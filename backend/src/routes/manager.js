import express from 'express'
import path from 'path'
import fs from 'fs'
import { query } from '../config/db.js'
import { requireAuth } from '../middleware/auth.js'
import { ensureRole } from '../middleware/roles.js'
import { requirePerm } from '../middleware/permissions.js'

const router = express.Router()

// Helpers: slugify and ensure uniqueness
const slugify = (txt) => String(txt||'')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g,'')
  .toLowerCase()

async function uniqueSlug(base, excludeId=null) {
  let s = slugify(base)
  if (!s) s = Math.random().toString(36).slice(2,8)
  let attempt = s
  let i = 1
  // Ensure column exists
  try { await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT`) } catch {}
  // Loop until unique
  // Exclude current product id when updating
  // Use ILIKE to avoid case collisions
  while (true) {
    const params = [attempt]
    let sql = 'SELECT id FROM products WHERE slug = $1'
    if (excludeId) { params.push(excludeId); sql += ' AND id <> $2' }
    const { rows } = await query(sql, params)
    if (!rows.length) return attempt
    attempt = `${s}-${i++}`
  }
}

// Generate a unique, human-friendly SKU when not provided
// Example: "Paiz 2mm" -> "PAIZ2MM"
const skuify = (txt) => String(txt||'')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '') // keep only letters and numbers
  .toUpperCase()

async function uniqueSku(base) {
  let s = skuify(base).slice(0,16) || 'PRD'
  let attempt = s
  let i = 1
  while (true) {
    const { rows } = await query('SELECT id FROM products WHERE sku = $1', [attempt])
    if (!rows.length) return attempt
    attempt = `${s}${(++i).toString().padStart(2,'0')}`.slice(0,24)
  }
}

// Generate next numeric SKU like 001, 002, ... 999, 1000, etc.
async function nextNumericSku() {
  // Consider SKUs that are entirely numeric
  const { rows } = await query(`
    SELECT MAX(CAST(sku AS INTEGER)) AS max_n
      FROM products
     WHERE sku ~ '^[0-9]+$'
  `)
  const maxN = Number(rows?.[0]?.max_n || 0)
  const next = maxN + 1
  // Pad to 3 digits for small numbers
  return next < 1000 ? String(next).padStart(3, '0') : String(next)
}

// === File uploads (images) ===
const uploadDir = path.resolve(process.cwd(), 'uploads')
try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }) } catch {}
let _uploader = null
async function getUploader() {
  if (_uploader) return _uploader
  try {
    const mod = await import('multer')
    const multer = mod.default || mod
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase()
        const base = path.basename(file.originalname || 'file', ext).replace(/[^a-zA-Z0-9_-]+/g,'-')
        const stamp = Date.now()
        cb(null, `${base}-${stamp}${ext||'.bin'}`)
      }
    })
    _uploader = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } })
    return _uploader
  } catch (e) {
    throw new Error('multer_not_installed')
  }
}

// Serve uploaded files
router.get('/uploads/:filename', async (req, res) => {
  const fp = path.join(uploadDir, path.basename(req.params.filename||''))
  if (!fs.existsSync(fp)) return res.status(404).end()
  return res.sendFile(fp)
})

// List invoices (manager)
router.get('/invoices', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER UNIQUE NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )`)
    const { q, page = 1, pageSize = 25 } = req.query || {}
    const pageN = Math.max(1, Number(page)||1)
    const sizeN = Math.min(100, Math.max(1, Number(pageSize)||25))
    const offset = (pageN - 1) * sizeN
    const params = []
    const where = []
    if (q) { params.push(`%${q}%`); where.push(`(CAST(s.id AS TEXT) ILIKE $${params.length} OR u.email ILIKE $${params.length})`) }
    const sql = `
      SELECT s.id AS sale_id, s.occurred_at, s.total, s.status, u.email AS customer_email,
             i.path, i.created_at AS invoice_created_at
        FROM sales s
        LEFT JOIN users u ON u.id = s.user_id
        LEFT JOIN invoices i ON i.sale_id = s.id
       ${where.length? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.occurred_at DESC
       LIMIT ${sizeN} OFFSET ${offset}
    `
    const { rows } = await query(sql, params)
    return res.json({ invoices: rows, page: pageN, pageSize: sizeN })
  } catch (e) {
    return res.status(500).json({ error: 'list_invoices_error' })
  }
})

