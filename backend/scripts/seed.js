/* Loads the demo data from ../assets/js/data.js (single source of truth) into MySQL.
 * Run after `npm run db:migrate`. Re-running wipes and reloads the data. Development only. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const config = require('../src/config');

function loadSeed() {
  const file = path.join(__dirname, '..', '..', 'assets', 'js', 'data.js');
  const sandbox = {}; sandbox.window = sandbox;   // like a browser: window.CC is also the global CC
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox.window.CC.seed;
}
const ts = (iso) => (iso ? String(iso).replace('T', ' ').slice(0, 19) : null);
const json = (v) => (v == null ? null : JSON.stringify(v));

(async () => {
  if (config.isProd) { console.error('Refusing to seed with NODE_ENV=production'); process.exit(1); }
  const seed = loadSeed();
  const conn = await mysql.createConnection({ ...config.db, charset: 'utf8mb4', multipleStatements: true });
  await conn.beginTransaction();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['notifications', 'feedback', 'search_queries', 'saved_schemes', 'profiles', 'scheme_documents',
      'scheme_criteria', 'scheme_aliases', 'schemes', 'documents', 'faqs', 'categories', 'users']) {
      await conn.query('TRUNCATE TABLE ' + t);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    for (const u of seed.users) {
      await conn.query('INSERT INTO users (user_id,name,email,password_hash,role,preferred_language,email_notifications,is_active,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [u.id, u.name, u.email, bcrypt.hashSync(u.password, 10), u.role, u.preferred_language || 'EN', !!u.email_notifications, u.is_active !== false, u.created_at]);
    }
    for (const c of seed.categories) {
      await conn.query('INSERT INTO categories (category_id,slug,icon,name_en,name_ta,description,is_active) VALUES (?,?,?,?,?,?,?)',
        [c.id, c.slug, c.icon, c.name_en, c.name_ta, c.description, c.is_active]);
    }
    for (const d of seed.documents) {
      await conn.query('INSERT INTO documents (document_id,name_en,name_ta,description,where_to_get,where_to_get_ta,issuer_url,issuer_label) VALUES (?,?,?,?,?,?,?,?)',
        [d.id, d.name_en, d.name_ta, d.description, d.where_en, d.where_ta, d.link || null, d.link_label || null]);
    }
    for (const s of seed.schemes) {
      await conn.query(`INSERT INTO schemes (scheme_id,slug,category_id,level,state,image,name_en,name_ta,short_en,short_ta,who_en,who_ta,benefits_en,benefits_ta,
        official_url,source_name,source_url,last_verified_on,is_verified,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [s.id, s.slug, s.category_id, s.level, s.state, s.image, s.name_en, s.name_ta, s.short_en, s.short_ta, s.who_en, s.who_ta || null,
        json(s.benefits_en), json(s.benefits_ta), s.official_url, s.source_name, s.source_url, s.last_verified_on, !!s.is_verified, !!s.is_active]);
      for (const a of s.aliases || []) await conn.query('INSERT INTO scheme_aliases (scheme_id,alias) VALUES (?,?)', [s.id, a]);
      for (const c of s.criteria || []) {
        await conn.query('INSERT INTO scheme_criteria (scheme_id,criteria_group,type,op,value,label_en,label_ta) VALUES (?,?,?,?,?,?,?)',
          [s.id, c.group, c.type, c.op, c.value, c.label_en, c.label_ta]);
      }
      let i = 0;
      for (const d of s.documents || []) {
        await conn.query('INSERT INTO scheme_documents (scheme_id,document_id,is_mandatory,sort_order) VALUES (?,?,?,?)', [s.id, d.id, !!d.mandatory, i++]);
      }
    }
    for (const f of seed.faqs) {
      await conn.query('INSERT INTO faqs (faq_id,category_id,topic,question_en,answer_en,question_ta,answer_ta,is_active) VALUES (?,?,?,?,?,?,?,?)',
        [f.id, f.category_id, f.topic, f.q_en, f.a_en, f.q_ta, f.a_ta, f.is_active !== false]);
    }
    for (const [uid, p] of Object.entries(seed.profiles)) {
      await conn.query('INSERT INTO profiles (user_id,dob,gender,income,occupation,state,district,student_level,farmer_land_status,disability_type) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [uid, p.dob || null, p.gender || null, p.income === '' ? null : p.income, p.occupation || null, p.state || null, p.district || null,
          p.student_level || null, p.farmer_land_status || null, p.disability_type || null]);
    }
    for (const [uid, ids] of Object.entries(seed.saved)) {
      for (const sid of ids) await conn.query('INSERT INTO saved_schemes (user_id,scheme_id) VALUES (?,?)', [uid, sid]);
    }
    for (const q of seed.queries) {
      await conn.query('INSERT INTO search_queries (user_id,query_text,source,scheme_id,result_found,review_status,count,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [q.user_id, q.query_text, q.source, q.scheme_id || null, !!q.result_found, q.review_status, q.count || 1, ts(q.created_at)]);
    }
    // seeded demo votes (anonymous: user_id NULL), comments attached to the first votes
    for (const f of seed.feedback) {
      const comments = f.comments.slice();
      for (let i = 0; i < f.yes + f.no; i++) {
        await conn.query('INSERT INTO feedback (scheme_id,user_id,useful,comment) VALUES (?,NULL,?,?)', [f.scheme_id, i < f.yes, comments.shift() || null]);
      }
    }
    for (const n of seed.notifications) {
      await conn.query('INSERT INTO notifications (user_id,scheme_id,type,title_en,title_ta,is_read,created_at) VALUES (?,?,?,?,?,?,?)',
        [n.user_id, n.scheme_id, n.type, n.title_en, n.title_ta, !!n.is_read, ts(n.created_at) || ts(new Date().toISOString())]);
    }
    await conn.commit();
    const [[r]] = await conn.query('SELECT (SELECT COUNT(*) FROM categories) c,(SELECT COUNT(*) FROM schemes) s,(SELECT COUNT(*) FROM faqs) f,(SELECT COUNT(*) FROM users) u,(SELECT COUNT(*) FROM scheme_criteria) cr');
    console.log('Seeded:', JSON.stringify(r));
  } catch (e) { await conn.rollback(); throw e; } finally { await conn.end(); }
})().catch((e) => { console.error(e.message); process.exit(1); });
