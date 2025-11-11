import express from 'express';
import { query } from '../config/db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAuthToken } from '../utils/jwt.js';
import { sendEmail } from '../utils/email.js';
import { verifyRecaptcha } from '../utils/recaptcha.js';
import { verifyTurnstile } from '../utils/turnstile.js';
import { generateNumericCode, expiryFromNow } from '../utils/codes.js';
import { requireAuth } from '../middleware/auth.js';
import { enforceSessionState } from '../middleware/sessionActivity.js';
import { audit } from '../utils/audit.js';
import { ensureRole } from '../middleware/roles.js';

const router = express.Router();

// Helpers
async function getUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

async function anyManagerExists() {
  const { rows } = await query("SELECT 1 FROM users WHERE role = 'manager' LIMIT 1");
  return !!rows.length;
}

async function getUserById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, securityCode, turnstileToken, recaptchaToken } = req.body || {};
    if (!email || !password || !securityCode) return res.status(400).json({ error: 'missing_fields' });
    
    // CAPTCHA: prefer Turnstile, fallback to reCAPTCHA if provided
    const ts = await verifyTurnstile(turnstileToken);
    const rc = !ts?.success ? await verifyRecaptcha(recaptchaToken) : { success: true };
    if (!ts?.success && !rc?.success) return res.status(400).json({ error: 'captcha_failed' });
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email_in_use' });

    const passHash = await hashPassword(password);
    const { rows } = await query(
      'INSERT INTO users (email, password_hash, full_name, role, security_code) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, is_email_verified',
      [email.toLowerCase(), passHash, fullName || null, 'client', String(securityCode)]
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
    const { email, password, turnstileToken, recaptchaToken } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

    // CAPTCHA: prefer Turnstile, fallback to reCAPTCHA during transición
    const ts = await verifyTurnstile(turnstileToken);
    const rc = !ts?.success ? await verifyRecaptcha(recaptchaToken) : { success: true };
    if (!ts?.success && !rc?.success) return res.status(400).json({ error: 'captcha_failed' });

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
    console.error('auth_login_error:', e?.message || e, e?.stack || '')
    return res.status(500).json({ error: 'login_error' });
  }
});

// Request password reset
router.post('/password/request', async (req, res) => {
  try {
    const { email, turnstileToken, recaptchaToken } = req.body || {};
    if (!email) return res.status(400).json({ error: 'missing_fields' });

    // CAPTCHA to mitigate abuse
    const ts = await verifyTurnstile(turnstileToken);
    const rc = !ts?.success ? await verifyRecaptcha(recaptchaToken) : { success: true };
    if (!ts?.success && !rc?.success) return res.status(400).json({ error: 'captcha_failed' });
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
    // Seleccionar solo columnas seguras que existen en todos los esquemas
    const { rows } = await query('SELECT id, email, full_name, role FROM users WHERE id = $1', [req.user.id]);
    const u = rows[0] || {}
    const role = (u.role || '').toLowerCase()
    const isStaff = role && role !== 'client'
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
    const perms = permsByRole[role] || []
    // Devolver placeholders para campos opcionales
    return res.json({ user: {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      is_staff: isStaff,
      perms,
      status: 'active',
      is_email_verified: true,
      avatar_url: null,
      created_at: null,
    } });
  } catch (e) {
    return res.status(500).json({ error: 'me_error' });
  }
});

// Update own profile (name, avatar)
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { fullName, avatarUrl } = req.body || {};
    await query(
      `UPDATE users SET full_name = COALESCE($2, full_name), avatar_url = COALESCE($3, avatar_url), updated_at = NOW() WHERE id = $1`,
      [req.user.id, fullName || null, avatarUrl || null]
    );
    const u = await getUserById(req.user.id);
    return res.json({ ok: true, user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role, avatar_url: u.avatar_url } });
  } catch (e) {
    return res.status(500).json({ error: 'update_profile_error' });
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

// Change password (authenticated)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'missing_fields' });

    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'not_found' });

    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) {
      await audit({ userId: req.user.id, eventType: 'change_password_fail', ip: req.ip, userAgent: req.headers['user-agent'], details: { reason: 'bad_current' } });
      return res.status(403).json({ error: 'invalid_current_password' });
    }

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    await audit({ userId: req.user.id, eventType: 'change_password', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'change_password_error' });
  }
});

