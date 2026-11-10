const router = require('express').Router();
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { wrap } = require('../utils/errors');

router.use(requireRole('ADMIN'));

// GET /api/admin/users — name, email and account status only (never profile data: DESIGN.md section 10)
router.get('/users', wrap(async (req, res) => {
  const [rows] = await pool.query("SELECT user_id,name,email,role,is_active,created_at FROM users WHERE role='USER' ORDER BY user_id");
  res.json(rows.map((u) => ({ id: u.user_id, name: u.name, email: u.email, role: u.role, is_active: !!u.is_active, created_at: u.created_at })));
}));

module.exports = router;
