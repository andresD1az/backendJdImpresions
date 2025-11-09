import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export default function Inventory() {
  const { token, user } = useAuth()
  const [q, setQ] = useState('')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ sku:'', name:'', category:'', unit:'', purchase_price:'', margin_percent:'', discount_percent:'', sale_price_cop:'', description:'', image_url:'', image_urls_text:'', attributes_text:'' })
  const [editingId, setEditingId] = useState('')
  const [editDraft, setEditDraft] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [opMsg, setOpMsg] = useState('')
  const [opErr, setOpErr] = useState('')
  const [listError, setListError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRows, setHistoryRows] = useState([])
  const [historyTitle, setHistoryTitle] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsProduct, setDetailsProduct] = useState(null)
  const [detailsDraft, setDetailsDraft] = useState({ description:'', image_url:'', image_urls_text:'', attributes_text:'' })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkAction, setBulkAction] = useState('') // publish|draft|trash|delete|discount
  const [bulkDiscount, setBulkDiscount] = useState('')

  const fmtCOP = (n) => {
    const num = Number(n||0)
    return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)
  }

  const toggleSelectAll = (checked) => {
    if (checked) setSelectedIds(new Set(list.map(p=>p.id)))
    else setSelectedIds(new Set())
  }
  const toggleSelectOne = (id, checked) => {
    setSelectedIds(prev=>{ const s = new Set(prev); if (checked) s.add(id); else s.delete(id); return s })
  }
  const runBulk = async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return alert('Selecciona al menos un producto')
    try {
      if (bulkAction === 'delete') {
        const ok = confirm(`Eliminar permanentemente ${ids.length} producto(s)?`)
        if (!ok) return
        await Promise.all(ids.map(id => api(`/manager/products/${id}`, { method:'DELETE', token })))
      } else if (bulkAction === 'trash') {
        await Promise.all(ids.map(id => api(`/manager/products/${id}`, { method:'PATCH', token, body: { status: 'trash' } })))
      } else if (bulkAction === 'publish') {
        await Promise.all(ids.map(id => api(`/manager/products/${id}`, { method:'PATCH', token, body: { status: 'published' } })))
      } else if (bulkAction === 'draft') {
        await Promise.all(ids.map(id => api(`/manager/products/${id}`, { method:'PATCH', token, body: { status: 'draft' } })))
      } else if (bulkAction === 'discount') {
        const v = Number(bulkDiscount)
        if (!Number.isFinite(v) || v < 0) return alert('Descuento inválido')
        await Promise.all(ids.map(id => api(`/manager/products/${id}`, { method:'PATCH', token, body: { discount_percent: v } })))
      } else {
        return alert('Selecciona una acción')
      }
      setSelectedIds(new Set())
      setBulkAction('')
      setBulkDiscount('')
      load()
    } catch (e) {
      const msg = (e && (e.message || e.error || e.statusText)) || 'No se pudo aplicar la acción masiva'
      alert(msg)
    }
  }

  const openDetails = (p) => {
    setDetailsProduct(p)
    setDetailsDraft({
      description: p.description || '',
      image_url: p.image_url || '',
      image_urls_text: Array.isArray(p.image_urls) ? p.image_urls.join('\n') : '',
      attributes_text: p.attributes ? JSON.stringify(p.attributes, null, 2) : ''
    })
    setDetailsOpen(true)
  }

  const saveDetails = async () => {
    if (!detailsProduct) return
    const imagesArr = (detailsDraft.image_urls_text || '')
      .split(/\n|,/).map(s=>s.trim()).filter(Boolean)
    let attrsObj
    try { attrsObj = detailsDraft.attributes_text ? JSON.parse(detailsDraft.attributes_text) : undefined } catch {
      alert('JSON de características inválido'); return
    }
    await update(detailsProduct.id, {
      description: detailsDraft.description,
      image_url: detailsDraft.image_url,
      image_urls: imagesArr.length ? imagesArr : [],
      attributes: attrsObj || null,
    })
    setDetailsOpen(false)
    setDetailsProduct(null)
  }
  const fmtDate = (s) => {
    if (!s) return ''
    try { return new Date(s).toLocaleString('es-CO') } catch { return String(s) }
  }

  const handleStockChange = (field, rawVal) => {
    if (!editDraft) return
    let v = Number(rawVal)
    if (!Number.isFinite(v)) v = 0
    let b = Number(editDraft.stock_bodega||0)
    let s = Number(editDraft.stock_surtido||0)
    let total = Number(editDraft.original_total||0)

    // Negative value means reduce total by its magnitude; value itself becomes 0 in that area
    if (field === 'stock_bodega') {
      if (v < 0) {
        const newTotal = Math.max(0, total + v) // v is negative
        b = 0
        s = Math.max(0, newTotal - b)
        total = newTotal
      } else {
        b = v
        const newS = Math.max(0, total - b)
        s = newS
      }
    } else { // stock_surtido
      if (v < 0) {
        const newTotal = Math.max(0, total + v)
        s = 0
        b = Math.max(0, newTotal - s)
        total = newTotal
      } else {
        s = v
        const newB = Math.max(0, total - s)
        b = newB
      }
    }

    // If both are explicitly set to 0, clear total to 0
    if (v === 0 && ((field==='stock_bodega' && s===0) || (field==='stock_surtido' && b===0))) {
      total = 0
      b = 0
      s = 0
    }

    setEditDraft(d => ({ ...d, stock_bodega: b, stock_surtido: s, original_total: total }))
  }

  const netFrom = (purchase, margin, discount) => {
    const m = 1 + (Number(margin||0)/100)
    const d = 1 - (Number(discount||0)/100)
    return Number(purchase||0) * m * d
  }

  const round1000 = (n) => {
    const base = 1000
    return Math.round(Number(n||0) / base) * base
  }

  const load = async () => {
    setLoading(true)
    setListError('')
    try {
      const res = await api(`/manager/products${q?`?q=${encodeURIComponent(q)}`:''}`, { token })
      setList(res.products || [])
    } catch(e) { setListError('No se pudo cargar productos') }
    finally { setLoading(false) }
  }

  useEffect(()=>{ if (token) load() }, [token])

  const save = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      const imagesArr = (form.image_urls_text || '')
        .split(/\n|,/).map(s=>s.trim()).filter(Boolean)
      let attrsObj
      try { attrsObj = form.attributes_text ? JSON.parse(form.attributes_text) : undefined } catch { attrsObj = undefined }
      await api('/manager/products', { method:'POST', token, body: {
        ...form,
        purchase_price: Number(form.purchase_price)||0,
        margin_percent: Number(form.margin_percent)||0,
        discount_percent: Number(form.discount_percent)||0,
        sale_price_cop: form.sale_price_cop !== '' && form.sale_price_cop !== undefined ? Number(form.sale_price_cop)||0 : undefined,
        image_urls: imagesArr.length ? imagesArr : undefined,
        attributes: attrsObj,
      } })
      setForm({ sku:'', name:'', category:'', unit:'', purchase_price:'', margin_percent:'', discount_percent:'', sale_price_cop:'', description:'', image_url:'', image_urls_text:'', attributes_text:'' })
      setMsg('Producto guardado')
      load()
    } catch (e) { setError('No se pudo guardar') }
  }

  const update = async (id, patch) => {
    await api(`/manager/products/${id}`, { method:'PATCH', token, body: patch })
    load()
  }

  // Edición inline deshabilitada: usamos editor dedicado
  const startEdit = () => {}
  const saveEdit = async () => {}
  const cancelEdit = () => {}

  const removeItem = async (id) => {
    if (!confirm('¿Eliminar producto?')) return
    await api(`/manager/products/${id}`, { method:'DELETE', token })
    load()
  }

  const duplicateItem = async (p) => {
    try {
      const base = await api(`/manager/products/${p.id}`, { token })
      const copy = base.product || p
      const newSku = `${copy.sku}-COPY-${Math.floor(Math.random()*1000)}`
      await api('/manager/products', { method:'POST', token, body: {
        sku: newSku,
        name: `${copy.name} (copia)`,
        category: copy.category,
        unit: copy.unit,
        purchase_price: copy.purchase_price,
        margin_percent: copy.margin_percent,
        discount_percent: copy.discount_percent,
        sale_price_cop: copy.sale_price_cop,
        description: copy.description,
        image_url: copy.image_url,
        image_urls: copy.image_urls,
        attributes: copy.attributes,
        status: 'draft'
      } })
      alert('Duplicado en borrador')
      load()
    } catch (e) { alert('No se pudo duplicar') }
  }

  const moveToTrash = async (p) => {
    if (!confirm('Mover a la papelera?')) return
    try {
      await api(`/manager/products/${p.id}`, { method:'PATCH', token, body: { status: 'trash' } })
      load()
    } catch (e) { alert('No se pudo mover a papelera') }
  }

  const getAreaStock = (p, area) => area==='bodega' ? Number(p.stock_bodega||0) : Number(p.stock_surtido||0)

  const openHistory = async (p) => {
    try {
      setHistoryTitle(`${p.sku} · ${p.name||''}`)
      const res = await api(`/manager/products/${p.id}/price-history`, { token })
      setHistoryRows(res?.history || [])
      setHistoryOpen(true)
    } catch (e) {
      alert('No se pudo cargar el historial de precios')
    }
  }

  const applyTotalDelta = async (p) => {
    if (!editDraft) return
    const delta = Number(editDraft.totalDelta)
    if (!delta || delta === 0 || !Number.isFinite(delta)) return alert('Cantidad inválida')
    // Operamos sobre bodega por requerimiento
    const bodegaStock = Number(editDraft.stock_bodega || 0)
    if (delta < 0 && Math.abs(delta) > bodegaStock) {
      const ok = confirm(`Vas a restar ${Math.abs(delta)} de bodega pero solo hay ${bodegaStock}. ¿Continuar?`)
      if (!ok) return
    }
    try {
      // Ejecutar movimiento en backend
      await api('/manager/inventory/movement', { method:'POST', token, body: {
        sku: p.sku,
        area: 'bodega',
        type: delta > 0 ? 'ingreso' : 'salida',
        quantity: Math.abs(delta),
        reason: 'inventory_total_delta'
      }})
      // Refrescar draft y limpiar delta
      setEditDraft(d=>({
        ...d,
        totalDelta: '',
        stock_bodega: Number(d.stock_bodega||0) + delta,
        original_total: Number(d.original_total|| (Number(d.stock_bodega||0)+Number(d.stock_surtido||0))) + delta,
      }))
      setOpMsg(`Total ${delta>0?'+':''}${delta} aplicado en bodega para ${p.sku}.`)
      setOpErr('')
      load()
    } catch (e) {
      const detail = (e && (e.message || e.error || e.statusText)) || 'No se pudo aplicar el cambio de total'
      setOpErr(detail)
      alert(detail)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Inventario (Productos)</h1>
      <div className="bg-white rounded shadow p-4 mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold">Productos</div>
        <a href="/admin/productos/nuevo" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded">Nuevo producto</a>
      </div>

      <div className="bg-white rounded shadow p-4">
        {(opMsg||opErr) && (
          <div className={`mb-2 px-3 py-2 rounded ${opErr?'bg-red-50 text-red-700 border border-red-200':'bg-green-50 text-green-700 border border-green-200'}`}>
            {opErr || opMsg}
          </div>
        )}
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          <input className="border rounded px-3 py-2 flex-1" placeholder="Buscar por SKU o nombre" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="border rounded px-3 py-2" onClick={load}>Buscar</button>
          <button className="border rounded px-3 py-2" onClick={async()=>{ await api('/manager/products/populate-from-movements', { method:'POST', token }); load() }}>Poblar desde movimientos</button>
          <div className="ml-auto flex gap-2 items-center">
            <select className="border rounded px-2 py-2" value={bulkAction} onChange={e=>setBulkAction(e.target.value)}>
              <option value="">Acción masiva</option>
              <option value="publish">Publicar</option>
              <option value="draft">Pasar a borrador</option>
              <option value="trash">Mover a papelera</option>
              <option value="delete">Eliminar permanente</option>
              <option value="discount">Aplicar descuento %</option>
            </select>
            {bulkAction==='discount' && (
              <input className="border rounded px-2 py-2 w-28" type="number" placeholder="%" value={bulkDiscount} onChange={e=>setBulkDiscount(e.target.value)} />
            )}
            <button className="bg-gray-800 text-white rounded px-3 py-2" onClick={runBulk}>Aplicar</button>
          </div>
        </div>
        {listError && <div className="mb-2 text-red-600">{listError}</div>}
        {loading ? 'Cargando...' : (
          <div className="overflow-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-sm text-gray-600">
                  <th className="py-1 pr-3">
                    <input type="checkbox" checked={selectedIds.size===list.length && list.length>0} onChange={e=>toggleSelectAll(e.target.checked)} />
                  </th>
                  <th className="py-1 pr-3">SKU</th>
                  <th className="py-1 pr-3">Nombre</th>
                  <th className="py-1 pr-3">Categoría</th>
                  <th className="py-1 pr-3">Unidad</th>
                  <th className="py-1 pr-3">Compra</th>
                  <th className="py-1 pr-3">Ganancia %</th>
                  <th className="py-1 pr-3">Descuento %</th>
                  <th className="py-1 pr-3">Neto (auto)</th>
                  <th className="py-1 pr-3">Venta (COP)</th>
                  <th className="py-1 pr-3">Cant. bodega</th>
                  <th className="py-1 pr-3">Cant. surtido</th>
                  <th className="py-1 pr-3">Cant. total</th>
                  <th className="py-1">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 pr-3"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={e=>toggleSelectOne(p.id, e.target.checked)} /></td>
                    <td className="py-2 pr-3">{p.sku}</td>
                    <td className="py-2 pr-3">{p.name}</td>
                    <td className="py-2 pr-3">{p.category||'-'}</td>
                    <td className="py-2 pr-3">{p.unit||'-'}</td>
                    <td className="py-2 pr-3">{fmtCOP(p.purchase_price)}</td>
                    <td className="py-2 pr-3">{Number(p.margin_percent||0).toFixed(2)}</td>
                    <td className="py-2 pr-3">{Number(p.discount_percent||0).toFixed(2)}</td>
                    {(()=>{ const net = netFrom(p.purchase_price, p.margin_percent, p.discount_percent); return (
                      <td className="py-2 pr-3"><span title="Calculado automáticamente">{fmtCOP(net)}</span><span className="ml-1 text-xs text-gray-500">auto</span></td>
                    ) })()}
                    <td className="py-2 pr-3">{fmtCOP(p.sale_price_cop)}</td>
                    <td className="py-2 pr-3">{fmtCOP(p.stock_bodega)}</td>
                    <td className="py-2 pr-3">{fmtCOP(p.stock_surtido)}</td>
                    <td className="py-2 pr-3">{fmtCOP(p.stock_total)}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <a className="text-gray-700" href={p.slug?`/tienda/${p.slug}`:`/producto/${p.sku}`} target="_blank" rel="noreferrer">Ver</a>
                        <a className="text-blue-700" href={`/admin/productos/${p.id}/editar`}>Editar</a>
                        <button className="text-indigo-700" onClick={()=>duplicateItem(p)}>Duplicar</button>
                        <button className="text-gray-700" onClick={()=>openHistory(p)}>Historial</button>
                        <button className="text-red-700" onClick={()=>moveToTrash(p)}>Papelera</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length===0 && (<tr><td className="py-2 text-gray-500" colSpan={12}>Sin resultados</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
        {historyOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
            <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">Historial de precio · {historyTitle}</h3>
                <button className="text-sm" onClick={()=>{ setHistoryOpen(false); setHistoryRows([]) }}>Cerrar</button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-auto">
                {historyRows.length===0 ? (
                  <div className="text-gray-500">Sin cambios registrados</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-1 pr-3">Fecha</th>
                        <th className="py-1 pr-3">Usuario</th>
                        <th className="py-1 pr-3">De</th>
                        <th className="py-1 pr-3">A</th>
                        <th className="py-1">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((h)=> (
                        <tr key={h.id} className="border-t">
                          <td className="py-2 pr-3">{fmtDate(h.created_at)}</td>
                          <td className="py-2 pr-3">{h.user_id ?? '-'}</td>
                          <td className="py-2 pr-3">{fmtCOP(h.old_price)}</td>
                          <td className="py-2 pr-3">{fmtCOP(h.new_price)}</td>
                          <td className="py-2">{h.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="p-4 border-t text-right">
                <button className="border rounded px-3 py-2" onClick={()=>{ setHistoryOpen(false); setHistoryRows([]) }}>Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