// One-time bootstrap: create first manager (gerente)
router.post('/bootstrap/manager', async (req, res) => {
  try {
    const key = req.headers['x-bootstrap-key'];
    if (!process.env.ADMIN_BOOTSTRAP_KEY || key !== process.env.ADMIN_BOOTSTRAP_KEY) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (await anyManagerExists()) return res.status(409).json({ error: 'manager_exists' });

    const { email, password, fullName, securityCode } = req.body || {};
    if (!email || !password || !securityCode) return res.status(400).json({ error: 'missing_fields' });
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email_in_use' });

    const passHash = await hashPassword(password);
    const { rows } = await query(
      "INSERT INTO users (email, password_hash, full_name, role, security_code, is_email_verified) VALUES ($1,$2,$3,'manager',$4,TRUE) RETURNING id, email, role",
      [email.toLowerCase(), passHash, fullName || null, String(securityCode)]
    );
    const user = rows[0];
    await audit({ userId: user.id, eventType: 'bootstrap_manager', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ ok: true, user });
  } catch (e) {
    console.error('bootstrap_manager_error:', e?.message || e, e?.stack || '')
    return res.status(500).json({ error: 'bootstrap_error' });
  }
});

// Admin: create employee user (only manager)
router.post('/admin/create-employee', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const {
      email, password, fullName, securityCode, role,
      rut, nationalId, bloodType, findings, birthDate, experienceYears
    } = req.body || {};
    if (!email || !password || !securityCode || !role) return res.status(400).json({ error: 'missing_fields' });
    const allowedRoles = new Set(['manager','operativo','bodega','surtido','descargue','vendedor','cajero','soporte']);
    if (!allowedRoles.has(role)) return res.status(400).json({ error: 'invalid_role' });

    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'email_in_use' });

    const passHash = await hashPassword(password);
    const { rows } = await query(
      'INSERT INTO users (email, password_hash, full_name, role, security_code, is_email_verified) VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING id, email, role',
      [email.toLowerCase(), passHash, fullName || null, role, String(securityCode)]
    );
    const user = rows[0];
    // Create profile if any profile field provided
    if (rut || nationalId || bloodType || findings || birthDate || experienceYears !== undefined) {
      await query(
        'INSERT INTO employee_profiles (user_id, rut, national_id, blood_type, findings, birth_date, experience_years) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id) DO UPDATE SET rut=EXCLUDED.rut, national_id=EXCLUDED.national_id, blood_type=EXCLUDED.blood_type, findings=EXCLUDED.findings, birth_date=EXCLUDED.birth_date, experience_years=EXCLUDED.experience_years',
        [user.id, rut || null, nationalId || null, bloodType || null, findings || null, birthDate || null, Number.isFinite(Number(experienceYears)) ? Number(experienceYears) : null]
      );
    }

    await audit({ userId: req.user.id, eventType: 'create_employee', ip: req.ip, userAgent: req.headers['user-agent'], details: { employeeId: user.id, role } });
    return res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e) {
    return res.status(500).json({ error: 'create_employee_error' });
  }
});

