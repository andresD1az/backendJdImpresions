import express from 'express'
import { query } from '../config/db.js'
import { requireAuth } from '../middleware/auth.js'
import { ensureRole } from '../middleware/roles.js'

const router = express.Router()

function parseRange(req) {
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7*24*60*60*1000)
  const to = req.query.to ? new Date(req.query.to) : new Date()
  return { from, to }
}

router.get('/kpis/overview', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { from, to } = parseRange(req)

    const stock = await query(`
      SELECT area, COALESCE(SUM(quantity),0) AS qty
        FROM inventory_stock
       GROUP BY area
    `)
    const stockMap = Object.fromEntries(stock.rows.map(r => [r.area, Number(r.qty)]))

    const sales = await query(`
      SELECT
        COALESCE(SUM(total),0) AS total,
        COUNT(*) AS count,
        COALESCE(SUM(si.quantity),0) AS items
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.occurred_at BETWEEN $1 AND $2
    `,[from, to])

    const returns = await query(`
      SELECT COALESCE(SUM(quantity),0) AS total, COUNT(*) AS count
        FROM returns
       WHERE occurred_at BETWEEN $1 AND $2
    `,[from, to])

    return res.json({
      stock_bodega_total: Number(stockMap['bodega']||0),
      stock_surtido_total: Number(stockMap['surtido']||0),
      ventas_total: Number(sales.rows[0].total||0),
      ventas_count: Number(sales.rows[0].count||0),
      ventas_items: Number(sales.rows[0].items||0),
      devoluciones_total: Number(returns.rows[0].total||0),
      devoluciones_count: Number(returns.rows[0].count||0),
      range: { from, to }
    })
  } catch (e) {
    return res.status(500).json({ error: 'kpis_overview_error' })
  }
})

// Move all existing stock from 'surtido' to 'bodega' (one-time admin helper)
router.post('/inventory/move-all-to-bodega', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    await query('BEGIN')
    try {
      // Upsert aggregated surtido quantities into bodega
      await query(`
        INSERT INTO inventory_stock (product_id, area, quantity)
        SELECT product_id, 'bodega' AS area, SUM(quantity) AS qty
          FROM inventory_stock
         WHERE area = 'surtido'
         GROUP BY product_id
        ON CONFLICT (product_id, area)
        DO UPDATE SET quantity = inventory_stock.quantity + EXCLUDED.quantity
      `)
      // Remove all surtido rows
      await query(`DELETE FROM inventory_stock WHERE area = 'surtido'`)
      await query('COMMIT')
    } catch (e) {
      await query('ROLLBACK')
      throw e
    }
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'move_all_to_bodega_error' })
  }
})

// Populate products from inventory_movements distinct SKUs (name defaults to SKU)
router.post('/products/populate-from-movements', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { rows: skusRows } = await query(`
      SELECT DISTINCT sku FROM (
        SELECT sku FROM products WHERE sku IS NOT NULL
        UNION ALL
        SELECT DISTINCT p2.sku
        FROM (
          SELECT im.product_id, p.sku
            FROM inventory_movements im
            JOIN products p ON p.id = im.product_id
        ) p2
      ) t WHERE sku IS NOT NULL`)

    // Also consider movements that may have provided sku directly (if your schema has it)
    const { rows: missingSkuRows } = await query(`
      SELECT DISTINCT m_sku AS sku
        FROM (
          SELECT NULL::text as m_sku LIMIT 0
        ) q -- placeholder if there is no separate sku column on movements
    `)

    const allSkus = new Set([...(skusRows||[]).map(r=>r.sku), ...(missingSkuRows||[]).map(r=>r.sku)].filter(Boolean))

    let created = 0
    for (const sku of allSkus) {
      const { rows: exists } = await query('SELECT 1 FROM products WHERE sku = $1', [sku])
      if (!exists.length) {
        await query('INSERT INTO products (sku, name) VALUES ($1,$2) ON CONFLICT (sku) DO NOTHING', [sku, sku])
        created++
      }
    }
    return res.json({ ok: true, created })
  } catch (e) {
    return res.status(500).json({ error: 'populate_products_error', message: e?.message || String(e) })
  }
})

