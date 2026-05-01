const crypto = require('crypto');
const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  const start = Date.now();

  res.on('finish', () => {
    const userId = req.user?.id || null;
    const userRole = req.user?.role || null;
    const resource = (req.originalUrl || '').split('?')[0];

    // Structured log line for easy ingestion by log systems.
    logger.info('Request handled', {
      requestId,
      method: req.method,
      resource,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userId,
      userRole
    });
  });

  next();
}

module.exports = { requestLogger };

