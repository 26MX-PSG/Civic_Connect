const router = require('express').Router();
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const config = require('../config');
const { sign, requireAuth } = require('../middleware/auth');
const { wrap, bad, ApiError, unauthorized } = require('../utils/errors');
const v = require('../utils/validate');
const C = require('../constants');

const publicUser = (u) => ({ id: u.user_id, name: u.name, email: u.email, role: u.role, preferred_language: u.preferred_language, email_notifications: !!u.email_notifications });
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const buildResetLink = (token) => `${config.frontendUrl.replace(/\/$/, '')}/reset-password.html?token=${encodeURIComponent(token)}`;

async function sendPasswordResetEmail(recipient, name, resetLink) {
  const { host, port, secure, user, pass, from } = config.smtp;
  if (!host || !user || !pass) {
    console.warn(`[auth] SMTP not configured. Password reset link for ${recipient}: ${resetLink}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: !!secure,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from,
    to: recipient,
    subject: 'Reset your CivicConnect password',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#fff">
        <h2 style="margin:0 0 12px;color:#3b2f2a;">Reset your password</h2>
        <p>Hello ${name || 'there'},</p>
        <p>We received a request to reset the password for your CivicConnect account.</p>
        <p><a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#7a5b45;color:#fff;text-decoration:none;border-radius:8px;">Reset password</a></p>
        <p>If you didn’t request this, you can safely ignore this email.</p>
        <p style="font-size:12px;color:#6b7280;">This link expires in ${config.passwordResetTtlMinutes} minutes.</p>
      </div>
    `
  });
}

// POST /api/auth/register  — always creates a USER (admins are created by seeding / other admins)
router.post('/register', wrap(async (req, res) => {
  const b = req.body || {};
  const name = v.str(b.name, 'name', { min: 2, max: 100 });
  const email = v.email(b.email);
  const password = v.str(b.password, 'password', { min: 6, max: 72 });
  const lang = v.oneOf(b.preferred_language, C.languages, 'preferred_language') || 'EN';
  const [dup] = await pool.query('SELECT 1 FROM users WHERE email=?', [email]);
  if (dup.length) throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  const [r] = await pool.query('INSERT INTO users (name,email,password_hash,role,preferred_language) VALUES (?,?,?,?,?)', [name, email, bcrypt.hashSync(password, 10), 'USER', lang]);
  const user = { user_id: r.insertId, name, email, role: 'USER', preferred_language: lang, email_notifications: false };
  res.status(201).json({ token: sign(user), user: publicUser(user) });
}));

// POST /api/auth/login
router.post('/login', wrap(async (req, res) => {
  const b = req.body || {};
  const email = v.str(b.email, 'email', { max: 150 }).toLowerCase();
  const password = v.str(b.password, 'password', { max: 72 });
  const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
  const u = rows[0];
  // same message for unknown email and wrong password
  if (!u || !bcrypt.compareSync(password, u.password_hash)) throw unauthorized('Incorrect email or password');
  if (!u.is_active) throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  res.json({ token: sign(u), user: publicUser(u) });
}));

// POST /api/auth/forgot-password — generic response to avoid leaking account existence
router.post('/forgot-password', wrap(async (req, res) => {
  const b = req.body || {};
  const email = v.email(b.email);
  const [rows] = await pool.query('SELECT user_id, name, email FROM users WHERE email=? AND is_active=1', [email]);

  if (rows.length) {
    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + config.passwordResetTtlMinutes * 60 * 1000);
    await pool.query('DELETE FROM password_resets WHERE user_id=?', [user.user_id]);
    await pool.query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.user_id, hashToken(token), expiresAt]);
    await sendPasswordResetEmail(user.email, user.name, buildResetLink(token));
  }

  res.json({ ok: true, message: 'If an account exists for that email, a password reset link has been sent.' });
}));

// POST /api/auth/reset-password
router.post('/reset-password', wrap(async (req, res) => {
  const b = req.body || {};
  const token = v.str(b.token, 'token', { min: 32, max: 255 });
  const password = v.str(b.password, 'password', { min: 8, max: 72 });
  const tokenHash = hashToken(token);

  const [rows] = await pool.query(`
    SELECT pr.user_id, pr.reset_id
    FROM password_resets pr
    WHERE pr.token_hash = ?
      AND pr.used_at IS NULL
      AND pr.expires_at > NOW()
    ORDER BY pr.expires_at DESC
    LIMIT 1
  `, [tokenHash]);

  if (!rows.length) throw bad('This password reset link is invalid or expired.');

  const userId = rows[0].user_id;
  await pool.query('UPDATE users SET password_hash=? WHERE user_id=?', [bcrypt.hashSync(password, 10), userId]);
  await pool.query('UPDATE password_resets SET used_at=NOW() WHERE user_id=?', [userId]);

  res.json({ ok: true, message: 'Password updated successfully.' });
}));

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// PATCH /api/auth/me — language and notification preferences
router.patch('/me', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const lang = v.oneOf(b.preferred_language, C.languages, 'preferred_language');
  const name = b.name !== undefined ? v.str(b.name, 'name', { min: 2, max: 100 }) : null;
  if (lang === null && name === null && b.email_notifications === undefined) throw bad('Nothing to update');
  await pool.query('UPDATE users SET preferred_language=COALESCE(?,preferred_language), name=COALESCE(?,name), email_notifications=COALESCE(?,email_notifications) WHERE user_id=?',
    [lang, name, b.email_notifications === undefined ? null : !!b.email_notifications, req.user.user_id]);
  const [[u]] = await pool.query('SELECT * FROM users WHERE user_id=?', [req.user.user_id]);
  res.json({ user: publicUser(u) });
}));

// POST /api/auth/logout — JWTs are stateless; the client discards the token
router.post('/logout', (req, res) => res.json({ ok: true }));

module.exports = router;
