export function permsFromRole(role) {
  const r = (role || '').toLowerCase()
  const permsByRole = {
    manager: ['report:view','product:view','product:edit','price:edit','image:edit','inventory:view','inventory:move','invoice:emit','return:manage','order:refund','payment:reconcile','user:manage','role:manage','audit:view'],
    bodega: ['inventory:view','inventory:move'],
    surtido: ['inventory:view','inventory:move'],
    descargue: ['inventory:move'],
    cajero: ['invoice:emit','payment:reconcile'],
    soporte: ['return:manage'],
    operativo: [],
    vendedor: ['product:view','report:view'],
    client: [],
  }
  return permsByRole[r] || []
}

export function requirePerm(perm) {
  return (req, res, next) => {
    try {
      const role = (req.user?.role || '').toLowerCase()
      if (role === 'manager') return next()
      const perms = permsFromRole(role)
      if (!perms.includes(perm)) return res.sendStatus(403)
      return next()
    } catch {
      return res.sendStatus(403)
    }
  }
}
