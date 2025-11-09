import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'

export default function StoreCatalog() {
  const params = useParams()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') || sp.get('search') || '')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [cat, setCat] = useState(params.categoria || sp.get('category') || '')
  const [brand, setBrand] = useState(sp.get('brand') || '')
  const [onlyAvail, setOnlyAvail] = useState(sp.get('inStock') === 'true')
  const [minP, setMinP] = useState(Number(sp.get('minPrice')||0))
  const [maxP, setMaxP] = useState(Number(sp.get('maxPrice')||0) || 999999999)
  const [cats, setCats] = useState([])

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const params = new URLSearchParams()
      if (q) params.set('search', q)
      if (cat) params.set('category', cat)
      if (brand) params.set('brand', brand)
      if (onlyAvail) params.set('inStock', 'true')
      if (Number(minP)>0) params.set('minPrice', String(minP))
      if (Number(maxP)>0 && Number(maxP)<999999999) params.set('maxPrice', String(maxP))
      const qs = params.toString()
      const res = await api(`/store/catalog${qs?`?${qs}`:''}`)
      setItems(res?.products||[])
    } catch {
      setErr('No se pudo cargar el catálogo')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ (async()=>{ try{ const r=await api('/store/categories'); setCats(r?.categories||[]) }catch{} })() }, [])
  useEffect(()=>{ load() }, [])

  // Sync category with path param changes
  useEffect(()=>{
    if (params.categoria && params.categoria !== cat) {
      setCat(params.categoria)
    }
    if (!params.categoria && cat && sp.get('category') !== cat) {
      // Ensure search param reflects selected category when not in path
      const p = new URLSearchParams(sp)
      if (cat) p.set('category', cat); else p.delete('category')
      setSp(p, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.categoria])

  const addToCart = (sku) => {
    const key = 'cart'
    const raw = localStorage.getItem(key)
    const cart = raw ? JSON.parse(raw) : []
    const idx = cart.findIndex(x=>x.sku===sku)
    if (idx>=0) cart[idx].quantity = Number(cart[idx].quantity||0) + 1
    else cart.push({ sku, quantity: 1 })
    localStorage.setItem(key, JSON.stringify(cart))
    alert('Agregado al carrito')
  }

  const categories = useMemo(() => cats.length? cats : Array.from(new Set(items.map(i=>i.category || 'Otros'))).filter(Boolean), [cats, items])
  const brands = useMemo(() => Array.from(new Set(items.map(i=>i.brand).filter(Boolean))), [items])
  const priceStats = useMemo(() => {
    const prices = items.map(i=>Number(i.price||0)).filter(n=>n>0)
    return { min: prices.length? Math.min(...prices):0, max: prices.length? Math.max(...prices):0 }
  }, [items])

  const filtered = useMemo(() => {
    return items.filter(p => {
      if (cat && (p.category||'') !== cat) return false
      if (brand && (p.brand||'') !== brand) return false
      if (onlyAvail && !p.available) return false
      const price = Number(p.price||0)
      if (price < minP) return false
      if (price > maxP) return false
      return true
    })
  }, [items, cat, brand, onlyAvail, minP, maxP])

  useEffect(()=>{
    // Inicializa rango de precio una vez cargado
    if (!loading && items.length) {
      setMinP(priceStats.min)
      setMaxP(priceStats.max)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (cat) params.set('category', cat)
    if (brand) params.set('brand', brand)
    if (onlyAvail) params.set('inStock', 'true')
    if (Number(minP)>0) params.set('minPrice', String(minP))
    if (Number(maxP)>0 && Number(maxP)<999999999) params.set('maxPrice', String(maxP))
    setSp(params, { replace: true })
    load()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      <div className="flex items-center gap-2 mt-4 mb-4">
        <input className="border rounded px-3 py-2 flex-1" placeholder="Buscar productos" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="border rounded px-4 py-2 hover:bg-gray-50" onClick={applyFilters}>Buscar</button>
      </div>
      {err && <div className="text-red-600 mb-2">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Sidebar filtros */}
        <aside className="md:col-span-3">
          <div className="bg-white rounded-xl border p-4 sticky top-4">
            <div className="font-semibold mb-3">Filtros</div>
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-1">Categoría</div>
              <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="">Todas</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-1">Marca</div>
              <select value={brand} onChange={e=>setBrand(e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="">Todas</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-1">Rango de precio</div>
              <div className="flex items-center gap-2">
                <input type="number" className="border rounded px-2 py-1 w-28" value={minP} onChange={e=>setMinP(Number(e.target.value)||0)} />
                <span className="text-gray-500">-</span>
                <input type="number" className="border rounded px-2 py-1 w-28" value={maxP} onChange={e=>setMaxP(Number(e.target.value)||0)} />
              </div>
              {priceStats.max>0 && <div className="text-xs text-gray-500 mt-1">Mín: ${priceStats.min.toLocaleString('es-CO')} · Máx: ${priceStats.max.toLocaleString('es-CO')}</div>}
            </div>
            <div className="mb-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyAvail} onChange={e=>{setOnlyAvail(e.target.checked)}} />
                Solo disponibles
              </label>
            </div>
            <button className="w-full mt-2 border rounded px-3 py-2 hover:bg-gray-50" onClick={applyFilters}>Aplicar filtros</button>
          </div>
        </aside>

        {/* Grid productos */}
        <section className="md:col-span-9">
          {loading ? (
            <div className="text-gray-600">Cargando...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(p => (
                <div key={p.id} className="bg-white rounded-xl border overflow-hidden hover:shadow transition">
                  <a href={`/producto/${p.sku}`} className="block">
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
                    )}
                    <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded ${p.available? 'bg-green-100 text-green-700':'bg-gray-200 text-gray-700'}`}>
                      {p.available? 'Disponible':'Agotado'}
                    </div>
                  </div>
                  </a>
                  <div className="p-4">
                    <div className="text-xs text-gray-500">{p.brand || 'Marca'}</div>
                    <a href={`/producto/${p.sku}`} className="font-medium line-clamp-2 hover:underline">{p.name}</a>
                    <div className="mt-1 text-sm text-gray-600">{p.category || '-'}</div>
                    <div className="mt-2 font-semibold">${Number(p.price||0).toLocaleString('es-CO')} <span className="text-xs text-gray-500">IVA incl.</span></div>
                    <button className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded disabled:opacity-50" disabled={!p.available} onClick={()=>addToCart(p.sku)}>
                      {p.available ? 'Agregar al carrito' : 'Notificarme'}
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length===0 && <div className="text-gray-600">Sin resultados</div>}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