// ===== Returns management (manager) =====
router.get('/returns', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS return_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      items JSONB,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      accepted_policy BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now(),
      decided_at TIMESTAMPTZ,
      decided_by INTEGER
    )`)
    const { status } = req.query || {}
    const params = []
    let where = ''
    if (status) { params.push(String(status)); where = 'WHERE r.status = $1' }
    const { rows } = await query(`
      SELECT r.id, r.sale_id, r.user_id, r.items, r.reason, r.status, r.created_at, r.decided_at, r.decided_by,
             s.total, s.status AS sale_status, u.email AS customer_email
        FROM return_requests r
        LEFT JOIN sales s ON s.id = r.sale_id
        LEFT JOIN users u ON u.id = r.user_id
        ${where}
        ORDER BY r.created_at DESC
        LIMIT 200
    `, params)
    return res.json({ returns: rows })
  } catch (e) {
    return res.status(500).json({ error: 'list_returns_error' })
  }
})

router.patch('/returns/:id', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params
    const { status, items } = req.body || {}
    const st = String(status||'').toLowerCase()
    if (!['approved','rejected'].includes(st)) return res.status(400).json({ error: 'invalid_status' })

    // Load request
    const { rows } = await query('SELECT id, sale_id, items, status FROM return_requests WHERE id = $1', [id])
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    const reqRow = rows[0]
    if (reqRow.status !== 'pending') return res.status(409).json({ error: 'already_decided' })

    // If approving, adjust stock to bodega
    if (st === 'approved') {
      const payload = Array.isArray(items) && items.length ? items : (Array.isArray(reqRow.items) ? reqRow.items : [])
      if (!payload.length) return res.status(400).json({ error: 'missing_items_for_approval' })
      await query('BEGIN')
      try {
        // Map sku to product_id
        const skus = [...new Set(payload.map(i => String(i.sku||'').trim()).filter(Boolean))]
        const { rows: prods } = await query('SELECT id, sku FROM products WHERE sku = ANY($1)', [skus])
        const idBySku = new Map(prods.map(r => [r.sku, r.id]))
        for (const it of payload) {
          const pid = idBySku.get(String(it.sku))
          const qty = Math.max(0, Number(it.quantity)||0)
          if (!pid || !qty) continue
          await query(
            `INSERT INTO inventory_stock (product_id, area, quantity)
             VALUES ($1,'bodega',$2)
             ON CONFLICT (product_id, area) DO UPDATE SET quantity = inventory_stock.quantity + EXCLUDED.quantity`,
            [pid, qty]
          )
        }
        await query('UPDATE return_requests SET status = $2, decided_at = NOW(), decided_by = $3 WHERE id = $1', [id, 'approved', req.user?.id||null])
        await query('COMMIT')
      } catch (e) {
        await query('ROLLBACK')
        throw e
      }
    } else {
      await query('UPDATE return_requests SET status = $2, decided_at = NOW(), decided_by = $3 WHERE id = $1', [id, 'rejected', req.user?.id||null])
    }
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'update_return_error' })
  }
})

// Unified activity (inventory movements + price change logs) for a product
router.get('/products/:id/activity', requireAuth, ensureRole(['manager','bodega','surtido','descargue']), async (req, res) => {
  try {
    const { id } = req.params
    // Ensure tables
    await query(`CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      product_id UUID NOT NULL,
      area TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      reason TEXT,
      user_id INTEGER,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )`)
    await query(`CREATE TABLE IF NOT EXISTS price_change_logs (
      id SERIAL PRIMARY KEY,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      old_price NUMERIC NOT NULL,
      new_price NUMERIC NOT NULL,
      reason TEXT,
      user_id INTEGER,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )`)
    const { rows } = await query(`
      SELECT id, 'inventory' AS kind, created_at, area, type, quantity, reason, user_id, NULL::NUMERIC AS old_price, NULL::NUMERIC AS new_price
        FROM inventory_movements
       WHERE product_id::text = $1
      UNION ALL
      SELECT id, 'price' AS kind, created_at, NULL, NULL, NULL, reason, user_id, old_price, new_price
        FROM price_change_logs
       WHERE product_id::text = $1
       ORDER BY created_at DESC
       LIMIT 200
    `, [id])
    return res.json({ activity: rows })
  } catch (e) {
    return res.status(500).json({ error: 'activity_error', message: e?.message })
  }
})

// Upload endpoint (manager only)
router.post('/uploads', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const uploader = await getUploader() // may throw if not installed
    uploader.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'upload_middleware_error', message: String(err.message||err) })
      if (!req.file) return res.status(400).json({ error: 'no_file' })
      const filename = req.file.filename
      // return relative path to be robust behind proxies
      const url = `/manager/uploads/${encodeURIComponent(filename)}`
      return res.json({ ok: true, url, filename })
    })
  } catch (e) {
    if (String(e.message) === 'multer_not_installed') return res.status(500).json({ error: 'multer_missing', message: 'Instala la dependencia multer en el backend' })
    return res.status(500).json({ error: 'upload_error' })
  }
})

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

// Bulk actions on products
router.post('/products/bulk', requireAuth, ensureRole(['manager','bodega','surtido','descargue']), async (req, res) => {
  const { action, ids, discount_percent } = req.body || {}
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'missing_ids' })
  const role = (req.user?.role || '').toLowerCase()
  const perms = req.user?.perms || []
  const has = (p)=>perms.includes(p)
  const wantsPrice = action === 'discount'
  if (wantsPrice && !(role==='manager' || has('price:edit'))) return res.status(403).json({ error: 'forbidden_price' })
  if (!wantsPrice && !(role==='manager' || has('product:edit'))) return res.status(403).json({ error: 'forbidden_product' })
  const results = []
  for (const id of ids) {
    try {
      if (action === 'delete') {
        await query('DELETE FROM products WHERE id = $1', [id])
      } else if (action === 'trash') {
        await query('UPDATE products SET status = $2, updated_at = NOW() WHERE id = $1', [id, 'trash'])
      } else if (action === 'publish') {
        await query('UPDATE products SET status = $2, published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE id = $1', [id, 'published'])
      } else if (action === 'draft') {
        await query('UPDATE products SET status = $2, updated_at = NOW() WHERE id = $1', [id, 'draft'])
      } else if (action === 'discount') {
        const v = Number(discount_percent)
        if (!Number.isFinite(v) || v < 0) throw new Error('invalid_discount')
        // Update discount
        await query('UPDATE products SET discount_percent = $2, updated_at = NOW() WHERE id = $1', [id, v])
        // If manager, also recompute sale price based on cost params
        if (role === 'manager') {
          const cur = await query('SELECT purchase_price, margin_percent, discount_percent FROM products WHERE id = $1', [id])
          const pp = Number(cur.rows?.[0]?.purchase_price || 0)
          const mp = Number(cur.rows?.[0]?.margin_percent || 0)
          const dp = Number(cur.rows?.[0]?.discount_percent || 0)
          const net = pp * (1 + mp/100) * (1 - dp/100)
          const base = 1000
          const sp = Math.round(net / base) * base
          await query('UPDATE products SET sale_price_cop = $2, updated_at = NOW() WHERE id = $1', [id, sp])
        }
      } else {
        throw new Error('unknown_action')
      }
      results.push({ id, ok: true })
    } catch (e) {
      results.push({ id, ok: false, error: e?.message || 'error' })
    }
  }
  return res.json({ ok: true, results })
})

// Migration: add new columns for Woo-style products and backfill slugs
router.post('/products/migrate-slugs', requireAuth, ensureRole(['manager']), requirePerm('product:edit'), async (req, res) => {
  try {
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS published_at TIMESTAMP NULL`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS faq JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'catalog'`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tags JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS seo JSONB`)
    // Backfill slug for rows where it is null
    await query(`
      UPDATE products p SET slug = COALESCE(slug,
        LOWER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(p.name),''), p.sku), '[^a-zA-Z0-9]+', '-', 'g'))
      )
      WHERE p.slug IS NULL
    `)
    // Make slugs more unique by appending sku for duplicates
    await query(`
      WITH dups AS (
        SELECT slug FROM products WHERE slug IS NOT NULL GROUP BY slug HAVING COUNT(*) > 1
      )
      UPDATE products p
         SET slug = LOWER(CONCAT(p.slug, '-', REGEXP_REPLACE(p.sku, '[^a-zA-Z0-9]+','-','g')))
        FROM dups
       WHERE p.slug = dups.slug
    `)
    const pr = await query('SELECT id, sku, slug FROM products WHERE CAST(id AS TEXT) = $1', [id])
    return res.json({ ok: true, product: pr.rows?.[0] || { id, sku: undefined, slug: finalSlug } })
  } catch (e) {
    return res.status(500).json({ error: 'migrate_slugs_error' })
  }
})