// Rebuild inventory_stock from movements (idempotent)
router.post('/inventory/rebuild-stock', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { rows } = await query(`
      WITH last_ajuste AS (
        SELECT DISTINCT ON (product_id, area)
               product_id, area, created_at AS t, quantity AS qty
          FROM inventory_movements
         WHERE type = 'ajuste'
         ORDER BY product_id, area, created_at DESC
      ), pairs AS (
        SELECT DISTINCT m.product_id, m.area,
               la.t AS base_time,
               COALESCE(la.qty, 0) AS base_qty
          FROM inventory_movements m
          LEFT JOIN last_ajuste la
            ON la.product_id = m.product_id AND la.area = m.area
      ), calc AS (
        SELECT p.product_id, p.area,
               p.base_qty + COALESCE((
                 SELECT SUM(CASE WHEN type='ingreso' THEN quantity WHEN type='salida' THEN -quantity ELSE 0 END)
                   FROM inventory_movements im
                  WHERE im.product_id = p.product_id
                    AND im.area = p.area
                    AND (p.base_time IS NULL OR im.created_at > p.base_time)
               ),0) AS stock
          FROM pairs p
      )
      SELECT c.product_id, c.area, GREATEST(c.stock, 0) AS stock
        FROM calc c
    `)

    await query('BEGIN')
    try {
      for (const r of rows) {
        await query(
          `INSERT INTO inventory_stock (product_id, area, quantity)
           VALUES ($1,$2,$3)
           ON CONFLICT (product_id, area) DO UPDATE SET quantity = EXCLUDED.quantity`,
          [r.product_id, r.area, Number(r.stock) || 0]
        )
      }
      await query('COMMIT')
    } catch (e) {
      await query('ROLLBACK')
      throw e
    }

    return res.json({ ok: true, updated: rows.length })
  } catch (e) {
    return res.status(500).json({ error: 'rebuild_stock_error', message: e?.message || String(e) })
  }
})

