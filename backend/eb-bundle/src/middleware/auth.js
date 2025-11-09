import { verifyAuthToken } from '../utils/jwt.js';
import { query } from '../config/db.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    if (!token) return res.status(401).json({ error: 'missing_token' });

    const decoded = verifyAuthToken(token);
    req.user = { id: decoded.userId, role: decoded.role || 'user' };
    req.jwt = { jti: decoded.jti || decoded.jti, raw: token };

    // find session by jwt id
    const { rows } = await query('SELECT * FROM sessions WHERE jwt_id = $1 AND user_id = $2 AND closed_at IS NULL', [decoded.jti, decoded.userId]);
    if (!rows.length) return res.status(401).json({ error: 'invalid_session' });
    req.session = rows[0];

    return next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
