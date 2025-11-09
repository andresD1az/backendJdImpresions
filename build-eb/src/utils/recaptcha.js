import fetch from 'node-fetch';

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;

export async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET) {
    // In dev, allow pass-through if not configured
    return { success: true, devBypass: true };
  }
  const params = new URLSearchParams();
  params.append('secret', RECAPTCHA_SECRET);
  params.append('response', token || '');

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await res.json();
  return data; // { success, score, action, ... }
}
