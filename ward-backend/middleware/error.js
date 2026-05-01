const logger = require('../utils/logger');

/**
 * Global Error Handler
 * Mask internal errors in production, but log them for debugging.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.status || 500;
  const isOperational = err.isOperational || false;

  // Log the full error internally
  logger.error('Unhandled Exception', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    tenantId: req.user?.tenantId
  });

  // Masking logic
  let response = {
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR'
  };

  if (process.env.NODE_ENV === 'development' || isOperational) {
    response.error = err.message;
    response.code = err.code || 'APP_ERROR';
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