// Get single product with full fields for editor
router.get('/products/:id', requireAuth, ensureRole(['manager']), async (req, res) => {
  const { id } = req.params
  try {
    // Ensure inventory tables used in the SELECT exist
    await query(`CREATE TABLE IF NOT EXISTS inventory_stock (
      product_id UUID NOT NULL,
      area TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      PRIMARY KEY (product_id, area)
    )`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS published_at TIMESTAMP NULL`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS faq JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS faq JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'catalog'`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tags JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS seo JSONB`)
    const { rows } = await query(`
      WITH st AS (
        SELECT product_id,
               SUM(CASE WHEN area='bodega' THEN quantity ELSE 0 END) AS stock_bodega,
               SUM(CASE WHEN area='surtido' THEN quantity ELSE 0 END) AS stock_surtido
          FROM inventory_stock
         GROUP BY product_id
      )
      SELECT p.id, p.sku, p.name, p.category, p.unit, p.purchase_price, p.margin_percent, p.discount_percent, p.sale_price_cop,
             p.description, p.short_description, p.image_url, p.image_urls, p.attributes, p.status, p.slug, p.published_at,
             p.visibility, p.barcode, p.tags, p.seo, p.faq, p.reviews,
             COALESCE(st.stock_bodega,0) AS stock_bodega,
             COALESCE(st.stock_surtido,0) AS stock_surtido,
             COALESCE(st.stock_bodega,0) + COALESCE(st.stock_surtido,0) AS stock_total
        FROM products p
        LEFT JOIN st ON st.product_id = p.id
       WHERE CAST(p.id AS TEXT) = $1
    `, [id])
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    const r = rows[0]
    return res.json({ product: {
      ...r,
      image_urls: Array.isArray(r.image_urls) ? r.image_urls : [],
      attributes: r.attributes || null,
      faq: Array.isArray(r.faq) ? r.faq : null,
      reviews: Array.isArray(r.reviews) ? r.reviews : null,
      stock_bodega: Number(r.stock_bodega||0),
      stock_surtido: Number(r.stock_surtido||0),
      stock_total: Number(r.stock_total||0),
    } })
  } catch (e) {
    return res.status(500).json({ error: 'get_product_error', message: e?.message })
  }
})
  } catch (e) {
    return res.status(500).json({ error: 'kpis_overview_error' })
  }
})

// Delete user: only if the user has no sales. Otherwise, return 409.
router.delete('/users/:id', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await query('SELECT COUNT(*) AS c FROM sales WHERE user_id = $1', [id])
    const cnt = Number(rows?.[0]?.c || 0)
    if (cnt > 0) return res.status(409).json({ error: 'cannot_delete_has_sales', count: cnt })
    await query('DELETE FROM users WHERE id = $1', [id])
    const pr = await query('SELECT id, sku, slug FROM products WHERE CAST(id AS TEXT) = $1', [id])
    return res.json({ ok: true, product: pr.rows?.[0] || { id, sku: undefined, slug: finalSlug } })
  } catch (e) {
    return res.status(500).json({ error: 'delete_user_error' })
  }
})

router.get('/users', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { q, estado, role, page = 1, pageSize = 25 } = req.query || {}
    const params = []
    const where = []
    if (q) { params.push(`%${q}%`); where.push(`(u.email ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`) }
    if (estado) { params.push(String(estado)); where.push(`u.status = $${params.length}`) }
    if (role) { params.push(String(role)); where.push(`u.role = $${params.length}`) }
    const pageN = Math.max(1, Number(page)||1)
    const sizeN = Math.min(100, Math.max(1, Number(pageSize)||25))
    const offset = (pageN - 1) * sizeN
    const sql = `
      SELECT u.id, u.email, u.full_name, u.role, u.is_email_verified,
             u.status AS estado_usuario, u.created_at, u.updated_at,
             COALESCE(COUNT(s.id),0) AS purchase_count
        FROM users u
        LEFT JOIN sales s ON s.user_id = u.id
       ${where.length? 'WHERE ' + where.join(' AND ') : ''}
       GROUP BY u.id, u.email, u.full_name, u.role, u.is_email_verified, u.status, u.created_at, u.updated_at
       ORDER BY u.created_at DESC
       LIMIT ${sizeN} OFFSET ${offset}
    `
    const { rows } = await query(sql, params)
    return res.json({ users: rows, page: pageN, pageSize: sizeN })
  } catch (e) {
    return res.status(500).json({ error: 'list_users_error' })
  }
})

router.patch('/users/:id', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params
    const { full_name, role, estado_usuario } = req.body || {}
    const fields = []
    const params = []
    if (full_name !== undefined) { params.push(full_name || null); fields.push(`full_name = $${params.length}`) }
    if (role !== undefined) { params.push(role || null); fields.push(`role = $${params.length}`) }
    if (estado_usuario !== undefined) { params.push(String(estado_usuario)); fields.push(`status = $${params.length}`) }
    if (!fields.length) return res.json({ ok: true })
    params.push(id)
    await query(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params)
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'update_user_error' })
  }
})

// List sales (manager)
router.get('/sales', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending'`)
    const { status, q, page = 1, pageSize = 25 } = req.query || {}
    const params = []
    const where = []
    if (status) { params.push(status); where.push(`s.fulfillment_status = $${params.length}`) }
    if (q) { params.push(`%${q}%`); where.push(`(u.email ILIKE $${params.length} OR CAST(s.id AS TEXT) ILIKE $${params.length})`) }
    const pageN = Math.max(1, Number(page)||1)
    const sizeN = Math.min(100, Math.max(1, Number(pageSize)||25))
    const offset = (pageN - 1) * sizeN
    const sql = `
      SELECT s.id, s.occurred_at, s.total, s.status, s.fulfillment_status, s.payment_ref,
             u.email AS customer_email
        FROM sales s
        LEFT JOIN users u ON u.id = s.user_id
       ${where.length? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.occurred_at DESC
       LIMIT ${sizeN} OFFSET ${offset}
    `
    const { rows } = await query(sql, params)
    return res.json({ sales: rows, page: pageN, pageSize: sizeN })
  } catch (e) {
    return res.status(500).json({ error: 'list_sales_error' })
  }
})

// Get sale detail (manager)
router.get('/sales/:id', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params
    const { rows: hdr } = await query(`
      SELECT s.id, s.occurred_at, s.total, s.status, s.fulfillment_status, s.payment_ref,
             u.email AS customer_email
        FROM sales s
        LEFT JOIN users u ON u.id = s.user_id
       WHERE s.id = $1
       LIMIT 1
    `, [id])
    if (!hdr.length) return res.status(404).json({ error: 'not_found' })
    const { rows: its } = await query(`
      SELECT si.id, si.quantity, si.unit_price, si.line_total, p.sku, p.name
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1
       ORDER BY si.id
    `, [id])
    return res.json({ sale: hdr[0], items: its })
  } catch (e) {
    return res.status(500).json({ error: 'sale_detail_error' })
  }
})

