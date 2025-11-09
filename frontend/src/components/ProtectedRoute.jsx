import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowLocked = false, roles }) {
  const { token, locked, user } = useAuth()
  const location = useLocation()

  if (!token) return <Navigate to="/login" state={{ from: location }} replace />

  // If the route allows locked sessions (e.g., /locked), only allow when actually locked.
  if (allowLocked) {
    if (!locked) return <Navigate to="/dashboard" replace />
    return children
  }

  // For normal protected routes, redirect to /locked when session is locked.
  if (locked) return <Navigate to="/locked" replace />

  // Role-based guard if roles are provided
  if (roles && roles.length) {
    // If user info not loaded yet, avoid redirecting until it is available
    if (!user) return null
    const role = (user?.role || 'user').toString().toLowerCase()
    const allowed = roles.map(r=>r.toString().toLowerCase())
    if (!allowed.includes(role)) return <Navigate to="/dashboard" replace />
  }
  return children
}
