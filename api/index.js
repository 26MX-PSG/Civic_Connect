/* Vercel serverless entry: every /api request is handled by the Express app (see vercel.json). */
module.exports = require('../backend/src/app').createApp();
