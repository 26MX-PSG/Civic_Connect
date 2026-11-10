const router = require('express').Router();
const pool = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { wrap, notFound, bad } = require('../utils/errors');
const v = require('../utils/validate');

async function summary(sid, uid) {
  const [[t]] = await pool.query('SELECT COALESCE(SUM(useful),0) yes, COALESCE(SUM(NOT useful),0) no FROM feedback WHERE scheme_id=?', [sid]);
  let mine = null;
  if (uid) { const [r] = await pool.query('SELECT useful, comment FROM feedback WHERE scheme_id=? AND user_id=?', [sid, uid]); if (r.length) mine = { useful: !!r[0].useful, comment: r[0].comment }; }
  return { scheme_id: sid, yes: Number(t.yes), no: Number(t.no), mine };
}

// GET /api/feedback/:schemeId — totals (and the caller's own vote when logged in). Comments are not public.
router.get('/:schemeId', optionalAuth, wrap(async (req, res) => {
  const sid = v.id(req.params.schemeId, 'schemeId');
  res.json(await summary(sid, req.user && req.user.user_id));
}));

// PUT /api/feedback/:schemeId { useful: true|false, comment? } — one vote per user per scheme; voting again replaces it
router.put('/:schemeId', requireAuth, wrap(async (req, res) => {
  const sid = v.id(req.params.schemeId, 'schemeId');
  const b = req.body || {};
  if (typeof b.useful !== 'boolean') throw bad('useful must be true or false');
  const comment = v.str(b.comment, 'comment', { max: 200, required: false });
  const [s] = await pool.query('SELECT 1 FROM schemes WHERE scheme_id=?', [sid]);
  if (!s.length) throw notFound('Scheme not found');
  await pool.query(`INSERT INTO feedback (scheme_id,user_id,useful,comment) VALUES (?,?,?,?)
    ON DUPLICATE KEY UPDATE useful=VALUES(useful), comment=COALESCE(VALUES(comment), comment), created_at=NOW()`, [sid, req.user.user_id, b.useful, comment]);
  res.json(await summary(sid, req.user.user_id));
}));

module.exports = router;
