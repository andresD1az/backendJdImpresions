import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function VerifyEmail() {
  const loc = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(loc.state?.email || '')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(''); setMsg('')
    try {
      await api('/auth/verify-email', { method: 'POST', body: { email, code } })
      setMsg('Correo verificado. Ahora puedes iniciar sesión.')
      setTimeout(()=>navigate('/login'), 800)
    } catch (e) {
      setError(e?.data?.error || 'verify_email_error')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-semibold mb-4">Verificar correo</h1>
      {msg && <div className="mb-3 text-green-700">{msg}</div>}
      {error && <div className="mb-3 text-red-600">{String(error)}</div>}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Correo</label>
          <input className="w-full border rounded px-3 py-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Código</label>
          <input className="w-full border rounded px-3 py-2" value={code} onChange={e=>setCode(e.target.value)} required />
        </div>
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">Confirmar</button>
      </form>
    </div>
  )
}
