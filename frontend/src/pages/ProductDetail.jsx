import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'

export default function ProductDetail({ initialProduct }) {
  const { sku } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [qty, setQty] = useState(1)
  const [imgIdx, setImgIdx] = useState(0)
  const [tab, setTab] = useState('descripcion') // descripcion | caracteristicas

  useEffect(() => {
    (async () => {
      setErr('')
      if (initialProduct) {
        setProduct(initialProduct)
        try {
          if (initialProduct.sku) {
            const rel = await api(`/store/related?sku=${encodeURIComponent(initialProduct.sku)}`)
            setRelated(rel?.products || [])
          }
        } catch {}
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await api(`/store/product/${encodeURIComponent(sku)}`)
        setProduct(res?.product || null)
        try {
          const rel = await api(`/store/related?sku=${encodeURIComponent(sku)}`)
          setRelated(rel?.products || [])
        } catch {}
      } catch (e) { setErr('Producto no encontrado') }
      finally { setLoading(false) }
    })()
  }, [sku, initialProduct])

  const p = product
  const maxQty = useMemo(()=> Number(p?.stock||0), [p])
  const filteredAttributes = useMemo(()=>{
    const obj = p?.attributes
    if (!obj || typeof obj !== 'object') return null
    const ignore = new Set(['stock_status','low_threshold'])
    const entries = Object.entries(obj).filter(([k])=>!ignore.has(String(k)))
    return entries.length ? Object.fromEntries(entries) : null
  }, [p])

  const addToCart = () => {
    if (!p?.sku) return
    const key = 'cart'
    const raw = localStorage.getItem(key)
    const cart = raw ? JSON.parse(raw) : []
    const idx = cart.findIndex(x=>x.sku===p.sku)
    const already = idx>=0 ? Number(cart[idx].quantity||0) : 0
    const available = Math.max(0, (maxQty || 0) - already)
    const qn = Math.max(1, Math.min(Number(qty)||1, available || 1))
    if (idx>=0) cart[idx].quantity = already + qn
    else cart.push({ sku: p.sku, quantity: qn })
    localStorage.setItem(key, JSON.stringify(cart))
    navigate('/carrito')
  }

  if (loading) return <div className="max-w-5xl mx-auto">Cargando...</div>
  if (err) return <div className="max-w-5xl mx-auto text-red-600">{err}</div>
  if (!p) return <div className="max-w-5xl mx-auto text-gray-600">Producto no encontrado</div>

  const price = (p.price_public ?? p.price ?? 0)
  const hasDiscount = Number(p.discount_percent||0) > 0
  const oldPrice = hasDiscount ? Math.round(Number(price||0) / (1 - Number(p.discount_percent)/100)) : null
  const lowStock = p.available && Number(p.stock||0) > 0 && Number(p.stock||0) <= 5
  const images = Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls : (p.image_url ? [p.image_url] : [])

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6">
      <nav className="text-sm text-gray-600 mb-4 flex items-center gap-2">
        <a className="hover:underline" href="/tienda">Tienda</a>
        <span>/</span>
        <span className="text-gray-800">{p.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="aspect-[4/3] bg-gray-50 overflow-hidden group">
            {images.length ? (
              <img src={images[Math.max(0, Math.min(imgIdx, images.length-1))]} alt={p.name}
                   className="w-full h-full object-cover transform transition-transform duration-300 group-hover:scale-[1.03]" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
            )}
          </div>
          {images.length>1 && (
            <div className="flex gap-2 p-3 border-t bg-white overflow-x-auto">
              {images.map((src, i) => (
                <button key={i} onClick={()=>setImgIdx(i)}
                        className={`w-16 h-16 rounded border overflow-hidden flex-shrink-0 ${i===imgIdx? 'ring-2 ring-blue-500 border-blue-500':'hover:border-gray-400'}`}
                        aria-label={`Imagen ${i+1}`}>
                  <img src={src} alt={`thumb-${i+1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          {p.short_description && (
            <div className="mt-1 text-gray-600 text-sm">{p.short_description}</div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
            {p.brand && <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700">{p.brand}</span>}
            {p.category && <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700">{p.category}</span>}
            {p.sku && <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700">SKU: {p.sku}</span>}
          </div>
          <div className="mt-4 flex items-end gap-3">
            <div className="text-3xl font-bold text-gray-900">${Number(price||0).toLocaleString('es-CO')}</div>
            {hasDiscount && oldPrice ? (
              <div className="text-lg text-gray-500 line-through">${oldPrice.toLocaleString('es-CO')}</div>
            ) : null}
            <span className="text-sm text-gray-500">IVA incl.</span>
          </div>
          <div className="mt-2 text-sm">
            <span className={`inline-block text-xs px-2 py-1 rounded ${p.available? 'bg-green-100 text-green-700':'bg-gray-200 text-gray-700'}`}>
              {p.available? 'Disponible':'Agotado'}
            </span>
            {lowStock && <span className="ml-2 text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">¡Quedan pocas unidades!</span>}
          </div>
          <div className="mt-6 text-gray-700">
            <div className="flex items-center gap-4 border-b">
              <button className={`py-2 px-1 -mb-px ${tab==='descripcion'?'border-b-2 border-blue-600 text-blue-700':'text-gray-600'}`} onClick={()=>setTab('descripcion')}>Descripción</button>
              <button className={`py-2 px-1 -mb-px ${tab==='caracteristicas'?'border-b-2 border-blue-600 text-blue-700':'text-gray-600'}`} onClick={()=>setTab('caracteristicas')}>Características</button>
            </div>
            <div className="mt-3">
              {tab==='descripcion' && (
                <div className="bg-gray-50 border rounded p-3 text-sm leading-6">
                  {p.description ? String(p.description) : 'Sin descripción'}
                </div>
              )}
              {tab==='caracteristicas' && (
                <div className="bg-gray-50 border rounded p-3">
                  {filteredAttributes ? (
                    <ul className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-6">
                      {Object.entries(filteredAttributes).map(([k,v]) => (
                        <li key={k}><span className="text-gray-500">{k}:</span> <span className="text-gray-800">{String(v)}</span></li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-600">Sin características técnicas.</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <label className="text-sm text-gray-700">Cantidad</label>
            <div className="flex items-center border rounded overflow-hidden">
              <button className="px-3 py-2" onClick={()=>setQty(q=>Math.max(1,(Number(q)||1)-1))}>-</button>
              <input className="w-16 text-center outline-none" type="number" min="1" max={Math.max(1, maxQty||1)} value={qty}
                     onChange={e=>{
                       const n = Number(e.target.value)
                       if (!Number.isFinite(n)) { setQty(1); return }
                       const capped = maxQty? Math.max(1, Math.min(n, maxQty)) : Math.max(1, n)
                       setQty(capped)
                     }} />
              <button className="px-3 py-2" onClick={()=>setQty(q=>{
                const n = (Number(q)||1)+1
                return maxQty? Math.min(n, maxQty) : Math.max(1, n)
              })}>+</button>
            </div>
          </div>
          <div className="mt-4">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50 inline-flex items-center gap-2" onClick={addToCart} disabled={!p.available || (maxQty<=0)}>
              <span>🛒</span>
              <span>{p.available ? 'Agregar al carrito' : 'Sin stock'}</span>
            </button>
            <div className="mt-2 text-xs text-gray-500">Pago seguro 🔒 · Envío rápido 🚚</div>
            {p.available && maxQty>0 && (
              <div className="text-xs text-gray-600 mt-1">Stock disponible: {maxQty}</div>
            )}
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-3">Productos relacionados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {related.filter(x=>x.id!==p.id).slice(0,4).map(r => (
            <a key={r.id} href={`/producto/${r.sku}`} className="bg-white rounded-xl border overflow-hidden hover:shadow transition block">
              <div className="aspect-[4/3] bg-gray-100">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
                )}
              </div>
              <div className="p-3">
                <div className="text-xs text-gray-500">{r.brand||'Marca'}</div>
                <div className="text-sm font-medium line-clamp-2">{r.name}</div>
                <div className="mt-1 text-sm font-semibold">${Number(r.price||0).toLocaleString('es-CO')}</div>
              </div>
            </a>
          ))}
          {related.filter(x=>x.id!==p.id).length===0 && (
            <div className="text-gray-600">No hay relacionados</div>
          )}
        </div>
      </section>
    </div>
  )
}
