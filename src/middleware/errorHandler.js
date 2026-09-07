const { AppError } = require('../errors/AppError');

function errorHandler(err, _req, res, _next) {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const payload = {
    success: false,
    message: err.message || 'Internal server error',
    ...(err.extras || {}),
  };

  if (statusCode >= 500) {
    console.error('[server] Unhandled error:', err.message);
  }

  if (res.headersSent) {
    return;
  }

  return res.status(statusCode).json(payload);
}

module.exports = {
  errorHandler,
};
