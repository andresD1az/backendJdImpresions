import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export default function Profile() {
  const { token, user, setUser } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      const res = await api('/auth/me', { method: 'PATCH', token, body: { fullName, avatarUrl } })
      setUser(res.user)
      setMsg('Perfil actualizado')
    } catch (e) {
      setError('No se pudo actualizar el perfil')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Perfil</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded shadow md:col-span-2">
          <h2 className="font-semibold mb-3">Información de registro</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt className="text-sm text-gray-600">Correo</dt>
              <dd>{user?.email || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">Nombre</dt>
              <dd>{user?.full_name || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">Rol</dt>
              <dd>{user?.role || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">Estado</dt>
              <dd>{user?.status || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">Verificación de correo</dt>
              <dd>{user?.is_email_verified ? 'Verificado' : 'No verificado'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">Fecha de registro</dt>
              <dd>{user?.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Editar perfil</h2>
          <form onSubmit={onSubmit} className="space-y-4" aria-label="Formulario de perfil">
            <div>
              <label className="block text-sm mb-1" htmlFor="fn">Nombre</label>
              <input id="fn" className="w-full border rounded px-3 py-2" value={fullName} onChange={e=>setFullName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1" htmlFor="av">Avatar URL</label>
              <input id="av" className="w-full border rounded px-3 py-2" value={avatarUrl} onChange={e=>setAvatarUrl(e.target.value)} placeholder="https://..." />
              <p className="text-xs text-gray-500 mt-1">Pega un enlace a una imagen (más adelante habilitaremos subida).</p>
            </div>
            {avatarUrl && <img src={avatarUrl} alt="Vista previa" className="w-20 h-20 rounded-full object-cover" />}
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">Guardar</button>
            {msg && <div className="text-green-700" aria-live="polite">{msg}</div>}
            {error && <div className="text-red-600" aria-live="assertive">{error}</div>}
          </form>
        </div>
      </div>
    </div>
  )
}