// List employees with profile (manager only)
router.get('/admin/employees', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    // Evitar referenciar columnas opcionales como u.status si no existen
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.role,
              ep.rut, ep.national_id, ep.blood_type, ep.findings, ep.birth_date, ep.experience_years
         FROM users u
    LEFT JOIN employee_profiles ep ON ep.user_id = u.id
        WHERE u.role IN ('bodega','descargue','surtido','manager')
        ORDER BY u.email ASC`
    );
    // Completar status con 'active' por defecto si no existe en el esquema
    const normalized = rows.map(r => ({ ...r, status: r.status || 'active' }))
    return res.json({ employees: normalized });
  } catch (e) {
    return res.status(500).json({ error: 'list_employees_error' });
  }
});

// Update employee: suspend/reactivate and update profile fields
router.patch('/admin/employees/:id', requireAuth, ensureRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, fullName, rut, nationalId, bloodType, findings, birthDate, experienceYears } = req.body || {};

    // Update status/full_name if provided
    if (status || fullName) {
      const allowed = new Set(['active','suspended']);
      const nextStatus = status && allowed.has(status) ? status : undefined;
      await query(
        `UPDATE users SET
           full_name = COALESCE($2, full_name),
           status = COALESCE($3, status),
           updated_at = NOW()
         WHERE id = $1`,
        [id, fullName || null, nextStatus || null]
      );
    }

    // Upsert profile
    if (rut || nationalId || bloodType || findings || birthDate || experienceYears !== undefined) {
      await query(
        `INSERT INTO employee_profiles (user_id, rut, national_id, blood_type, findings, birth_date, experience_years)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id) DO UPDATE SET
           rut = EXCLUDED.rut,
           national_id = EXCLUDED.national_id,
           blood_type = EXCLUDED.blood_type,
           findings = EXCLUDED.findings,
           birth_date = EXCLUDED.birth_date,
           experience_years = EXCLUDED.experience_years,
           updated_at = NOW()`,
        [id, rut || null, nationalId || null, bloodType || null, findings || null, birthDate || null, Number.isFinite(Number(experienceYears)) ? Number(experienceYears) : null]
      );
    }

    await audit({ userId: req.user.id, eventType: 'update_employee', ip: req.ip, userAgent: req.headers['user-agent'], details: { employeeId: id } });
    return res.json({ ok: true });
});

// Delete employee (hard delete)
router.delete('/admin/employees/:id', requireAuth, ensureRole(['manager']), async (req, res) => {
try {
const { id } = req.params;
await query('DELETE FROM users WHERE id = $1', [id]);
await audit({ userId: req.user.id, eventType: 'delete_employee', ip: req.ip, userAgent: req.headers['user-agent'], details: { employeeId: id } });
return res.json({ ok: true });
} catch (e) {
return res.status(500).json({ error: 'delete_employee_error' });
}
});

// Update employee role (manager only)
router.patch('/admin/employee/:id/role', requireAuth, ensureRole(['manager']), async (req, res) => {
try {
const { id } = req.params;
const { newRole } = req.body || {};
const allowedRoles = new Set(['manager','operativo','bodega','surtido','descargue','vendedor','cajero','soporte']);
if (!newRole || !allowedRoles.has(String(newRole))) {
return res.status(400).json({ error: 'invalid_role' });
}

// Cannot change own role
const me = await getUserById(req.user.id);
if (!me) return res.status(401).json({ error: 'unauthorized' });
if (String(id) === String(me.id)) {
return res.status(403).json({ error: 'cannot_change_own_role' });
}

// Target must exist
const target = await getUserById(id);
if (!target) return res.status(404).json({ error: 'not_found' });

// If demoting a manager, ensure at least one manager remains
const isDemotingManager = String(target.role) === 'manager' && String(newRole) !== 'manager';
if (isDemotingManager) {
const { rows } = await query("SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'manager' AND id <> $1", [id]);
const remaining = rows[0]?.cnt || 0;
if (remaining <= 0) {
return res.status(409).json({ error: 'must_keep_one_manager' });
}
}

await query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [String(newRole), id]);
await audit({ userId: req.user.id, eventType: 'change_role', ip: req.ip, userAgent: req.headers['user-agent'], details: { employeeId: id, fromRole: target.role, toRole: String(newRole) } });
return res.json({ ok: true });
} catch (e) {
return res.status(500).json({ error: 'change_role_error' });
}
});

export default router;

// Dev-only endpoint to verify email sending quickly
// Enable behind env flag if desired
export const devRouter = (() => {
  const dev = express.Router();
  dev.post('/email-test', async (req, res) => {
    try {
      if (!process.env.GMAIL_USER || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
        return res.status(400).json({ error: 'gmail_not_configured' });
      }
      const { to, subject = 'Prueba JDImpresiones', html = '<p>Correo de prueba</p>' } = req.body || {};
      if (!to) return res.status(400).json({ error: 'missing_to' });
      const result = await sendEmail({ to, subject, html });
      return res.json({ ok: true, id: result?.id || result?.threadId || null });
    } catch (e) {
      return res.status(500).json({ error: 'email_test_error', message: e?.message || String(e) });
    }
  });
  return dev;
})();
