// Integration tests against the seeded dev database. Run: npm run db:reset && npm test
process.env.NODE_ENV = 'test';
// Fake SMTP server so we can prove Nodemailer really delivers (set before the app loads its config)
const net = require('node:net');
const mailbox = [];
const smtp = net.createServer((sock) => {
  let data = false, buf = '', cur = { to: [], body: '' };
  const w = (t) => sock.write(t + '\r\n');
  w('220 fake ESMTP');
  sock.on('data', (c) => {
    buf += c.toString();
    let i;
    while ((i = buf.indexOf('\r\n')) > -1) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (data) { if (line === '.') { data = false; cur.body = cur.body.replace(/=\n/g, '').replace(/=3D/g, '='); mailbox.push(cur); cur = { to: [], body: '' }; w('250 queued'); } else cur.body += line + '\n'; continue; }
      if (/^EHLO/i.test(line)) { sock.write('250-fake\r\n250 AUTH PLAIN LOGIN\r\n'); }
      else if (/^AUTH/i.test(line)) w('235 ok');
      else if (/^RCPT TO/i.test(line)) { cur.to.push(line.match(/<(.+)>/)[1]); w('250 ok'); }
      else if (/^DATA/i.test(line)) { data = true; w('354 go'); }
      else if (/^QUIT/i.test(line)) { w('221 bye'); sock.end(); }
      else w('250 ok');
    }
  });
  sock.on('error', () => {});
});
smtp.listen(0, '127.0.0.1');
const smtpPort = new Promise((r) => smtp.on('listening', () => r(smtp.address().port)));
Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_SECURE: 'false', SMTP_FROM: 'CivicConnect <test@civic.test>' });
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
let createApp, pool;

let server, base;
const uniq = Date.now();
const newEmail = `tester${uniq}@example.in`;
let tok = {};   // tokens by name

before(async () => {
  process.env.SMTP_PORT = String(await smtpPort);
  ({ createApp } = require('../src/app')); pool = require('../src/db');
  server = createApp().listen(0); base = 'http://127.0.0.1:' + server.address().port; });
after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE ?', ['tester%@example.in']);
  await pool.query("DELETE FROM search_queries WHERE query_text LIKE 'zzqx%'");
  server.close(); smtp.close(); await pool.end();
});

async function call(method, path, { body, token } = {}) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch (e) { /* empty */ }
  return { status: r.status, json };
}

test('health', async () => { const r = await call('GET', '/api/health'); assert.equal(r.status, 200); assert.equal(r.json.database, 'up'); });
test('unknown endpoint is a JSON 404', async () => { const r = await call('GET', '/api/nope'); assert.equal(r.status, 404); assert.equal(r.json.error.code, 'NOT_FOUND'); });

test('auth: register, duplicate, validation, login, me', async () => {
  let r = await call('POST', '/api/auth/register', { body: { name: 'Test User', email: newEmail, password: 'secret12' } });
  assert.equal(r.status, 201); assert.equal(r.json.user.role, 'USER'); assert.ok(r.json.token); tok.user = r.json.token;
  assert.equal(r.json.user.password_hash, undefined);
  r = await call('POST', '/api/auth/register', { body: { name: 'Test User', email: newEmail, password: 'secret12' } }); assert.equal(r.status, 409);
  r = await call('POST', '/api/auth/register', { body: { name: 'X', email: 'bad', password: '1' } }); assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/register', { body: { name: 'Hacker', email: `tester${uniq}b@example.in`, password: 'secret12', role: 'ADMIN' } });
  assert.equal(r.json.user.role, 'USER', 'cannot self-register as admin');
  r = await call('POST', '/api/auth/login', { body: { email: newEmail, password: 'wrong' } }); assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/login', { body: { email: newEmail, password: 'secret12' } }); assert.equal(r.status, 200);
  r = await call('GET', '/api/auth/me', { token: tok.user }); assert.equal(r.json.user.email, newEmail);
  r = await call('GET', '/api/auth/me'); assert.equal(r.status, 401);
  r = await call('GET', '/api/auth/me', { token: 'garbage' }); assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/login', { body: { email: '26MX102@psgtech.ac.in', password: 'dav231107' } }); assert.equal(r.status, 200); tok.admin = r.json.token;
});