// Update fulfillment status (manager)
router.patch('/sales/:id/status', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending'`)
    const { id } = req.params
    const { status } = req.body || {}
    const allowed = new Set(['pending','pagando','enviado','recibido'])
    const st = String(status||'').toLowerCase()
    if (!allowed.has(st)) return res.status(400).json({ error: 'invalid_status' })
    await query('UPDATE sales SET fulfillment_status = $2 WHERE id = $1', [id, st])
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'update_status_error' })
  }
})

// Demo seed: create example products and stock for local testing
router.post('/seed/demo', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const products = [
      { sku: 'A001', name: 'Cuaderno Argollado', category: 'Papelería', unit: 'unidad' },
      { sku: 'B002', name: 'Lápiz HB', category: 'Escritura', unit: 'unidad' },
      { sku: 'C003', name: 'Resaltador Amarillo', category: 'Marcadores', unit: 'unidad' },
      { sku: 'D004', name: 'Borrador Blanco', category: 'Accesorios', unit: 'unidad' },
      { sku: 'E005', name: 'Regla 30cm', category: 'Accesorios', unit: 'unidad' }
    ]
    const stock = [
      { sku: 'A001', area: 'bodega', quantity: 50 },
      { sku: 'A001', area: 'surtido', quantity: 10 },
      { sku: 'B002', area: 'bodega', quantity: 100 },
      { sku: 'C003', area: 'bodega', quantity: 40 },
      { sku: 'D004', area: 'bodega', quantity: 60 },
      { sku: 'E005', area: 'bodega', quantity: 30 }
    ]

    // Upsert products (basic fields); leave prices en 0 para que el manager los edite
    for (const p of products) {
      await query(
        `INSERT INTO products (sku, name, category, unit)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, unit = EXCLUDED.unit, updated_at = NOW()`,
        [p.sku || null, p.name, p.category || null, p.unit || null]
      )
    }
    // Map sku->id
    const { rows: prs } = await query('SELECT id, sku FROM products WHERE sku IS NOT NULL')
    const idBySku = new Map(prs.map(r => [r.sku, r.id]))
    // Write stock
    for (const s of stock) {
      const pid = idBySku.get(s.sku)
      if (!pid) continue
      await query(
        `INSERT INTO inventory_stock (product_id, area, quantity)
         VALUES ($1,$2,$3)
         ON CONFLICT (product_id, area) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [pid, s.area, Number(s.quantity) || 0]
      )
    }
    return res.json({ ok: true, products: products.length, stock: stock.length })
  } catch (e) {
    return res.status(500).json({ error: 'seed_demo_error', message: e?.message || String(e) })
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
    // Ensure columns exist
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price_locked BOOLEAN NOT NULL DEFAULT FALSE`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT`)
    let sql = `
      SELECT p.id, p.sku, p.name, p.category, p.unit,
             p.purchase_price, p.margin_percent, p.discount_percent, p.sale_price_cop,
             p.price_locked,
             p.description,
             p.image_url,
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
    const { sku, name, category, unit, purchase_price, margin_percent, discount_percent, sale_price_cop, description, image_url, image_urls, attributes, status, slug, published_at, visibility, short_description, barcode, tags, seo } = req.body || {}
    if (!name) return res.status(400).json({ error: 'missing_fields' })
    try {
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS published_at TIMESTAMP NULL`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'catalog'`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS tags JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS seo JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT`)
      await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'products_sku_uk') THEN
         CREATE UNIQUE INDEX products_sku_uk ON products(sku);
       END IF; END $$;`)
    } catch {}
    const pp = Number(purchase_price)||0
    const mp = Number(margin_percent)||0
    const dp = Number(discount_percent)||0
    let sp = sale_price_cop !== undefined ? Number(sale_price_cop)||0 : 0
    if (!sp) {
      const net = pp * (1 + mp/100) * (1 - dp/100)
      const base = 1000
      sp = Math.round(net / base) * base
    }
    // Compute slug when not provided
    let finalSlug = (slug || '').trim()
    if (!finalSlug) {
      const base = slugify(name) || slugify(sku)
      finalSlug = await uniqueSlug(base)
    } else {
      finalSlug = await uniqueSlug(finalSlug)
    }

    // Compute SKU if missing -> numeric sequence (001, 002, ...)
    const finalSku = sku && String(sku).trim()
      ? String(sku).trim().toUpperCase()
      : await nextNumericSku()

    // Try insert, retry on SKU conflict by suffixing
    let attempts = 0
    let productRow = null
    let skuTry = finalSku
    while (attempts < 5) {
      try {
        const { rows } = await query(
          `INSERT INTO products (sku, name, category, unit, purchase_price, margin_percent, discount_percent, sale_price_cop, description, image_url, image_urls, attributes, status, slug, published_at, visibility, short_description, barcode, tags, seo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, COALESCE($13,'draft'), $14, $15, COALESCE($16,'catalog'), $17, $18, $19, $20)
           RETURNING id, sku, slug, name, category, unit, purchase_price, margin_percent, discount_percent, sale_price_cop, description, image_url`,
          [skuTry, name, category || null, unit || null,
           pp, mp, dp, sp, description || null, image_url || null,
           Array.isArray(image_urls) ? JSON.stringify(image_urls) : null,
           attributes ? JSON.stringify(attributes) : null,
           status || 'draft', finalSlug || null, published_at || null,
           visibility || 'catalog', short_description || null, barcode || null,
           Array.isArray(tags) ? JSON.stringify(tags) : null,
           seo ? JSON.stringify(seo) : null]
        )
        productRow = rows[0]
        break
      } catch (e) {
        // 23505 unique_violation
        if (e?.code === '23505') {
          attempts++
          skuTry = await uniqueSku(`${finalSku}-${attempts}`)
          continue
        }
        throw e
      }
    }
    if (!productRow) return res.status(500).json({ error: 'create_product_retry_failed' })
    return res.json({ ok: true, product: productRow })
  } catch (e) {
    return res.status(500).json({ error: 'create_product_error', code: e?.code, message: e?.message, detail: e?.detail })
  }
})

