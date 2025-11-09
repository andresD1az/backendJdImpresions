import React, { useEffect, useState } from 'react'
import { api, API_BASE } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function MyOrders() {
  const { token } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [detail, setDetail] = useState(null)
  const [rtOpen, setRtOpen] = useState(false)
  const [rtReason, setRtReason] = useState('')
  const [rtAccepted, setRtAccepted] = useState(false)
  const [rtItems, setRtItems] = useState([])

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const res = await api('/store/orders', { token })
      setList(res?.orders||[])
    } catch {
      setErr('No se pudieron cargar tus pedidos')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ if (token) load() }, [token])

  const openDetail = async (id) => {
    try {
      const res = await api(`/store/orders/${id}`, { token })
      setDetail(res)
    } catch {}
  }

  const downloadInvoice = (id) => {
    if (!token) return
    const url = `${API_BASE}/store/orders/${id}/invoice.pdf?token=${encodeURIComponent(token)}`
    // Open in new tab to trigger browser PDF viewer/download
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const requestReturn = async (id) => {
    if (!token) return
    // Load items for modal
    let orderItems = detail?.order?.id === id ? (detail?.items||[]) : []
    if (!orderItems.length) {
      try { const d = await api(`/store/orders/${id}`, { token }); orderItems = d?.items||[] } catch {}
    }
    setRtItems(orderItems.map(it => ({ sku: it.sku, name: it.name, quantity: Number(it.quantity||0) })))
    setRtReason('')
    setRtAccepted(false)
    setRtOpen(true)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6">
      <h1 className="text-2xl font-semibold mb-4">Historial de pedidos</h1>
      {err && <div className="text-red-600 mb-2">{err}</div>}
      {loading ? 'Cargando...' : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Pago</th>
                <th className="py-3 px-4">Envío</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="py-3 px-4 text-sm text-gray-700">#{String(o.id).slice(0,8)}</td>
                  <td className="py-3 px-4">{new Date(o.occurred_at).toLocaleDateString('es-CO')}</td>
                  <td className="py-3 px-4 font-medium">${Number(o.total||0).toLocaleString('es-CO')}</td>
                  <td className="py-3 px-4"><span className={`text-xs px-2 py-1 rounded ${o.status==='paid'?'bg-green-100 text-green-700':o.status==='cancelled'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-700'}`}>{o.status||'pending'}</span></td>
                  <td className="py-3 px-4"><span className={`text-xs px-2 py-1 rounded ${o.fulfillment_status==='enviado'?'bg-blue-100 text-blue-700':o.fulfillment_status==='recibido'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-700'}`}>{o.fulfillment_status||'pending'}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button className="text-blue-700 hover:underline text-sm" onClick={()=>openDetail(o.id)}>Ver detalles</button>
                      <button className="text-gray-700 hover:underline text-sm" onClick={()=>downloadInvoice(o.id)}>Descargar factura</button>
                      <button className="text-orange-700 hover:underline text-sm" onClick={()=>requestReturn(o.id)}>Solicitar devolución</button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length===0 && <tr><td className="py-3 px-4 text-gray-600" colSpan={5}>No tienes pedidos aún</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal devolución */}
      {rtOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={()=>setRtOpen(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Solicitud de devolución</div>
              <button onClick={()=>setRtOpen(false)}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-gray-50 rounded p-3 h-32 overflow-auto text-sm text-gray-700">
                <div className="font-medium mb-1">Política de devoluciones</div>
                <p>El cliente acepta la política de devoluciones con aviso dentro de 5 días calendario, producto en buen estado y con empaque original, conforme a la ley aplicable. La empresa JD Impressions evaluará cada caso y podrá aprobar, rechazar o solicitar información adicional. Al aceptar, confirmas haber leído y aceptado esta política.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={rtAccepted} onChange={e=>setRtAccepted(e.target.checked)} />
                He leído y acepto la política de devoluciones
              </label>
              <div>
                <div className="font-medium mb-1">Motivo</div>
                <textarea className="border rounded w-full px-3 py-2 h-20" placeholder="Describe el motivo (opcional)" value={rtReason} onChange={e=>setRtReason(e.target.value)} />
              </div>
              <div>
                <div className="font-medium mb-1">Items del pedido</div>
                <div className="bg-gray-50 rounded">
                  {rtItems.map((it,idx)=> (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                      <div className="text-sm">{it.sku} - {it.name}</div>
                      <input type="number" min={0} max={it.quantity} className="border rounded w-24 px-2 py-1 text-sm" value={it.quantity} onChange={e=>{
                        const v = Math.max(0, Number(e.target.value)||0)
                        setRtItems(arr => arr.map((x,i)=> i===idx? { ...x, quantity: v } : x))
                      }} />
                    </div>
                  ))}
                  {rtItems.length===0 && <div className="px-3 py-2 text-sm text-gray-600">Sin items</div>}
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button className="px-3 py-2 rounded border" onClick={()=>setRtOpen(false)}>Cancelar</button>
                <button disabled={!rtAccepted} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" onClick={async()=>{
                  try {
                    const orderId = detail?.order?.id || (list[0]?.id) // fallback
                    const payloadItems = rtItems.filter(i=>Number(i.quantity)>0).map(i=>({ sku: i.sku, quantity: Number(i.quantity||0) }))
                    await api('/store/returns', { method: 'POST', token, body: { sale_id: orderId, items: payloadItems, reason: rtReason, accepted_policy: true } })
                    alert('Solicitud de devolución enviada.')
                    setRtOpen(false)
                  } catch { alert('No se pudo enviar la solicitud.') }
                }}>Enviar solicitud</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={()=>setDetail(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Pedido #{String(detail?.order?.id||'').slice(0,8)}</div>
              <button onClick={()=>setDetail(null)}>✕</button>
            </div>
            <div className="p-5">
              <div className="text-sm text-gray-600 mb-3">Fecha: {detail?.order?.occurred_at ? new Date(detail.order.occurred_at).toLocaleString('es-CO') : '-'}</div>
              <div className="text-sm text-gray-600 mb-3">Estado: {detail?.order?.status || '-'}</div>
              <div className="text-sm text-gray-600 mb-3">Total: ${Number(detail?.order?.total||0).toLocaleString('es-CO')}</div>
              <div className="font-semibold mb-2">Items</div>
              <div className="bg-gray-50 rounded">
                {(detail?.items||[]).map((it,idx)=> (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                    <div className="text-sm">{it.sku || it.product_name || 'Producto'}</div>
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
