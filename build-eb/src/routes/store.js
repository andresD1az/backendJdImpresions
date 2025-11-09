import express from 'express'
import { query } from '../config/db.js'
import { mpClient, mpPreference, mpPayment } from '../lib/mercadopago.js'
import { Preference } from 'mercadopago'
import { requireAuth } from '../middleware/auth.js'
import client from 'prom-client'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { verifyAuthToken } from '../utils/jwt.js'

const router = express.Router()

// ===== Business metrics (Prometheus) =====
const getOrCreateCounter = (name, help, labelNames=[]) =>
  client.register.getSingleMetric(name) || new client.Counter({ name, help, labelNames })

// Product detail by SLUG for storefront
router.get('/product-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const { preview } = req.query
    // Ensure optional columns
    try {
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS faq JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews JSONB`)
      await query(`CREATE TABLE IF NOT EXISTS inventory_stock (
        product_id UUID NOT NULL,
        area TEXT NOT NULL,
        quantity NUMERIC NOT NULL,
        PRIMARY KEY (product_id, area)
      )`)
    } catch {}
    let rows
    try {
      const q = `
      WITH sums AS (
        SELECT product_id,
               COALESCE(SUM(CASE WHEN area = 'surtido' THEN quantity ELSE 0 END),0) AS qty_surtido,
               COALESCE(SUM(CASE WHEN area = 'bodega' THEN quantity ELSE 0 END),0) AS qty_bodega
          FROM inventory_stock
         GROUP BY product_id
      )
      SELECT p.id, p.sku, p.name, p.brand, p.category, p.unit,
             p.image_url, p.image_urls, p.tax_percent, p.description, p.short_description, p.discount_percent, p.attributes, p.faq, p.reviews,
             ROUND(p.sale_price_cop * (1 + COALESCE(NULLIF(p.tax_percent,0),0)/100.0)) AS price_public,
             (COALESCE(s.qty_surtido,0) > 0) AS available,
             GREATEST(COALESCE(s.qty_surtido,0),0) AS stock,
             GREATEST(COALESCE(s.qty_surtido,0),0) AS stock_surtido,
             GREATEST(COALESCE(s.qty_bodega,0),0) AS stock_bodega
        FROM products p
        LEFT JOIN sums s ON s.product_id = p.id
       WHERE LOWER(p.slug) = LOWER($1)
         AND ($2::boolean = true OR p.status = 'published')
       LIMIT 1
      `
      rows = (await query(q, [slug, String(preview)==='1']) ).rows
    } catch (invErr) {
      // Fallback sin inventario
      const q2 = `
        SELECT p.id, p.sku, p.name, p.brand, p.category, p.unit,
               p.image_url, p.image_urls, p.tax_percent, p.description, p.short_description, p.discount_percent, p.attributes, p.faq, p.reviews,
               ROUND(p.sale_price_cop * (1 + COALESCE(NULLIF(p.tax_percent,0),0)/100.0)) AS price_public,
               false AS available,
               0 AS stock,
               0 AS stock_surtido,
               0 AS stock_bodega
          FROM products p
         WHERE LOWER(p.slug) = LOWER($1)
           AND ($2::boolean = true OR p.status = 'published')
         LIMIT 1
      `
      rows = (await query(q2, [slug, String(preview)==='1']) ).rows
    }
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    const r = rows[0]
    return res.json({
      product: {
        id: r.id, sku: r.sku, name: r.name, brand: r.brand, category: r.category, unit: r.unit,
        image_url: r.image_url, image_urls: Array.isArray(r.image_urls)? r.image_urls : null,
        short_description: r.short_description || null,
        description: r.description || null, tax_percent: Number(r.tax_percent||0),
        discount_percent: Number(r.discount_percent||0),
        attributes: r.attributes || null,
        faq: Array.isArray(r.faq) ? r.faq : null,
        reviews: Array.isArray(r.reviews) ? r.reviews : null,
        price: Number(r.price_public||0), available: !!r.available, stock: Number(r.stock||0),
        stock_surtido: Number(r.stock_surtido||0), stock_bodega: Number(r.stock_bodega||0)
      }
    })

  // List my invoices (client)
  router.get('/invoices', requireAuth, async (req, res) => {
    try {
      await query(`CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER UNIQUE NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )`)
      const page = Math.max(1, Number(req.query?.page)||1)
      const size = Math.min(100, Math.max(1, Number(req.query?.pageSize)||25))
      const offset = (page - 1) * size
      const { rows } = await query(`
        SELECT s.id AS sale_id, s.occurred_at, s.total, COALESCE(i.path,'') AS path, i.created_at AS invoice_created_at
          FROM sales s
          LEFT JOIN invoices i ON i.sale_id = s.id
         WHERE s.user_id = $1
         ORDER BY s.occurred_at DESC
         LIMIT ${size} OFFSET ${offset}
      `, [req.user?.id])
      return res.json({ invoices: rows, page, pageSize: size })
    } catch (e) {
      return res.status(500).json({ error: 'invoices_list_error' })
    }
  })

  // List my return requests (client)
  router.get('/returns', requireAuth, async (req, res) => {
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
      const { rows } = await query(`
        SELECT id, sale_id, items, reason, status, created_at, decided_at
          FROM return_requests
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 100
      `, [req.user?.id])
      return res.json({ returns: rows })
    } catch (e) {
      return res.status(500).json({ error: 'list_returns_error' })
    }
  })
  } catch (e) {
    const msg = e?.message || 'unknown'
    return res.status(500).json({ error: 'product_error', message: msg })
  }
})

const cartVerifyTotal = getOrCreateCounter('cart_verify_total', 'Total cart verify operations', ['result'])
const checkoutCreatedTotal = getOrCreateCounter('checkout_created_total', 'Total checkouts created')
const mpWebhookEventsTotal = getOrCreateCounter('mp_webhook_events_total', 'MercadoPago webhook events', ['status'])
const mpReturnTotal = getOrCreateCounter('mp_return_total', 'MercadoPago return callback hits', ['status'])

// Public catalog: list products with available stock and price
router.get('/catalog', async (req, res) => {
  try {
    const { q, search, category, brand, minPrice, maxPrice, inStock, page, pageSize, sort, limit } = req.query
    const params = []
    const clauses = []
    const qtext = search || q
    if (qtext) { params.push(`%${qtext}%`); clauses.push(`(p.sku ILIKE $${params.length} OR p.name ILIKE $${params.length})`) }
    if (category) { params.push(category); clauses.push(`p.category = $${params.length}`) }
    if (brand) { params.push(brand); clauses.push(`p.brand = $${params.length}`) }
    if (minPrice) { params.push(Number(minPrice)); clauses.push(`p.sale_price_cop >= $${params.length}`) }
    if (maxPrice) { params.push(Number(maxPrice)); clauses.push(`p.sale_price_cop <= $${params.length}`) }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const order = 'ORDER BY p.created_at DESC'
    const pageN = Math.max(1, Number(page)||1)
    const sizeN = Math.min(48, Math.max(1, Number(pageSize || limit)||24))
    const offset = (pageN - 1) * sizeN

    try {
      await query(`CREATE TABLE IF NOT EXISTS inventory_stock (
        product_id UUID NOT NULL,
        area TEXT NOT NULL,
        quantity NUMERIC NOT NULL,
        PRIMARY KEY (product_id, area)
      )`)
    } catch {}

    let rows
    try {
      const q = `
      WITH sums AS (
        SELECT product_id,
               COALESCE(SUM(CASE WHEN area = 'surtido' THEN quantity ELSE 0 END),0) AS qty_surtido,
               COALESCE(SUM(CASE WHEN area = 'bodega' THEN quantity ELSE 0 END),0) AS qty_bodega
          FROM inventory_stock
         GROUP BY product_id
      )
      SELECT p.id, p.sku, p.name, p.brand, p.category, p.unit,
             p.image_url, p.tax_percent, p.description,
             ROUND(p.sale_price_cop * (1 + COALESCE(NULLIF(p.tax_percent,0),0)/100.0)) AS price_public,
             (COALESCE(s.qty_surtido,0) > 0) AS available,
             GREATEST(COALESCE(s.qty_surtido,0),0) AS stock
        FROM products p
        LEFT JOIN sums s ON s.product_id = p.id
        ${where}
        ${order}
        LIMIT ${sizeN} OFFSET ${offset}
      `
      rows = (await query(q, params)).rows
    } catch (invErr) {
      const q2 = `
        SELECT p.id, p.sku, p.name, p.brand, p.category, p.unit,
               p.image_url, p.tax_percent, p.description,
               ROUND(p.sale_price_cop * (1 + COALESCE(NULLIF(p.tax_percent,0),0)/100.0)) AS price_public,
               false AS available,
               0 AS stock
          FROM products p
          ${where}
          ${order}
          LIMIT ${sizeN} OFFSET ${offset}
      `
      rows = (await query(q2, params)).rows
    }
    let out = rows.map(r => ({
      id: r.id, sku: r.sku, name: r.name, brand: r.brand, category: r.category, unit: r.unit,
      image_url: r.image_url, description: r.description || null, tax_percent: Number(r.tax_percent||0),
      price: Number(r.price_public||0), available: !!r.available, stock: Number(r.stock||0)
    }))
    if (String(inStock||'').toLowerCase() === 'true') out = out.filter(x=>x.available)
    return res.json({ products: out, page: pageN, pageSize: sizeN })
  } catch (e) {
    return res.status(500).json({ error: 'catalog_error' })
  }
})

// Public categories list (by distinct)
router.get('/categories', async (_req, res) => {
  try {
    const { rows } = await query(`SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> '' ORDER BY 1 LIMIT 100`)
    return res.json({ categories: rows.map(r=>r.category) })
  } catch {
    return res.status(500).json({ error: 'categories_error' })
  }
})

// Product detail by SKU
router.get('/product/:sku', async (req, res) => {
  try {
    const { sku } = req.params
    // Ensure optional columns used by product detail exist
    try {
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS faq JSONB`)
      await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews JSONB`)
      await query(`CREATE TABLE IF NOT EXISTS inventory_stock (
        product_id UUID NOT NULL,
        area TEXT NOT NULL,
        quantity NUMERIC NOT NULL,
        PRIMARY KEY (product_id, area)
      )`)
    } catch {}
    let rows
    try {
      const q = `
      WITH sums AS (
        SELECT product_id,
               COALESCE(SUM(CASE WHEN area = 'surtido' THEN quantity ELSE 0 END),0) AS qty_surtido,
               COALESCE(SUM(CASE WHEN area = 'bodega' THEN quantity ELSE 0 END),0) AS qty_bodega
          FROM inventory_stock
         GROUP BY product_id
      )
      SELECT p.id, p.sku, p.name, p.brand, p.category, p.unit,
             p.image_url, p.image_urls, p.tax_percent, p.description, p.short_description, p.discount_percent, p.attributes, p.faq, p.reviews,
             ROUND(p.sale_price_cop * (1 + COALESCE(NULLIF(p.tax_percent,0),0)/100.0)) AS price_public,
             (COALESCE(s.qty_surtido,0) > 0) AS available,
             GREATEST(COALESCE(s.qty_surtido,0),0) AS stock,
             GREATEST(COALESCE(s.qty_surtido,0),0) AS stock_surtido,
             GREATEST(COALESCE(s.qty_bodega,0),0) AS stock_bodega
        FROM products p
        LEFT JOIN sums s ON s.product_id = p.id
       WHERE LOWER(p.sku) = LOWER($1)
       LIMIT 1
      `
      rows = (await query(q, [sku])).rows
    } catch (invErr) {
      const q2 = `
        SELECT p.id, p.sku, p.name, p.brand, p.category, p.unit,
               p.image_url, p.image_urls, p.tax_percent, p.description, p.short_description, p.discount_percent, p.attributes, p.faq, p.reviews,
               ROUND(p.sale_price_cop * (1 + COALESCE(NULLIF(p.tax_percent,0),0)/100.0)) AS price_public,
               false AS available,
               0 AS stock,
               0 AS stock_surtido,
               0 AS stock_bodega
          FROM products p
         WHERE LOWER(p.sku) = LOWER($1)
         LIMIT 1
      `
      rows = (await query(q2, [sku])).rows
    }
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    const r = rows[0]
    return res.json({
      product: {
        id: r.id, sku: r.sku, name: r.name, brand: r.brand, category: r.category, unit: r.unit,
        image_url: r.image_url, image_urls: Array.isArray(r.image_urls)? r.image_urls : null,
        short_description: r.short_description || null,
        description: r.description || null, tax_percent: Number(r.tax_percent||0),
        discount_percent: Number(r.discount_percent||0),
        attributes: r.attributes || null,
        faq: Array.isArray(r.faq) ? r.faq : null,
        reviews: Array.isArray(r.reviews) ? r.reviews : null,
        price: Number(r.price_public||0), available: !!r.available, stock: Number(r.stock||0),
        stock_surtido: Number(r.stock_surtido||0), stock_bodega: Number(r.stock_bodega||0)
      }
    })
  } catch {
    return res.status(500).json({ error: 'product_error' })
  }
})

// Related by category/brand simple heuristic
router.get('/related', async (req, res) => {
  try {
    const { sku } = req.query
    if (!sku) return res.json({ products: [] })
    const { rows } = await query(`
      SELECT p2.id, p2.sku, p2.name, p2.brand, p2.category, p2.image_url,
             ROUND(p2.sale_price_cop * (1 + COALESCE(NULLIF(p2.tax_percent,0),0)/100.0)) AS price_public
        FROM products p
        JOIN products p2 ON (p2.category = p.category OR p2.brand = p.brand) AND p2.sku <> p.sku
       WHERE LOWER(p.sku) = LOWER($1)
       ORDER BY p2.created_at DESC
       LIMIT 8
    `, [sku])
    return res.json({ products: rows.map(r=>({ id:r.id, sku:r.sku, name:r.name, brand:r.brand, category:r.category, image_url:r.image_url, price:Number(r.price_public||0) })) })
  } catch {
    return res.status(500).json({ error: 'related_error' })
  }
})

// Create order from cart (pending payment)
router.post('/cart/checkout', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    const items = Array.isArray(req.body?.items) ? req.body.items : [] // [{ sku, quantity }]
    if (!items.length) return res.status(400).json({ error: 'empty_cart' })

    // Map sku -> product
    const skus = [...new Set(items.map(i => String(i.sku||'').trim()).filter(Boolean))]
    if (!skus.length) return res.status(400).json({ error: 'invalid_items' })
    const { rows: prods } = await query('SELECT id, sku, name, sale_price_cop FROM products WHERE sku = ANY($1)', [skus])
    const bySku = new Map(prods.map(p => [p.sku, p]))

    // Build order lines
    const lines = []
    for (const it of items) {
      const p = bySku.get(String(it.sku))
      const qty = Number(it.quantity)
      if (!p || !Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'invalid_item', sku: it.sku })
      const unit = Number(p.sale_price_cop || 0)
      const lineTotal = unit * qty
      lines.push({ product_id: p.id, unit_price: unit, quantity: qty, line_total: lineTotal })
    }

    const total = lines.reduce((a,b)=>a + Number(b.line_total||0), 0)

    // Persist sale and items (status pending)
    await query('BEGIN')
    let sale
    try {
      const ins = await query('INSERT INTO sales (user_id, customer, total, status) VALUES ($1,$2,$3,$4) RETURNING id', [userId || null, req.user?.email || null, total, 'pending'])
      sale = ins.rows[0]
      for (const ln of lines) {
        await query('INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5)', [sale.id, ln.product_id, ln.quantity, ln.unit_price, ln.line_total])
      }
      await query('COMMIT')
    } catch (e) {
      await query('ROLLBACK')
      throw e
    }

    try { checkoutCreatedTotal.inc() } catch {}
    return res.json({ ok: true, order_id: sale.id, total })
  } catch (e) {
    return res.status(500).json({ error: 'checkout_error' })
  }
})

// Verify cart: recalc prices and validate stock
router.post('/cart/verify', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) {
      try { cartVerifyTotal.inc({ result: 'empty' }) } catch {}
      return res.status(400).json({ error: 'empty_cart' })
    }
    const skus = [...new Set(items.map(i => String(i.sku||'').trim()).filter(Boolean))]
    try {
      await query(`CREATE TABLE IF NOT EXISTS inventory_stock (
        product_id UUID NOT NULL,
        area TEXT NOT NULL,
        quantity NUMERIC NOT NULL,
        PRIMARY KEY (product_id, area)
      )`)
    } catch {}
    const { rows: prods } = await query(`
      WITH sums AS (
        SELECT product_id,
               COALESCE(SUM(CASE WHEN area = 'surtido' THEN quantity ELSE 0 END),0) AS qty_surtido
          FROM inventory_stock
         GROUP BY product_id
      )
      SELECT p.id, p.sku, p.name, p.sale_price_cop, p.tax_percent, COALESCE(s.qty_surtido,0) AS stock
        FROM products p
        LEFT JOIN sums s ON s.product_id = p.id
       WHERE p.sku = ANY($1)
    `, [skus])
    const bySku = new Map(prods.map(p => [p.sku, p]))
    const validated = []
    let ok = true
    let total = 0
    for (const it of items) {
      const p = bySku.get(String(it.sku))
      const qty = Math.max(0, Number(it.quantity)||0)
      if (!p || !qty) { ok = false; continue }
      const unit = Number(p.sale_price_cop||0) * (1 + Number(p.tax_percent||0)/100)
      const line = unit * qty
      const stockOk = Number(p.stock||0) >= qty
      if (!stockOk) ok = false
      validated.push({ sku: p.sku, name: p.name, unit_price: Math.round(unit), quantity: qty, line_total: Math.round(line), stock_ok: stockOk })
      total += line
    }
    try {
      const hadStockIssue = validated.some(v => v.stock_ok === false)
      cartVerifyTotal.inc({ result: ok ? 'ok' : (hadStockIssue ? 'insufficient_stock' : 'invalid') })
    } catch {}
    return res.json({ ok, items: validated, total: Math.round(total) })
  } catch {
    return res.status(500).json({ error: 'verify_error' })
  }
})

// List my orders (client)
router.get('/orders', requireAuth, async (req, res) => {
  try {
    await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending'`)
    const { rows } = await query(`
      SELECT id, occurred_at, total, status, payment_ref, fulfillment_status
        FROM sales
       WHERE user_id = $1
       ORDER BY occurred_at DESC
       LIMIT 100
    `, [req.user?.id])
    return res.json({ orders: rows })
  } catch (e) {
    return res.status(500).json({ error: 'orders_error' })
  }
})

