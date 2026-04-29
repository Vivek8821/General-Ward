function normalizeNodeEnv(raw) {
  const env = (raw || '').trim();
  if (!env) return 'development';
  return env;
}

function validateNodeEnv(nodeEnv) {
  const allowed = new Set(['development', 'test', 'production', 'staging']);
  if (!allowed.has(nodeEnv)) {
    throw new Error(
      `[config] Invalid NODE_ENV="${nodeEnv}". Allowed: development, test, staging, production.`
    );
  }
}

function isProdLike(nodeEnv) {
  return nodeEnv === 'production' || nodeEnv === 'staging';
}

function getJwtSecret({ nodeEnv }) {
  const secret = process.env.JWT_SECRET;
  if (secret && String(secret).trim() !== '') return String(secret);

  // Never allow a silent weak default in prod-like envs.
  if (isProdLike(nodeEnv)) {
    throw new Error('[config] JWT_SECRET must be set in production/staging.');
  }

  // Explicitly allow a fallback only for local dev/test.
  // Keep it stable so tokens work across restarts in local workflows.
  // eslint-disable-next-line no-console
  console.warn('[config] JWT_SECRET not set; using insecure fallback (development/test only).');
  return 'super-secret-key-change-in-production';
}

function getCorsOrigins({ nodeEnv }) {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || String(raw).trim() === '') {
    return { mode: 'auto' };
  }

  const origins = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (isProdLike(nodeEnv) && origins.length === 0) {
    throw new Error('[config] CORS_ORIGIN must list at least one origin in production/staging.');
  }

  return { mode: 'explicit', origins };
}

const nodeEnv = normalizeNodeEnv(process.env.NODE_ENV);
validateNodeEnv(nodeEnv);

const config = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  isDev: nodeEnv === 'development',
  isProdLike: isProdLike(nodeEnv),
  jwtSecret: getJwtSecret({ nodeEnv }),
  cors: getCorsOrigins({ nodeEnv }),
};

module.exports = config;

