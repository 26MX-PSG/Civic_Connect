/* Loads schemes in the same shape as CC.seed.schemes (aliases, criteria, documents attached),
 * so the frontend can swap store.js for fetch() with little change. 15 schemes: a few joins per request is fine. */
const pool = require('./db');

const parseJson = (v) => (v == null ? null : typeof v === 'string' ? JSON.parse(v) : v);

async function loadSchemes({ includeInactive = false } = {}) {
  const [rows] = await pool.query('SELECT * FROM schemes' + (includeInactive ? '' : ' WHERE is_active = TRUE') + ' ORDER BY scheme_id');
  if (!rows.length) return [];
  const [aliases] = await pool.query('SELECT scheme_id, alias FROM scheme_aliases ORDER BY alias_id');
  const [criteria] = await pool.query('SELECT * FROM scheme_criteria ORDER BY criteria_group, criteria_id');
  const [docs] = await pool.query('SELECT scheme_id, document_id, is_mandatory FROM scheme_documents ORDER BY sort_order');
  const by = (list) => list.reduce((m, r) => { (m[r.scheme_id] = m[r.scheme_id] || []).push(r); return m; }, {});
  const A = by(aliases), C = by(criteria), D = by(docs);
  return rows.map((s) => ({
    id: s.scheme_id, slug: s.slug, category_id: s.category_id, level: s.level, state: s.state, image: s.image,
    name_en: s.name_en, name_ta: s.name_ta, aliases: (A[s.scheme_id] || []).map((a) => a.alias),
    short_en: s.short_en, short_ta: s.short_ta, who_en: s.who_en, who_ta: s.who_ta,
    benefits_en: parseJson(s.benefits_en) || [], benefits_ta: parseJson(s.benefits_ta),
    criteria: (C[s.scheme_id] || []).map((c) => ({ group: c.criteria_group, type: c.type, op: c.op, value: c.value, label_en: c.label_en, label_ta: c.label_ta })),
    documents: (D[s.scheme_id] || []).map((d) => ({ id: d.document_id, mandatory: !!d.is_mandatory })),
    official_url: s.official_url, source_name: s.source_name, source_url: s.source_url,
    last_verified_on: s.last_verified_on, is_verified: !!s.is_verified, is_active: !!s.is_active
  }));
}

async function findScheme(idOrSlug, opts) {
  const all = await loadSchemes(opts);
  return all.find((s) => String(s.id) === String(idOrSlug) || s.slug === idOrSlug) || null;
}

module.exports = { loadSchemes, findScheme };
