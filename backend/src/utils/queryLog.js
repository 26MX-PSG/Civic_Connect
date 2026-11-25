// Records a question/search that found nothing (admins review these). Repeats bump `count`.
const pool = require('../db');

async function logUnanswered(text, userId, source = 'SEARCH', schemeId = null) {
  const t = String(text || '').trim().slice(0, 255);
  if (!t) return;
  const [ex] = await pool.query('SELECT query_id FROM search_queries WHERE source=? AND LOWER(query_text)=LOWER(?) LIMIT 1', [source, t]);
  if (ex.length) await pool.query('UPDATE search_queries SET count=count+1, created_at=NOW() WHERE query_id=?', [ex[0].query_id]);
  else await pool.query('INSERT INTO search_queries (user_id,query_text,source,scheme_id,result_found) VALUES (?,?,?,?,FALSE)', [userId || null, t, source, schemeId]);
}
module.exports = { logUnanswered };
