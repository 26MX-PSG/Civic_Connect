const router = require('express').Router();
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { wrap, bad, notFound, ApiError } = require('../utils/errors');
const v = require('../utils/validate');
const C = require('../constants');
const { loadSchemes, findScheme } = require('../schemeRepo');
const { recommend } = require('../utils/match');
const { getProfile } = require('./profiles');
const notify = require('../notify');
const mailer = require('../mailer');
const config = require('../config');

router.use(requireRole('ADMIN'));

/* ---------- users: name, email and status only (never profile data: DESIGN.md section 10) ---------- */
router.get('/users', wrap(async (req, res) => {
  const [rows] = await pool.query("SELECT user_id,name,email,role,is_active,created_at FROM users WHERE role='USER' ORDER BY user_id");
  res.json(rows.map((u) => ({ id: u.user_id, name: u.name, email: u.email, role: u.role, is_active: !!u.is_active, created_at: u.created_at })));
}));

router.patch('/users/:id', wrap(async (req, res) => {
  const id = v.id(req.params.id);
  if (typeof (req.body || {}).is_active !== 'boolean') throw bad('is_active must be true or false');
  const [r] = await pool.query("UPDATE users SET is_active=? WHERE user_id=? AND role='USER'", [req.body.is_active, id]);
  if (!r.affectedRows) throw notFound('User not found');
  res.json({ id, is_active: req.body.is_active });
}));

/* ---------- dashboard numbers ---------- */
router.get('/stats', wrap(async (req, res) => {
  const [[s]] = await pool.query(`SELECT
    (SELECT COUNT(*) FROM schemes WHERE is_active) activeSchemes, (SELECT COUNT(*) FROM schemes) totalSchemes,
    (SELECT COUNT(*) FROM users WHERE role='USER') users,
    (SELECT COUNT(*) FROM search_queries WHERE review_status='NEW') newQueries,
    (SELECT COUNT(*) FROM search_queries WHERE source LIKE 'CHATBOT%') chatbotQueries,
    (SELECT COALESCE(SUM(useful),0) FROM feedback) yes, (SELECT COALESCE(SUM(NOT useful),0) FROM feedback) no,
    (SELECT COUNT(*) FROM schemes WHERE is_active AND (last_verified_on IS NULL OR last_verified_on < DATE_SUB(CURDATE(), INTERVAL 90 DAY))) overdue`);
  const yes = Number(s.yes), no = Number(s.no);
  res.json({ activeSchemes: s.activeSchemes, totalSchemes: s.totalSchemes, users: s.users, newQueries: s.newQueries, chatbotQueries: s.chatbotQueries,
    verificationOverdue: s.overdue, responses: yes + no, usefulPct: yes + no ? Math.round(yes * 100 / (yes + no)) : 0 });
}));

/* ---------- schemes ---------- */
const OPS = ['=', '<', '<=', '>', '>=', 'IN', 'BETWEEN', 'IS_SET'];
const CRIT_TYPES = Object.keys(require('../utils/match').FIELD);