router.patch('/products/:id', requireAuth, ensureRole(['manager','bodega','surtido','descargue']), async (req, res) => {
  try {
    const { id } = req.params
    const { name, category, unit, purchase_price, margin_percent, discount_percent, sale_price_cop, price_change_reason, description, image_url, image_urls, attributes, status, slug, published_at, visibility, short_description, barcode, tags, seo, sku } = req.body || {}
    // Initialize role and permissions early to avoid temporal dead zone when referenced below
    const role = (req.user?.role || '').toLowerCase()
    const perms = req.user?.perms || []
    const has = (p)=>perms.includes(p)

    // Read current price and cost params to detect change and compute auto sale price
    const cur = await query('SELECT purchase_price, margin_percent, discount_percent, sale_price_cop FROM products WHERE CAST(id AS TEXT) = $1', [id])
    const oldPrice = Number(cur.rows?.[0]?.sale_price_cop ?? 0)
    const newPrice = sale_price_cop !== undefined ? Number(sale_price_cop) : undefined
    let finalSalePrice = newPrice
    // Auto-compute sale price for manager if editing cost params without providing sale_price_cop
    if (finalSalePrice === undefined) {
      const ppCur = Number(cur.rows?.[0]?.purchase_price ?? 0)
      const mpCur = Number(cur.rows?.[0]?.margin_percent ?? 0)
      const dpCur = Number(cur.rows?.[0]?.discount_percent ?? 0)
      const ppN = purchase_price !== undefined ? Number(purchase_price) : ppCur
      const mpN = margin_percent !== undefined ? Number(margin_percent) : mpCur
      const dpN = discount_percent !== undefined ? Number(discount_percent) : dpCur
      const touchedCost = (purchase_price !== undefined) || (margin_percent !== undefined) || (discount_percent !== undefined)
      if (touchedCost && role === 'manager') {
        const net = ppN * (1 + mpN/100) * (1 - dpN/100)
        const base = 1000
        finalSalePrice = Math.round(net / base) * base
      }
    }
    const changedPrice = (finalSalePrice !== undefined && Number(finalSalePrice) !== Number(oldPrice))

    // Ensure columns exist
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price_locked BOOLEAN NOT NULL DEFAULT FALSE`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS published_at TIMESTAMP NULL`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS faq JSONB`)
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews JSONB`)
    // Check lock
    const lockRow = await query('SELECT price_locked FROM products WHERE CAST(id AS TEXT) = $1', [id])
    const isLocked = !!lockRow.rows?.[0]?.price_locked
    if (isLocked && role !== 'manager' && sale_price_cop !== undefined && Number(sale_price_cop) !== oldPrice) {
      return res.status(403).json({ error: 'price_locked', message: 'Precio bloqueado: solo gerentes pueden modificarlo' })
    }
    // Granular permission checks
    const wantsPriceChange = [purchase_price, margin_percent, discount_percent, sale_price_cop].some(v=>v !== undefined)
    const wantsMetaChange = [name, category, unit, description, image_url, image_urls, attributes, status, slug, published_at, visibility, short_description, barcode, tags, seo, req.body?.faq, req.body?.reviews].some(v=>v !== undefined)
    if (wantsPriceChange && !(role==='manager' || has('price:edit'))) {
      return res.status(403).json({ error: 'forbidden_price', message: 'No tienes permiso para cambiar precios' })
    }
    if (!wantsPriceChange && wantsMetaChange) {
      const canMetaEdit = (role==='manager' || role==='bodega' || role==='surtido' || has('product:edit'))
      if (!canMetaEdit) {
        return res.status(403).json({ error: 'forbidden_product', message: 'No tienes permiso para editar producto' })
      }
    }
    if (wantsPriceChange && role !== 'manager' && sale_price_cop !== undefined && Number(sale_price_cop) !== oldPrice) {
      if (!price_change_reason) return res.status(400).json({ error: 'missing_reason', message: 'Motivo es requerido para cambiar precio' })
    }
    let finalSlug = null
    const curRowRes = await query('SELECT name, sku, slug FROM products WHERE CAST(id AS TEXT) = $1', [id])
    const currentSlug = curRowRes.rows?.[0]?.slug
    const currentName = curRowRes.rows?.[0]?.name
    const currentSku = curRowRes.rows?.[0]?.sku
    if ((slug !== undefined && String(slug).trim()==='') || (slug === undefined && name !== undefined)) {
      // Clearing slug or changing name: compute from provided name (fallback current sku/slug)
      const base = slugify(name || currentSlug || currentSku)
      finalSlug = await uniqueSlug(base, id)
    } else if (slug !== undefined && String(slug||'').trim()) {
      // Explicit slug provided: normalize/ensure unique
      finalSlug = await uniqueSlug(String(slug), id)
    } else if (slug === undefined && name === undefined && (currentSlug === null || currentSlug === undefined || String(currentSlug).trim()==='')) {
      // Neither slug nor name provided, but product has no slug yet: compute from current name or sku
      const base = slugify(currentName || currentSku)
      finalSlug = await uniqueSlug(base, id)
    }

    // Compute new SKU if needed (use numeric sequence)
    let newSku = null
    if (sku !== undefined) {
      const cand = String(sku||'').trim().toUpperCase()
      newSku = cand || await nextNumericSku()
    } else if (!currentSku || String(currentSku).trim()==='' || String(currentSku).length <= 1) {
      newSku = await nextNumericSku()
    }

    if (role === 'manager' || has('price:edit') || wantsMetaChange) {
      await query(
        `UPDATE products SET
           name = COALESCE($2, name),
           sku = COALESCE($3, sku),
           category = COALESCE($4, category),
           unit = COALESCE($5, unit),
           purchase_price = COALESCE($6, purchase_price),
           margin_percent = COALESCE($7, margin_percent),
           discount_percent = COALESCE($8, discount_percent),
           sale_price_cop = COALESCE($9, sale_price_cop),
           price_locked = COALESCE($10, price_locked),
           description = COALESCE($11, description),
           image_url = COALESCE($12, image_url),
           image_urls = COALESCE($13, image_urls),
           attributes = COALESCE($14, attributes),
           status = COALESCE($15, status),
           slug = COALESCE($16, slug),
           published_at = COALESCE($17, published_at),
           visibility = COALESCE($18, visibility),
           short_description = COALESCE($19, short_description),
           barcode = COALESCE($20, barcode),
           tags = COALESCE($21, tags),
           seo = COALESCE($22, seo),
          faq = COALESCE($23, faq),
          reviews = COALESCE($24, reviews),
          updated_at = NOW()
         WHERE CAST(id AS TEXT) = $1`,
        [id,
         name || null,
         newSku || null,
         category || null,
         unit || null,
         purchase_price !== undefined ? Number(purchase_price) : null,
         margin_percent !== undefined ? Number(margin_percent) : null,
         discount_percent !== undefined ? Number(discount_percent) : null,
         finalSalePrice !== undefined ? Number(finalSalePrice) : null,
         req.body.price_locked !== undefined ? !!req.body.price_locked : null,
         description !== undefined ? (description || null) : null,
         image_url !== undefined ? (image_url || null) : null,
         Array.isArray(image_urls) ? JSON.stringify(image_urls) : null,
         attributes ? JSON.stringify(attributes) : null,
          status || null, (finalSlug!==null? finalSlug : (slug!==undefined? (slug||null) : null)), published_at || null,
         visibility || null, short_description !== undefined ? (short_description || null) : null,
         barcode !== undefined ? (barcode || null) : null,
         Array.isArray(tags) ? JSON.stringify(tags) : null,
         seo ? JSON.stringify(seo) : null,
         Array.isArray(req.body?.faq) ? JSON.stringify(req.body.faq) : (req.body?.faq === null ? null : null),
         Array.isArray(req.body?.reviews) ? JSON.stringify(req.body.reviews) : (req.body?.reviews === null ? null : null)]
      )
    }

    // If price changed, record log
    if (changedPrice) {
      // Ensure price change table exists and append log (product_id as UUID to match products.id)
      await query(`CREATE TABLE IF NOT EXISTS price_change_logs (
          id SERIAL PRIMARY KEY,
          product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          old_price NUMERIC NOT NULL,
          new_price NUMERIC NOT NULL,
          reason TEXT,
          user_id INTEGER,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )`)
      await query(`INSERT INTO price_change_logs (product_id, old_price, new_price, reason, user_id)
                   VALUES ($1::uuid,$2,$3,$4,$5)`, [id, oldPrice, (finalSalePrice!==undefined?finalSalePrice:newPrice)||oldPrice, price_change_reason || null, req.user?.id || null])
    }
    const { rows: pr } = await query('SELECT id, sku, slug FROM products WHERE CAST(id AS TEXT) = $1', [id])
    return res.json({ ok: true, product: pr?.[0] || { id, sku: newSku || currentSku, slug: finalSlug } })
  } catch (e) {
    return res.status(500).json({ error: 'update_product_error', code: e?.code, message: e?.message, detail: e?.detail })
  }
})

