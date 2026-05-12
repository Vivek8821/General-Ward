const rateLimit = require('express-rate-limit');

exports.clinicalWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  message: { error: 'Too many requests, please slow down', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

exports.adminWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: 'Too many requests, please slow down', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

exports.escalationLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Too many escalation requests', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});
