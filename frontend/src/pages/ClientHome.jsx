import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

export default function ClientHome() {
  const [items, setItems] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const best = await api('/store/catalog?sort=best_sellers&limit=6')
        setItems(best?.products || [])
        try { const c = await api('/store/categories'); setCats(c?.categories||[]) } catch {}
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const categories = useMemo(() => cats.slice(0,6).map(name => ({ name, count: 0 })), [cats])

  const best = useMemo(() => items.slice(0,8), [items])

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8 md:p-12 mt-4">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <div className="text-sm opacity-90 mb-1">Shop</div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">Back to School</h1>
            <p className="mt-3 text-blue-50 max-w-xl">Encuentra todo lo que necesitas con nuestras ofertas especiales.</p>
            <a href="/tienda" className="inline-block mt-6 bg-white text-blue-700 font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-50">Ver Productos</a>
          </div>
          <div className="flex-1 hidden md:block">
            <div className="w-full h-40 md:h-48 bg-white/10 rounded-xl backdrop-blur flex items-center justify-center">
              <span className="opacity-80">JD Impressions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Categories */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Categorías destacadas</h2>
        {loading ? (
          <div className="text-gray-600">Cargando...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {categories.map((c, i) => (
              <a key={i} href={`/tienda?q=${encodeURIComponent(c.name)}`} className="group bg-white border rounded-xl p-4 hover:shadow transition flex items-center justify-center text-center">
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">&nbsp;</div>
                </div>
              </a>
            ))}
            {categories.length===0 && <div className="text-gray-600 col-span-2 md:col-span-6">Sin categorías</div>}
          </div>
        )}
      </section>

      {/* Best Sellers (placeholder: top items) */}
      <section className="mt-10 mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Best Sellers</h2>
          <a href="/tienda" className="text-blue-700 hover:underline text-sm">Ver todos</a>
        </div>
        {loading ? (
          <div className="text-gray-600">Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {best.map(p => (
              <a key={p.id} href={`/producto/${p.sku}`} className="bg-white rounded-xl border overflow-hidden hover:shadow transition block">
                <div className="aspect-[4/3] bg-gray-100">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="text-xs text-gray-500">{p.brand || 'Marca'}</div>
                  <div className="font-medium line-clamp-2 hover:underline">{p.name}</div>
                  <div className="mt-1 text-sm text-gray-600">{p.category || '-'}</div>
                  <div className="mt-2 font-semibold">${Number(p.price||0).toLocaleString('es-CO')} <span className="text-xs text-gray-500">IVA incl.</span></div>
                </div>
              </a>
            ))}
          </div>
        )}
        {best.length===0 && <div className="text-gray-600">Sin productos</div>}
      </section>

      {/* Footer removido: lo provee ClientShell */}
    </div>
  )
}
