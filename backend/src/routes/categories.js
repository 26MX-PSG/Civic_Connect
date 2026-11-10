const router = require('express').Router();
const pool = require('../db');
const { wrap, notFound } = require('../utils/errors');

const shape = (c) => ({ id: c.category_id, slug: c.slug, icon: c.icon, name_en: c.name_en, name_ta: c.name_ta, description: c.description, is_active: !!c.is_active, scheme_count: Number(c.scheme_count) });
const SQL = `SELECT c.*, (SELECT COUNT(*) FROM schemes s WHERE s.category_id=c.category_id AND s.is_active) AS scheme_count FROM categories c WHERE c.is_active`;

// GET /api/categories — active categories that have at least one active scheme
router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query(SQL + ' ORDER BY c.category_id');
  res.json(rows.map(shape).filter((c) => c.scheme_count > 0));
}));

router.get('/:idOrSlug', wrap(async (req, res) => {
  const [rows] = await pool.query(SQL + ' AND (c.category_id=? OR c.slug=?)', [Number(req.params.idOrSlug) || 0, req.params.idOrSlug]);
  if (!rows.length) throw notFound('Category not found');
  res.json(shape(rows[0]));
}));

module.exports = router;
