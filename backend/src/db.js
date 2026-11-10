const mysql = require('mysql2/promise');
const { db } = require('./config');

const pool = mysql.createPool({
  ...db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',
  dateStrings: true,       // DATE columns come back as 'YYYY-MM-DD' strings
  decimalNumbers: true
});

module.exports = pool;