function parseScheme(b, partial) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('Send the scheme as a JSON object');
  const out = {
    slug: v.str(b.slug, 'slug', { max: 80 }).toLowerCase(),
    category_id: v.id(b.category_id, 'category_id'),
    level: v.oneOf(b.level, C.levels, 'level'),
    state: v.str(b.state, 'state', { max: 60, required: false }),
    image: v.str(b.image, 'image', { max: 60, required: false }),
    name_en: v.str(b.name_en, 'name_en', { max: 200 }), name_ta: v.str(b.name_ta, 'name_ta', { max: 250, required: false }),
    short_en: v.str(b.short_en, 'short_en', { max: 300 }), short_ta: v.str(b.short_ta, 'short_ta', { max: 300, required: false }),
    who_en: v.str(b.who_en, 'who_en', { max: 2000 }), who_ta: v.str(b.who_ta, 'who_ta', { max: 2000, required: false }),
    official_url: v.str(b.official_url, 'official_url', { max: 500 }), source_name: v.str(b.source_name, 'source_name', { max: 200 }),
    source_url: v.str(b.source_url, 'source_url', { max: 500 }), last_verified_on: v.date(b.last_verified_on, 'last_verified_on'),
    is_verified: !!b.is_verified
  };
  if (!out.level) throw bad('level is required');
  if (!/^[a-z0-9-]+$/.test(out.slug)) throw bad('slug may only contain a-z, 0-9 and -');
  ['official_url', 'source_url'].forEach((k) => { if (!/^https:\/\/\S+$/i.test(out[k])) throw bad(k + ' must be an https:// link'); });
  if (out.level === 'CENTRAL') out.state = null;
  const list = (x, name) => { if (x === undefined || x === null) return null; if (!Array.isArray(x) || x.some((i) => typeof i !== 'string')) throw bad(name + ' must be a list of text'); return x.map((i) => i.trim()).filter(Boolean); };
  out.benefits_en = list(b.benefits_en, 'benefits_en') || []; if (!out.benefits_en.length) throw bad('benefits_en needs at least one benefit');
  out.benefits_ta = list(b.benefits_ta, 'benefits_ta');
  out.aliases = (list(b.aliases, 'aliases') || [out.slug.replace(/-/g, ' ')]).map((a) => a.slice(0, 100));
  if (b.criteria !== undefined && !Array.isArray(b.criteria)) throw bad('criteria must be a list');
  out.criteria = (b.criteria || []).map((c, i) => {
    if (!CRIT_TYPES.includes(c.type)) throw bad(`criteria[${i}].type must be one of: ${CRIT_TYPES.join(', ')}`);
    if (!OPS.includes(c.op)) throw bad(`criteria[${i}].op must be one of: ${OPS.join(', ')}`);
    return { group: v.int(c.group, 'criteria group', { min: 1, max: 20 }) || 1, type: c.type, op: c.op, value: String(c.value == null ? '' : c.value).slice(0, 100), label_en: v.str(c.label_en, 'label_en', { max: 200, required: false }), label_ta: v.str(c.label_ta, 'label_ta', { max: 250, required: false }) };
  });
  if (b.documents !== undefined && !Array.isArray(b.documents)) throw bad('documents must be a list');
  out.documents = (b.documents || []).map((d) => ({ id: v.str(d.id, 'document id', { max: 40 }), mandatory: d.mandatory !== false }));
  return out;
}

async function writeScheme(conn, id, s) {
  const cols = ['slug', 'category_id', 'level', 'state', 'image', 'name_en', 'name_ta', 'short_en', 'short_ta', 'who_en', 'who_ta', 'official_url', 'source_name', 'source_url', 'last_verified_on', 'is_verified'];
  const vals = cols.map((c) => s[c]).concat([JSON.stringify(s.benefits_en), s.benefits_ta ? JSON.stringify(s.benefits_ta) : null]);
  const all = cols.concat(['benefits_en', 'benefits_ta']);
  if (id) { await conn.query(`UPDATE schemes SET ${all.map((c) => c + '=?').join(',')}${s.is_active === undefined ? '' : ',is_active=?'} WHERE scheme_id=?`, [...vals, ...(s.is_active === undefined ? [] : [s.is_active]), id]); }
  else { const [r] = await conn.query(`INSERT INTO schemes (${all.join(',')},is_active) VALUES (${all.map(() => '?').join(',')},?)`, [...vals, s.is_active !== false]); id = r.insertId; }
  await conn.query('DELETE FROM scheme_aliases WHERE scheme_id=?', [id]);
  await conn.query('DELETE FROM scheme_criteria WHERE scheme_id=?', [id]);
  await conn.query('DELETE FROM scheme_documents WHERE scheme_id=?', [id]);
  for (const a of s.aliases) await conn.query('INSERT INTO scheme_aliases (scheme_id,alias) VALUES (?,?)', [id, a]);
  for (const c of s.criteria) await conn.query('INSERT INTO scheme_criteria (scheme_id,criteria_group,type,op,value,label_en,label_ta) VALUES (?,?,?,?,?,?,?)', [id, c.group, c.type, c.op, c.value, c.label_en, c.label_ta]);
  let order = 0;
  for (const d of s.documents) await conn.query('INSERT INTO scheme_documents (scheme_id,document_id,is_mandatory,sort_order) VALUES (?,?,?,?)', [id, d.id, d.mandatory, order++]);
  return id;
}

