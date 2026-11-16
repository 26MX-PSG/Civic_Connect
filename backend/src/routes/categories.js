const router = require('express').Router();
const pool = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { wrap, notFound } = require('../utils/errors');

const shape = (c) => ({ id: c.category_id, slug: c.slug, icon: c.icon, name_en: c.name_en, name_ta: c.name_ta, description: c.description, is_active: !!c.is_active, scheme_count: Number(c.scheme_count) });
const SQL = `SELECT c.*, (SELECT COUNT(*) FROM schemes s WHERE s.category_id=c.category_id AND s.is_active) AS scheme_count FROM categories c WHERE c.is_active`;
const ALL_SQL = `SELECT c.*, (SELECT COUNT(*) FROM schemes s WHERE s.category_id=c.category_id AND s.is_active) AS scheme_count FROM categories c WHERE 1=1`;

// GET /api/categories — active categories that have at least one active scheme
// Admins can add ?all=1 to also get inactive / empty categories (for the admin Content page).
router.get('/', optionalAuth, wrap(async (req, res) => {
  if (req.query.all === '1' && req.user && req.user.role === 'ADMIN') {
    const [all] = await pool.query(ALL_SQL + ' ORDER BY c.category_id');
    return res.json(all.map(shape));
  }
  const [rows] = await pool.query(SQL + ' ORDER BY c.category_id');
  res.json(rows.map(shape).filter((c) => c.scheme_count > 0));
}));

router.get('/:idOrSlug', wrap(async (req, res) => {
  const [rows] = await pool.query(SQL + ' AND (c.category_id=? OR c.slug=?)', [Number(req.params.idOrSlug) || 0, req.params.idOrSlug]);
  if (!rows.length) throw notFound('Category not found');
  res.json(shape(rows[0]));
}));

module.exports = router;