// Get one order with items
router.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { rows: hdr } = await query('SELECT id, occurred_at, total, status, payment_ref FROM sales WHERE id = $1 AND user_id = $2', [id, req.user?.id])
    if (!hdr.length) return res.status(404).json({ error: 'not_found' })
    const { rows: its } = await query(`
      SELECT si.id, si.quantity, si.unit_price, si.line_total, p.sku, p.name
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1
       ORDER BY si.id
    `, [id])
    return res.json({ order: hdr[0], items: its })
  } catch (e) {
    return res.status(500).json({ error: 'order_error' })
  }
})

// Generate or serve invoice PDF for an order (client-owned). Supports token in query for direct download.
router.get('/orders/:id/invoice.pdf', async (req, res) => {
  try {
    const { id } = req.params
    // Authenticate: header token or query token
    let userId = null
    try {
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        // Use existing middleware by calling requireAuth-like flow: reuse /orders/:id permission check below
        // Quick fetch user from session table via JWT util
        const token = req.headers.authorization.split(' ')[1]
        const v = await verifyAuthToken(token)
        userId = v?.sub || v?.id || null
      } else if (req.query && req.query.token) {
        const v = await verifyAuthToken(String(req.query.token))
        userId = v?.sub || v?.id || null
      }
    } catch {}
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    const { rows: hdr } = await query('SELECT id, occurred_at, total, status FROM sales WHERE id = $1 AND user_id = $2', [id, userId])
    if (!hdr.length) return res.status(404).json({ error: 'not_found' })
    const { rows: its } = await query(`
      SELECT si.quantity, si.unit_price, si.line_total, p.sku, p.name
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1
       ORDER BY si.id
    `, [id])

    // Ensure invoices table and directory
    await query(`CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER UNIQUE NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )`)
    const invoicesDir = path.resolve(process.cwd(), 'uploads', 'invoices')
    try { if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true }) } catch {}
    const filePath = path.join(invoicesDir, `sale-${id}.pdf`)

    // If file exists, just stream it
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf')
      return fs.createReadStream(filePath).pipe(res)
    }

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)
    // Header
    doc.fontSize(18).text('Factura de venta', { align: 'right' })
    doc.moveDown(0.5)
    doc.fontSize(10).text('JD Impressions', { align: 'right' })
    doc.text('NIT: 147852951', { align: 'right' })
    doc.text('Registro: 147852951852', { align: 'right' })
    doc.text('Domicilio: Armenia – Quindío, Colombia', { align: 'right' })
    doc.text('Tel: 3123456789', { align: 'right' })
    doc.text('Email: jdimpresions@gmail.com', { align: 'right' })
    doc.moveDown()
    // Order info
    const order = hdr[0]
    doc.fontSize(12).text(`Pedido #${order.id}`)
    doc.text(`Fecha: ${order.occurred_at ? new Date(order.occurred_at).toLocaleString('es-CO') : '-'}`)
    doc.text(`Estado: ${order.status}`)
    doc.moveDown()
    // Items table
    doc.fontSize(12).text('Items', { underline: true })
    doc.moveDown(0.5)
    its.forEach((it) => {
      doc.fontSize(10).text(`${it.sku} - ${it.name}`)
      doc.text(`Cantidad: ${it.quantity}  Precio: $${Number(it.unit_price||0).toLocaleString('es-CO')}  Subtotal: $${Number(it.line_total||0).toLocaleString('es-CO')}`)
      doc.moveDown(0.2)
    })
    doc.moveDown()
    doc.fontSize(12).text(`Total: $${Number(order.total||0).toLocaleString('es-CO')}`, { align: 'right' })
    doc.end()

    stream.on('finish', async () => {
      try { await query(`INSERT INTO invoices (sale_id, path) VALUES ($1,$2) ON CONFLICT (sale_id) DO UPDATE SET path = EXCLUDED.path`, [id, filePath]) } catch {}
      res.setHeader('Content-Type', 'application/pdf')
      fs.createReadStream(filePath).pipe(res)
    })
    stream.on('error', () => res.status(500).json({ error: 'pdf_error' }))
  } catch (e) {
    return res.status(500).json({ error: 'invoice_error' })
  }
})