// Products CRUD (manager only)
router.get('/products', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { q } = req.query
    // Ensure price_locked column exists
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price_locked BOOLEAN NOT NULL DEFAULT FALSE`)
    let sql = `
      SELECT p.id, p.sku, p.name, p.category, p.unit,
             p.purchase_price, p.margin_percent, p.discount_percent, p.sale_price_cop,
             p.price_locked,
             COALESCE(sb.qty,0) AS stock_bodega,
             COALESCE(ss.qty,0) AS stock_surtido,
             COALESCE(sb.qty,0) + COALESCE(ss.qty,0) AS stock_total,
             p.created_at, p.updated_at
        FROM products p
        LEFT JOIN (
          SELECT product_id, SUM(quantity) AS qty
            FROM inventory_stock WHERE area='bodega' GROUP BY product_id
        ) sb ON sb.product_id = p.id
        LEFT JOIN (
          SELECT product_id, SUM(quantity) AS qty
            FROM inventory_stock WHERE area='surtido' GROUP BY product_id
        ) ss ON ss.product_id = p.id
    `
    const params = []
    if (q) {
      sql += ' WHERE p.sku ILIKE $1 OR p.name ILIKE $1'
      params.push(`%${q}%`)
    }
    sql += ' ORDER BY created_at DESC LIMIT 200'
    const { rows } = await query(sql, params)
    return res.json({ products: rows })
  } catch (e) {
    return res.status(500).json({ error: 'list_products_error' })
  }
})

router.post('/products', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { sku, name, category, unit, purchase_price, margin_percent, discount_percent, sale_price_cop } = req.body || {}
    if (!sku || !name) return res.status(400).json({ error: 'missing_fields' })
    const pp = Number(purchase_price)||0
    const mp = Number(margin_percent)||0
    const dp = Number(discount_percent)||0
    let sp = sale_price_cop !== undefined ? Number(sale_price_cop)||0 : 0
    if (!sp) {
      const net = pp * (1 + mp/100) * (1 - dp/100)
      const base = 1000
      sp = Math.round(net / base) * base
    }
    const { rows } = await query(
      `INSERT INTO products (sku, name, category, unit, purchase_price, margin_percent, discount_percent, sale_price_cop)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (sku) DO UPDATE SET
          name=EXCLUDED.name,
          category=EXCLUDED.category,
          unit=EXCLUDED.unit,
          purchase_price=EXCLUDED.purchase_price,
          margin_percent=EXCLUDED.margin_percent,
          discount_percent=EXCLUDED.discount_percent,
          sale_price_cop=EXCLUDED.sale_price_cop,
          updated_at = NOW()
       RETURNING id, sku, name, category, unit, purchase_price, margin_percent, discount_percent, sale_price_cop`,
      [sku, name, category || null, unit || null,
       pp, mp, dp, sp]
    )
    return res.json({ ok: true, product: rows[0] })
  } catch (e) {
    return res.status(500).json({ error: 'create_product_error' })
  }
})

router.patch('/products/:id', requireAuth, ensureRole(['manager','bodega','surtido','descargue']), async (req, res) => {
  try {
    const { id } = req.params
    const { name, category, unit, purchase_price, margin_percent, discount_percent, sale_price_cop, price_change_reason } = req.body || {}

    // Read current price to detect change
    const cur = await query('SELECT sale_price_cop FROM products WHERE id = $1', [id])
    const oldPrice = Number(cur.rows?.[0]?.sale_price_cop ?? 0)
    const newPrice = sale_price_cop !== undefined ? Number(sale_price_cop) : undefined

    // Ensure price_locked column exists
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price_locked BOOLEAN NOT NULL DEFAULT FALSE`)
    const role = (req.user?.role || '').toLowerCase()
    // Check lock
    const lockRow = await query('SELECT price_locked FROM products WHERE id = $1', [id])
    const isLocked = !!lockRow.rows?.[0]?.price_locked
    if (isLocked && role !== 'manager' && sale_price_cop !== undefined && Number(sale_price_cop) !== oldPrice) {
      return res.status(403).json({ error: 'price_locked', message: 'Precio bloqueado: solo gerentes pueden modificarlo' })
    }
    if (role !== 'manager') {
      // Non-manager can ONLY change sale_price_cop and MUST provide reason
      if (sale_price_cop === undefined) return res.status(400).json({ error: 'forbidden_fields', message: 'Solo se permite actualizar sale_price_cop' })
      if (!price_change_reason || String(price_change_reason).trim().length === 0) return res.status(400).json({ error: 'price_reason_required', message: 'Debe indicar motivo del cambio de precio' })
      await query(
        `UPDATE products SET
           sale_price_cop = COALESCE($2, sale_price_cop),
           updated_at = NOW()
         WHERE id = $1`,
        [id, Number(sale_price_cop)]
      )
    } else {
      await query(
        `UPDATE products SET
           name = COALESCE($2, name),
           category = COALESCE($3, category),
           unit = COALESCE($4, unit),
           purchase_price = COALESCE($5, purchase_price),
           margin_percent = COALESCE($6, margin_percent),
           discount_percent = COALESCE($7, discount_percent),
           sale_price_cop = COALESCE($8, sale_price_cop),
           price_locked = COALESCE($9, price_locked),
           updated_at = NOW()
         WHERE id = $1`,
        [id,
         name || null,
         category || null,
         unit || null,
         purchase_price !== undefined ? Number(purchase_price) : null,
         margin_percent !== undefined ? Number(margin_percent) : null,
         discount_percent !== undefined ? Number(discount_percent) : null,
         sale_price_cop !== undefined ? Number(sale_price_cop) : null,
         req.body.price_locked !== undefined ? !!req.body.price_locked : null]
      )
    }

    // If price changed, record log
    if (newPrice !== undefined && newPrice !== oldPrice) {
      await query(`
        CREATE TABLE IF NOT EXISTS price_change_logs (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          old_price NUMERIC NOT NULL,
          new_price NUMERIC NOT NULL,
          reason TEXT,
          user_id INTEGER,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )`)
      await query(`INSERT INTO price_change_logs (product_id, old_price, new_price, reason, user_id)
                   VALUES ($1,$2,$3,$4,$5)`, [id, oldPrice, newPrice, price_change_reason || null, req.user?.id || null])
    }
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'update_product_error' })
  }
})

// Price history for a product (manager only)
router.get('/products/:id/price-history', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params
    await query(`
      CREATE TABLE IF NOT EXISTS price_change_logs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        old_price NUMERIC NOT NULL,
        new_price NUMERIC NOT NULL,
        reason TEXT,
        user_id INTEGER,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      )`)
    const { rows } = await query(`
      SELECT id, old_price, new_price, reason, user_id, created_at
        FROM price_change_logs
       WHERE product_id = $1
       ORDER BY created_at DESC
       LIMIT 100
    `, [id])
    return res.json({ history: rows })
  } catch (e) {
    return res.status(500).json({ error: 'price_history_error' })
  }
})

router.delete('/products/:id', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params
    await query('DELETE FROM products WHERE id = $1', [id])
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'delete_product_error' })
  }
})

