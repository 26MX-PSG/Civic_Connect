const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { sign, requireAuth } = require('../middleware/auth');
const { wrap, bad, ApiError, unauthorized } = require('../utils/errors');
const v = require('../utils/validate');
const C = require('../constants');

const publicUser = (u) => ({ id: u.user_id, name: u.name, email: u.email, role: u.role, preferred_language: u.preferred_language, email_notifications: !!u.email_notifications });

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
