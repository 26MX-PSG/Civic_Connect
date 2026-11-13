const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const pool = require('./db');
const { notFoundHandler, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false })); // CSP off so the static demo frontend (inline handlers, CDN fonts) works
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', async (req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'up' }); }
    catch (e) { res.status(503).json({ status: 'degraded', database: 'down' }); }
  });

  // slow down password guessing
  // Human-readable API index for demos: open http://localhost:3000/api-docs
  const ENDPOINTS = [
    ['GET', '/api/health', '-', 'API + database status'],
    ['POST', '/api/auth/register', '-', 'Create account (users table INSERT)'],
    ['POST', '/api/auth/login', '-', 'Login, returns JWT'],
    ['POST', '/api/auth/forgot-password', '-', 'Send a generic reset email if account exists'],
    ['POST', '/api/auth/reset-password', '-', 'Reset password using a token'],
    ['GET', '/api/auth/me', 'user', 'Current user'],
    ['PATCH', '/api/auth/me', 'user', 'Update language / notification prefs (users UPDATE)'],
    ['GET', '/api/categories', '-', 'Categories with scheme counts'],
    ['GET', '/api/schemes?keyword=&category=&level=&state=', '-', 'Search schemes (English + Tamil)'],
    ['GET', '/api/schemes/:idOrSlug', '-', 'Scheme detail, documents, feedback totals'],
    ['GET', '/api/documents', '-', 'Document guide'],
    ['GET', '/api/faqs?keyword=', '-', 'FAQs'],
    ['GET', '/api/profiles/me', 'user', 'Eligibility profile + completion %'],
    ['PUT', '/api/profiles/me', 'user', 'Save profile (profiles UPSERT)'],
    ['GET', '/api/recommendations', 'user', 'Matching schemes for the profile'],
    ['GET', '/api/saved', 'user', 'Saved scheme ids'],
    ['POST', '/api/saved', 'user', 'Save a scheme (saved_schemes INSERT)'],
    ['DELETE', '/api/saved/:schemeId', 'user', 'Unsave a scheme (saved_schemes DELETE)'],
    ['GET', '/api/feedback/:schemeId', '-', 'Useful / not useful totals'],
    ['PUT', '/api/feedback/:schemeId', 'user', 'Vote + comment (feedback UPSERT)'],
    ['GET', '/api/notifications', 'user', 'My notifications'],
    ['PATCH', '/api/notifications/:id/read', 'user', 'Mark as read (notifications UPDATE)'],
    ['GET', '/api/admin/users', 'admin', 'User list for admins']
  ];
  app.get('/api', (req, res) => res.json({ name: 'CivicConnect API', endpoints: ENDPOINTS.map(([method, path, auth, description]) => ({ method, path, auth, description })) }));
  app.get('/api-docs', (req, res) => res.type('html').send(`<!doctype html><meta charset="utf-8"><title>CivicConnect API</title>
<style>body{font:15px system-ui;max-width:1000px;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:.45rem;text-align:left}code{background:#f3f3f3;padding:2px 5px;border-radius:4px}.GET{color:#0a7}.POST{color:#06c}.PUT,.PATCH{color:#c60}.DELETE{color:#c00}</style>
<h1>CivicConnect REST API</h1><p>Express + MySQL. Auth = <code>Authorization: Bearer &lt;JWT&gt;</code> from login. Try any GET in the browser.</p>
<table><tr><th>Method<th>Endpoint<th>Auth<th>What it does</tr>${ENDPOINTS.map(([m, p, a, d]) => `<tr><td><b class="${m}">${m}</b><td><code>${p.startsWith('/api/health') || m !== 'GET' || p.includes(':') ? p : `<a href="${p}">${p}</a>`}</code><td>${a}<td>${d}`).join('')}</table>`));

  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 20, standardHeaders: true, legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, try again later' } } }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/schemes', require('./routes/schemes'));
  app.use('/api/documents', require('./routes/documents'));
  app.use('/api/faqs', require('./routes/faqs'));
  app.use('/api/profiles', require('./routes/profiles'));
  app.use('/api/saved', require('./routes/saved'));
  app.use('/api/recommendations', require('./routes/recommendations'));
  app.use('/api/feedback', require('./routes/feedback'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/admin', require('./routes/admin'));

  // Serve the static frontend from the same origin (only these paths; backend/ and .env are never exposed)
  const root = require('path').join(__dirname, '..', '..');
  app.use('/assets', express.static(require('path').join(root, 'assets')));
  app.use('/admin', express.static(require('path').join(root, 'admin')));
  app.get(/^\/([A-Za-z0-9_-]+\.html)?$/, (req, res, next) => {
    const f = req.params[0] || 'index.html';
    res.sendFile(require('path').join(root, f), (e) => e && next());
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