test('auth: forgot password and reset password flow', async () => {
  const email = '26MX203@psgtech.ac.in';
  let r = await call('POST', '/api/auth/forgot-password', { body: { email } });
  assert.equal(r.status, 200);
  assert.equal(r.json.message, 'If an account exists for that email, a password reset link has been sent.');
  const [rows] = await pool.query('SELECT token_hash, expires_at FROM password_resets WHERE user_id=(SELECT user_id FROM users WHERE email=?) ORDER BY created_at DESC LIMIT 1', [email]);
  assert.equal(rows.length, 1);
  assert.match(rows[0].token_hash, /^[a-f0-9]{64}$/);
  assert.ok(new Date(String(rows[0].expires_at).replace(' ', 'T') + 'Z').getTime() > Date.now());

  const raw = 'manual-reset-token-' + Date.now();
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  await pool.query('DELETE FROM password_resets WHERE user_id=(SELECT user_id FROM users WHERE email=?)', [email]);
  await pool.query('INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES ((SELECT user_id FROM users WHERE email=?), ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE), NOW())', [email, tokenHash]);

  r = await call('POST', '/api/auth/reset-password', { body: { token: raw, password: 'NewPass123' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.message, 'Password updated successfully.');

  r = await call('POST', '/api/auth/login', { body: { email, password: '26MX203' } });
  assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/login', { body: { email, password: 'NewPass123' } });
  assert.equal(r.status, 200);
});

test('roles: admin-only endpoint', async () => {
  let r = await call('GET', '/api/admin/users'); assert.equal(r.status, 401);
  r = await call('GET', '/api/admin/users', { token: tok.user }); assert.equal(r.status, 403);
  r = await call('GET', '/api/admin/users', { token: tok.admin }); assert.equal(r.status, 200);
  assert.ok(r.json.length >= 9); assert.deepEqual(Object.keys(r.json[0]).sort(), ['created_at', 'email', 'id', 'is_active', 'name', 'role']);
});

test('disabled account cannot log in', async () => {
  const r = await call('POST', '/api/auth/login', { body: { email: '26MX220@psgtech.ac.in', password: '26MX220' } }); assert.equal(r.status, 403);
});

test('categories: 9 shown (Financial support has only the inactive scheme)', async () => {
  let r = await call('GET', '/api/categories'); assert.equal(r.status, 200); assert.equal(r.json.length, 9);
  assert.ok(r.json.every((c) => c.scheme_count >= 1));
  r = await call('GET', '/api/categories/farmers'); assert.equal(r.json.name_en, 'Farmers');
  r = await call('GET', '/api/categories/999'); assert.equal(r.status, 404);
});

test('schemes: list excludes inactive, filters, search', async () => {
  let r = await call('GET', '/api/schemes'); assert.equal(r.json.length, 14, '15 seeded minus inactive PM SVANidhi');
  assert.ok(!r.json.some((s) => s.slug === 'pm-svanidhi'));
  assert.ok(r.json[0].criteria && r.json[0].documents && r.json[0].aliases && r.json[0].category);
  r = await call('GET', '/api/schemes?category=farmers'); assert.deepEqual(r.json.map((s) => s.slug), ['pm-kisan', 'pmfby']);
  r = await call('GET', '/api/schemes?level=STATE&state=Tamil%20Nadu'); assert.ok(r.json.every((s) => s.level === 'STATE'));
  r = await call('GET', '/api/schemes?level=NOPE'); assert.equal(r.status, 400);
  r = await call('GET', '/api/schemes?keyword=' + encodeURIComponent('crop insurance')); assert.equal(r.json[0].slug, 'pmfby');
  r = await call('GET', '/api/schemes?keyword=' + encodeURIComponent('கிசான்')); assert.equal(r.json[0].slug, 'pm-kisan', 'Tamil alias search');
});

test('search: no-result keyword is logged once and counted', async () => {
  const kw = 'zzqx unicorn grant';
  let r = await call('GET', '/api/schemes?keyword=' + encodeURIComponent(kw)); assert.deepEqual(r.json, []);
  await call('GET', '/api/schemes?keyword=' + encodeURIComponent(kw));
  const [rows] = await pool.query('SELECT count, source FROM search_queries WHERE query_text=?', [kw]);
  assert.equal(rows.length, 1); assert.equal(rows[0].count, 2); assert.equal(rows[0].source, 'SEARCH');
});

test('scheme detail', async () => {
  let r = await call('GET', '/api/schemes/pm-kisan');
  assert.equal(r.status, 200); assert.equal(r.json.id, 1); assert.equal(r.json.is_verified, false);
  assert.ok(r.json.document_details.find((d) => d.id === 'land_records').where_en);
  assert.ok(r.json.feedback.yes >= 18);
  r = await call('GET', '/api/schemes/12'); assert.equal(r.json.is_active, false, 'inactive scheme still viewable');
  r = await call('GET', '/api/schemes/nope'); assert.equal(r.status, 404);
});

test('documents and faqs', async () => {
  let r = await call('GET', '/api/documents'); assert.equal(r.json.length, 14);
  r = await call('GET', '/api/documents/aadhaar'); assert.ok(r.json.where_en);
  r = await call('GET', '/api/faqs'); assert.equal(r.json.length, 16);
  r = await call('GET', '/api/faqs?keyword=income'); assert.ok(r.json.length >= 1);
});

test('profile: validation, save, read, consistency', async () => {
  let r = await call('GET', '/api/profiles/me'); assert.equal(r.status, 401);
  r = await call('GET', '/api/profiles/me', { token: tok.user }); assert.equal(r.json.completion, 0);
  r = await call('PUT', '/api/profiles/me', { token: tok.user, body: { gender: 'ROBOT' } }); assert.equal(r.status, 400);
  r = await call('PUT', '/api/profiles/me', { token: tok.user, body: { dob: '2999-01-01' } }); assert.equal(r.status, 400);
  r = await call('PUT', '/api/profiles/me', { token: tok.user, body: { income: -5 } }); assert.equal(r.status, 400);
  r = await call('PUT', '/api/profiles/me', { token: tok.user, body: { dob: '2005-06-14', gender: 'FEMALE', income: 250000, occupation: 'STUDENT', student_level: 'UG', state: 'Tamil Nadu', district: 'Coimbatore', disability_type: 'NONE', farmer_land_status: 'OWN_LAND' } });
  assert.equal(r.status, 200); assert.equal(r.json.profile.farmer_land_status, null, 'dropped: not a farmer'); assert.equal(r.json.completion, 100);
  r = await call('GET', '/api/profiles/me', { token: tok.user }); assert.equal(r.json.profile.dob, '2005-06-14'); assert.equal(r.json.profile.income, 250000);
  r = await call('PUT', '/api/profiles/me', { token: tok.user, body: { dob: '2010-01-01' } }); assert.equal(r.status, 400); assert.match(r.json.error.message, /at least 18 years old/i);
});

test('recommendations: matching rules', async () => {
  let r = await call('GET', '/api/recommendations'); assert.equal(r.status, 401);
  r = await call('GET', '/api/recommendations', { token: tok.user });   // 20-ish y/o female UG student, TN, income 2.5L, no disability
  const m = r.json.matches.map((x) => x.scheme.slug);
  assert.ok(m.includes('pudhumai-penn') && m.includes('tamil-pudhalvan') && m.includes('post-matric-sc') === false || m.includes('naan-mudhalvan'));
  assert.ok(m.includes('vidiyal-payanam'), 'woman in TN');
  assert.ok(!m.includes('pm-kisan') && !m.includes('niramaya'));
  assert.ok(!r.json.matches.concat(r.json.partial).some((x) => x.scheme.slug === 'pm-svanidhi'), 'inactive excluded');
  assert.match(r.json.disclaimer, /basic criteria/);
  // empty profile -> only partial
  const reg = await call('POST', '/api/auth/register', { body: { name: 'Empty Profile', email: `tester${uniq}c@example.in`, password: 'secret12' } });
  r = await call('GET', '/api/recommendations', { token: reg.json.token }); assert.equal(r.json.matches.length, 0); assert.ok(r.json.partial.length > 5);
});

test('saved schemes', async () => {
  let r = await call('GET', '/api/saved'); assert.equal(r.status, 401);
  r = await call('POST', '/api/saved', { token: tok.user, body: { scheme_id: 5 } }); assert.equal(r.status, 201);
  r = await call('POST', '/api/saved', { token: tok.user, body: { scheme_id: 5 } }); assert.equal(r.status, 201, 'idempotent');
  r = await call('POST', '/api/saved', { token: tok.user, body: { scheme_id: 11 } });
  r = await call('POST', '/api/saved', { token: tok.user, body: { scheme_id: 999 } }); assert.equal(r.status, 404);
  r = await call('POST', '/api/saved', { token: tok.user, body: { scheme_id: 'abc' } }); assert.equal(r.status, 400);
  r = await call('GET', '/api/saved', { token: tok.user }); assert.deepEqual(r.json.scheme_ids.sort((a, b) => a - b), [5, 11]);
  r = await call('DELETE', '/api/saved/5', { token: tok.user }); assert.equal(r.json.saved, false);
  r = await call('GET', '/api/saved', { token: tok.user }); assert.deepEqual(r.json.scheme_ids, [11]);
});

test('feedback: one vote per user, replaceable', async () => {
  let r = await call('PUT', '/api/feedback/1', { body: { useful: true } }); assert.equal(r.status, 401);
  r = await call('GET', '/api/feedback/1'); const before = r.json;
  r = await call('PUT', '/api/feedback/1', { token: tok.user, body: { useful: true, comment: 'Good info' } });
  assert.equal(r.json.yes, before.yes + 1); assert.equal(r.json.mine.useful, true);
  r = await call('PUT', '/api/feedback/1', { token: tok.user, body: { useful: false } });
  assert.equal(r.json.yes, before.yes); assert.equal(r.json.no, before.no + 1, 'vote replaced, not added');
  r = await call('PUT', '/api/feedback/1', { token: tok.user, body: { useful: 'yes' } }); assert.equal(r.status, 400);
  r = await call('PUT', '/api/feedback/999', { token: tok.user, body: { useful: true } }); assert.equal(r.status, 404);
});

test('notifications: own only, mark read', async () => {
  let r = await call('POST', '/api/auth/login', { body: { email: '26MX203@psgtech.ac.in', password: 'NewPass123' } }); const t = r.json.token;
  r = await call('GET', '/api/notifications', { token: t }); assert.equal(r.json.length, 4);
  r = await call('PATCH', '/api/notifications/1/read', { token: t }); assert.equal(r.json.is_read, true);
  r = await call('PATCH', '/api/notifications/1/read', { token: tok.user }); assert.equal(r.status, 404, 'other users cannot touch it');
  r = await call('GET', '/api/notifications', { token: tok.user }); assert.equal(r.json.length, 0);
});

test('bad JSON body gives 400, not 500', async () => {
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
  assert.equal(r.status, 400);
});

/* ---------------- Week 7-8: admin workflow + email notifications ---------------- */
const mailTo = (addr) => mailbox.filter((m) => m.to.includes(addr));
const waitMail = async (addr, n = 1) => { for (let i = 0; i < 40 && mailTo(addr).length < n; i++) await new Promise((r) => setTimeout(r, 50)); return mailTo(addr); };
const adminSchemeBody = (over = {}) => ({ slug: 'zz-test-' + uniq, category_id: 1, level: 'CENTRAL', name_en: 'ZZ Test Scheme', name_ta: 'சோதனை', short_en: 'short', who_en: 'who', benefits_en: ['b1'],
  official_url: 'https://example.gov.in', source_name: 'Test Dept', source_url: 'https://example.gov.in/src', last_verified_on: '2026-01-01', is_verified: false,
  criteria: [{ group: 1, type: 'OCCUPATION', op: '=', value: 'STUDENT', label_en: 'Student' }], documents: [{ id: 'aadhaar', mandatory: true }], ...over });

test('password reset email is delivered through SMTP', async () => {
  const before = mailTo('26MX203@psgtech.ac.in').length;
  await call('POST', '/api/auth/forgot-password', { body: { email: '26MX203@psgtech.ac.in' } });
  const got = await waitMail('26MX203@psgtech.ac.in', before + 1);
  assert.ok(got.length > before); assert.match(got[got.length - 1].body, /reset-password\.html\?token=/);
});

test('admin: only admins, validation, stats, mail status', async () => {
  let r = await call('POST', '/api/admin/schemes', { token: tok.user, body: adminSchemeBody() }); assert.equal(r.status, 403);
  r = await call('POST', '/api/admin/schemes', { token: tok.admin, body: adminSchemeBody({ official_url: 'http://insecure' }) }); assert.equal(r.status, 400);
  r = await call('POST', '/api/admin/schemes', { token: tok.admin, body: adminSchemeBody({ criteria: [{ group: 1, type: 'NOPE', op: '=' }] }) }); assert.equal(r.status, 400);
  r = await call('GET', '/api/admin/stats', { token: tok.admin }); assert.equal(r.status, 200); assert.ok(r.json.totalSchemes >= 15 && 'usefulPct' in r.json);
  r = await call('GET', '/api/admin/mail/status', { token: tok.admin }); assert.equal(r.json.configured, true); assert.equal(r.json.ok, true);
});

test('admin: scheme lifecycle sends NEW_MATCH, SCHEME_UPDATED, SCHEME_DEACTIVATED (in-app + email for opted-in only)', async () => {
  // opted-in student with a profile; second student NOT opted in
  const optIn = await call('POST', '/api/auth/register', { body: { name: 'Opt In', email: `tester${uniq}o@example.in`, password: 'secret12' } });
  const optOut = await call('POST', '/api/auth/register', { body: { name: 'Opt Out', email: `tester${uniq}n@example.in`, password: 'secret12' } });
  const prof = { dob: '2005-06-14', gender: 'FEMALE', income: 250000, occupation: 'STUDENT', student_level: 'UG', state: 'Tamil Nadu', district: 'Coimbatore', disability_type: 'NONE' };
  for (const t of [optIn.json.token, optOut.json.token]) await call('PUT', '/api/profiles/me', { token: t, body: prof });
  await call('PATCH', '/api/auth/me', { token: optIn.json.token, body: { email_notifications: true } });

  let r = await call('POST', '/api/admin/schemes', { token: tok.admin, body: adminSchemeBody() });
  assert.equal(r.status, 201); const sid = r.json.scheme.id; assert.equal(r.json.scheme.criteria.length, 1);
  assert.ok(r.json.notifications.notified >= 2 && r.json.notifications.emailed >= 1);
  r = await call('POST', '/api/admin/schemes', { token: tok.admin, body: adminSchemeBody() }); assert.equal(r.status, 409, 'duplicate slug');
  const mails = await waitMail(`tester${uniq}o@example.in`); assert.match(mails[0].body, /ZZ Test Scheme/);
  assert.equal(mailTo(`tester${uniq}n@example.in`).length, 0, 'not opted in -> no email');
  r = await call('GET', '/api/notifications', { token: optOut.json.token }); assert.ok(r.json.some((n) => n.type === 'NEW_MATCH' && n.scheme_id === sid), 'in-app notice still created');

  await call('POST', '/api/saved', { token: optIn.json.token, body: { scheme_id: sid } });
  r = await call('PUT', `/api/admin/schemes/${sid}`, { token: tok.admin, body: adminSchemeBody({ name_en: 'ZZ Test Scheme v2' }) });
  assert.equal(r.status, 200); assert.equal(r.json.scheme.name_en, 'ZZ Test Scheme v2'); assert.equal(r.json.notifications.updated.notified, 1);
  assert.equal(r.json.notifications.newMatch.notified, 0, 'NEW_MATCH is not repeated for the same user');

  r = await call('PATCH', `/api/admin/schemes/${sid}/active`, { token: tok.admin, body: { is_active: false } });
  assert.equal(r.json.notifications.notified, 1);
  r = await call('GET', '/api/notifications', { token: optIn.json.token });
  assert.deepEqual(['SCHEME_DEACTIVATED', 'SCHEME_UPDATED', 'NEW_MATCH'].filter((t) => r.json.some((n) => n.type === t)).length, 3);
  r = await call('GET', '/api/schemes?includeInactive=1', { token: tok.admin }); assert.ok(r.json.some((x) => x.id === sid));
  r = await call('GET', '/api/schemes?includeInactive=1'); assert.ok(!r.json.some((x) => x.id === sid), 'public cannot see inactive');
  await pool.query("DELETE FROM notifications WHERE title_en LIKE 'ZZ Test Scheme%'");
  await pool.query('DELETE FROM schemes WHERE scheme_id=?', [sid]);
});

test('admin: announcement, users, queries, feedback, categories, faqs', async () => {
  let r = await call('POST', '/api/admin/announcements', { token: tok.admin, body: { title_en: '' } }); assert.equal(r.status, 400);
  r = await call('POST', '/api/admin/announcements', { token: tok.admin, body: { title_en: 'Camp on Monday', title_ta: 'திங்கள் முகாம்' } });
  assert.equal(r.status, 201); assert.ok(r.json.recipients >= 5);
  await pool.query("DELETE FROM notifications WHERE title_en='Camp on Monday'");

  r = await call('GET', '/api/admin/users', { token: tok.admin }); const u = r.json.find((x) => x.email === newEmail);
  r = await call('PATCH', `/api/admin/users/${u.id}`, { token: tok.admin, body: { is_active: false } }); assert.equal(r.json.is_active, false);
  r = await call('GET', '/api/auth/me', { token: tok.user }); assert.equal(r.status, 401, 'disabled user is locked out immediately');
  await call('PATCH', `/api/admin/users/${u.id}`, { token: tok.admin, body: { is_active: true } });

  await call('GET', '/api/schemes?keyword=zzqx%20admin%20review');
  r = await call('GET', '/api/admin/queries', { token: tok.admin }); const q = r.json.find((x) => x.query_text === 'zzqx admin review'); assert.equal(q.review_status, 'NEW');
  r = await call('PATCH', `/api/admin/queries/${q.id}`, { token: tok.admin, body: { review_status: 'REVIEWED' } }); assert.equal(r.json.review_status, 'REVIEWED');
  r = await call('PATCH', `/api/admin/queries/${q.id}`, { token: tok.admin, body: { review_status: 'BOGUS' } }); assert.equal(r.status, 400);

  r = await call('GET', '/api/admin/feedback', { token: tok.admin }); assert.ok(r.json.length >= 15 && Array.isArray(r.json[0].comments));

  r = await call('POST', '/api/admin/categories', { token: tok.admin, body: { slug: 'zz-cat-' + uniq, name_en: 'ZZ Cat' } }); assert.equal(r.status, 201); const cid = r.json.id;
  r = await call('GET', '/api/categories'); assert.ok(!r.json.some((c) => c.id === cid), 'empty category hidden publicly');
  r = await call('GET', '/api/categories?all=1', { token: tok.admin }); assert.ok(r.json.some((c) => c.id === cid));
  r = await call('PUT', `/api/admin/categories/${cid}`, { token: tok.admin, body: { slug: 'zz-cat-' + uniq, name_en: 'ZZ Cat 2', name_ta: 'ஒன்று' } }); assert.equal(r.json.name_en, 'ZZ Cat 2');
  await pool.query('DELETE FROM categories WHERE category_id=?', [cid]);

  r = await call('POST', '/api/admin/faqs', { token: tok.admin, body: { q_en: 'zzuniqueqx question?', a_en: 'ZZ answer', topic: 'general' } }); assert.equal(r.status, 201); const fid = r.json.id;
  r = await call('GET', '/api/faqs?keyword=zzuniqueqx'); assert.equal(r.json.length, 1, 'new FAQ is searchable immediately');
  r = await call('PUT', `/api/admin/faqs/${fid}`, { token: tok.admin, body: { q_en: 'zzuniqueqx question?', a_en: 'ZZ answer', is_active: false } });
  r = await call('GET', '/api/faqs?keyword=zzuniqueqx'); assert.equal(r.json.length, 0, 'inactive FAQ hidden');
  r = await call('DELETE', `/api/admin/faqs/${fid}`, { token: tok.admin }); assert.equal(r.json.deleted, true);
  r = await call('DELETE', `/api/admin/faqs/${fid}`, { token: tok.admin }); assert.equal(r.status, 404);
});

test('mailer: failing SMTP never breaks the request', async () => {
  const mailer = require('../src/mailer');
  const r = await mailer.sendMail({ to: 'x@y.in', subject: 's', text: 't' }); assert.equal(r.sent, true);
});

test('chat/log: assistants report unanswered questions; admin sees them', async () => {
  let r = await call('POST', '/api/chat/log', { body: { query_text: 'zzqx bot question', source: 'CHATBOT_GENERAL' } }); assert.equal(r.status, 201);
  await call('POST', '/api/chat/log', { body: { query_text: 'ZZQX bot question', source: 'CHATBOT_GENERAL' } });
  r = await call('POST', '/api/chat/log', { body: { query_text: 'x', source: 'NOPE' } }); assert.equal(r.status, 400);
  r = await call('GET', '/api/admin/queries', { token: tok.admin });
  const q = r.json.filter((x) => x.query_text.toLowerCase() === 'zzqx bot question'); assert.equal(q.length, 1); assert.equal(q[0].count, 2); assert.equal(q[0].source, 'CHATBOT_GENERAL');
});