// Create return request (client)
router.post('/returns', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    const { sale_id, items, reason, accepted_policy } = req.body || {}
    if (!accepted_policy) return res.status(400).json({ error: 'policy_not_accepted' })
    if (!sale_id) return res.status(400).json({ error: 'missing_sale_id' })
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
    const payload = Array.isArray(items) ? items : []
    const { rows } = await query(
      `INSERT INTO return_requests (user_id, sale_id, items, reason, accepted_policy)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, status, created_at`,
      [userId, sale_id, JSON.stringify(payload), reason || null, !!accepted_policy]
    )
    return res.json({ ok: true, request: rows[0] })
  } catch (e) {
    return res.status(500).json({ error: 'return_create_error' })
  }
})

export default router

// ===== Mercado Pago Integration =====
// Create preference
router.post('/payments/mercado-pago/preference', requireAuth, async (req, res) => {
  try {
    if (!mpClient || !mpPreference) return res.status(503).json({ error: 'mp_not_configured' })
    const { items = [], payer = {}, shipping_address = {}, redirect_urls = {} } = req.body || {}
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'empty_items' })

    // Validación de datos del cliente
    const missing = []
    const name = String(payer?.name || '').trim()
    const email = String(payer?.email || '').trim()
    const idNum = String(payer?.identification?.number || req.body?.idNumber || '').trim()
    const phone = String(payer?.phone?.number || req.body?.phone || '').replace(/\D/g, '')
    const addressLine = String(shipping_address?.line || '').trim()
    const city = String(shipping_address?.city || '').trim()
    if (!name) missing.push('fullName')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push('email')
    if (!idNum) missing.push('idNumber')
    if (!phone) missing.push('phone')
    if (!addressLine) missing.push('address')
    if (!city) missing.push('city')
    if (missing.length) return res.status(400).json({ error: 'missing_customer_fields', fields: missing })

    // Recalcular precios desde BD para seguridad
    const skus = [...new Set(items.map(i => String(i.sku||'').trim()).filter(Boolean))]
    const { rows: prods } = await query('SELECT id, sku, name, sale_price_cop, tax_percent FROM products WHERE sku = ANY($1)', [skus])
    const bySku = new Map(prods.map(p => [p.sku, p]))
    const mpItems = []
    let total = 0
    for (const it of items) {
      const p = bySku.get(String(it.sku))
      const qty = Math.max(1, Number(it.quantity)||1)
      if (!p) return res.status(400).json({ error: 'invalid_item', sku: it.sku })
      const unit = Math.round(Number(p.sale_price_cop||0) * (1 + Number(p.tax_percent||0)/100))
      total += unit * qty
      mpItems.push({ id: p.sku, title: p.name, quantity: qty, currency_id: 'COP', unit_price: unit })
    }

    // Crear venta e items en transacción para que se refleje inmediatamente en panel interno
    let saleId
    await query('BEGIN')
    try {
      const ins = await query('INSERT INTO sales (user_id, customer, total, status) VALUES ($1,$2,$3,$4) RETURNING id', [req.user?.id||null, req.user?.email||null, total, 'pending'])
      saleId = ins.rows[0]?.id
      for (const it of mpItems) {
        const { rows: pr } = await query('SELECT id FROM products WHERE sku = $1', [it.id])
        const pid = pr[0]?.id
        if (pid) {
          await query('INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5)', [saleId, pid, Number(it.quantity)||1, Number(it.unit_price)||0, Number(it.unit_price||0) * Number(it.quantity||1)])
        }
      }
      await query('COMMIT')
    } catch (txe) {
      await query('ROLLBACK')
      throw txe
    }

    const notificationUrl = process.env.MP_WEBHOOK_URL || `${process.env.BASE_URL || ''}/store/payments/mercado-pago/webhook`
    try {
      // Force back_urls to backend callback endpoint so they are always valid for MP
      const backendBase = process.env.BASE_URL || 'http://localhost:4000'
      const backUrls = {
        success: `${backendBase}/store/payments/mercado-pago/return`,
        failure: `${backendBase}/store/payments/mercado-pago/return`,
        pending: `${backendBase}/store/payments/mercado-pago/return`,
      }
      const pref = new Preference(mpClient)
      const body = {
        items: mpItems,
        payer: { name: payer?.name, email: payer?.email },
        external_reference: String(saleId),
        notification_url: notificationUrl,
        back_urls: backUrls,
        auto_return: 'approved',
        binary_mode: true
      }
      const prefRes = await pref.create({ body })
      const init = prefRes?.init_point || prefRes?.sandbox_init_point
      return res.json({ ok: true, init_point: init, sale_id: saleId })
    } catch (err) {
      const msg = err?.message || (typeof err === 'string' ? err : 'unknown')
      console.error('MercadoPago preference error:', msg)
      return res.status(502).json({ error: 'mp_preference_error', message: msg })
    }
  } catch (e) {
    return res.status(500).json({ error: 'mp_preference_error' })
  }
})

