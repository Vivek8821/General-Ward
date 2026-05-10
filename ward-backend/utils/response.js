const config = require('../config');

function errorResponse(err, res, defaultStatus = 500) {
  const status = err.status || err.statusCode || defaultStatus;
  const isServerError = status >= 500;
  const message = config.isProdLike && isServerError && !err.isOperational
    ? 'Internal server error'
    : err.message || 'Internal server error';
  const body = { error: message };
  if (err.code) body.code = err.code;
  res.status(status).json(body);
}

module.exports = { errorResponse };
