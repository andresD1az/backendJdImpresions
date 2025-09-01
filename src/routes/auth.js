import express from 'express';
import { query } from '../config/db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAuthToken } from '../utils/jwt.js';
import { sendEmail } from '../utils/email.js';
import { verifyRecaptcha } from '../utils/recaptcha.js';
import { generateNumericCode, expiryFromNow } from '../utils/codes.js';
import { requireAuth } from '../middleware/auth.js';
import { enforceSessionState } from '../middleware/sessionActivity.js';
import { audit } from '../utils/audit.js';

const router = express.Router();

// Helpers
async function getUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, securityCode, role } = req.body || {};
    if (!email || !password || !securityCode) return res.status(400).json({ error: 'missing_fields' });

    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email_in_use' });

    const passHash = await hashPassword(password);
    const { rows } = await query(
      'INSERT INTO users (email, password_hash, full_name, role, security_code) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, is_email_verified',
      [email.toLowerCase(), passHash, fullName || null, role || 'user', String(securityCode)]
    );
    const user = rows[0];

    // email verification code
    const code = generateNumericCode(6);
    const expires = expiryFromNow(15);
    await query(
      'INSERT INTO email_verification_codes (user_id, code, expires_at) VALUES ($1,$2,$3)',
      [user.id, code, expires]
    );

    // Dev helper: print code in non-production envs
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Email verification code for ${email}:`, code);
    }

    try {
      await sendEmail({
        to: email,
        subject: 'Verifica tu correo',
        html: `<p>Tu código de verificación es <b>${code}</b>. Expira en 15 minutos.</p>`
      });
    } catch (err) {
      console.error('Email send error (verification):', err?.message || err);
    }

    await audit({ userId: user.id, eventType: 'register', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'register_error' });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'missing_fields' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'not_found' });

    const { rows } = await query(
      'SELECT * FROM email_verification_codes WHERE user_id = $1 AND code = $2 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [user.id, String(code)]
    );
    const rec = rows[0];
    if (!rec) return res.status(400).json({ error: 'invalid_code' });
    if (new Date(rec.expires_at) < new Date()) return res.status(400).json({ error: 'code_expired' });

    await query('UPDATE email_verification_codes SET used_at = NOW() WHERE id = $1', [rec.id]);
    await query('UPDATE users SET is_email_verified = TRUE WHERE id = $1', [user.id]);
    await audit({ userId: user.id, eventType: 'email_verified', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'verify_email_error' });
  }
});

// Login with CAPTCHA
router.post('/login', async (req, res) => {
  try {
    const { email, password, recaptchaToken } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

    const rc = await verifyRecaptcha(recaptchaToken);
    if (!rc?.success) return res.status(400).json({ error: 'captcha_failed' });

    const user = await getUserByEmail(email);
    if (!user) {
      await audit({ eventType: 'login_fail', ip: req.ip, userAgent: req.headers['user-agent'], details: { reason: 'no_user', email } });
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      await audit({ userId: user.id, eventType: 'login_fail', ip: req.ip, userAgent: req.headers['user-agent'], details: { reason: 'bad_password' } });
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    if (!user.is_email_verified) return res.status(403).json({ error: 'email_not_verified' });

    const { token, jti } = signAuthToken({ userId: user.id, role: user.role });
    const { rows } = await query('INSERT INTO sessions (user_id, jwt_id) VALUES ($1,$2) RETURNING id', [user.id, jti]);
    const sessionId = rows[0].id;

    await audit({ userId: user.id, sessionId, eventType: 'login_success', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ token });
  } catch (e) {
    return res.status(500).json({ error: 'login_error' });
  }
});

// Request password reset
router.post('/password/request', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'missing_fields' });
    const user = await getUserByEmail(email);
    if (user) {
      const code = generateNumericCode(6);
      const expires = expiryFromNow(15);
      await query('INSERT INTO password_reset_codes (user_id, code, expires_at) VALUES ($1,$2,$3)', [user.id, code, expires]);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Password reset code for ${email}:`, code);
      }
      try {
        await sendEmail({ to: email, subject: 'Código de recuperación', html: `<p>Tu código es <b>${code}</b>. Expira en 15 minutos.</p>` });
      } catch (err) {
        console.error('Email send error (password reset):', err?.message || err);
      }
      await audit({ userId: user.id, eventType: 'password_reset_requested', ip: req.ip, userAgent: req.headers['user-agent'] });
    }
    // always respond ok to avoid user enumeration
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'password_request_error' });
  }
});

// Verify password reset code (no password change)
router.post('/password/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'missing_fields' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'not_found' });

    const { rows } = await query(
      'SELECT * FROM password_reset_codes WHERE user_id = $1 AND code = $2 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [user.id, String(code)]
    );
    const rec = rows[0];
    if (!rec) return res.status(400).json({ error: 'invalid_code' });
    if (new Date(rec.expires_at) < new Date()) return res.status(400).json({ error: 'code_expired' });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'password_verify_code_error' });
  }
});

// Reset password
router.post('/password/reset', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'missing_fields' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'not_found' });

    const { rows } = await query(
      'SELECT * FROM password_reset_codes WHERE user_id = $1 AND code = $2 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [user.id, String(code)]
    );
    const rec = rows[0];
    if (!rec) return res.status(400).json({ error: 'invalid_code' });
    if (new Date(rec.expires_at) < new Date()) return res.status(400).json({ error: 'code_expired' });

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    await query('UPDATE password_reset_codes SET used_at = NOW() WHERE id = $1', [rec.id]);
    await audit({ userId: user.id, eventType: 'password_reset', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'password_reset_error' });
  }
});

// Protected me endpoint
router.get('/me', requireAuth, enforceSessionState, async (req, res) => {
  try {
    const { rows } = await query('SELECT id, email, full_name, role, is_email_verified FROM users WHERE id = $1', [req.user.id]);
    return res.json({ user: rows[0] });
  } catch (e) {
    return res.status(500).json({ error: 'me_error' });
  }
});

// Lock session manually
router.post('/lock', requireAuth, async (req, res) => {
  try {
    await query('UPDATE sessions SET is_locked = TRUE WHERE id = $1', [req.session.id]);
    await audit({ userId: req.user.id, sessionId: req.session.id, eventType: 'lock', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'lock_error' });
  }
});

// Unlock session with security code
router.post('/unlock', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'missing_code' });

    const { rows } = await query('SELECT security_code FROM users WHERE id = $1', [req.user.id]);
    const expected = rows[0]?.security_code || '';
    if (String(code) !== String(expected)) {
      await audit({ userId: req.user.id, sessionId: req.session.id, eventType: 'unlock_fail', ip: req.ip, userAgent: req.headers['user-agent'] });
      return res.status(403).json({ error: 'invalid_code' });
    }
    await query('UPDATE sessions SET is_locked = FALSE, last_activity_at = NOW() WHERE id = $1', [req.session.id]);
    await audit({ userId: req.user.id, sessionId: req.session.id, eventType: 'unlock_success', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'unlock_error' });
  }
});

// Logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await query('UPDATE sessions SET closed_at = NOW() WHERE id = $1', [req.session.id]);
    await audit({ userId: req.user.id, sessionId: req.session.id, eventType: 'logout', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'logout_error' });
  }
});

export default router;
