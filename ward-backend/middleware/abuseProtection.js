const rateLimit = require('express-rate-limit');

// ── Attack Pattern Definitions ────────────────────────────────────────────────
//
// SQL patterns are conservative: we only flag unambiguous injection constructs
// (UNION SELECT, stacked statements, boolean tautologies with quotes) so that
// clinical text containing ordinary SQL words ("select a diet", "update daily")
// is never blocked.
//
const ATTACK_PATTERNS = [
  // XSS
  { name: 'xss_script',     re: /<script[\s\S]*?>/i },
  { name: 'xss_iframe',     re: /<i?frame[\s>]/i },
  { name: 'xss_javascript', re: /javascript\s*:/i },
  { name: 'xss_vbscript',   re: /vbscript\s*:/i },
  { name: 'xss_event',      re: /\bon\w{1,20}\s*=/i },
  // SQL injection
  { name: 'sqli_union',     re: /\bunion\s+(all\s+)?select\b/i },
  { name: 'sqli_stacked',   re: /;\s*(drop|delete|insert|update|exec|truncate)\b/i },
  { name: 'sqli_comment',   re: /['"`]\s*--/ },
  { name: 'sqli_boolean',   re: /['"`]\s*(or|and)\s+['"`]?\d['"`]?\s*=\s*['"`]?\d/i },
  { name: 'sqli_block',     re: /\/\*[\s\S]*?\*\// },
];

// Fields whose values are legitimately long (summaries, notes, report text)
const LONG_FIELD_WHITELIST = new Set([
  'notes', 'reason', 'findings', 'impression', 'results',
  'dischargeRecommendations', 'historyOfPresentingIllness',
  'physicalExamFindings', 'conditions', 'familyHistory',
  'pastSurgeries', 'socialHistory', 'clinicalRemarks',
  'medicationsDuringAdmission',
]);
const DEFAULT_MAX_LENGTH  = 10_000;
const CLINICAL_MAX_LENGTH = 50_000;

function scanValue(value, field) {
  if (typeof value !== 'string') return null;

  const maxLen = LONG_FIELD_WHITELIST.has(field)
    ? CLINICAL_MAX_LENGTH
    : DEFAULT_MAX_LENGTH;

  if (value.length > maxLen) {
    return { field, reason: 'oversized_field' };
  }

  for (const p of ATTACK_PATTERNS) {
    if (p.re.test(value)) {
      return { field, reason: p.name };
    }
  }

  return null;
}

function scanObject(obj, parentKey = '') {
  if (!obj || typeof obj !== 'object') return scanValue(obj, parentKey);

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const path = parentKey ? `${parentKey}.${key}` : key;

    if (typeof val === 'string') {
      const hit = scanValue(val, key);
      if (hit) return { ...hit, field: path };
    } else if (val && typeof val === 'object') {
      const hit = scanObject(val, path);
      if (hit) return hit;
    }
  }

  return null;
}

// ── Middleware: Attack Pattern Detection ──────────────────────────────────────

exports.detectAttackPatterns = function detectAttackPatterns(req, res, next) {
  if (!req.body || typeof req.body !== 'object') return next();
  // Only scan write operations — GET/HEAD/OPTIONS carry no body
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const hit = scanObject(req.body);
  if (hit) {
    // Log the field name and pattern but never the value itself (avoids storing attack payloads)
    console.error('[AbuseDetection] Blocked suspicious input', {
      pattern: hit.reason,
      field:   hit.field,
      userId:  req.user?.id,
      role:    req.user?.role,
      ip:      req.ip,
      method:  req.method,
      endpoint: req.originalUrl,
    });
    return res.status(400).json({
      error: 'Input contains disallowed characters or patterns.',
      code:  'INVALID_INPUT',
    });
  }

  next();
};

// ── Middleware: Per-Form Submission Rate Limiter ───────────────────────────────
//
// Key = userId + IP + normalised path so that the same user hammering the same
// endpoint is caught, but the limit does not bleed across different endpoints.
//
exports.submissionLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const uid  = req.user?.id  || 'anon';
    const ip   = req.ip        || 'unknown';
    // Normalise path: strip trailing slash and numeric/uuid segments so that
    // /patients/abc-123/labs and /patients/xyz-456/labs share the same bucket.
    const path = req.path.replace(/\/[0-9a-f-]{8,}(\/|$)/gi, '/:id$1');
    return `sub:${uid}:${ip}:${path}`;
  },
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  message: {
    error: 'Too many submissions. Please wait a moment before trying again.',
    code:  'SUBMISSION_RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Middleware: Honeypot Field Validation ─────────────────────────────────────
//
// Real users (submitting via the app) always send website: ''.
// Bots that scan network traffic and replay requests tend to fill every field
// they see — including ones with plausible names like "website".
// Any non-empty value in this field means the request is not from the app.
//
exports.validateHoneypot = function validateHoneypot(req, res, next) {
  const hp = req.body?.website;
  if (hp != null && String(hp).trim() !== '') {
    console.error('[AbuseDetection] Honeypot triggered', {
      ip:       req.ip,
      endpoint: req.originalUrl,
    });
    // Return a plausible-looking success to avoid revealing detection
    return res.status(200).json({ ok: true });
  }
  next();
};