// Price history for a product (manager only)
router.get('/products/:id/price-history', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params
    await query(`
      CREATE TABLE IF NOT EXISTS price_change_logs (
        id SERIAL PRIMARY KEY,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        old_price NUMERIC NOT NULL,
        new_price NUMERIC NOT NULL,
        reason TEXT,
        user_id INTEGER,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      )`)
    const { rows } = await query(`
      SELECT id, old_price, new_price, reason, user_id, created_at
        FROM price_change_logs
       WHERE product_id = $1::uuid
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
    await query('DELETE FROM products WHERE CAST(id AS TEXT) = $1', [id])
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'delete_product_error' })
  }
})

// Stock by area
router.get('/inventory/stock', requireAuth, ensureRole(['manager','bodega','surtido']), requirePerm('inventory:view'), async (req, res) => {
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
    const role = (req.user?.role || '').toLowerCase()
    const perms = req.user?.perms || []
    const has = (p)=>perms.includes(p)
    if (!(role==='manager' || has('inventory:move'))) return res.status(403).json({ error: 'forbidden_inventory_move' })
    // Ensure tables
    await query(`CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      product_id UUID NOT NULL,
      area TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      reason TEXT,
      user_id INTEGER,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )`)
    await query(`CREATE TABLE IF NOT EXISTS inventory_stock (
      product_id UUID NOT NULL,
      area TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      PRIMARY KEY (product_id, area)
    )`)
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
    const role = (req.user?.role || '').toLowerCase()
    const perms = req.user?.perms || []
    const has = (p)=>perms.includes(p)
    if (!(role==='manager' || has('inventory:move'))) return res.status(403).json({ error: 'forbidden_inventory_move' })
    // Ensure tables
    await query(`CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
      product_id UUID NOT NULL,
      area TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      reason TEXT,
      user_id INTEGER,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    )`)
    await query(`CREATE TABLE IF NOT EXISTS inventory_stock (
      product_id UUID NOT NULL,
      area TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      PRIMARY KEY (product_id, area)
    )`)
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

// Import structured sheet data: { categorias:[], proveedores:[], productos:[] }
router.post('/import/sheet', requireAuth, ensureRole(['manager']), async (req, res) => {
  const body = req.body || {}
  const categorias = Array.isArray(body.categorias) ? body.categorias : []
  const proveedores = Array.isArray(body.proveedores) ? body.proveedores : []
  const productos = Array.isArray(body.productos) ? body.productos : []
  try {
    await query('BEGIN')
    try {
      // Upsert categories
      for (const c of categorias) {
        await query(
          `INSERT INTO categories (ext_id, name)
           VALUES ($1,$2)
           ON CONFLICT (ext_id) DO UPDATE SET name = EXCLUDED.name`,
          [String(c.id_categoria||'').trim() || null, c.nombre]
        )
      }
      // Upsert suppliers
      for (const s of proveedores) {
        await query(
          `INSERT INTO suppliers (ext_id, name, nit, contact, phone)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (ext_id) DO UPDATE SET name=EXCLUDED.name, nit=EXCLUDED.nit, contact=EXCLUDED.contact, phone=EXCLUDED.phone`,
          [String(s.id_proveedor||'').trim() || null, s.nombre, s.nit || null, s.contacto || null, s.telefono || null]
        )
      }
      // Maps
      const { rows: catRows } = await query('SELECT id, ext_id FROM categories')
      const catByExt = new Map(catRows.map(r => [r.ext_id, r.id]))
      const { rows: supRows } = await query('SELECT id, ext_id FROM suppliers')
      const supByExt = new Map(supRows.map(r => [r.ext_id, r.id]))

      // Upsert products and stock
      for (const p of productos) {
        const sku = String(p.sku||'').trim() || null
        const catId = p.id_categoria ? catByExt.get(String(p.id_categoria)) || null : null
        const supId = p.id_proveedor ? supByExt.get(String(p.id_proveedor)) || null : null
        const iva = p.iva_pct != null ? (Number(p.iva_pct) > 1 ? Number(p.iva_pct) : Number(p.iva_pct) * 100) : 0
        const purchase = Number(p.costo_compra||0)
        const sale = Number(p.precio_venta||0)
        const saleMayor = Number(p.precio_mayorista||0)
        const discountMax = Number(p.descuento_max_pct||0)
        const margin = Number(p.margen_pct||0)
        await query(
          `INSERT INTO products (
             sku, name, category, unit, brand, category_id, supplier_id,
             purchase_price, tax_percent, sale_price_unit, sale_price_bulk, discount_percent, margin_percent, sale_price_cop,
             bar_code, stock_min, location, status, warranty_months, weight_kg, image_url, created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,
             $8,$9,$10,$11,$12,$13,$14,
             $15,$16,$17,$18,$19,$20,$21,NOW(),NOW()
           )
           ON CONFLICT (sku) DO UPDATE SET
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             unit = EXCLUDED.unit,
             brand = EXCLUDED.brand,
             category_id = EXCLUDED.category_id,
             supplier_id = EXCLUDED.supplier_id,
             purchase_price = EXCLUDED.purchase_price,
             tax_percent = EXCLUDED.tax_percent,
             sale_price_unit = EXCLUDED.sale_price_unit,
             sale_price_bulk = EXCLUDED.sale_price_bulk,
             discount_percent = EXCLUDED.discount_percent,
             margin_percent = EXCLUDED.margin_percent,
             sale_price_cop = EXCLUDED.sale_price_cop,
             bar_code = EXCLUDED.bar_code,
             stock_min = EXCLUDED.stock_min,
             location = EXCLUDED.location,
             status = EXCLUDED.status,
             warranty_months = EXCLUDED.warranty_months,
             weight_kg = EXCLUDED.weight_kg,
             image_url = EXCLUDED.image_url,
             updated_at = NOW()`,
          [
            sku, p.nombre, null, p.unidad_medida || null, p.marca || null, catId, supId,
            purchase, iva, sale, saleMayor, discountMax, margin, sale,
            p.codigo_barras || null, Number(p.stock_minimo||0), p.ubicacion || null, (p.estado? 'activo':'inactivo'), Number(p.garantia_meses||0) || null, Number(p.peso_kg||0) || null, p.imagen_url || null
          ]
        )
        // Stock: bodega = stock_actual
        if (sku && (p.stock_actual != null)) {
          const { rows: idr } = await query('SELECT id FROM products WHERE sku = $1', [sku])
          const pid = idr[0]?.id
          if (pid) {
            await query(
              `INSERT INTO inventory_stock (product_id, area, quantity)
               VALUES ($1,'bodega',$2)
               ON CONFLICT (product_id, area) DO UPDATE SET quantity = EXCLUDED.quantity`,
              [pid, Number(p.stock_actual||0)]
            )
          }
        }
      }
      await query('COMMIT')
      return res.json({ ok: true, categorias: categorias.length, proveedores: proveedores.length, productos: productos.length })
    } catch (e) {
      await query('ROLLBACK')
      throw e
    }
  } catch (e) {
    return res.status(500).json({ error: 'import_sheet_error', message: e?.message || String(e) })
  }
})
