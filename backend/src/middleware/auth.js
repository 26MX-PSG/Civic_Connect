const jwt = require('jsonwebtoken');
const config = require('../config');
const pool = require('../db');
const { unauthorized, forbidden, wrap } = require('../utils/errors');

function sign(user) {
  return jwt.sign({ sub: user.user_id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function userFromToken(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  let payload;
  try { payload = jwt.verify(h.slice(7), config.jwtSecret); } catch (e) { throw unauthorized('Invalid or expired token'); }
  // re-read from DB so deactivated users and role changes take effect immediately
  const [rows] = await pool.query('SELECT user_id,name,email,role,preferred_language,email_notifications,is_active FROM users WHERE user_id=?', [payload.sub]);
  if (!rows.length || !rows[0].is_active) throw unauthorized('Account not available');
  return rows[0];
}

const requireAuth = wrap(async (req, res, next) => {
  const u = await userFromToken(req);
  if (!u) throw unauthorized();
  req.user = u; next();
});

// attaches req.user when a valid token is sent, otherwise continues as a guest
const optionalAuth = wrap(async (req, res, next) => {
  req.user = (await userFromToken(req)) || null; next();
});

const requireRole = (...roles) => [requireAuth, (req, res, next) => (roles.includes(req.user.role) ? next() : next(forbidden('Admin access required')))];

module.exports = { sign, requireAuth, optionalAuth, requireRole };
