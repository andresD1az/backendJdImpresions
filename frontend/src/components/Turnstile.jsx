import React, { useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAB7_J30AoQN278gb'
let turnstileLoaded = false
let loadingPromise = null

function loadScript() {
  if (turnstileLoaded) return Promise.resolve()
  if (loadingPromise) return loadingPromise
  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
    script.async = true
    script.defer = true
    window.onTurnstileLoad = () => {
      turnstileLoaded = true
      resolve()
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
  return loadingPromise
}

export default function Turnstile({ onVerify, theme = 'auto' }) {
  const ref = useRef(null)

  useEffect(() => {
    let widgetId = null
    let isMounted = true

    async function render() {
      await loadScript()
      if (!isMounted || !ref.current || !window.turnstile || !SITE_KEY) return
      // Render managed widget (visible). Simpler and reliable.
      widgetId = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        theme,
        callback: (token) => onVerify?.(token),
        'error-callback': () => onVerify?.(''),
        'expired-callback': () => onVerify?.(''),
      })
    }
    render()

    return () => {
      isMounted = false
      try {
        if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
      } catch {}
    }
  }, [onVerify, theme])

  return <div ref={ref} />
}
