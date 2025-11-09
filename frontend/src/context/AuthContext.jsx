import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])

  // Al cargar la app, si hay token en localStorage, obtener el usuario
  useEffect(() => {
    if (token && !user) {
      fetchMe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const fetchMe = async () => {
    if (!token) return
    try {
      const res = await api('/auth/me', { token })
      setUser(res.user)
      setLocked(false)
      return { ok: true, user: res.user }
    } catch (err) {
      if (err.status === 423) {
        setLocked(true)
        return { ok: false, locked: true }
      }
      // Para cualquier otro error (500, 4xx), forzar relogin para evitar loops
      console.error('fetchMe_error', err)
      setToken('')
      setUser(null)
      setLocked(false)
      return { ok: false }
    }
  }

  const login = async ({ email, password, turnstileToken }) => {
    setLoading(true)
    try {
      const { token: t } = await api('/auth/login', {
        method: 'POST',
        body: { email, password, turnstileToken },
      })
      setToken(t)
      const me = await fetchMe()
      const u = me?.user
      // Lock only for non-client roles (employees/admins)
      if (u && u.role !== 'client') {
        try {
          await api('/auth/lock', { method: 'POST', token: t })
          setLocked(true)
        } catch {}
      }
      return { ok: true, user: u }
    } catch (e) {
      return { ok: false, error: e?.data?.error || 'login_error' }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    if (token) {
      try { await api('/auth/logout', { method: 'POST', token }) } catch {}
    }
    setToken('')
    setUser(null)
    setLocked(false)
  }

  const value = useMemo(() => ({ token, user, locked, loading, setToken, setUser, setLocked, fetchMe, login, logout }), [token, user, locked, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
