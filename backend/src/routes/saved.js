const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { wrap, notFound, bad } = require('../utils/errors');
const v = require('../utils/validate');

// GET /api/saved — ids of saved schemes, newest first
router.get('/', requireAuth, wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT scheme_id FROM saved_schemes WHERE user_id=? ORDER BY saved_at DESC, scheme_id DESC', [req.user.user_id]);
  res.json({ scheme_ids: rows.map((r) => r.scheme_id) });
}));

// POST /api/saved { scheme_id } — idempotent
router.post('/', requireAuth, wrap(async (req, res) => {
  if (!req.body || req.body.scheme_id === undefined) throw bad('scheme_id is required');
  const sid = v.id(req.body.scheme_id, 'scheme_id');
  const [s] = await pool.query('SELECT 1 FROM schemes WHERE scheme_id=?', [sid]);
  if (!s.length) throw notFound('Scheme not found');
  await pool.query('INSERT IGNORE INTO saved_schemes (user_id,scheme_id) VALUES (?,?)', [req.user.user_id, sid]);
  res.status(201).json({ saved: true, scheme_id: sid });
}));

// DELETE /api/saved/:schemeId — idempotent
router.delete('/:schemeId', requireAuth, wrap(async (req, res) => {
  const sid = v.id(req.params.schemeId, 'schemeId');
  await pool.query('DELETE FROM saved_schemes WHERE user_id=? AND scheme_id=?', [req.user.user_id, sid]);
  res.json({ saved: false, scheme_id: sid });
}));

module.exports = router;
