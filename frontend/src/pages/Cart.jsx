import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Cart() {
  const key = 'cart'
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([]) // [{ sku, quantity }]
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [errors, setErrors] = useState({}) // { field: message }
  const [verify, setVerify] = useState(null) // { ok, items:[{sku, unit_price, quantity, line_total, stock_ok}], total }
  const [form, setForm] = useState({
    fullName: '', idNumber: '', email: '', phone: '', neighborhood: '', city: '', reference: '',
    payment: 'gateway'
  })

  useEffect(()=>{
    try {
      const raw = localStorage.getItem(key)
      setItems(raw ? JSON.parse(raw) : [])
    } catch { setItems([]) }
  }, [])

  useEffect(()=>{
    // Prefill from user
    setForm(f => ({
      ...f,
      fullName: f.fullName || (user?.fullName || ''),
      email: f.email || (user?.email || '')
    }))
  }, [user])

  const updateQty = (idx, q) => {
    const v = Math.max(0, Number(q)||0)
    setItems(arr => arr.map((it,i)=> i===idx ? { ...it, quantity: v } : it))
    setVerify(null)
  }

  const remove = (idx) => setItems(arr => arr.filter((_,i)=>i!==idx))

  const total = useMemo(()=> Number(verify?.total||0), [verify])
  const formOk = useMemo(()=>{
    const f = form
    const emailOk = /.+@.+\..+/.test(String(f.email||'').trim())
    const phoneOk = String(f.phone||'').trim().length > 0 // solo requerido no vacío
    const idOk = String(f.idNumber||'').trim().length > 0
    return Boolean(
      String(f.fullName||'').trim() && idOk && emailOk && phoneOk &&
      String(f.neighborhood||'').trim() && String(f.city||'').trim() && String(f.reference||'').trim()
    )
  }, [form])

  const disabledReason = useMemo(()=>{
    if (!items.some(i=>Number(i.quantity)>0)) return 'Agrega productos al carrito.'
    if (!verify?.ok) return 'Verifica tu carrito antes de confirmar.'
    if (!formOk) return 'Completa tu información para continuar.'
    return ''
  }, [items, verify, formOk])

  const runVerify = async () => {
    setErr(''); setMsg('')
    try {
      const payload = { items: items.filter(i=>Number(i.quantity)>0) }
      if (!payload.items.length) { setVerify(null); return setErr('Carrito vacío') }
      const res = await api('/store/cart/verify', { method: 'POST', body: payload })
      setVerify(res)
      if (!res.ok) setErr('Algunos productos no están disponibles o cambiaron de precio. Revisa el detalle.')
      else setMsg('Carrito verificado. Puedes confirmar tu orden.')
    } catch {
      setErr('No se pudo verificar el carrito')
      setVerify(null)
    }
  }

  const checkout = async () => {
    setMsg(''); setErr('')
    try {
      // Forzar autenticación antes de proceder al pago
      if (!token) {
        const next = encodeURIComponent('/carrito')
        navigate(`/login?next=${next}`)
        return
      }
      // Validación de campos obligatorios con mensajes por campo
      const em = {}
      if (!String(form.fullName||'').trim()) em.fullName = 'Ingresa tu nombre completo'
      if (!String(form.idNumber||'').trim()) em.idNumber = 'Ingresa tu documento'
      if (!/.+@.+\..+/.test(String(form.email||'').trim())) em.email = 'Ingresa un email válido'
      if (String(form.phone||'').replace(/\D/g,'').length < 7) em.phone = 'Ingresa un teléfono válido'
      if (!String(form.neighborhood||'').trim()) em.neighborhood = 'Ingresa tu barrio'
      if (!String(form.city||'').trim()) em.city = 'Ingresa tu ciudad'
      if (!String(form.reference||'').trim()) em.reference = 'Ingresa una referencia de entrega'
      setErrors(em)
      const missing = Object.keys(em)
      if (missing.length) {
        setErr('Por favor completa la información requerida. Puedes continuar y te guiaremos.');
        // No retornamos: permitimos continuar; el backend también validará.
      }

      if (!verify) {
        await runVerify()
        if (!verify?.ok) return
      }
      if (!verify.ok) return
      const payload = { items: items.filter(i=>Number(i.quantity)>0) }
        const origin = window.location.origin
        const pref = await api('/store/payments/mercado-pago/preference', {
          method: 'POST', token,
          body: {
            items: payload.items,
            payer: { name: form.fullName || '', email: form.email || '', identification:{ type:'CC', number:String(form.idNumber||'') }, phone:{ number:String(form.phone||'') } },
            shipping_address: { line: `${form.neighborhood || ''} ${form.reference || ''}`.trim(), city: form.city || '' },
            redirect_urls: {
              success: `${origin}/mis-pedidos?paid=1`,
              failure: `${origin}/carrito?error=pago`,
              pending: `${origin}/mis-pedidos?pending=1`
            }
          }
        })
        if (pref?.init_point) {
          // Resetear carrito al crear la orden
          try { localStorage.removeItem('cart'); window.dispatchEvent(new Event('cart-updated')) } catch {}
          setItems([])
          window.location.href = pref.init_point
          return
        } else {
          setErr('No se pudo iniciar el pago')
          return
        }
    } catch (e) {
      const msg = e?.data?.message || e?.data?.error || 'No se pudo procesar el checkout'
      setErr(msg)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      <nav className="text-sm text-gray-600 mt-4 mb-2">
        <a href="/tienda" className="hover:underline">Tienda</a>
        <span className="mx-2">/</span>
        <span>Checkout</span>
      </nav>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Checkout</h1>
      </div>
      {(msg||err || !token) && (
        <div className={`mb-3 border rounded px-3 py-2 flex items-start gap-2 ${err?'border-red-200 bg-red-50 text-red-700':'border-green-200 bg-green-50 text-green-700'}`}>
          <div className="mt-0.5">
            {err ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0v-5.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 10-1.214-.882l-3.483 4.79-1.803-1.803a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.146-.094l3.914-5.571z" clipRule="evenodd"/></svg>
            )}
          </div>
          <div>
            <div className="font-medium">{err ? 'Falta información' : (!token ? 'Sesión requerida' : 'Listo')}</div>
            <div className="text-sm">{err || (!token ? 'Inicia sesión para completar tu compra.' : msg)}</div>
          </div>
          {err && Object.keys(errors||{}).length>0 && (
            <ul className="mt-1 text-sm list-disc list-inside">
              {errors.fullName && <li>Nombre completo</li>}
              {errors.idNumber && <li>Documento</li>}
              {errors.email && <li>Email válido</li>}
              {errors.phone && <li>Teléfono válido</li>}
              {errors.neighborhood && <li>Barrio</li>}
              {errors.city && <li>Ciudad</li>}
              {errors.reference && <li>Referencia</li>}
            </ul>
          )}
        </div>
      )}
      {items.length===0 ? (
        <div className="text-gray-600">Carrito vacío</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border p-5">
              <div className="font-semibold mb-4">1. Información personal y de entrega</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Nombre completo</label>
                  <input className={`mt-1 border rounded px-3 py-2 w-full ${errors.fullName?'border-red-500':''}`} placeholder="Nombre completo" required value={form.fullName} onChange={e=>{ setForm({...form, fullName: e.target.value}); if (errors.fullName) setErrors({...errors, fullName: undefined}) }} />
                  {errors.fullName && <div className="text-xs text-red-600 mt-1">{errors.fullName}</div>}
                </div>
                <div>
                  <label className="text-sm text-gray-700">Documento</label>
                  <input className={`mt-1 border rounded px-3 py-2 w-full ${errors.idNumber?'border-red-500':''}`} placeholder="Documento" required value={form.idNumber} onChange={e=>{ setForm({...form, idNumber: e.target.value}); if (errors.idNumber) setErrors({...errors, idNumber: undefined}) }} />
                  {errors.idNumber && <div className="text-xs text-red-600 mt-1">{errors.idNumber}</div>}
                </div>
                <div>
                  <label className="text-sm text-gray-700">Email</label>
                  <input className={`mt-1 border rounded px-3 py-2 w-full ${errors.email?'border-red-500':''}`} placeholder="Email" type="email" required value={form.email} onChange={e=>{ setForm({...form, email: e.target.value}); if (errors.email) setErrors({...errors, email: undefined}) }} />
                  {errors.email && <div className="text-xs text-red-600 mt-1">{errors.email}</div>}
                </div>
                <div>
                  <label className="text-sm text-gray-700">Teléfono</label>
                  <input className={`mt-1 border rounded px-3 py-2 w-full ${errors.phone?'border-red-500':''}`} placeholder="Teléfono" required value={form.phone} onChange={e=>{ setForm({...form, phone: e.target.value}); if (errors.phone) setErrors({...errors, phone: undefined}) }} />
                  {errors.phone && <div className="text-xs text-red-600 mt-1">{errors.phone}</div>}
                </div>
                <div>
                  <label className="text-sm text-gray-700">Barrio</label>
                  <input className={`mt-1 border rounded px-3 py-2 w-full ${errors.neighborhood?'border-red-500':''}`} placeholder="Barrio" required value={form.neighborhood} onChange={e=>{ setForm({...form, neighborhood: e.target.value}); if (errors.neighborhood) setErrors({...errors, neighborhood: undefined}) }} />
                  {errors.neighborhood && <div className="text-xs text-red-600 mt-1">{errors.neighborhood}</div>}
                </div>
                <div>
                  <label className="text-sm text-gray-700">Ciudad</label>
                  <input className={`mt-1 border rounded px-3 py-2 w-full ${errors.city?'border-red-500':''}`} placeholder="Ciudad" required value={form.city} onChange={e=>{ setForm({...form, city: e.target.value}); if (errors.city) setErrors({...errors, city: undefined}) }} />
                  {errors.city && <div className="text-xs text-red-600 mt-1">{errors.city}</div>}
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-gray-700">Referencia</label>
                  <textarea className={`mt-1 border rounded px-3 py-2 w-full ${errors.reference?'border-red-500':''}`} placeholder="Referencia" rows={3} required value={form.reference} onChange={e=>{ setForm({...form, reference: e.target.value}); if (errors.reference) setErrors({...errors, reference: undefined}) }} />
                  {errors.reference && <div className="text-xs text-red-600 mt-1">{errors.reference}</div>}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="font-semibold mb-2">2. Pago</div>
              <div className="text-sm text-gray-700">El pago se realiza de forma 100% segura con Mercado Pago.</div>
            </div>

            {/* Items del carrito */}
            <div className="bg-white rounded-xl border p-5">
              <div className="font-semibold mb-4">Productos</div>
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2 border-b">
                  <div className="w-40">{it.sku}</div>
                  <input className="border rounded px-2 py-1 w-24" type="number" min="0" value={it.quantity} onChange={e=>updateQty(idx, e.target.value)} />
                  <button className="text-red-700" onClick={()=>remove(idx)}>Quitar</button>
                  {verify && (
                    <div className="ml-auto text-right text-sm">
                      <div className="text-gray-600">Unidad: ${Number(verify.items?.find(x=>x.sku===it.sku)?.unit_price||0).toLocaleString('es-CO')}</div>
                      <div className="font-medium">Subtotal: ${Number(verify.items?.find(x=>x.sku===it.sku)?.line_total||0).toLocaleString('es-CO')}</div>
                      {!verify.items?.find(x=>x.sku===it.sku)?.stock_ok && <div className="text-orange-700">Sin stock suficiente</div>}
                    </div>
                  )}
                </div>
              ))}
              <div className="mt-3 flex items-center gap-3">
                <button className="border rounded px-3 py-2 hover:bg-gray-50" onClick={runVerify}>Verificar carrito</button>
                {verify && <div className={`text-sm ${verify.ok?'text-green-700':'text-orange-700'}`}>{verify.ok?'Verificación exitosa':'Verificación con observaciones'}</div>}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border p-5 sticky top-4">
              <div className="font-semibold mb-3">Resumen de pedido</div>
              <div className="text-sm text-gray-600">Ítems: {items.reduce((a,b)=>a+Number(b.quantity||0),0)}</div>
              <div className="mt-1 text-sm text-gray-600">Subtotal: ${Number(total||0).toLocaleString('es-CO')}</div>
              <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded" onClick={checkout}>{token ? 'Confirmar orden' : 'Iniciar sesión para pagar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