async function saveScheme(id, parsed) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const newId = await writeScheme(conn, id, parsed);
    await conn.commit();
    return newId;
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'SLUG_EXISTS', 'A scheme with this slug already exists');
    if (e.code === 'ER_NO_REFERENCED_ROW_2') throw bad('Unknown category_id or document id');
    throw e;
  } finally { conn.release(); }
}

// users (with profiles) whose profile gives a basic-criteria MATCH for this scheme
async function matchingUserIds(scheme) {
  const [users] = await pool.query("SELECT user_id FROM users WHERE role='USER' AND is_active=1 AND user_id IN (SELECT user_id FROM profiles)");
  const ids = [];
  for (const u of users) { const p = await getProfile(u.user_id); if (recommend([scheme], p).some((x) => x.result.status === 'MATCH')) ids.push(u.user_id); }
  return ids;
}
const alreadyTold = async (schemeId) => (await pool.query("SELECT DISTINCT user_id FROM notifications WHERE scheme_id=? AND type='NEW_MATCH'", [schemeId]))[0].map((r) => r.user_id);

async function newMatchNotify(schemeId) {
  const s = await findScheme(schemeId);                 // active only
  if (!s) return notify.dispatch([]);
  const told = new Set(await alreadyTold(schemeId));
  return notify.newMatch(s, (await matchingUserIds(s)).filter((id) => !told.has(id)));
}

router.post('/schemes', wrap(async (req, res) => {
  const parsed = parseScheme(req.body); parsed.is_active = req.body.is_active !== false;
  const id = await saveScheme(null, parsed);
  const notifications = parsed.is_active ? await newMatchNotify(id) : null;
  res.status(201).json({ scheme: await findScheme(id, { includeInactive: true }), notifications });
}));

router.put('/schemes/:id', wrap(async (req, res) => {
  const id = v.id(req.params.id);
  const before = await findScheme(id, { includeInactive: true });
  if (!before) throw notFound('Scheme not found');
  const parsed = parseScheme(req.body);
  await saveScheme(id, parsed);
  const after = await findScheme(id, { includeInactive: true });
  const notifications = { updated: after.is_active ? await notify.schemeUpdated(after) : null, newMatch: after.is_active ? await newMatchNotify(id) : null };
  res.json({ scheme: after, notifications });
}));

router.patch('/schemes/:id/active', wrap(async (req, res) => {
  const id = v.id(req.params.id);
  if (typeof (req.body || {}).is_active !== 'boolean') throw bad('is_active must be true or false');
  const s = await findScheme(id, { includeInactive: true });
  if (!s) throw notFound('Scheme not found');
  await pool.query('UPDATE schemes SET is_active=? WHERE scheme_id=?', [req.body.is_active, id]);
  let notifications = null;
  if (s.is_active && !req.body.is_active) notifications = await notify.schemeDeactivated(s);
  if (!s.is_active && req.body.is_active) notifications = await newMatchNotify(id);
  res.json({ id, is_active: req.body.is_active, notifications });
}));

/* ---------- categories ---------- */
const catBody = (b) => ({
  slug: v.str(b && b.slug, 'slug', { max: 60 }).toLowerCase(), name_en: v.str(b.name_en, 'name_en', { max: 100 }), name_ta: v.str(b.name_ta, 'name_ta', { max: 150, required: false }),
  icon: v.str(b.icon, 'icon', { max: 40, required: false }), description: v.str(b.description, 'description', { max: 2000, required: false }), is_active: b.is_active !== false
});
const catShape = (c) => ({ id: c.category_id, slug: c.slug, icon: c.icon, name_en: c.name_en, name_ta: c.name_ta, description: c.description, is_active: !!c.is_active });

