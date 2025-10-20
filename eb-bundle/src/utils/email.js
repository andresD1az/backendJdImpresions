import { google } from 'googleapis';

// Gmail API (OAuth2) configuration
const GMAIL_USER = process.env.GMAIL_USER; // e.g., youraccount@gmail.com
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const from = process.env.EMAIL_FROM || 'No-Reply <no-reply@example.com>';

function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER) {
    throw new Error('Gmail API not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_USER in .env');
  }
  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // redirect not used at runtime, but required
  );
  oAuth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  return oAuth2Client;
}

function toBase64Url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildRawMessage({ fromAddr, to, subject, html, text }) {
  const boundary = '====multipart_boundary====';
  const headers = [
    `From: ${fromAddr}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join('\r\n');

  const textPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text || '',
  ].join('\r\n');

  const htmlPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html || '',
  ].join('\r\n');

  const closing = `--${boundary}--`;
  const mime = `${headers}\r\n\r\n${textPart}\r\n\r\n${htmlPart}\r\n\r\n${closing}`;
  return toBase64Url(mime);
}

export async function sendEmail({ to, subject, html, text }) {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = buildRawMessage({ fromAddr: from, to, subject, html, text });

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return res.data;
}
