export function ensureRole(allowed = []) {
  const set = new Set(Array.isArray(allowed) ? allowed : [allowed])
  return (req, res, next) => {
    const role = req?.user?.role || 'user'
    if (!set.size || set.has(role)) return next()
    return res.status(403).json({ error: 'forbidden' })
  }
}