// Webhook
router.post('/payments/mercado-pago/webhook', async (req, res) => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS payment_events (id SERIAL PRIMARY KEY, payment_id TEXT UNIQUE, status TEXT, raw JSONB, occurred_at TIMESTAMPTZ DEFAULT now())`)
    const topic = req.query?.type || req.body?.type || req.headers['x-topic']
    const dataId = req.query?.['data.id'] || req.body?.data?.id || req.body?.id
    if (!dataId) { res.sendStatus(200); return }
    try { await query('INSERT INTO payment_events (payment_id, status, raw) VALUES ($1,$2,$3)', [String(dataId), String(topic||'unknown'), req.body||{}]) } catch {}

    // Verificación activa del pago contra MP
    let status = (req.body?.data?.status || req.body?.status || '').toLowerCase()
    const extRefBody = req.body?.data?.external_reference || req.body?.external_reference || req.query?.external_reference
    let saleId = Number(extRefBody) || null
    try {
      if (mpPayment && dataId) {
        const resp = await mpPayment.get({ id: String(dataId) })
        const p = resp || {}
        const extRef = p?.external_reference || p?.order?.external_reference || extRefBody
        if (!saleId) saleId = Number(extRef) || null
        status = String(p?.status || status || '').toLowerCase()
        // Validar monto vs total de venta
        if (saleId) {
          const { rows } = await query('SELECT total FROM sales WHERE id = $1', [saleId])
          const expected = Number(rows?.[0]?.total || 0)
          const paid = Number(p?.transaction_amount || p?.amount || 0)
          if (expected && paid && Math.abs(expected - paid) > 1) {
            await query('INSERT INTO payment_events (payment_id, status, raw) VALUES ($1,$2,$3) ON CONFLICT (payment_id) DO NOTHING', [String(dataId)+':mismatch', 'amount_mismatch', { expected, paid }])
          }
        }
      }
    } catch (e) {
      // En caso de fallo en consulta, mantener fallback a payload
    }

    if (!status) status = 'pending'
    if (saleId) {
      const mapped = status === 'approved' ? 'paid' : status === 'rejected' ? 'cancelled' : 'pending'
      await query('UPDATE sales SET status = $1, payment_ref = $2 WHERE id = $3', [mapped, String(dataId), saleId])
    }
    try { mpWebhookEventsTotal.inc({ status: status || 'unknown' }) } catch {}
    res.sendStatus(200)
  } catch (e) {
    res.sendStatus(200)
  }
})

// Return callback for user redirection from Mercado Pago (con verificación activa)
router.get('/payments/mercado-pago/return', async (req, res) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:8081'
  try {
    const statusQ = String(req.query?.status || req.query?.collection_status || '').toLowerCase()
    const paymentId = req.query?.payment_id || req.query?.collection_id || null
    const prefId = req.query?.preference_id || null
    let status = statusQ
    let saleId = null
    try {
      if (mpPayment && paymentId) {
        const p = await mpPayment.get({ id: String(paymentId) })
        status = String(p?.status || status || '').toLowerCase()
        saleId = Number(p?.external_reference || p?.order?.external_reference || null) || null
        if (saleId) {
          const mapped = status === 'approved' ? 'paid' : status === 'rejected' ? 'cancelled' : 'pending'
          await query('UPDATE sales SET status = $1, payment_ref = COALESCE(payment_ref, $2) WHERE id = $3', [mapped, String(paymentId), saleId])
        }
      }
    } catch {}
    let path = 'mis-pedidos?pending=1'
    if (status === 'approved' || status === 'success') path = 'mis-pedidos?paid=1'
    else if (status === 'failure' || status === 'rejected' || status === 'cancelled') path = 'carrito?error=pago'
    const target = `${base}/${path}`
    try { mpReturnTotal.inc({ status: status || 'unknown' }) } catch {}
    res.redirect(302, target)
  } catch {
    res.redirect(302, base)
  }
})
