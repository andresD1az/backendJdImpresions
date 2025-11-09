import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function ClientInvoices() {
  const { token } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const res = await api('/store/orders', { token })
      setOrders(res?.orders || [])
    } catch {
      setErr('No se pudo cargar el listado de facturas')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ if (token) load() }, [token])

  const download = (id) => {
    if (!token) return
    const base = ''
    const url = `${base}/store/orders/${id}/invoice.pdf?token=${encodeURIComponent(token)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Mis Facturas</h1>
      {err && <div className="text-red-600 mb-2">{err}</div>}
      {loading ? 'Cargando...' : (
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="py-3 px-4">Pedido</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4 text-right">Factura</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="py-3 px-4 text-sm text-gray-700">#{String(o.id).slice(0,8)}</td>
                  <td className="py-3 px-4">{new Date(o.occurred_at).toLocaleDateString('es-CO')}</td>
                  <td className="py-3 px-4 font-medium">${Number(o.total||0).toLocaleString('es-CO')}</td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-blue-700 hover:underline text-sm" onClick={()=>download(o.id)}>Descargar PDF</button>
                  </td>
                </tr>
              ))}
              {orders.length===0 && <tr><td className="py-3 px-4 text-gray-600" colSpan={4}>No hay facturas disponibles</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