router.post('/categories', wrap(async (req, res) => {
  const c = catBody(req.body);
  try {
    const [r] = await pool.query('INSERT INTO categories (slug,icon,name_en,name_ta,description,is_active) VALUES (?,?,?,?,?,?)', [c.slug, c.icon, c.name_en, c.name_ta, c.description, c.is_active]);
    res.status(201).json(catShape({ ...c, category_id: r.insertId }));
  } catch (e) { if (e.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'SLUG_EXISTS', 'A category with this slug already exists'); throw e; }
}));
router.put('/categories/:id', wrap(async (req, res) => {
  const id = v.id(req.params.id); const c = catBody(req.body);
  try {
    const [r] = await pool.query('UPDATE categories SET slug=?,icon=?,name_en=?,name_ta=?,description=?,is_active=? WHERE category_id=?', [c.slug, c.icon, c.name_en, c.name_ta, c.description, c.is_active, id]);
    if (!r.affectedRows) throw notFound('Category not found');
    res.json(catShape({ ...c, category_id: id }));
  } catch (e) { if (e.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'SLUG_EXISTS', 'A category with this slug already exists'); throw e; }
}));

/* ---------- FAQs ---------- */
const faqBody = (b) => ({
  category_id: b && b.category_id ? v.id(b.category_id, 'category_id') : null, topic: v.str(b && b.topic, 'topic', { max: 40, required: false }),
  q_en: v.str(b && b.q_en, 'q_en', { max: 1000 }), a_en: v.str(b.a_en, 'a_en', { max: 5000 }),
  q_ta: v.str(b.q_ta, 'q_ta', { max: 1000, required: false }), a_ta: v.str(b.a_ta, 'a_ta', { max: 5000, required: false }), is_active: b.is_active !== false
});
const faqShape = (f, id) => ({ id, category_id: f.category_id, topic: f.topic, q_en: f.q_en, a_en: f.a_en, q_ta: f.q_ta, a_ta: f.a_ta, is_active: f.is_active });

router.get('/faqs', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM faqs ORDER BY faq_id');
  res.json(rows.map((f) => faqShape({ category_id: f.category_id, topic: f.topic, q_en: f.question_en, a_en: f.answer_en, q_ta: f.question_ta, a_ta: f.answer_ta, is_active: !!f.is_active }, f.faq_id)));
}));
router.post('/faqs', wrap(async (req, res) => {
  const f = faqBody(req.body);
  try { const [r] = await pool.query('INSERT INTO faqs (category_id,topic,question_en,answer_en,question_ta,answer_ta,is_active) VALUES (?,?,?,?,?,?,?)', [f.category_id, f.topic, f.q_en, f.a_en, f.q_ta, f.a_ta, f.is_active]); res.status(201).json(faqShape(f, r.insertId)); }
  catch (e) { if (e.code === 'ER_NO_REFERENCED_ROW_2') throw bad('Unknown category_id'); throw e; }
}));
router.put('/faqs/:id', wrap(async (req, res) => {
  const id = v.id(req.params.id); const f = faqBody(req.body);
  try {
    const [r] = await pool.query('UPDATE faqs SET category_id=?,topic=?,question_en=?,answer_en=?,question_ta=?,answer_ta=?,is_active=? WHERE faq_id=?', [f.category_id, f.topic, f.q_en, f.a_en, f.q_ta, f.a_ta, f.is_active, id]);
    if (!r.affectedRows) throw notFound('FAQ not found');
    res.json(faqShape(f, id));
  } catch (e) { if (e.code === 'ER_NO_REFERENCED_ROW_2') throw bad('Unknown category_id'); throw e; }
}));
router.delete('/faqs/:id', wrap(async (req, res) => {
  const [r] = await pool.query('DELETE FROM faqs WHERE faq_id=?', [v.id(req.params.id)]);
  if (!r.affectedRows) throw notFound('FAQ not found');
  res.json({ deleted: true });
}));

