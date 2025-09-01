import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.EMAIL_FROM || 'No-Reply <no-reply@example.com>';

let transporter = null;

export function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: user && pass ? { user, pass } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const tx = getTransporter();
  const info = await tx.sendMail({ from, to, subject, html, text });
  return info;
}
