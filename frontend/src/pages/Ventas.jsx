import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export default function Ventas() {
  const { token } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState(null)
  const [savingId, setSavingId] = useState(null)

  const load = async (p=1) => {
    setLoading(true); setErr('')
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      params.set('page', String(p))
      const res = await api(`/manager/sales?${params.toString()}`, { token })
      setList(res?.sales||[])
      setPage(p)
    } catch {
      setErr('No se pudieron cargar las ventas')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ if (token) load(1) }, [token])

  const openDetail = async (id) => {
    try {
      const res = await api(`/manager/sales/${id}`, { token })
      setDetail(res)
    } catch {}
  }

  const changeStatus = async (id, st) => {
    try {
      setSavingId(id)
      await api(`/manager/sales/${id}/status`, { token, method: 'PATCH', body: { status: st } })
      // refresh current page
      await load(page)
      if (detail?.sale?.id === id) setDetail({ ...detail, sale: { ...detail.sale, fulfillment_status: st } })
    } catch (e) {
      setErr('No se pudo actualizar el estado')
    } finally { setSavingId(null) }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Ventas</h1>
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm text-gray-600">Buscar</label>
          <input className="border rounded px-3 py-1.5" placeholder="ID o email" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Estado</label>
          <select className="border rounded px-3 py-1.5" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="pending">pending</option>
            <option value="paid">paid</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <button className="border rounded px-3 py-1.5 hover:bg-gray-50" onClick={()=>load(1)}>Aplicar</button>
      </div>

      {err && <div className="text-red-600 mb-2">{err}</div>}
      {loading ? 'Cargando...' : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Pago</th>
                <th className="py-3 px-4">Logística</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="py-3 px-4 text-sm text-gray-700">#{String(o.id).slice(0,8)}</td>
                  <td className="py-3 px-4">{new Date(o.occurred_at).toLocaleString('es-CO')}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{o.customer_email||'-'}</td>
                  <td className="py-3 px-4 font-medium">${Number(o.total||0).toLocaleString('es-CO')}</td>
                  <td className="py-3 px-4"><span className={`text-xs px-2 py-1 rounded ${o.status==='paid'?'bg-green-100 text-green-700':o.status==='cancelled'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-700'}`}>{o.status||'pending'}</span></td>
                  <td className="py-3 px-4">
                    <select className="border rounded px-2 py-1 text-sm"
                            value={o.fulfillment_status||'pending'}
                            onChange={e=>changeStatus(o.id, e.target.value)}
                            disabled={savingId===o.id}>
                      <option value="pending">pending</option>
                      <option value="pagando">pagando</option>
                      <option value="enviado">enviado</option>
                      <option value="recibido">recibido</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button className="text-blue-700 hover:underline text-sm" onClick={()=>openDetail(o.id)}>Ver detalles</button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length===0 && <tr><td className="py-3 px-4 text-gray-600" colSpan={6}>No hay ventas</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={()=>setDetail(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Venta #{String(detail?.sale?.id||'').slice(0,8)}</div>
              <button onClick={()=>setDetail(null)}>✕</button>
            </div>
            <div className="p-5">
              <div className="text-sm text-gray-600 mb-2">Cliente: {detail?.sale?.customer_email||'-'}</div>
              <div className="text-sm text-gray-600 mb-2">Pago: {detail?.sale?.status||'-'}</div>
              <div className="text-sm text-gray-600 mb-4">Logística:
                <select className="border rounded px-2 py-1 ml-2 text-sm"
                        value={detail?.sale?.fulfillment_status||'pending'}
                        onChange={e=>changeStatus(detail?.sale?.id, e.target.value)}
                        disabled={savingId===detail?.sale?.id}>
                  <option value="pending">pending</option>
                  <option value="pagando">pagando</option>
                  <option value="enviado">enviado</option>
                  <option value="recibido">recibido</option>
                </select>
              </div>
              <div className="text-sm text-gray-600 mb-4">Total: ${Number(detail?.sale?.total||0).toLocaleString('es-CO')}</div>
              <div className="font-semibold mb-2">Ítems</div>
              <div className="bg-gray-50 rounded">
                {(detail?.items||[]).map((it,idx)=> (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                    <div className="text-sm">{it.sku} - {it.name}</div>
                    <div className="text-sm text-gray-600">x{it.quantity}</div>
                    <div className="text-sm font-medium">${Number(it.unit_price||0).toLocaleString('es-CO')}</div>
                  </div>
                ))}
                {(!detail?.items || !detail.items.length) && <div className="px-3 py-2 text-sm text-gray-600">Sin items</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
