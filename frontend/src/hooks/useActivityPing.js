import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

// Pings /auth/me on user activity to keep session unlocked when user is active.
export default function useActivityPing({ minIntervalMs = 20000, checkIntervalMs = 15000, enabled = true } = {}) {
  const { token, fetchMe, setLocked } = useAuth()
  const lastPing = useRef(0)

  useEffect(() => {
    if (!enabled || !token) return

    const now = () => Date.now()
    const maybePing = () => {
      if (!token) return
      if (now() - lastPing.current >= minIntervalMs) {
        lastPing.current = now()
        fetchMe()
      }
    }

    const onActivity = () => maybePing()

    window.addEventListener('mousemove', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('click', onActivity)

    // initial one-time call to get current user/session state
    fetchMe()

    // periodic non-extending check to detect lock/auto-logout exactly at timeout
    const id = setInterval(async () => {
      if (!token) return
      try {
        await api('/auth/me', { token, headers: { 'x-no-activity-update': 'true' } })
      } catch (e) {
        if (e?.status === 423) {
          setLocked(true)
        } else if (e?.status === 401) {
          // sync state via normal fetchMe (will clear token)
          await fetchMe()
        }
      }
    }, checkIntervalMs)

    return () => {
      clearInterval(id)
      window.removeEventListener('mousemove', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('click', onActivity)
    }
  }, [token, enabled])
}
