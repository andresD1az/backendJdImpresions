import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Turnstile from '../components/Turnstile'

export default function RequestReset() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const navigate = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      await api('/auth/password/request', { method: 'POST', body: { email, turnstileToken } })
      setMsg('Si el correo existe, se envió un código de recuperación.')
      // Ir al formulario para ingresar el código, prellenando el correo
      navigate(`/password/reset?email=${encodeURIComponent(email)}`)
    } catch {
      setMsg('Solicitud enviada (si existe el correo).')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-semibold mb-4">Recuperar contraseña</h1>
      {msg && <div className="mb-3 text-green-700">{msg}</div>}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Correo</label>
          <input className="w-full border rounded px-3 py-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="flex justify-center">
          <Turnstile onVerify={setTurnstileToken} />
        </div>
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">Solicitar código</button>
      </form>
    </div>
  )
}
