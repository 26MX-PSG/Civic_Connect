const router = require('express').Router();
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { wrap } = require('../utils/errors');
const v = require('../utils/validate');

router.use(requireRole('ADMIN'));

// GET /api/admin/users — name, email and account status only
router.get('/users', wrap(async (req, res) => {
  const [rows] = await pool.query("SELECT user_id,name,email,role,is_active,created_at FROM users WHERE role='USER' ORDER BY user_id");
  res.json(rows.map((u) => ({ id: u.user_id, name: u.name, email: u.email, role: u.role, is_active: !!u.is_active, created_at: u.created_at })));
}));

// GET /api/admin/feedback?schemeId=<id> — detailed feedback for authorized admins
router.get('/feedback', wrap(async (req, res) => {
  let schemeId = null;
  if (req.query.schemeId !== undefined && req.query.schemeId !== '') {
    schemeId = v.id(req.query.schemeId, 'schemeId');
  }

  const params = [];
  let sql = `SELECT f.feedback_id, f.scheme_id, s.name_en AS scheme_name, s.name_ta AS scheme_name_ta,
                    f.user_id, u.name AS user_name, u.email AS user_email,
                    f.useful, f.comment, f.created_at
             FROM feedback f
             JOIN schemes s ON s.scheme_id=f.scheme_id
             LEFT JOIN users u ON u.user_id=f.user_id`;
  if (schemeId !== null) {
    sql += ' WHERE f.scheme_id=?'; params.push(schemeId);
  }
  sql += ' ORDER BY f.created_at DESC, f.feedback_id DESC';

  const [rows] = await pool.query(sql, params);
  res.json(rows.map((f) => ({
    feedback_id: f.feedback_id,
    scheme_id: f.scheme_id,
    scheme_name: f.scheme_name,
    scheme_name_ta: f.scheme_name_ta,
    user_id: f.user_id,
    user_name: f.user_name,
    user_email: f.user_email,
    useful: !!f.useful,
    response: f.useful ? 'Yes' : 'No',
    comment: f.comment,
    created_at: f.created_at
  })));
}));

module.exports = router;
