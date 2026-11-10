const router = require('express').Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { wrap, notFound } = require('../utils/errors');
const v = require('../utils/validate');

const shape = (n) => ({ id: n.notification_id, user_id: n.user_id, scheme_id: n.scheme_id, type: n.type, title_en: n.title_en, title_ta: n.title_ta, is_read: !!n.is_read, created_at: n.created_at });

router.get('/', requireAuth, wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC, notification_id DESC', [req.user.user_id]);
  res.json(rows.map(shape));
}));

router.patch('/:id/read', requireAuth, wrap(async (req, res) => {
  const id = v.id(req.params.id);
  const [r] = await pool.query('UPDATE notifications SET is_read=TRUE WHERE notification_id=? AND user_id=?', [id, req.user.user_id]);
  if (!r.affectedRows) throw notFound('Notification not found');
  res.json({ id, is_read: true });
}));

module.exports = router;
