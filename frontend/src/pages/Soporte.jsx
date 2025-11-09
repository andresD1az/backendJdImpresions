import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function Soporte() {
  const { token } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [status, setStatus] = useState('')
  const [sel, setSel] = useState(null)
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!token) return
    setLoading(true); setErr('')
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : ''
      const res = await api(`/manager/returns${qs}`, { token })
      setList(res?.returns || [])
    } catch {
      setErr('No se pudo cargar la bandeja de devoluciones')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ if (token) load() }, [token, status])

  const open = (r) => {
    setSel(r)
    const its = Array.isArray(r.items) ? r.items : []
    setItems(its.map(it => ({ sku: it.sku, quantity: Number(it.quantity||0) })))
  }

  const totalRequests = useMemo(()=> list.length, [list])

  const setQty = (idx, q) => {
    setItems(arr => arr.map((it,i)=> i===idx ? { ...it, quantity: Math.max(0, Number(q)||0) } : it))
  }

  const approve = async () => {
    if (!sel || !token) return
    if (!items.length || items.every(it => !Number(it.quantity))) {
      alert('No hay cantidades para reponer.')
      return
    }
    if (!window.confirm('¿Aprobar devolución y reponer stock a bodega?')) return
    setSaving(true)
    try {
      await api(`/manager/returns/${sel.id}`, { method: 'PATCH', token, body: { status: 'approved', items } })
      alert('Devolución aprobada.')
      setSel(null)
      load()
    } catch {
      alert('No se pudo aprobar la devolución.')
    } finally { setSaving(false) }
  }

  const reject = async () => {
    if (!sel || !token) return
    if (!window.confirm('¿Rechazar devolución?')) return
    setSaving(true)
    try {
      await api(`/manager/returns/${sel.id}`, { method: 'PATCH', token, body: { status: 'rejected' } })
      alert('Devolución rechazada.')
      setSel(null)
      load()
    } catch {
      alert('No se pudo rechazar la devolución.')
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      <h1 className="text-2xl font-semibold mb-4">Soporte · Devoluciones</h1>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl border">
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="font-semibold">Bandeja ({totalRequests})</div>
            <div className="flex items-center gap-2 text-sm">
              <label>Estado</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} className="border rounded px-2 py-1">
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="approved">Aprobado</option>
                <option value="rejected">Rechazado</option>
              </select>
            </div>
          </div>
          {err && <div className="px-4 py-2 text-red-600">{err}</div>}
          {loading ? (
            <div className="px-4 py-3 text-gray-600">Cargando...</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left py-2 px-3">ID</th>
                    <th className="text-left py-2 px-3">Fecha</th>
                    <th className="text-left py-2 px-3">Pedido</th>
                    <th className="text-left py-2 px-3">Cliente</th>
                    <th className="text-left py-2 px-3">Estado</th>
                    <th className="text-right py-2 px-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 px-3">#{String(r.id).slice(0,8)}</td>
                      <td className="py-2 px-3">{r.created_at ? new Date(r.created_at).toLocaleString('es-CO') : '-'}</td>
                      <td className="py-2 px-3">#{String(r.sale_id).slice(0,8)}</td>
                      <td className="py-2 px-3">{r.customer_email || '-'}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-1 rounded ${r.status==='approved'?'bg-green-100 text-green-700':r.status==='rejected'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-800'}`}>{r.status}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button className="text-blue-700 hover:underline" onClick={()=>open(r)}>Ver</button>
                      </td>
                    </tr>
                  ))}
                  {list.length===0 && <tr><td className="py-3 px-3 text-gray-600" colSpan={6}>Sin solicitudes</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b font-semibold">Detalle</div>
          {!sel ? (
            <div className="p-4 text-sm text-gray-600">Selecciona una solicitud para ver y decidir.</div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="text-sm text-gray-600">Solicitud: #{String(sel.id).slice(0,8)} · Pedido #{String(sel.sale_id).slice(0,8)}</div>
              <div className="text-sm text-gray-600">Estado actual: {sel.status}</div>
              <div className="text-sm text-gray-600">Motivo: {sel.reason || '-'}</div>
              <div className="mt-2">
                <div className="font-medium mb-2">Items devueltos</div>
                <div className="bg-gray-50 rounded">
                  {items.map((it,idx)=>(
                    <div key={idx} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                      <div className="text-sm">{it.sku}</div>
                      <input type="number" min={0} className="w-24 border rounded px-2 py-1 text-sm" value={it.quantity} onChange={e=>setQty(idx, e.target.value)} />
                    </div>
                  ))}
                  {items.length===0 && <div className="px-3 py-2 text-sm text-gray-600">Sin items</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={saving || sel.status!=='pending'} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50" onClick={approve}>Aprobar</button>
                <button disabled={saving || sel.status!=='pending'} className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50" onClick={reject}>Rechazar</button>
                <button className="px-3 py-2 rounded border" onClick={()=>setSel(null)}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
