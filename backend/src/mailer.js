/* Single place that talks to SMTP (Nodemailer). Everything else calls sendMail().
 * If SMTP is not configured, mail is logged to the console instead (dev mode) and sendMail returns { sent:false }. */
const nodemailer = require('nodemailer');
const config = require('./config');

let transporter = null;

function isConfigured() { const s = config.smtp; return !!(s.host && s.user && s.pass); }

function getTransporter() {
  if (transporter) return transporter;
  const { host, port, secure, user, pass } = config.smtp;
  transporter = nodemailer.createTransport({
    host, port, secure,                       // secure=true -> port 465 (SSL). false -> port 587 (STARTTLS)
    auth: { user, pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    pool: true, maxConnections: 3
  });
  return transporter;
}

// Translate raw SMTP errors into something a human can act on.
function explain(e) {
  const m = String((e && e.message) || e);
  if (e && (e.code === 'EAUTH' || /535|Invalid login|Username and Password not accepted|BadCredentials/i.test(m)))
    return 'SMTP login rejected. For Gmail use a 16-character App Password (not your normal password; 2-Step Verification must be ON). Check SMTP_USER / SMTP_PASS.';
  if (e && (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT' || e.code === 'ESOCKET' || e.code === 'ECONNECTION'))
    return 'Cannot reach the SMTP server. Check SMTP_HOST / SMTP_PORT, and that port 587 or 465 is not blocked by your network.';
  if (/wrong version number|SSL routines/i.test(m))
    return 'TLS mismatch: use SMTP_PORT=587 with SMTP_SECURE=false, or SMTP_PORT=465 with SMTP_SECURE=true.';
  if (e && e.code === 'EENVELOPE') return 'Recipient address was rejected: ' + m;
  return m;
}

async function verify() {
  if (!isConfigured()) return { ok: false, configured: false, message: 'SMTP_HOST, SMTP_USER and SMTP_PASS are not all set in .env' };
  try { await getTransporter().verify(); return { ok: true, configured: true, message: 'SMTP login OK (' + config.smtp.host + ':' + config.smtp.port + ')' }; }
  catch (e) { return { ok: false, configured: true, message: explain(e) }; }
}

async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.warn(`[mail] SMTP not configured — would send to ${to}: "${subject}"${text ? '\n' + text : ''}`);
    return { sent: false, reason: 'SMTP not configured' };
  }
  try {
    const info = await getTransporter().sendMail({ from: config.smtp.from, to, subject, html, text });
    return { sent: true, messageId: info.messageId };
  } catch (e) {
    const reason = explain(e);
    console.error(`[mail] failed to send to ${to}: ${reason}`);
    return { sent: false, reason };
  }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Shared branded layout for every email. `body` must already be escaped / trusted HTML.
function layout({ heading, body, cta }) {
  const url = config.frontendUrl.replace(/\/$/, '');
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#fff">
  <h2 style="margin:0 0 12px;color:#173B65">${esc(heading)}</h2>${body}
  ${cta ? `<p><a href="${esc(cta.href.startsWith('http') ? cta.href : url + '/' + cta.href.replace(/^\//, ''))}" style="display:inline-block;padding:12px 18px;background:#173B65;color:#fff;text-decoration:none;border-radius:8px">${esc(cta.label)}</a></p>` : ''}
  <p style="font-size:12px;color:#6b7280;margin-top:24px">CivicConnect gives guidance based on basic criteria only; the government department makes the final decision. You get these emails because you turned on email notifications — change this on your dashboard.</p></div>`;
}

module.exports = { sendMail, verify, isConfigured, layout, esc, explain };
