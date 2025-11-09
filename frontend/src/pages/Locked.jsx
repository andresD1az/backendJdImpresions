import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export default function Locked() {
  const { token, setLocked, fetchMe } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const onUnlock = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api('/auth/unlock', { method: 'POST', token, body: { code } })
      setLocked(false)
      await fetchMe()
      navigate('/dashboard', { replace: true })
    } catch (e) {
      if (e?.status === 401) {
        // sesión cerrada por auto-logout
        navigate('/login', { replace: true })
        return
      }
      setError(e?.data?.error || 'unlock_error')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-semibold mb-4">Sesión bloqueada</h1>
      <p className="text-gray-700 mb-4">Ingresa tu código de seguridad para desbloquear tu Dashboard.</p>
      {error && <div className="mb-3 text-red-600">{String(error)}</div>}
      <form onSubmit={onUnlock} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Código de seguridad</label>
          <input className="w-full border rounded px-3 py-2" value={code} onChange={e=>setCode(e.target.value)} required />
        </div>
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">Desbloquear</button>
      </form>
    </div>
  )
}
