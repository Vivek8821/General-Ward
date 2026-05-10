const logger = require('../utils/logger');
const config = require('../config');

function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const isOperational = err.isOperational || false;
  const isServerError = statusCode >= 500;

  logger.error('Unhandled Exception', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    tenantId: req.user?.tenantId
  });

  let response = {
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR'
  };

  if (!config.isProdLike || isOperational || !isServerError) {
    response.error = err.message;
    response.code = err.code || 'APP_ERROR';
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
