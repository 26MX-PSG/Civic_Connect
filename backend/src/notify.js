/* Creates in-app notifications (notifications table) and, for users who opted in
 * (users.email_notifications), also sends an email through Nodemailer.
 * Types: SCHEME_UPDATED, SCHEME_DEACTIVATED, NEW_MATCH, ANNOUNCEMENT. Email problems never break the caller. */
const pool = require('./db');
const mailer = require('./mailer');

const SUBJECT = {
  SCHEME_UPDATED: 'A scheme you saved was updated',
  SCHEME_DEACTIVATED: 'A scheme you saved is no longer active',
  NEW_MATCH: 'New scheme that may match your profile',
  ANNOUNCEMENT: 'CivicConnect announcement'
};

/* items: [{ user_id, name, email, email_notifications, scheme_id?, type, title_en, title_ta, link? }]
 * Returns { notified, emailed, email_failed, email_skipped } */
async function dispatch(items) {
  const out = { notified: 0, emailed: 0, email_failed: 0, email_skipped: 0, email_error: null };
  for (const n of items) {
    await pool.query('INSERT INTO notifications (user_id,scheme_id,type,title_en,title_ta) VALUES (?,?,?,?,?)',
      [n.user_id, n.scheme_id || null, n.type, String(n.title_en).slice(0, 200), n.title_ta ? String(n.title_ta).slice(0, 250) : null]);
    out.notified++;
    if (!n.email_notifications) { out.email_skipped++; continue; }
    const r = await mailer.sendMail({
      to: n.email, subject: `${SUBJECT[n.type]} — CivicConnect`,
      text: `${n.title_en}\n\nOpen CivicConnect: ${n.link || 'dashboard.html'}`,
      html: mailer.layout({ heading: SUBJECT[n.type], body: `<p>Hello ${mailer.esc(n.name || 'there')},</p><p>${mailer.esc(n.title_en)}</p>`, cta: { label: n.type === 'ANNOUNCEMENT' ? 'Open CivicConnect' : 'View details', href: n.link || 'dashboard.html' } })
    });
    if (r.sent) out.emailed++; else { out.email_failed++; out.email_error = out.email_error || r.reason; }
  }
  return out;
}

const ACTIVE_USERS = 'SELECT user_id,name,email,email_notifications FROM users WHERE role="USER" AND is_active=1';

async function usersWhoSaved(schemeId) {
  const [rows] = await pool.query(`SELECT u.user_id,u.name,u.email,u.email_notifications FROM users u JOIN saved_schemes ss ON ss.user_id=u.user_id
    WHERE ss.scheme_id=? AND u.is_active=1 AND u.role='USER'`, [schemeId]);
  return rows;
}

const link = (s) => `scheme.html?slug=${encodeURIComponent(s.slug)}`;

async function schemeUpdated(s) {
  return dispatch((await usersWhoSaved(s.id)).map((u) => ({ ...u, scheme_id: s.id, type: 'SCHEME_UPDATED', link: link(s),
    title_en: `${s.name_en} was updated. Please review the latest details.`, title_ta: `${s.name_ta || s.name_en} புதுப்பிக்கப்பட்டது. சமீபத்திய விவரங்களைப் பாருங்கள்.` })));
}
async function schemeDeactivated(s) {
  return dispatch((await usersWhoSaved(s.id)).map((u) => ({ ...u, scheme_id: s.id, type: 'SCHEME_DEACTIVATED', link: link(s),
    title_en: `${s.name_en} is no longer active on CivicConnect`, title_ta: `${s.name_ta || s.name_en} இப்போது செயலில் இல்லை` })));
}
async function newMatch(s, userIds) {
  if (!userIds.length) return dispatch([]);
  const [rows] = await pool.query(`${ACTIVE_USERS} AND user_id IN (?)`, [userIds]);
  return dispatch(rows.map((u) => ({ ...u, scheme_id: s.id, type: 'NEW_MATCH', link: link(s),
    title_en: `${s.name_en} may match your profile (basic criteria). Check the details and documents.`, title_ta: `${s.name_ta || s.name_en} உங்கள் விவரங்களுடன் பொருந்தலாம்.` })));
}
async function announcement(title_en, title_ta) {
  const [rows] = await pool.query(ACTIVE_USERS);
  return { ...(await dispatch(rows.map((u) => ({ ...u, type: 'ANNOUNCEMENT', title_en, title_ta: title_ta || title_en })))), recipients: rows.length };
}

module.exports = { dispatch, schemeUpdated, schemeDeactivated, newMatch, announcement };
