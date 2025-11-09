import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'

export default function PermissionGuard({ perm, children }) {
  const { user } = useAuth()
  const perms = user?.perms || []
  if (!perms.includes(perm)) return <Navigate to="/dashboard" replace />
  return children
}