/* ---------- documents (document guide) ---------- */
const docBody = (b) => ({
  name_en: v.str(b && b.name_en, 'name_en', { max: 150 }), name_ta: v.str(b.name_ta, 'name_ta', { max: 150, required: false }), description: v.str(b.description, 'description', { max: 2000, required: false }),
  where_to_get: v.str(b.where_en, 'where_en', { max: 2000, required: false }), where_to_get_ta: v.str(b.where_ta, 'where_ta', { max: 2000, required: false }),
  issuer_url: v.str(b.link, 'link', { max: 500, required: false }), issuer_label: v.str(b.link_label, 'link_label', { max: 100, required: false })
});
router.put('/documents/:id', wrap(async (req, res) => {
  const d = docBody(req.body);
  const [r] = await pool.query('UPDATE documents SET name_en=?,name_ta=?,description=?,where_to_get=?,where_to_get_ta=?,issuer_url=?,issuer_label=? WHERE document_id=?',
    [d.name_en, d.name_ta, d.description, d.where_to_get, d.where_to_get_ta, d.issuer_url, d.issuer_label, req.params.id]);
  if (!r.affectedRows) throw notFound('Document not found');
  res.json({ id: req.params.id, updated: true });
}));

/* ---------- unanswered queries (search + chatbots) ---------- */
const REVIEW = ['NEW', 'REVIEWED', 'SCHEME_ADDED', 'IGNORED'];
router.get('/queries', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM search_queries ORDER BY created_at DESC, query_id DESC');
  res.json(rows.map((q) => ({ id: q.query_id, user_id: q.user_id, query_text: q.query_text, source: q.source, scheme_id: q.scheme_id, result_found: !!q.result_found, review_status: q.review_status, count: q.count, created_at: q.created_at })));
}));
router.patch('/queries/:id', wrap(async (req, res) => {
  const id = v.id(req.params.id); const st = v.oneOf((req.body || {}).review_status, REVIEW, 'review_status');
  if (!st) throw bad('review_status is required');
  const [r] = await pool.query('UPDATE search_queries SET review_status=? WHERE query_id=?', [st, id]);
  if (!r.affectedRows) throw notFound('Query not found');
  res.json({ id, review_status: st });
}));

/* ---------- feedback per scheme (admin sees comments; the public API does not) ---------- */
router.get('/feedback', wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT s.scheme_id, s.name_en, COALESCE(SUM(f.useful),0) yes, COALESCE(SUM(NOT f.useful),0) no FROM schemes s LEFT JOIN feedback f ON f.scheme_id=s.scheme_id GROUP BY s.scheme_id, s.name_en ORDER BY s.scheme_id`);
  const [comments] = await pool.query('SELECT scheme_id, comment FROM feedback WHERE comment IS NOT NULL AND comment<>"" ORDER BY created_at, feedback_id');
  res.json(rows.map((r) => ({ scheme_id: r.scheme_id, name_en: r.name_en, yes: Number(r.yes), no: Number(r.no), comments: comments.filter((c) => c.scheme_id === r.scheme_id).map((c) => c.comment) })));
}));

/* ---------- announcements ---------- */
router.post('/announcements', wrap(async (req, res) => {
  const b = req.body || {};
  const en = v.str(b.title_en, 'title_en', { max: 200 }), ta = v.str(b.title_ta, 'title_ta', { max: 250, required: false });
  res.status(201).json(await notify.announcement(en, ta));
}));

/* ---------- email setup check ---------- */
// GET  /api/admin/mail/status -> is SMTP configured and does the login work?
router.get('/mail/status', wrap(async (req, res) => {
  const r = await mailer.verify();
  res.json({ ...r, host: config.smtp.host || null, port: config.smtp.port, secure: config.smtp.secure, user: config.smtp.user || null, from: config.smtp.from });
}));
// POST /api/admin/mail/test { to? } -> sends a test email (defaults to the admin's own address)
router.post('/mail/test', wrap(async (req, res) => {
  const to = (req.body && req.body.to) ? v.email(req.body.to) : req.user.email;
  const r = await mailer.sendMail({ to, subject: 'CivicConnect test email', text: 'SMTP is working.', html: mailer.layout({ heading: 'SMTP is working', body: '<p>This is a test email from the CivicConnect admin panel.</p>' }) });
  res.status(r.sent ? 200 : 502).json({ to, ...r });
}));

module.exports = router;
