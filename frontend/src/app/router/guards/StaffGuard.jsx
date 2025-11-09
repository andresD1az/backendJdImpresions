import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'

export default function StaffGuard({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_staff && (user.role||'').toLowerCase() === 'client') return <Navigate to="/" replace />
  return children
}
