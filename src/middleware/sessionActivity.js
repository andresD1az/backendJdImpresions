import { query } from '../config/db.js';

const LOCK_AFTER_MINUTES = Number(process.env.LOCK_AFTER_MINUTES || 1); // default 1 minute
const AUTO_LOGOUT_AFTER_HOURS = Number(process.env.AUTO_LOGOUT_AFTER_HOURS || 8); // default 8 hours

export async function enforceSessionState(req, res, next) {
  try {
    const session = req.session; // set by requireAuth
    if (!session) return res.status(401).json({ error: 'no_session' });

    const now = new Date();
    const last = new Date(session.last_activity_at);
    const minutesInactive = (now - last) / (1000 * 60);
    const hoursInactive = minutesInactive / 60;

    // No aplicar pantalla de bloqueo ni auto-logout a clientes finales (roles no pertenecientes al staff)
    const role = (req.user && req.user.role) ? String(req.user.role).toLowerCase() : 'client';
    const staffRoles = new Set(['manager','operativo','bodega','surtido','descargue','vendedor','cajero','soporte','admin']);
    const isClientUser = !staffRoles.has(role);
    if (isClientUser) {
      // Solo refrescar actividad y continuar
      try {
        await query('UPDATE sessions SET last_activity_at = NOW() WHERE id = $1', [session.id]);
        req.session.last_activity_at = new Date().toISOString();
      } catch {}
      return next();
    }

    // Auto-logout if too long inactive
    if (!session.closed_at && hoursInactive >= AUTO_LOGOUT_AFTER_HOURS) {
      await query('UPDATE sessions SET closed_at = NOW() WHERE id = $1', [session.id]);
      return res.status(401).json({ error: 'auto_logout' });
    }

    // Lock if inactive beyond threshold
    if (!session.is_locked && minutesInactive >= LOCK_AFTER_MINUTES) {
      await query('UPDATE sessions SET is_locked = TRUE WHERE id = $1', [session.id]);
      req.session.is_locked = true;
    }

    // If locked, block access (except unlock endpoint)
    if (req.session.is_locked && !req.path.endsWith('/unlock')) {
      return res.status(423).json({ error: 'session_locked' });
    }

    // Update last activity timestamp for allowed requests
    // Unless client explicitly requests a check that should NOT extend activity
    const noActivityUpdate = String(req.headers['x-no-activity-update'] || '').toLowerCase() === 'true';
    if (!noActivityUpdate) {
      await query('UPDATE sessions SET last_activity_at = NOW() WHERE id = $1', [session.id]);
      req.session.last_activity_at = new Date().toISOString();
    }

    return next();
  } catch (e) {
    return res.status(500).json({ error: 'session_enforce_error' });
  }
}
