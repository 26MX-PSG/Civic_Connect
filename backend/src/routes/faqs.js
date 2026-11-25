const router = require('express').Router();
const pool = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { wrap } = require('../utils/errors');
const { norm } = require('../utils/text');

// GET /api/faqs?keyword=&topic=&category=
router.get('/', optionalAuth, wrap(async (req, res) => {
  const all = req.query.all === '1' && req.user && req.user.role === 'ADMIN';
  const [rows] = await pool.query('SELECT * FROM faqs' + (all ? '' : ' WHERE is_active=TRUE') + ' ORDER BY faq_id');
  let list = rows.map((f) => ({ id: f.faq_id, category_id: f.category_id, topic: f.topic, q_en: f.question_en, a_en: f.answer_en, q_ta: f.question_ta, a_ta: f.answer_ta, is_active: !!f.is_active }));
  if (req.query.topic) list = list.filter((f) => f.topic === String(req.query.topic));
  if (req.query.category) list = list.filter((f) => String(f.category_id) === String(req.query.category));
  const kw = norm(String(req.query.keyword || '').slice(0, 255));
  if (kw) {
    const terms = kw.split(' ').filter((t) => t.length > 2);
    list = list.filter((f) => {
      const t = norm([f.q_en, f.a_en, f.q_ta, f.a_ta].join(' '));
      return terms.every((x) => t.includes(x.replace(/s$/, '')));
    });
  }
  res.json(list);
}));
module.exports = router;
