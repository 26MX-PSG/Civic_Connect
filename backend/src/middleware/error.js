const config = require('../config');
const { ApiError } = require('../utils/errors');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint: ' + req.method + ' ' + req.path } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body too large' } });
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong', ...(config.isProd ? {} : { details: err.message }) } });
}
module.exports = { notFoundHandler, errorHandler };
