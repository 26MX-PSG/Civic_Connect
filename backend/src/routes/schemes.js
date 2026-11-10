const router = require('express').Router();
const pool = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { loadSchemes, findScheme } = require('../schemeRepo');
const { wrap, notFound, bad } = require('../utils/errors');
const { norm } = require('../utils/text');
const C = require('../constants');

const STOP = new Set(['the', 'a', 'an', 'for', 'of', 'to', 'in', 'and', 'scheme', 'schemes', 'yojana', 'me', 'my', 'is', 'with', 'on', 'திட்டம்']);

async function logNoResult(text, userId) {
  const t = String(text || '').trim().slice(0, 255);
  if (!t) return;
  const [ex] = await pool.query("SELECT query_id FROM search_queries WHERE source='SEARCH' AND LOWER(query_text)=LOWER(?) LIMIT 1", [t]);
  if (ex.length) await pool.query('UPDATE search_queries SET count=count+1, created_at=NOW() WHERE query_id=?', [ex[0].query_id]);
  else await pool.query("INSERT INTO search_queries (user_id,query_text,source,result_found) VALUES (?,?,'SEARCH',FALSE)", [userId || null, t]);
}

// GET /api/schemes?keyword=&category=<id|slug>(,more)&level=&state=
router.get('/', optionalAuth, wrap(async (req, res) => {
  const { keyword, category, level, state } = req.query;
  if (level && !C.levels.includes(level)) throw bad('level must be CENTRAL or STATE');
  let list = await loadSchemes();
  const [catRows] = await pool.query('SELECT category_id, slug, name_en, name_ta FROM categories');
  const cats = Object.fromEntries(catRows.map((c) => [c.category_id, c]));

  if (category) {
    const wanted = String(category).split(',').map((x) => catRows.find((c) => String(c.category_id) === x || c.slug === x));
    const ids = wanted.map((c) => (c ? c.category_id : -1));
    list = list.filter((s) => ids.includes(s.category_id));
  }
  if (level) list = list.filter((s) => s.level === level);
  if (state) list = list.filter((s) => !s.state || s.state === String(state));

  const kw = norm(String(keyword || '').slice(0, 255));
  if (kw) {
    const [docs] = await pool.query('SELECT document_id, name_en, name_ta FROM documents');
    const docById = Object.fromEntries(docs.map((d) => [d.document_id, d]));
    let terms = kw.split(' ').filter((t) => t && !STOP.has(t));
    if (!terms.length) terms = [kw];
    list = list.map((s) => {
      const c = cats[s.category_id] || {};
      const text = norm([s.name_en, s.name_ta, s.aliases.join(' '), s.short_en, s.short_ta, s.who_en, s.who_ta, s.benefits_en.join(' '), c.name_en, c.name_ta,
        s.documents.map((x) => (docById[x.id] ? docById[x.id].name_en + ' ' + docById[x.id].name_ta : '')).join(' ')].join(' '));
      const name = norm(s.name_en + ' ' + s.name_ta + ' ' + s.aliases.join(' '));
      let hits = 0, score = 0;
      terms.forEach((t) => {
        const stem = t.length > 4 ? t.replace(/(ies|es|s)$/, '') : t;
        if (text.includes(stem)) { hits++; score += name.includes(stem) ? 3 : 1; }
      });
      return { s, hits, score };
    }).filter((x) => x.hits === terms.length || (terms.length > 2 && x.hits >= terms.length - 1))
      .sort((a, b) => b.score - a.score).map((x) => x.s);
    if (!list.length) await logNoResult(keyword, req.user && req.user.user_id);
  }
  res.json(list.map((s) => ({ ...s, category: cats[s.category_id] ? { id: s.category_id, slug: cats[s.category_id].slug, name_en: cats[s.category_id].name_en, name_ta: cats[s.category_id].name_ta } : null })));
}));

// GET /api/schemes/:idOrSlug — full detail with documents (incl. where to get) and feedback totals.
// Inactive schemes are still returned (is_active:false) so old links can say "no longer active".
router.get('/:idOrSlug', wrap(async (req, res) => {
  const s = await findScheme(req.params.idOrSlug, { includeInactive: true });
  if (!s) throw notFound('Scheme not found');
  const [[cat]] = await pool.query('SELECT category_id, slug, name_en, name_ta FROM categories WHERE category_id=?', [s.category_id]);
  const [docs] = await pool.query('SELECT * FROM documents WHERE document_id IN (?)', [s.documents.length ? s.documents.map((d) => d.id) : ['']]);
  const docById = Object.fromEntries(docs.map((d) => [d.document_id, d]));
  const [[fb]] = await pool.query('SELECT COALESCE(SUM(useful),0) yes, COALESCE(SUM(NOT useful),0) no FROM feedback WHERE scheme_id=?', [s.id]);
  res.json({
    ...s,
    category: cat ? { id: cat.category_id, slug: cat.slug, name_en: cat.name_en, name_ta: cat.name_ta } : null,
    document_details: s.documents.map((d) => { const m = docById[d.id] || {}; return { id: d.id, mandatory: d.mandatory, name_en: m.name_en, name_ta: m.name_ta, description: m.description,
      where_en: m.where_to_get, where_ta: m.where_to_get_ta, link: m.issuer_url || '', link_label: m.issuer_label || '' }; }),
    feedback: { yes: Number(fb.yes), no: Number(fb.no) }
  });
}));

module.exports = router;
