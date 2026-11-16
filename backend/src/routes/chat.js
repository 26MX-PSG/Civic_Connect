const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { optionalAuth } = require('../middleware/auth');
const { wrap, bad } = require('../utils/errors');
const v = require('../utils/validate');
const { logUnanswered } = require('../utils/queryLog');

const limiter = rateLimit({ windowMs: 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 30, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } } });

// POST /api/chat/log { query_text, source: SEARCH|CHATBOT_GENERAL|CHATBOT_SCHEME, scheme_id? }
// The assistants run in the browser; when they cannot answer they report the question here for admin review.
router.post('/log', limiter, optionalAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const text = v.str(b.query_text, 'query_text', { max: 255 });
  const source = v.oneOf(b.source, ['SEARCH', 'CHATBOT_GENERAL', 'CHATBOT_SCHEME'], 'source');
  if (!source) throw bad('source is required');
  await logUnanswered(text, req.user && req.user.user_id, source, b.scheme_id ? v.id(b.scheme_id, 'scheme_id') : null);
  res.status(201).json({ logged: true });
}));
module.exports = router;
