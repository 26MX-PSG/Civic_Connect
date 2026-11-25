/* First-boot database setup for hosting (Railway etc.). Safe to run on every start:
 *  - tables missing  -> create them and load the seed data (once)
 *  - tables present  -> do nothing (your admin edits are never overwritten)
 * Locally use `npm run db:reset` instead (that one wipes everything). */
const { spawnSync } = require('child_process');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

(async () => {
  const conn = await mysql.createConnection({ ...config.db, charset: 'utf8mb4' });
  const [t] = await conn.query("SHOW TABLES LIKE 'users'");
  let has = t.length > 0;
  if (has) { const [[c]] = await conn.query('SELECT COUNT(*) n FROM users'); has = c.n > 0; }
  await conn.end();
  if (has) { console.log('[init-db] database already set up — leaving it untouched'); return; }

  if (config.isProd && !process.env.ADMIN_PASSWORD) { console.error('[init-db] Set ADMIN_PASSWORD (the password for the admin 26MX102@psgtech.ac.in) before the first start.'); process.exit(1); }
  console.log('[init-db] empty database — creating tables and loading seed data');
  for (const script of ['migrate.js', 'seed.js']) {
    const r = spawnSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit', env: { ...process.env, ALLOW_INIT: '1' } });
    if (r.status !== 0) process.exit(r.status || 1);
  }
})().catch((e) => { console.error('[init-db] failed:', e.message); process.exit(1); });
