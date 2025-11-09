import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function Manager() {
  const { token } = useAuth()
  const [kpis, setKpis] = useState(null)
  const [summary, setSummary] = useState({ low_stock: [], last_movements: [] })
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('7d') // today|7d|30d|custom
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  // Users management state
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersQ, setUsersQ] = useState('')
  const [usersEstado, setUsersEstado] = useState('') // '', 'active', 'suspended', 'de_baja'
  const [usersPage, setUsersPage] = useState(1)
  const [usersPageSize] = useState(25)
  const [editUser, setEditUser] = useState(null)

  const queryParams = useMemo(() => {
    let f = from, t = to
    const now = new Date()
    if (range !== 'custom') {
      const end = new Date(now)
      const start = new Date(now)
      if (range === 'today') {
        // midnight to now
        start.setHours(0,0,0,0)
      } else if (range === '7d') {
        start.setDate(start.getDate() - 7)
      } else if (range === '30d') {
        start.setDate(start.getDate() - 30)
      }
      f = start.toISOString()
      t = end.toISOString()
    }
    const qp = []
    if (f) qp.push(`from=${encodeURIComponent(f)}`)
    if (t) qp.push(`to=${encodeURIComponent(t)}`)
    const qs = qp.length ? `?${qp.join('&')}` : ''
    return qs
  }, [range, from, to])

  const load = async () => {
    setLoading(true)
    try {
      const [k, s] = await Promise.all([
        api(`/manager/kpis/overview${queryParams}`, { token }),
        api('/manager/inventory/summary', { token }),
      ])
      setKpis(k)
      setSummary(s)
    } catch (e) {}
    finally { setLoading(false) }
  }

  useEffect(()=>{ if (token) load() }, [token, queryParams])

  const loadUsers = async (page=1) => {
    if (!token) return
    setUsersLoading(true)
    try {
      const qp = new URLSearchParams()
      if (usersQ) qp.set('q', usersQ)
      if (usersEstado) qp.set('estado', usersEstado)
      qp.set('page', String(page))
      qp.set('pageSize', String(usersPageSize))
      // Mostrar únicamente clientes
      qp.set('role', 'client')
      const data = await api(`/manager/users?${qp.toString()}`, { token })
      setUsers(data?.users || [])
      setUsersPage(page)
    } catch {}
    finally { setUsersLoading(false) }
  }

  useEffect(()=>{ if (token) loadUsers(1) }, [token])

  const onImport = async () => {
    try {
      const parsed = JSON.parse(importText)
      await api('/manager/import', { method: 'POST', token, body: parsed })
      setShowImport(false)
      setImportText('')
      load()
    } catch (e) {
      alert('JSON inválido o error al importar')
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Panel del gerente</h1>
      {/* Usuarios (clientes) - sección movida arriba para mejor visibilidad */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <div className="flex items-end gap-2 mb-3">
          <div>
            <label className="block text-sm mb-1">Buscar</label>
            <input className="border rounded px-2 py-1" placeholder="email o nombre" value={usersQ} onChange={e=>setUsersQ(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Estado</label>
            <select className="border rounded px-2 py-1" value={usersEstado} onChange={e=>setUsersEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
              <option value="de_baja">De baja</option>
            </select>
          </div>
          <button onClick={()=>loadUsers(1)} className="ml-auto bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded">Aplicar</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-1 pr-3">Email</th>
                <th className="py-1 pr-3">Nombre</th>
                <th className="py-1 pr-3">Rol</th>
                <th className="py-1 pr-3">Verificado</th>
                <th className="py-1 pr-3">Estado usuario</th>
                <th className="py-1 pr-3">Compras</th>
                <th className="py-1">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading && (
                <tr><td className="py-2" colSpan={6}>Cargando...</td></tr>
              )}
              {!usersLoading && users.length === 0 && (
                <tr><td className="py-2 text-gray-500" colSpan={6}>Sin resultados</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3">{u.full_name || '-'}</td>
                  <td className="py-2 pr-3">{u.role}</td>
                  <td className="py-2 pr-3">{u.is_email_verified ? 'Sí' : 'No'}</td>
                  <td className="py-2 pr-3">{u.estado_usuario}</td>
                  <td className="py-2 pr-3">{u.purchase_count ?? 0}</td>
                  <td className="py-2 flex gap-3">
                    <button className="text-blue-700 hover:underline" onClick={()=>setEditUser(u)}>Editar</button>
                    <button className="text-red-600 hover:underline" onClick={async ()=>{
                      if (!confirm(`¿Eliminar al cliente ${u.email}? Esta acción no se puede deshacer.`)) return
                      try {
                        await api(`/manager/users/${u.id}`, { method:'DELETE', token })
                        loadUsers(usersPage)
                      } catch (e) {
                        try {
                          const err = await e.json()
                          if (err?.error === 'cannot_delete_has_sales') {
                            alert(`No se puede eliminar: el usuario tiene ${err.count} compras registradas.`)
                            return
                          }
                        } catch {}
                        alert('Error al eliminar')
                      }
                    }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex gap-2">
          <button className="border rounded px-3 py-1" onClick={()=>{ if (usersPage>1) loadUsers(usersPage-1) }} disabled={usersPage<=1}>Anterior</button>
          <div className="px-2 py-1">Página {usersPage}</div>
          <button className="border rounded px-3 py-1" onClick={()=>loadUsers(usersPage+1)}>Siguiente</button>
        </div>
      </div>

      {loading && <div>Cargando...</div>}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded shadow p-4">
            <div className="text-sm text-gray-500">Stock Bodega</div>
            <div className="text-2xl font-bold">{kpis.stock_bodega_total}</div>
          </div>

      

      {editUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded shadow p-4">
            <h3 className="text-lg font-semibold mb-3">Editar usuario</h3>
            <form onSubmit={async (e)=>{
              e.preventDefault()
              try {
                const body = {
                  full_name: editUser.full_name,
                  role: editUser.role,
                  estado_usuario: editUser.estado_usuario
                }
                await api(`/manager/users/${editUser.id}`, { method:'PATCH', token, body })
                setEditUser(null)
                loadUsers(usersPage)
              } catch { alert('Error al guardar') }
            }}>
              <label className="block text-sm">Nombre</label>
              <input className="border rounded px-2 py-1 w-full mb-2" value={editUser.full_name || ''} onChange={e=>setEditUser({...editUser, full_name: e.target.value})} />
              <label className="block text-sm">Rol</label>
              <select className="border rounded px-2 py-1 w-full mb-2" value={editUser.role || 'user'} onChange={e=>setEditUser({...editUser, role: e.target.value})}>
                <option value="user">user</option>
                <option value="client">client</option>
                <option value="manager">manager</option>
                <option value="bodega">bodega</option>
                <option value="surtido">surtido</option>
                <option value="descargue">descargue</option>
              </select>
              <label className="block text-sm">Estado usuario</label>
              <select className="border rounded px-2 py-1 w-full mb-4" value={editUser.estado_usuario || 'active'} onChange={e=>setEditUser({...editUser, estado_usuario: e.target.value})}>
                <option value="active">Activo</option>
                <option value="suspended">Suspendido</option>
                <option value="de_baja">De baja</option>
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" className="px-3 py-2 rounded border" onClick={()=>setEditUser(null)}>Cancelar</button>
                <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
          <div className="bg-white rounded shadow p-4">
            <div className="text-sm text-gray-500">Stock Surtido</div>
            <div className="text-2xl font-bold">{kpis.stock_surtido_total}</div>
          </div>
          <div className="bg-white rounded shadow p-4">
            <div className="text-sm text-gray-500">Ventas (rango)</div>
            <div className="text-2xl font-bold">{kpis.ventas_total}</div>
          </div>
          <div className="bg-white rounded shadow p-4">
            <div className="text-sm text-gray-500">Devoluciones (rango)</div>
            <div className="text-2xl font-bold">{kpis.devoluciones_total}</div>
          </div>
        </div>
      )}

      <div className="flex items-end gap-3 mb-4">
        <div>
          <label className="block text-sm mb-1">Rango</label>
          <select className="border rounded px-2 py-1" value={range} onChange={e=>setRange(e.target.value)}>
            <option value="today">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        {range === 'custom' && (
          <>
            <div>
              <label className="block text-sm mb-1">Desde</label>
              <input type="datetime-local" className="border rounded px-2 py-1" value={from} onChange={e=>setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">Hasta</label>
              <input type="datetime-local" className="border rounded px-2 py-1" value={to} onChange={e=>setTo(e.target.value)} />
            </div>
          </>
        )}
        <button onClick={load} className="ml-auto bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded">Aplicar</button>
        <button onClick={()=>setShowImport(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded">Importar datos</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-3">Stock bajo</h2>
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-sm text-gray-600">
                <th className="py-1 pr-3">Producto</th>
                <th className="py-1 pr-3">Área</th>
                <th className="py-1">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {summary.low_stock.length === 0 && (
                <tr><td className="py-2 text-gray-500" colSpan={3}>Sin alertas</td></tr>
              )}
              {summary.low_stock.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2 pr-3">{r.area}</td>
                  <td className="py-2">{r.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-3">Últimos movimientos</h2>
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-sm text-gray-600">
                <th className="py-1 pr-3">Fecha</th>
                <th className="py-1 pr-3">Producto</th>
                <th className="py-1 pr-3">Área</th>
                <th className="py-1 pr-3">Tipo</th>
                <th className="py-1">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {summary.last_movements.map((m, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2 pr-3">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{m.name}</td>
                  <td className="py-2 pr-3">{m.area}</td>
                  <td className="py-2 pr-3">{m.type}</td>
                  <td className="py-2">{m.quantity}</td>
                </tr>
              ))}
              {summary.last_movements.length === 0 && (
                <tr><td className="py-2 text-gray-500" colSpan={5}>Sin movimientos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded shadow p-4">
            <h3 className="text-lg font-semibold mb-2">Importar JSON</h3>
            <p className="text-sm text-gray-600 mb-2">Pega un objeto con claves products, inventory_stock e inventory_movements.</p>
            <textarea aria-label="Editor JSON" className="w-full h-60 border rounded p-2 font-mono text-sm" value={importText} onChange={e=>setImportText(e.target.value)} placeholder='{"products":[], "inventory_stock":[], "inventory_movements":[]}' />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={()=>setShowImport(false)} className="px-3 py-2 rounded border">Cancelar</button>
              <button onClick={onImport} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Importar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
