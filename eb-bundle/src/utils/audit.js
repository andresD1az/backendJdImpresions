import { query } from '../config/db.js';

export async function audit({ userId, sessionId, eventType, ip, userAgent, details = {} }) {
  try {
    await query(
      'INSERT INTO auth_audit (user_id, session_id, event_type, ip, user_agent, details) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId || null, sessionId || null, eventType, ip || null, userAgent || null, details]
    );
  } catch (e) {
    // avoid breaking flow on audit errors
    console.error('audit error', e.message);
  }
}
