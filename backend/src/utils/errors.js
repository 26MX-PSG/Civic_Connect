class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
const bad = (message, details) => new ApiError(400, 'VALIDATION_ERROR', message, details);
const notFound = (message = 'Not found') => new ApiError(404, 'NOT_FOUND', message);
const unauthorized = (message = 'Login required') => new ApiError(401, 'UNAUTHORIZED', message);
const forbidden = (message = 'Not allowed') => new ApiError(403, 'FORBIDDEN', message);

// lets async route handlers throw
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ApiError, bad, notFound, unauthorized, forbidden, wrap };
