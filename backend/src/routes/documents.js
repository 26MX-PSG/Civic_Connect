const router = require('express').Router();
const pool = require('../db');
const { wrap, notFound } = require('../utils/errors');

const shape = (d) => ({ id: d.document_id, name_en: d.name_en, name_ta: d.name_ta, description: d.description,
  where_en: d.where_to_get, where_ta: d.where_to_get_ta, link: d.issuer_url || '', link_label: d.issuer_label || '' });

// GET /api/documents — the document guide (where to get each document)
router.get('/', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM documents ORDER BY name_en');
  res.json(rows.map(shape));
}));
router.get('/:id', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM documents WHERE document_id=?', [req.params.id]);
  if (!rows.length) throw notFound('Document not found');
  res.json(shape(rows[0]));
}));
module.exports = router;
