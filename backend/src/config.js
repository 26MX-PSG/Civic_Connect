const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be set to a strong value in production');
}

module.exports = {
  isProd,
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwtSecret: process.env.JWT_SECRET || 'change-me-dev-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_HOST_PORT || 3307),
    user: process.env.MYSQL_USER || 'civic_user',
    password: process.env.MYSQL_PASSWORD || 'civic_pass123',
    database: process.env.MYSQL_DATABASE || 'civicconnect'
  }
};
