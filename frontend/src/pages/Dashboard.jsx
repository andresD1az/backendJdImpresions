import React from 'react'
import { useAuth } from '../context/AuthContext'
import useActivityPing from '../hooks/useActivityPing'
import { Navigate } from 'react-router-dom'

export default function Dashboard() {
  const { user } = useAuth()
  useActivityPing({ minIntervalMs: 15000, checkIntervalMs: 2000 })

  // Espera a que cargue el usuario antes de decidir
  if (user == null) return null
  // Si es gerente, redirige a /manager para unificar el inicio
  if (user.role === 'manager') return <Navigate to="/manager" replace />

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      <div className="bg-white p-4 rounded shadow">
        <p>Bienvenido, <b>{user?.full_name || user?.email}</b></p>
        <p className="text-sm text-gray-600 mt-2">Esta pantalla se bloqueará tras 1 minuto de inactividad (según políticas del backend).</p>
      </div>
    </div>
  )
}
