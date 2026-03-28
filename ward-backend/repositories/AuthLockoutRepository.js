const dbAdapter = require('../dbAdapter');

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

class AuthLockoutRepository {
  constructor() {
    this.windowMs = Number(process.env.LOGIN_LOCKOUT_WINDOW_MS || DEFAULT_WINDOW_MS);
    this.maxAttempts = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
    this.lockoutMs = Number(process.env.LOGIN_LOCKOUT_DURATION_MS || DEFAULT_LOCKOUT_MS);
  }

  async isLocked(username, ipAddress) {
    if (!username || !ipAddress) return false;

    const row = await dbAdapter.get(
      `SELECT lockedUntil FROM AuthLoginAttempts WHERE username = ? AND ipAddress = ?`,
      [username, ipAddress]
    );
    if (!row || !row.lockedUntil) return false;
    const lockedUntilMs = new Date(row.lockedUntil).getTime();
    return Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now();
  }

  async reset(username, ipAddress) {
    if (!username || !ipAddress) return;
    await dbAdapter.run(`DELETE FROM AuthLoginAttempts WHERE username = ? AND ipAddress = ?`, [
      username,
      ipAddress,
    ]);
  }

  async recordFailure(username, ipAddress) {
    return dbAdapter.withTransaction(async ({ getAsync, runAsync }) => {
      if (!username || !ipAddress) {
        return { lockedNow: false };
      }

      const now = Date.now();

      const row = await getAsync(
        `SELECT attemptCount, firstAttemptAt, lockedUntil FROM AuthLoginAttempts WHERE username = ? AND ipAddress = ?`,
        [username, ipAddress]
      );

      if (row?.lockedUntil) {
        const lockedUntilMs = new Date(row.lockedUntil).getTime();
        if (Number.isFinite(lockedUntilMs) && lockedUntilMs > now) {
          return { lockedNow: true };
        }
      }

      let attemptCount = Number(row?.attemptCount || 0);
      let firstAttemptAtMs = row?.firstAttemptAt ? new Date(row.firstAttemptAt).getTime() : null;

      if (!Number.isFinite(firstAttemptAtMs) || now - firstAttemptAtMs > this.windowMs) {
        attemptCount = 1;
        firstAttemptAtMs = now;
      } else {
        attemptCount += 1;
      }

      let lockedUntil = null;
      const lockedNow = attemptCount >= this.maxAttempts;
      if (lockedNow) {
        lockedUntil = new Date(now + this.lockoutMs).toISOString();
      }

      await runAsync(
        `INSERT INTO AuthLoginAttempts (username, ipAddress, attemptCount, firstAttemptAt, lockedUntil)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (username, ipAddress) DO UPDATE SET
           attemptCount = excluded.attemptCount,
           firstAttemptAt = excluded.firstAttemptAt,
           lockedUntil = excluded.lockedUntil`,
        [
          username,
          ipAddress,
          attemptCount,
          new Date(firstAttemptAtMs).toISOString(),
          lockedUntil,
        ]
      );

      return { lockedNow };
    });
  }
}

module.exports = new AuthLockoutRepository();
