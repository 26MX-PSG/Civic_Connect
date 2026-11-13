// Integration tests against the seeded dev database. Run: npm run db:reset && npm test
process.env.NODE_ENV = 'test';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createApp } = require('../src/app');
const pool = require('../src/db');

let server, base;
const uniq = Date.now();
const newEmail = `tester${uniq}@example.in`;
let tok = {};   // tokens by name

before(async () => { server = createApp().listen(0); base = 'http://127.0.0.1:' + server.address().port; });
after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE ?', ['tester%@example.in']);
  await pool.query("DELETE FROM search_queries WHERE query_text LIKE 'zzqx%'");
  server.close(); await pool.end();
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
  r = await call('POST', '/api/auth/login', { body: { email: 'admin@demo.in', password: 'admin123' } }); assert.equal(r.status, 200); tok.admin = r.json.token;
});

test('auth: forgot password and reset password flow', async () => {
  const email = 'citizen@demo.in';
  let r = await call('POST', '/api/auth/forgot-password', { body: { email } });
  assert.equal(r.status, 200);
  assert.equal(r.json.message, 'If an account exists for that email, a password reset link has been sent.');
  const [rows] = await pool.query('SELECT token_hash, expires_at FROM password_resets WHERE user_id=(SELECT user_id FROM users WHERE email=?) ORDER BY created_at DESC LIMIT 1', [email]);
  assert.equal(rows.length, 1);
  assert.match(rows[0].token_hash, /^[a-f0-9]{64}$/);
  assert.ok(new Date(rows[0].expires_at).getTime() > Date.now());

  const raw = 'manual-reset-token-' + Date.now();
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  await pool.query('DELETE FROM password_resets WHERE user_id=(SELECT user_id FROM users WHERE email=?)', [email]);
  await pool.query('INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES ((SELECT user_id FROM users WHERE email=?), ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE), NOW())', [email, tokenHash]);

  r = await call('POST', '/api/auth/reset-password', { body: { token: raw, password: 'NewPass123' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.message, 'Password updated successfully.');

  r = await call('POST', '/api/auth/login', { body: { email, password: 'demo123' } });
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
  const r = await call('POST', '/api/auth/login', { body: { email: 'karthik@example.in', password: 'x' } }); assert.equal(r.status, 403);
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
  let r = await call('POST', '/api/auth/login', { body: { email: 'citizen@demo.in', password: 'demo123' } }); const t = r.json.token;
  r = await call('GET', '/api/notifications', { token: t }); assert.equal(r.json.length, 4);
  r = await call('PATCH', '/api/notifications/1/read', { token: t }); assert.equal(r.json.is_read, true);
  r = await call('PATCH', '/api/notifications/1/read', { token: tok.user }); assert.equal(r.status, 404, 'other users cannot touch it');
  r = await call('GET', '/api/notifications', { token: tok.user }); assert.equal(r.json.length, 0);
});

test('bad JSON body gives 400, not 500', async () => {
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
  assert.equal(r.status, 400);
});
