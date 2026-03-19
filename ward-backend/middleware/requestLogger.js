const crypto = require('crypto');

function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  const start = Date.now();

  res.on('finish', () => {
    const userId = req.user?.id || null;
    const userRole = req.user?.role || null;

    // Structured log line for easy ingestion by log systems.
    console.log(
      JSON.stringify({
        requestId,
        method: req.method,
        resource: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        userId,
        userRole
      })
    );
  });

  next();
}

module.exports = { requestLogger };

