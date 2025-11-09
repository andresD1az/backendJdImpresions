// En desarrollo usamos base relativa (Vite proxy).
// En producción usamos VITE_API_URL o por defecto '/api' para ir vía Nginx al backend.
export const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '/api')

export async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  // If session locked, bubble status for UI to handle
  if (!res.ok) {
    const err = { status: res.status, data: null }
    try { err.data = await res.json() } catch {}
    throw err
  }
  try {
    return await res.json()
  } catch {
    return null
  }
}