// Stock by area
router.get('/inventory/stock', requireAuth, ensureRole(['manager','bodega','surtido']), async (req, res) => {
  try {
    const { area, q } = req.query
    if (area && !['bodega','surtido'].includes(area)) return res.status(400).json({ error: 'invalid_area' })
    // Ensure schema: price_locked column may be used in this SELECT
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price_locked BOOLEAN NOT NULL DEFAULT FALSE`)
    const params = []
    let sql = `SELECT p.id, p.sku, p.name, s.area, s.quantity,
                      p.purchase_price, p.margin_percent, p.discount_percent, p.sale_price_cop, p.price_locked
                 FROM inventory_stock s
                 JOIN products p ON p.id = s.product_id`
    const clauses = []
    if (area) { clauses.push('s.area = $' + (params.length+1)); params.push(area) }
    if (q) { clauses.push('(p.sku ILIKE $' + (params.length+1) + ' OR p.name ILIKE $' + (params.length+1) + ')'); params.push('%'+q+'%') }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ')
    sql += ' ORDER BY p.name ASC LIMIT 500'
    const { rows } = await query(sql, params)
    return res.json({ stock: rows })
  } catch (e) {
    return res.status(500).json({ error: 'list_stock_error' })
  }
})
// Create a single inventory movement and update stock
router.post('/inventory/movement', requireAuth, ensureRole(['manager','bodega','surtido','descargue']), async (req, res) => {
  try {
    const { sku, area, type, quantity, reason } = req.body || {}
    if (!sku || !area || !type || !quantity) return res.status(400).json({ error: 'missing_fields' })
    if (!['bodega','surtido'].includes(area)) return res.status(400).json({ error: 'invalid_area' })
    if (!['ingreso','salida','ajuste'].includes(type)) return res.status(400).json({ error: 'invalid_type' })
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'invalid_quantity' })

    // Policy: los ingresos a surtido deben hacerse vía transfer desde bodega
    if (area === 'surtido' && type === 'ingreso') {
      return res.status(400).json({ error: 'ingreso_to_surtido_forbidden', message: 'Use /inventory/transfer para ingresar a surtido desde bodega' })
    }

    // Resolve product
    const { rows: prod } = await query('SELECT id FROM products WHERE sku = $1', [sku])
    if (!prod.length) return res.status(404).json({ error: 'product_not_found' })
    const pid = prod[0].id

    // Current stock
    const { rows: stockRows } = await query('SELECT quantity FROM inventory_stock WHERE product_id = $1 AND area = $2', [pid, area])
    let current = Number(stockRows[0]?.quantity || 0)
    let next = current
    if (type === 'ingreso') next = current + qty
    else if (type === 'salida') next = current - qty
    else if (type === 'ajuste') next = qty // interpret as set to exact qty
    if (next < 0) return res.status(400).json({ error: 'stock_negative' })

    await query('INSERT INTO inventory_movements (product_id, area, type, quantity, reason, user_id) VALUES ($1,$2,$3,$4,$5,$6)', [pid, area, type, qty, reason || null, req.user?.id || null])
    await query(
      `INSERT INTO inventory_stock (product_id, area, quantity)
       VALUES ($1,$2,$3)
       ON CONFLICT (product_id, area) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [pid, area, next]
    )
    return res.json({ ok: true, stock: next })
  } catch (e) {
    return res.status(500).json({ error: 'movement_error' })
  }
})

// Transfer stock between areas by creating two movements
router.post('/inventory/transfer', requireAuth, ensureRole(['manager','bodega','surtido']), async (req, res) => {
  try {
    const { sku, fromArea, toArea, quantity, reason } = req.body || {}
    if (!sku || !fromArea || !toArea || !quantity) return res.status(400).json({ error: 'missing_fields' })
    if (fromArea === toArea) return res.status(400).json({ error: 'same_area' })
    if (!['bodega','surtido'].includes(fromArea) || !['bodega','surtido'].includes(toArea)) return res.status(400).json({ error: 'invalid_area' })
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'invalid_quantity' })

    const { rows: prod } = await query('SELECT id FROM products WHERE sku = $1', [sku])
    if (!prod.length) return res.status(404).json({ error: 'product_not_found' })
    const pid = prod[0].id

    // Check stock in fromArea
    const { rows: fromStockRows } = await query('SELECT quantity FROM inventory_stock WHERE product_id = $1 AND area = $2', [pid, fromArea])
    const fromCurrent = Number(fromStockRows[0]?.quantity || 0)
    if (fromCurrent - qty < 0) return res.status(400).json({ error: 'insufficient_stock' })

    // Perform movements
    await query('BEGIN')
    try {
      await query('INSERT INTO inventory_movements (product_id, area, type, quantity, reason, user_id) VALUES ($1,$2,$3,$4,$5,$6)', [pid, fromArea, 'salida', qty, reason || 'transfer', req.user?.id || null])
      await query('INSERT INTO inventory_movements (product_id, area, type, quantity, reason, user_id) VALUES ($1,$2,$3,$4,$5,$6)', [pid, toArea, 'ingreso', qty, reason || 'transfer', req.user?.id || null])
      // Update stocks
      await query(`INSERT INTO inventory_stock (product_id, area, quantity) VALUES ($1,$2,$3) ON CONFLICT (product_id, area) DO UPDATE SET quantity = inventory_stock.quantity - EXCLUDED.quantity`, [pid, fromArea, qty])
      await query(`INSERT INTO inventory_stock (product_id, area, quantity) VALUES ($1,$2,$3) ON CONFLICT (product_id, area) DO UPDATE SET quantity = inventory_stock.quantity + EXCLUDED.quantity`, [pid, toArea, qty])
      await query('COMMIT')
    } catch (txe) {
      await query('ROLLBACK')
      throw txe
    }
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'transfer_error' })
  }
})

