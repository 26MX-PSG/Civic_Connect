const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be set to a strong value in production');
}

// Hosted MySQL (Railway etc.) usually gives one connection URL: mysql://user:pass@host:port/dbname
function dbFromEnv() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url) {
    const u = new URL(url);
    return { host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.replace(/^\//, '') };
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQL_HOST_PORT || 3307),
    user: process.env.MYSQL_USER || 'civic_user',
    password: process.env.MYSQL_PASSWORD || 'civic_pass123',
    database: process.env.MYSQL_DATABASE || 'civicconnect'
  };
}

module.exports = {
  isProd,
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwtSecret: process.env.JWT_SECRET || 'change-me-dev-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : `http://localhost:${Number(process.env.PORT || 3000)}`),
  passwordResetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30),
  smtp: {
    host: (process.env.SMTP_HOST || '').trim(),
    port: Number(process.env.SMTP_PORT || 587),
    // port 465 is always SSL; 587 uses STARTTLS (secure=false). Quotes/spaces in .env values are tolerated.
    secure: Number(process.env.SMTP_PORT || 587) === 465 || String(process.env.SMTP_SECURE).trim() === 'true',
    user: (process.env.SMTP_USER || '').trim(),
    pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),   // Gmail shows app passwords in 4 groups with spaces; spaces are not part of it
    from: process.env.SMTP_FROM || 'CivicConnect <noreply@civicconnect.local>'
  },
  db: { ...dbFromEnv(), ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}) }
};
