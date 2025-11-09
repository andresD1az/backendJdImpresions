import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'

export default function PermAny({ perms = [], children }) {
  const { user } = useAuth()
  const have = user?.perms || []
  const ok = perms.some(p => have.includes(p))
  if (!ok) return <Navigate to="/dashboard" replace />
  return children
}
