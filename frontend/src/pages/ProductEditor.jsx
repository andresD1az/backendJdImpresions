import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      {children}
    </label>
  )
}

export default function ProductEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'nuevo'
  const isExisting = !isNew
  const navigate = useNavigate()
  const { token } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [activeTab, setActiveTab] = useState('general')
  const [activity, setActivity] = useState([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [transferQty, setTransferQty] = useState('')
  const [transferDir, setTransferDir] = useState('bodega_to_surtido')
  const [dirty, setDirty] = useState(false)
  const autosaveRef = useRef(null)

  const [form, setForm] = useState({
    name: '',
    slug: '',
    short_description: '',
    description: '',
    category: '',
    sku: '',
    purchase_price: '',
    margin_percent: '',
    discount_percent: '',
    sale_price_cop: '',
    image_url: '',
    image_urls_text: '',
    attributes_text: '',
    tags_text: '',
    status: 'draft', // draft|pending|published|scheduled|trash
    visibility: 'catalog', // catalog|hidden|private
    published_at: '',
    stock_bodega: 0,
    stock_surtido: 0,
    stock_status: 'in_stock',
    low_threshold: '',
  })

  const fmtCOP = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(n||0))
  const netAuto = useMemo(()=>{
    const pp = Number(form.purchase_price||0)
    const mp = Number(form.margin_percent||0)
    const dp = Number(form.discount_percent||0)
    return Math.round(pp * (1 + mp/100) * (1 - dp/100))
  }, [form.purchase_price, form.margin_percent, form.discount_percent])

  useEffect(()=>{
    const load = async () => {
      if (isNew) { setLoading(false); return }
      try {
        setLoading(true)
        const res = await api(`/manager/products/${id}`, { token })
        const p = res?.product || {}
        setForm(f=>({
          ...f,
          name: p.name || '',
          slug: p.slug || '',
          short_description: p.short_description || '',
          description: p.description || '',
          category: p.category || '',
          sku: p.sku || '',
          purchase_price: p.purchase_price ?? '',
          margin_percent: p.margin_percent ?? '',
          discount_percent: p.discount_percent ?? '',
          sale_price_cop: p.sale_price_cop ?? '',
          image_url: p.image_url || '',
          image_urls_text: Array.isArray(p.image_urls) ? p.image_urls.join('\n') : '',
          attributes_text: p.attributes ? JSON.stringify(p.attributes, null, 2) : '',
          tags_text: Array.isArray(p.tags) ? p.tags.join(', ') : '',
          status: p.status || 'draft',
          visibility: p.visibility || 'catalog',
          published_at: p.published_at ? new Date(p.published_at).toISOString().slice(0,16) : '', // deprecated field, ignored
          stock_bodega: Number(p.stock_bodega||0),
          stock_surtido: Number(p.stock_surtido||0),
          stock_status: (p.attributes && p.attributes.stock_status) ? String(p.attributes.stock_status) : (f.stock_status||'in_stock'),
          low_threshold: (p.attributes && p.attributes.low_threshold!=null) ? String(p.attributes.low_threshold) : (f.low_threshold||''),
        }))
      } catch (e) {
        setError('No se pudo cargar el producto')
      } finally {
        setLoading(false)
      }
    }
    if (token) load()
  }, [token, id, isNew])

  const uploadFile = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/manager/uploads', {
      method: 'POST',
      headers: { Authorization: token ? `Bearer ${token}` : '' },
      body: fd
    })
    if (!res.ok) throw new Error('Fallo al subir imagen')
    const j = await res.json()
    if (!j?.url) throw new Error('Respuesta inválida al subir')
    return j.url
  }

  const onCoverSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadFile(file)
      setF({ image_url: url })
      setToast('Imagen principal subida')
    } catch (err) { setError(err.message||'No se pudo subir la imagen') }
    finally { e.target.value='' }
  }

  const onGallerySelect = async (e) => {
    const files = Array.from(e.target.files||[])
    if (!files.length) return
    try {
      const uploaded = []
      for (const f of files) {
        const url = await uploadFile(f)
        uploaded.push(url)
      }
      const cur = (form.image_urls_text||'').trim()
      const joined = [...(cur?cur.split(/\n|,/).map(s=>s.trim()).filter(Boolean):[]), ...uploaded]
      setF({ image_urls_text: joined.join('\n') })
      setToast('Imágenes agregadas a la galería')
    } catch (err) { setError(err.message||'No se pudo subir la(s) imagen(es)') }
    finally { e.target.value='' }
  }


  useEffect(()=>{
    if (!dirty) return
    if (autosaveRef.current) clearInterval(autosaveRef.current)
    autosaveRef.current = setInterval(()=>{
      if (!saving) handleSave('autosave')
    }, 30000)
    return ()=>autosaveRef.current && clearInterval(autosaveRef.current)
  }, [dirty, saving])

  useEffect(()=>{
    const beforeUnload = (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return ()=>window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  const setF = (patch) => { setDirty(true); setForm(prev=>({ ...prev, ...patch })) }

  const fetchProductIdBySku = async (sku) => {
    try {
      const res = await api(`/manager/products?q=${encodeURIComponent(sku)}`, { token })
      const list = Array.isArray(res?.products) ? res.products : []
      const hit = list.find(p => (p.sku||'').toUpperCase() === (sku||'').toUpperCase())
      return hit?.id
    } catch { return null }
  }

  const handleSave = async (mode='manual') => {
    setSaving(true); setError('')
    try {
      // Build attributes merging editor-specific fields
      let attr = {}
      try { if (form.attributes_text) attr = JSON.parse(form.attributes_text) || {} } catch{}
      if (form.stock_status) attr.stock_status = form.stock_status
      if (form.low_threshold !== '' && !Number.isNaN(Number(form.low_threshold))) attr.low_threshold = Number(form.low_threshold)

      const body = {
        name: form.name,
        slug: form.slug || undefined,
        short_description: form.short_description || undefined,
        description: form.description || undefined,
        category: form.category || undefined,
        sku: form.sku || undefined,
        purchase_price: form.purchase_price !== '' ? Number(form.purchase_price) : undefined,
        margin_percent: form.margin_percent !== '' ? Number(form.margin_percent) : undefined,
        discount_percent: form.discount_percent !== '' ? Number(form.discount_percent) : undefined,
        sale_price_cop: form.sale_price_cop !== '' ? Number(form.sale_price_cop) : undefined,
        image_url: form.image_url || undefined,
        image_urls: (form.image_urls_text||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean),
        attributes: Object.keys(attr).length? attr : undefined,
        tags: (form.tags_text||'').split(',').map(s=>s.trim()).filter(Boolean),
        status: form.status,
        visibility: form.visibility,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
      }
      if (isNew) {
        const res = await api('/manager/products', { method:'POST', token, body })
        let newId = res?.product?.id
        if (!newId && res?.product?.sku) {
          newId = await fetchProductIdBySku(res.product.sku)
        }
        if (newId) navigate(`/admin/productos/${newId}/editar`, { replace: true })
      } else {
        const res = await api(`/manager/products/${id}`, { method:'PATCH', token, body })
        if (res?.product) {
          const { slug: rSlug, sku: rSku } = res.product
          if (rSlug || rSku) setForm(prev => ({ ...prev, ...(rSlug? { slug: rSlug } : {}), ...(rSku? { sku: rSku } : {}) }))
        }
        // On manual save for existing products, also apply stock adjustments and refresh values
        if (mode === 'manual') {
          try {
            if (form.sku) {
              if (form.stock_bodega !== undefined) {
                await api('/manager/inventory/movement', { method:'POST', token, body: { sku: form.sku, area: 'bodega', type: 'ajuste', quantity: Number(form.stock_bodega)||0, reason: 'product_editor_set' } })
              }
              if (form.stock_surtido !== undefined) {
                await api('/manager/inventory/movement', { method:'POST', token, body: { sku: form.sku, area: 'surtido', type: 'ajuste', quantity: Number(form.stock_surtido)||0, reason: 'product_editor_set' } })
              }
              const fres = await api(`/manager/products/${id}`, { token })
              const fp = fres?.product || {}
              setForm(prev=>({ ...prev, stock_bodega: Number(fp.stock_bodega||0), stock_surtido: Number(fp.stock_surtido||0) }))
            }
          } catch {}
        }
      }
      if (mode !== 'autosave') setToast('Guardado')
      setDirty(false)
    } catch (e) {
      const msg = e?.data?.message || e?.data?.error || e?.message
      const code = e?.data?.code || e?.code
      setError(`No se pudo guardar${code?` [${code}]`:''}. ${msg||'Verifica slug/SKU únicos y campos válidos.'}`)
    } finally { setSaving(false) }
  }

  const handlePublish = async () => {
    await handleSave('manual')
    setF({ status: 'published' })
    await handleSave('manual')
    setToast('Publicado')
  }

  

  const handleTrash = async () => {
    if (!confirm('Mover a la papelera?')) return
    try {
      await api(`/manager/products/${id}`, { method:'PATCH', token, body: { status: 'trash' } })
      navigate('/admin/productos')
    } catch { setError('No se pudo mover a la papelera') }
  }

  const recalcSale = () => {
    const base = netAuto
    const rounded = Math.round(base / 1000) * 1000
    setF({ sale_price_cop: String(rounded) })
  }

  const applyStock = async () => {
    try {
      if (!isExisting) { setError('Primero guarda el producto antes de ajustar stock'); return }
      if (!form.sku) { setError('Define el SKU antes de ajustar stock'); return }
      const tasks = []
      if (form.stock_bodega !== undefined) {
        tasks.push(api('/manager/inventory/movement', { method:'POST', token, body: { sku: form.sku, area: 'bodega', type: 'ajuste', quantity: Number(form.stock_bodega)||0, reason: 'product_editor_set' } }))
      }
      if (form.stock_surtido !== undefined) {
        tasks.push(api('/manager/inventory/movement', { method:'POST', token, body: { sku: form.sku, area: 'surtido', type: 'ajuste', quantity: Number(form.stock_surtido)||0, reason: 'product_editor_set' } }))
      }
      await Promise.all(tasks)
      setToast('Stock actualizado')
      // Refresh stocks like transfer does
      const res = await api(`/manager/products/${id}`, { token })
      const p = res?.product || {}
      setForm(f=>({ ...f, stock_bodega: Number(p.stock_bodega||0), stock_surtido: Number(p.stock_surtido||0) }))
    } catch (e) { setError('No se pudo actualizar el stock') }
  }

  const galleryList = () => (form.image_urls_text||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean)
  const setGalleryList = (arr) => setF({ image_urls_text: arr.join('\n') })
  const removeFromGallery = (idx) => {
    const arr = galleryList(); arr.splice(idx,1); setGalleryList(arr)
  }
  const moveGallery = (idx, dir) => {
    const arr = galleryList(); const ni = idx + dir
    if (ni < 0 || ni >= arr.length) return
    const tmp = arr[idx]; arr[idx] = arr[ni]; arr[ni] = tmp; setGalleryList(arr)
  }

  if (loading) return <div className="max-w-6xl mx-auto p-4">Cargando...</div>

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">Panel / Productos / {isNew? 'Nuevo' : (form.name || 'Editar')}</div>
        <div className="flex items-center gap-2">
          {!!form.slug && (
            <>
              <span className="text-xs bg-gray-100 border rounded px-2 py-1 font-mono">slug: {form.slug}</span>
              <button type="button" className="text-xs border rounded px-2 py-1" onClick={()=>{ navigator.clipboard?.writeText(form.slug) }}>Copiar slug</button>
            </>
          )}
          {!!form.sku && (
            <>
              <span className="text-xs bg-gray-100 border rounded px-2 py-1 font-mono">SKU: {form.sku}</span>
              <button type="button" className="text-xs border rounded px-2 py-1" onClick={()=>{ navigator.clipboard?.writeText(form.sku) }}>Copiar SKU</button>
            </>
          )}
        </div>
      </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded shadow p-4 mb-4">
          <div className="flex items-center gap-4 border-b mb-3">
            {['general','precios','inventario','imagenes','atributos','movimientos'].map(t => (
              <button key={t} className={`py-2 px-1 -mb-px ${activeTab===t?'border-b-2 border-blue-600 text-blue-700':'text-gray-600'}`} onClick={()=>setActiveTab(t)}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
          {activeTab==='general' && (
            <div>
              <Field label="Nombre (requerido)">
                <input className="border rounded px-3 py-2 w-full" value={form.name} onChange={e=>setF({ name:e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isExisting ? (
                  <Field label="Slug (autogenerado)">
                    <input className="border rounded px-3 py-2 w-full bg-gray-50" value={form.slug} readOnly />
                  </Field>
                ) : (
                  <div className="text-xs text-gray-600 mt-2">El slug se generará automáticamente al guardar.</div>
                )}
                <Field label="Categoría">
                  <select className="border rounded px-3 py-2 w-full" value={form.category} onChange={e=>setF({ category:e.target.value })}>
                    <option value="">Selecciona...</option>
                    <option value="escuela">escuela</option>
                    <option value="arte">arte</option>
                    <option value="oficina">oficina</option>
                    <option value="tecnologia">tecnología</option>
                    <option value="papeleria">papelería</option>
                  </select>
                </Field>
              </div>
              <Field label="Descripción corta">
                <input className="border rounded px-3 py-2 w-full" value={form.short_description} onChange={e=>setF({ short_description:e.target.value })} />
              </Field>
              <Field label="Descripción (texto)">
                <textarea className="border rounded px-3 py-2 w-full h-32" value={form.description} onChange={e=>setF({ description:e.target.value })} />
              </Field>
              <Field label={`Características claves (JSON, ej: {"Material":"PLA","Color":"Rojo"})`}>
                <textarea className="border rounded px-3 py-2 w-full h-40 font-mono text-sm" value={form.attributes_text} onChange={e=>setF({ attributes_text:e.target.value })} />
              </Field>
            </div>
          )}
          {activeTab==='precios' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Compra (COP)"><input type="number" className="border rounded px-3 py-2 w-full" value={form.purchase_price} onChange={e=>setF({ purchase_price:e.target.value })} /></Field>
              <Field label="Ganancia %"><input type="number" className="border rounded px-3 py-2 w-full" value={form.margin_percent} onChange={e=>setF({ margin_percent:e.target.value })} /></Field>
              <Field label="Descuento %"><input type="number" className="border rounded px-3 py-2 w-full" value={form.discount_percent} onChange={e=>setF({ discount_percent:e.target.value })} /></Field>
              <Field label="Neto (auto)"><input disabled className="border rounded px-3 py-2 w-full bg-gray-50" value={fmtCOP(netAuto)} /></Field>
              <div className="md:col-span-2 flex items-end gap-3">
                <Field label="Venta (COP)"><input type="number" className="border rounded px-3 py-2 w-full" value={form.sale_price_cop} onChange={e=>setF({ sale_price_cop:e.target.value })} /></Field>
                <button type="button" className="border rounded px-3 py-2" onClick={recalcSale}>Recalcular</button>
              </div>
            </div>
          )}
          {activeTab==='inventario' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="SKU (autogenerado)"><input className="border rounded px-3 py-2 w-full bg-gray-50" value={form.sku} readOnly /></Field>
              
              <Field label="Estado stock"><select className="border rounded px-3 py-2 w-full" value={form.stock_status||'in_stock'} onChange={e=>setF({ stock_status:e.target.value })}><option value="in_stock">En stock</option><option value="out_of_stock">Agotado</option><option value="on_demand">Bajo pedido</option></select></Field>
              <Field label="Umbral stock bajo"><input type="number" className="border rounded px-3 py-2 w-full" value={form.low_threshold||''} onChange={e=>setF({ low_threshold:e.target.value })} /></Field>
              <Field label="Stock bodega">
                <input type="number" className="border rounded px-3 py-2 w-full" value={form.stock_bodega} onChange={e=>setF({ stock_bodega:e.target.value })} />
              </Field>
              <Field label="Stock surtido">
                <input type="number" className="border rounded px-3 py-2 w-full" value={form.stock_surtido} onChange={e=>setF({ stock_surtido:e.target.value })} />
              </Field>
              <Field label="Total (bodega + surtido)">
                <input disabled className="border rounded px-3 py-2 w-full bg-gray-50" value={Number(form.stock_bodega||0)+Number(form.stock_surtido||0)} />
              </Field>
              <div className="md:col-span-2 flex flex-col gap-2 border-t pt-3">
                <div className="text-sm text-gray-600">Transferir stock</div>
                <div className="flex items-center gap-2">
                  <select className="border rounded px-2 py-2" value={transferDir} onChange={e=>setTransferDir(e.target.value)}>
                    <option value="bodega_to_surtido">Bodega → Surtido</option>
                    <option value="surtido_to_bodega">Surtido → Bodega</option>
                  </select>
                  <input type="number" min="1" className="border rounded px-3 py-2 w-32" placeholder="Cantidad" value={transferQty} onChange={e=>setTransferQty(e.target.value)} />
                  <button type="button" className="border rounded px-3 py-2 disabled:opacity-50" disabled={!isExisting || !form.sku || !transferQty} onClick={async()=>{
                    try {
                      const qty = Number(transferQty)
                      if (!qty || qty<=0) return
                      const fromArea = transferDir==='bodega_to_surtido' ? 'bodega' : 'surtido'
                      const toArea = transferDir==='bodega_to_surtido' ? 'surtido' : 'bodega'
                      await api('/manager/inventory/transfer', { method:'POST', token, body: { sku: form.sku, fromArea, toArea, quantity: qty, reason: 'editor_transfer' } })
                      setTransferQty('')
                      setToast('Transferencia realizada')
                      // Refresh stocks by reloading product minimal fields
                      const res = await api(`/manager/products/${id}`, { token })
                      const p = res?.product || {}
                      setForm(f=>({ ...f, stock_bodega: Number(p.stock_bodega||0), stock_surtido: Number(p.stock_surtido||0) }))
                    } catch (e) { setError(e?.data?.message || 'No se pudo transferir') }
                  }}>Transferir</button>
                </div>
                <div>
                  <button type="button" className="border rounded px-3 py-2 disabled:opacity-50" disabled={!isExisting || !form.sku} onClick={applyStock}>Aplicar stock</button>
                  {!isExisting && <span className="ml-2 text-xs text-gray-600">Guarda el producto para poder ajustar stock.</span>}
                </div>
              </div>
            </div>
          )}
          {activeTab==='imagenes' && (
            <div>
              <Field label="Imagen principal (URL)"><input className="border rounded px-3 py-2 w-full" value={form.image_url} onChange={e=>setF({ image_url:e.target.value })} /></Field>
              <div className="flex items-center gap-3 mb-3">
                <input type="file" accept="image/*" onChange={onCoverSelect} />
                {form.image_url && (<img src={form.image_url} alt="cover" className="w-16 h-16 object-cover rounded border" />)}
              </div>
              <Field label="Galería (una URL por línea)"><textarea className="border rounded px-3 py-2 w-full h-32" value={form.image_urls_text} onChange={e=>setF({ image_urls_text:e.target.value })} /></Field>
              <div className="flex items-center gap-3 mb-2">
                <input type="file" multiple accept="image/*" onChange={onGallerySelect} />
              </div>
              {form.image_urls_text && (
                <div className="flex gap-3 flex-wrap">
                  {galleryList().map((u,i)=>(
                    <div key={i} className="flex flex-col items-center gap-1">
                      <img src={u} alt={`g${i}`} className="w-20 h-20 object-cover rounded border" />
                      <div className="flex gap-1 text-xs">
                        <button type="button" className="border rounded px-2 py-0.5" onClick={()=>moveGallery(i,-1)}>&lt;</button>
                        <button type="button" className="border rounded px-2 py-0.5" onClick={()=>moveGallery(i,1)}>&gt;</button>
                        <button type="button" className="border rounded px-2 py-0.5 text-red-700" onClick={()=>removeFromGallery(i)}>Quitar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
            {activeTab==='atributos' && (
              <div>
                <Field label="Etiquetas (separadas por coma)"><input className="border rounded px-3 py-2 w-full" value={form.tags_text} onChange={e=>setF({ tags_text:e.target.value })} /></Field>
                <Field label={`Atributos (JSON, ej: {"Material":"Madera"})`}>
                  <textarea className="border rounded px-3 py-2 w-full h-40 font-mono text-sm" value={form.attributes_text} onChange={e=>setF({ attributes_text:e.target.value })} />
                </Field>
              </div>
            )}
            {activeTab==='movimientos' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm text-gray-600">Actividad reciente</div>
                  <button type="button" className="border rounded px-2 py-1 text-xs" disabled={!isExisting || loadingActivity} onClick={async()=>{
                    if (!isExisting) return
                    try { setLoadingActivity(true); const res = await api(`/manager/products/${id}/activity`, { token }); setActivity(Array.isArray(res?.activity)? res.activity:[]) } catch { setActivity([]) } finally { setLoadingActivity(false) }
                  }}>Refrescar</button>
                </div>
                {!isExisting && <div className="text-xs text-gray-600">Guarda el producto para ver su actividad.</div>}
                {isExisting && (
                  <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-3">Fecha</th>
                          <th className="py-2 pr-3">Tipo</th>
                          <th className="py-2 pr-3">Área</th>
                          <th className="py-2 pr-3">Movimiento</th>
                          <th className="py-2 pr-3">Cantidad</th>
                          <th className="py-2 pr-3">Precio</th>
                          <th className="py-2 pr-3">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activity||[]).map((a,i)=> (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1 pr-3 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                            <td className="py-1 pr-3">{a.kind==='price'?'Precio':'Inventario'}</td>
                            <td className="py-1 pr-3">{a.area||'-'}</td>
                            <td className="py-1 pr-3">{a.type||'-'}</td>
                            <td className="py-1 pr-3">{a.quantity!=null? a.quantity : '-'}</td>
                            <td className="py-1 pr-3">{a.old_price!=null || a.new_price!=null ? `${fmtCOP(a.old_price||0)} → ${fmtCOP(a.new_price||0)}` : '-'}</td>
                            <td className="py-1 pr-3">{a.reason||''}</td>
                          </tr>
                        ))}
                        {(!activity || activity.length===0) && (
                          <tr><td colSpan="7" className="py-2 text-gray-500">{loadingActivity? 'Cargando...' : 'Sin actividad'}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="bg-white rounded shadow p-4 sticky top-4">
            <div className="text-sm text-gray-600 mb-2">Publicar</div>
            {/* Estado y Visibilidad eliminados del panel */}
            {/* Programación eliminada */}
            {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}
            {toast && <div className="mb-2 text-green-700 text-sm">{toast}</div>}
            <div className="flex flex-wrap gap-2">
              <button className="border rounded px-3 py-2" onClick={()=>handleSave('manual')} disabled={saving}>Guardar borrador</button>
              <button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2" onClick={handlePublish} disabled={saving}>{isNew? 'Publicar' : 'Actualizar'}</button>
              {!isNew && (
                <button className="text-red-700 border rounded px-3 py-2" onClick={handleTrash}>Mover a papelera</button>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-500">Autosave cada 30s cuando hay cambios.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
