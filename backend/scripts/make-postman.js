/* Generates postman/CivicConnect.postman_collection.json and the environment file. Run: node scripts/make-postman.js */
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'postman');
const hdr = [{ key: 'Content-Type', value: 'application/json' }];
const saveToken = (name) => ['const j = pm.response.json();', `pm.environment.set('${name}', j.token);`];
function req(name, method, url, { body, auth, tests = [] } = {}) {
  const [p, q] = url.split('?');
  return { name, event: [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }],
    request: { method, header: body ? hdr : [], url: { raw: '{{baseUrl}}' + url, host: ['{{baseUrl}}'], path: p.replace(/^\//, '').split('/'), query: q ? q.split('&').map((x) => { const [k, v] = x.split('='); return { key: k, value: v }; }) : undefined },
      auth: auth ? { type: 'bearer', bearer: [{ key: 'token', value: '{{' + auth + '}}', type: 'string' }] } : { type: 'noauth' },
      body: body ? { mode: 'raw', raw: JSON.stringify(body, null, 2) } : undefined } };
}
const ok = (code) => [`pm.test('status is ${code}', () => pm.response.to.have.status(${code}));`];
const folder = (name, item) => ({ name, item });

const collection = {
  info: { name: 'CivicConnect API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: 'Run "Auth" first (saves tokens), then any folder. Start the API: cd backend && npm start (needs the Docker MySQL running and seeded).' },
  item: [
    folder('Health', [req('Health check', 'GET', '/api/health', { tests: ok(200) })]),
    folder('Auth', [
      req('Login as citizen (demo)', 'POST', '/api/auth/login', { body: { email: '26MX203@psgtech.ac.in', password: '26MX203' }, tests: [...ok(200), ...saveToken('userToken')] }),
      req('Login as admin (demo)', 'POST', '/api/auth/login', { body: { email: '26MX102@psgtech.ac.in', password: 'dav231107' }, tests: [...ok(200), ...saveToken('adminToken')] }),
      req('Register new user', 'POST', '/api/auth/register', { body: { name: 'New Citizen', email: 'new.citizen.{{$timestamp}}@example.in', password: 'secret12' }, tests: [...ok(201), ...saveToken('newUserToken')] }),
      req('Me', 'GET', '/api/auth/me', { auth: 'userToken', tests: ok(200) }),
      req('Update language', 'PATCH', '/api/auth/me', { auth: 'userToken', body: { preferred_language: 'TA' }, tests: ok(200) }),
      req('Wrong password (expect 401)', 'POST', '/api/auth/login', { body: { email: '26MX203@psgtech.ac.in', password: 'nope' }, tests: ok(401) })
    ]),
    folder('Roles', [
      req('Admin users list as admin', 'GET', '/api/admin/users', { auth: 'adminToken', tests: ok(200) }),
      req('Admin users list as citizen (expect 403)', 'GET', '/api/admin/users', { auth: 'userToken', tests: ok(403) }),
      req('Admin users list with no token (expect 401)', 'GET', '/api/admin/users', { tests: ok(401) })
    ]),
    folder('Admin workflow (weeks 7-8)', [
      req('Dashboard stats', 'GET', '/api/admin/stats', { auth: 'adminToken', tests: ok(200) }),
      req('SMTP status (is email set up?)', 'GET', '/api/admin/mail/status', { auth: 'adminToken', tests: ok(200) }),
      req('Send test email to myself', 'POST', '/api/admin/mail/test', { auth: 'adminToken', body: {}, tests: ['pm.test("status is 200 (502 = SMTP problem, see body.reason)", () => pm.response.to.have.status(200));'] }),
      req('Add scheme (notifies matching citizens)', 'POST', '/api/admin/schemes', { auth: 'adminToken', body: { slug: 'postman-test-{{$timestamp}}', category_id: 1, level: 'CENTRAL', name_en: 'Postman Test Scheme', short_en: 'Test', who_en: 'Anyone', benefits_en: ['Test benefit'], official_url: 'https://example.gov.in', source_name: 'Test Dept', source_url: 'https://example.gov.in', last_verified_on: '2026-01-01', criteria: [{ group: 1, type: 'OCCUPATION', op: '=', value: 'STUDENT', label_en: 'Student' }], documents: [{ id: 'aadhaar', mandatory: true }] }, tests: [...ok(201), "pm.environment.set('schemeId', pm.response.json().scheme.id);"] }),
      req('Deactivate scheme (notifies savers)', 'PATCH', '/api/admin/schemes/{{schemeId}}/active', { auth: 'adminToken', body: { is_active: false }, tests: ok(200) }),
      req('Unanswered queries', 'GET', '/api/admin/queries', { auth: 'adminToken', tests: ok(200) }),
      req('Feedback per scheme', 'GET', '/api/admin/feedback', { auth: 'adminToken', tests: ok(200) }),
      req('Send announcement', 'POST', '/api/admin/announcements', { auth: 'adminToken', body: { title_en: 'Postman announcement', title_ta: 'அறிவிப்பு' }, tests: ok(201) }),
      req('Add FAQ', 'POST', '/api/admin/faqs', { auth: 'adminToken', body: { q_en: 'Postman question?', a_en: 'Postman answer', topic: 'About' }, tests: ok(201) }),
      req('Report unanswered chatbot question', 'POST', '/api/chat/log', { body: { query_text: 'postman chatbot question', source: 'CHATBOT_GENERAL' }, tests: ok(201) })
    ]),
    folder('Categories', [req('All categories', 'GET', '/api/categories', { tests: ok(200) }), req('One category', 'GET', '/api/categories/farmers', { tests: ok(200) })]),
    folder('Schemes', [
      req('List all schemes', 'GET', '/api/schemes', { tests: ok(200) }),
      req('Search: crop insurance', 'GET', '/api/schemes?keyword=crop insurance', { tests: ok(200) }),
      req('Search in Tamil', 'GET', '/api/schemes?keyword=கிசான்', { tests: ok(200) }),
      req('Filter: category + level', 'GET', '/api/schemes?category=education&level=STATE', { tests: ok(200) }),
      req('Scheme detail by slug', 'GET', '/api/schemes/pm-kisan', { tests: ok(200) }),
      req('Scheme detail by id', 'GET', '/api/schemes/5', { tests: ok(200) }),
      req('Unknown scheme (expect 404)', 'GET', '/api/schemes/does-not-exist', { tests: ok(404) })
    ]),
    folder('Documents and FAQs', [req('Document guide', 'GET', '/api/documents', { tests: ok(200) }), req('One document', 'GET', '/api/documents/aadhaar', { tests: ok(200) }), req('FAQs', 'GET', '/api/faqs', { tests: ok(200) }), req('FAQ search', 'GET', '/api/faqs?keyword=income', { tests: ok(200) })]),
    folder('Profile and recommendations', [
      req('Get my profile', 'GET', '/api/profiles/me', { auth: 'userToken', tests: ok(200) }),
      req('Save my profile', 'PUT', '/api/profiles/me', { auth: 'userToken', body: { dob: '2005-06-14', gender: 'FEMALE', income: 250000, occupation: 'STUDENT', student_level: 'UG', state: 'Tamil Nadu', district: 'Coimbatore', disability_type: 'NONE' }, tests: ok(200) }),
      req('Invalid profile (expect 400)', 'PUT', '/api/profiles/me', { auth: 'userToken', body: { gender: 'ROBOT' }, tests: ok(400) }),
      req('My recommendations', 'GET', '/api/recommendations', { auth: 'userToken', tests: ok(200) })
    ]),
    folder('Saved schemes', [
      req('Saved list', 'GET', '/api/saved', { auth: 'userToken', tests: ok(200) }),
      req('Save scheme 3', 'POST', '/api/saved', { auth: 'userToken', body: { scheme_id: 3 }, tests: ok(201) }),
      req('Remove scheme 3', 'DELETE', '/api/saved/3', { auth: 'userToken', tests: ok(200) })
    ]),
    folder('Feedback and notifications', [
      req('Feedback totals', 'GET', '/api/feedback/1', { tests: ok(200) }),
      req('Vote: useful', 'PUT', '/api/feedback/1', { auth: 'userToken', body: { useful: true, comment: 'Clear and helpful' }, tests: ok(200) }),
      req('My notifications', 'GET', '/api/notifications', { auth: 'userToken', tests: ok(200) }),
      req('Mark notification 1 read', 'PATCH', '/api/notifications/1/read', { auth: 'userToken', tests: ok(200) })
    ])
  ]
};
const env = { name: 'CivicConnect Local', values: [{ key: 'baseUrl', value: 'http://localhost:3000', enabled: true }, { key: 'userToken', value: '', enabled: true }, { key: 'adminToken', value: '', enabled: true }, { key: 'newUserToken', value: '', enabled: true }, { key: 'schemeId', value: '', enabled: true }], _postman_variable_scope: 'environment' };
fs.writeFileSync(path.join(dir, 'CivicConnect.postman_collection.json'), JSON.stringify(collection, null, 2));
fs.writeFileSync(path.join(dir, 'CivicConnect.local.postman_environment.json'), JSON.stringify(env, null, 2));
console.log('Wrote Postman files to backend/postman');