router.get('/sales/timeseries', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { from, to } = parseRange(req)
    const { rows } = await query(`
      SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS day,
             COALESCE(SUM(total),0) AS total
        FROM sales
       WHERE occurred_at BETWEEN $1 AND $2
       GROUP BY 1
       ORDER BY 1
    `,[from, to])
    return res.json({ series: rows })
  } catch {
    return res.status(500).json({ error: 'sales_ts_error' })
  }
})

router.get('/returns/timeseries', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { from, to } = parseRange(req)
    const { rows } = await query(`
      SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS day,
             COALESCE(SUM(quantity),0) AS qty
        FROM returns
       WHERE occurred_at BETWEEN $1 AND $2
       GROUP BY 1
       ORDER BY 1
    `,[from, to])
    return res.json({ series: rows })
  } catch {
    return res.status(500).json({ error: 'returns_ts_error' })
  }
})

router.get('/inventory/summary', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const low = await query(`
      SELECT p.id, p.name, s.area, s.quantity
        FROM inventory_stock s
        JOIN products p ON p.id = s.product_id
       WHERE s.quantity <= 5
       ORDER BY s.quantity ASC
       LIMIT 20
    `)
    const lastMovs = await query(`
      SELECT m.created_at, p.name, m.area, m.type, m.quantity, m.reason
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
       ORDER BY m.created_at DESC
       LIMIT 20
    `)
    return res.json({ low_stock: low.rows, last_movements: lastMovs.rows })
  } catch (e) {
    return res.status(500).json({ error: 'inventory_summary_error' })
  }
})

export default router

// Bulk import for initial data load (products, stock, movements)
router.post('/import', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { products = [], inventory_stock = [], inventory_movements = [] } = req.body || {}
    // Upsert products by sku
    for (const p of products) {
      await query(
        `INSERT INTO products (sku, name, category, unit)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, unit = EXCLUDED.unit, updated_at = NOW()`,
        [p.sku || null, p.name, p.category || null, p.unit || null]
      )
    }

    // Map sku -> id
    const { rows: prodRows } = await query('SELECT id, sku FROM products WHERE sku IS NOT NULL')
    const idBySku = new Map(prodRows.map(r => [r.sku, r.id]))

    // Set inventory stock per area (overwrite to provided quantity)
    for (const s of inventory_stock) {
      const pid = idBySku.get(s.sku)
      if (!pid) continue
      await query(
        `INSERT INTO inventory_stock (product_id, area, quantity)
         VALUES ($1,$2,$3)
         ON CONFLICT (product_id, area) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [pid, s.area, Number(s.quantity) || 0]
      )
    }

    // Insert movements for history (does not change stock here)
    for (const m of inventory_movements) {
      const pid = idBySku.get(m.sku)
      if (!pid) continue
      await query(
        `INSERT INTO inventory_movements (product_id, area, type, quantity, reason, user_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, NOW()))`,
        [pid, m.area, m.type, Number(m.quantity)||0, m.reason || null, req.user?.id || null, m.created_at || null]
      )
    }

    return res.json({ ok: true, products: products.length, stock: inventory_stock.length, movements: inventory_movements.length })
  } catch (e) {
    return res.status(500).json({ error: 'import_error', message: e?.message || String(e) })
  }
})
