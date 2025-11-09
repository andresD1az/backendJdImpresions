import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export default function Surtido() {
  const { token, user } = useAuth()
  const [q, setQ] = useState('')
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({ sku:'', quantity:'', reason:'' })
  const [adj, setAdj] = useState({ sku:'', quantity:'', reason:'' })
  const [priceEdit, setPriceEdit] = useState({}) // id -> sale_price_cop
  const [priceReason, setPriceReason] = useState({}) // id -> motivo de cambio de precio

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/manager/inventory/stock?area=surtido${q?`&q=${encodeURIComponent(q)}`:''}`, { token })
      const rows = res.stock || []
      if (rows.length === 0) {
        try {
          await api('/manager/inventory/rebuild-stock', { method:'POST', token })
          const res2 = await api(`/manager/inventory/stock?area=surtido${q?`&q=${encodeURIComponent(q)}`:''}`, { token })
          setStock(res2.stock || [])
        } catch {
          setStock([])
        }
      } else {
        setStock(rows)
      }
    } catch(e) {}
    finally { setLoading(false) }
  }

  useEffect(()=>{ if (token) load() }, [token])

  const transfer = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      const sku = form.sku.trim().toUpperCase()
      const qty = Number(form.quantity)
      if (!sku || !qty || qty<=0) return setError('Complete SKU y cantidad válida')
      await api('/manager/inventory/transfer', { method:'POST', token, body: { sku, fromArea:'bodega', toArea:'surtido', quantity:qty, reason: form.reason } })
      setMsg('Traslado registrado')
      setForm({ sku:'', quantity:'', reason:'' })
      load()
    } catch (e) {
      const code = e?.data?.error
      const detail = code==='insufficient_stock' ? 'Stock insuficiente en bodega'
        : code==='product_not_found' ? 'SKU no encontrado'
        : code==='invalid_quantity' ? 'Cantidad inválida'
        : 'No se pudo registrar el traslado'
      setError(detail)
    }
  }

  const adjust = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      const sku = adj.sku.trim().toUpperCase()
      const qty = Number(adj.quantity)
      if (!sku || (!Number.isFinite(qty)) || qty<0) return setError('SKU y cantidad válida (>= 0)')
      await api('/manager/inventory/movement', { method:'POST', token, body: { sku, area:'surtido', type:'ajuste', quantity:qty, reason: adj.reason } })
      setMsg('Ajuste registrado')
      setAdj({ sku:'', quantity:'', reason:'' })
      load()
    } catch (e) {
      const code = e?.data?.error
      const detail = code==='stock_negative' ? 'No se permite negativo'
        : code==='product_not_found' ? 'SKU no encontrado'
        : code==='invalid_quantity' ? 'Cantidad inválida'
        : 'No se pudo registrar el ajuste'
      setError(detail)
    }
  }

  const fmtCOP = (n)=> new Intl.NumberFormat('es-CO',{minimumFractionDigits:0, maximumFractionDigits:0}).format(Number(n||0))
  const netFrom = (purchase, margin, discount) => {
    const m = 1 + (Number(margin||0)/100)
    const d = 1 - (Number(discount||0)/100)
    return Number(purchase||0) * m * d
  }
  const round1000 = (n) => {
    const base = 1000
    return Math.round(Number(n||0)/base)*base
  }
  const savePrice = async (row) => {
    const isManager = String(user?.role||'').toLowerCase()==='manager'
    const val = Number(priceEdit[row.id])
    if (!Number.isFinite(val) || val<0) return alert('Precio inválido')
    if (row.price_locked && !isManager) return setError('Precio bloqueado: solo gerente puede cambiarlo')
    const body = { sale_price_cop: val }
    if (!isManager) {
      const reason = (priceReason[row.id]||'').trim()
      if (!reason) return setError('Debes indicar motivo del cambio de precio')
      body.price_change_reason = reason
    } else if (priceReason[row.id]) {
      body.price_change_reason = priceReason[row.id]
    }
    try {
      await api(`/manager/products/${row.id}`, { method:'PATCH', token, body })
      setMsg('Precio actualizado')
      setPriceEdit(s=>({ ...s, [row.id]: undefined }))
      setPriceReason(s=>({ ...s, [row.id]: '' }))
      load()
    } catch (e) {
      const code = e?.data?.error
      const detail = code==='price_locked' ? 'Precio bloqueado: solo gerente' : code==='price_reason_required' ? 'Motivo requerido' : 'No se pudo actualizar el precio'
      setError(detail)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Surtidos</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-3">Trasladar desde bodega</h2>
          <div className="mb-2">
            <button type="button" className="text-sm underline" onClick={async()=>{ await api('/manager/inventory/rebuild-stock', { method:'POST', token }); load() }}>Sincronizar stock</button>
          </div>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={transfer}>
            <input className="border rounded px-3 py-2" placeholder="SKU" value={form.sku} onChange={e=>setForm({...form, sku:e.target.value})} required />
            <input className="border rounded px-3 py-2" type="number" min="0" placeholder="Cantidad" value={form.quantity} onChange={e=>setForm({...form, quantity:e.target.value})} required />
            <input className="border rounded px-3 py-2 md:col-span-3" placeholder="Motivo (opcional)" value={form.reason} onChange={e=>setForm({...form, reason:e.target.value})} />
            <div className="md:col-span-3">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded">Registrar traslado</button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-3">Ajuste en surtido</h2>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={adjust}>
            <input className="border rounded px-3 py-2" placeholder="SKU" value={adj.sku} onChange={e=>setAdj({...adj, sku:e.target.value})} required />
            <input className="border rounded px-3 py-2" type="number" min="0" placeholder="Nueva cantidad" value={adj.quantity} onChange={e=>setAdj({...adj, quantity:e.target.value})} required />
            <input className="border rounded px-3 py-2 md:col-span-3" placeholder="Motivo (opcional)" value={adj.reason} onChange={e=>setAdj({...adj, reason:e.target.value})} />
            <div className="md:col-span-3">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded">Guardar ajuste</button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        <div className="flex gap-2 mb-3">
          <input className="border rounded px-3 py-2 flex-1" placeholder="Buscar en surtido (SKU o nombre)" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="border rounded px-3 py-2" onClick={load}>Buscar</button>
        </div>
        {loading ? 'Cargando...' : (
          <div className="overflow-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-sm text-gray-600">
                  <th className="py-1 pr-3">SKU</th>
                  <th className="py-1 pr-3">Producto</th>
                  <th className="py-1 pr-3">Área</th>
                  <th className="py-1 pr-3">Cantidad</th>
                  <th className="py-1 pr-3">Neto (auto)</th>
                  <th className="py-1">Venta (COP)</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((r,i)=> (
                  <tr key={i} className="border-t" onClick={()=>{ setForm(f=>({ ...f, sku: r.sku })); setAdj(a=>({ ...a, sku: r.sku })) }}>
                    <td className="py-2 pr-3">{r.sku}</td>
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3">{r.area}</td>
                    <td className="py-2 pr-3">{r.quantity}</td>
                    <td className="py-2 pr-3">{fmtCOP(netFrom(r.purchase_price, r.margin_percent, r.discount_percent))}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          className="border rounded px-2 py-1 w-28 disabled:opacity-50"
                          type="number"
                          disabled={r.price_locked && String(user?.role||'').toLowerCase()!=='manager'}
                          value={priceEdit[r.id] ?? r.sale_price_cop ?? 0}
                          onChange={e=>setPriceEdit(s=>({ ...s, [r.id]: e.target.value }))}
                        />
                        <button
                          className="border rounded px-2 py-1 text-xs"
                          title="Redondear a 1.000"
                          onClick={()=>setPriceEdit(s=>({ ...s, [r.id]: round1000(priceEdit[r.id] ?? r.sale_price_cop ?? 0) }))}
                          disabled={r.price_locked && String(user?.role||'').toLowerCase()!=='manager'}
                        >Recalcular</button>
                        <input
                          className="border rounded px-2 py-1 w-48"
                          placeholder="Motivo (requerido si no eres gerente)"
                          value={priceReason[r.id]||''}
                          onChange={e=>setPriceReason(s=>({ ...s, [r.id]: e.target.value }))}
                        />
                        <button
                          className="border rounded px-2 py-1 text-xs disabled:opacity-50"
                          onClick={()=>savePrice(r)}
                          disabled={(r.price_locked && String(user?.role||'').toLowerCase()!=='manager')}
                        >Guardar</button>
                        {r.price_locked && String(user?.role||'').toLowerCase()!=='manager' && (
                          <span className="text-xs text-gray-500">Precio bloqueado (solo gerente)</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {stock.length===0 && (<tr><td className="py-2 text-gray-500" colSpan={4}>Sin resultados</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
