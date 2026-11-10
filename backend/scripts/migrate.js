/* Applies db/schema.sql. WARNING: drops and recreates every table (development only). */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

(async () => {
  if (config.isProd) { console.error('Refusing to run migrate (drops tables) with NODE_ENV=production'); process.exit(1); }
  const conn = await mysql.createConnection({ ...config.db, charset: 'utf8mb4', multipleStatements: true });
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await conn.query(sql);
  console.log('Schema applied to database "' + config.db.database + '".');
  await conn.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
