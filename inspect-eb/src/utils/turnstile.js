import fetch from 'node-fetch';

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET;

export async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET) {
    // En dev, si no está configurado, permite pasar para no bloquear flujo
    return { success: true, devBypass: true };
  }
  const params = new URLSearchParams();
  params.append('secret', TURNSTILE_SECRET);
  params.append('response', token || '');

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  return data; // { success, "error-codes": [...], ... }
}
