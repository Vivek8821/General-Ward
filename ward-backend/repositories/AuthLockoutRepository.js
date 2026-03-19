const { db, withTransaction } = require('../db');

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

class AuthLockoutRepository {
  constructor() {
    this.windowMs = Number(process.env.LOGIN_LOCKOUT_WINDOW_MS || DEFAULT_WINDOW_MS);
    this.maxAttempts = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
    this.lockoutMs = Number(process.env.LOGIN_LOCKOUT_DURATION_MS || DEFAULT_LOCKOUT_MS);
  }

  isLocked(username, ipAddress) {
    return new Promise((resolve, reject) => {
      if (!username || !ipAddress) return resolve(false);

      db.get(
        `SELECT lockedUntil FROM AuthLoginAttempts WHERE username = ? AND ipAddress = ?`,
        [username, ipAddress],
        (err, row) => {
          if (err) return reject(err);
          if (!row || !row.lockedUntil) return resolve(false);
          const lockedUntilMs = new Date(row.lockedUntil).getTime();
          return resolve(Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now());
        }
      );
    });
  }

  reset(username, ipAddress) {
    return new Promise((resolve, reject) => {
      if (!username || !ipAddress) return resolve();
      db.run(
        `DELETE FROM AuthLoginAttempts WHERE username = ? AND ipAddress = ?`,
        [username, ipAddress],
        (err) => (err ? reject(err) : resolve())
      );
    });
  }

  recordFailure(username, ipAddress) {
    return withTransaction(async ({ getAsync, runAsync }) => {
      if (!username || !ipAddress) {
        return { lockedNow: false };
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      const row = await getAsync(
        `SELECT attemptCount, firstAttemptAt, lockedUntil FROM AuthLoginAttempts WHERE username = ? AND ipAddress = ?`,
        [username, ipAddress]
      );

      // If a lock is already active, keep it active and do not extend the window.
      if (row?.lockedUntil) {
        const lockedUntilMs = new Date(row.lockedUntil).getTime();
        if (Number.isFinite(lockedUntilMs) && lockedUntilMs > now) {
          return { lockedNow: true };
        }
      }

      let attemptCount = Number(row?.attemptCount || 0);
      let firstAttemptAtMs = row?.firstAttemptAt ? new Date(row.firstAttemptAt).getTime() : null;

      // Reset the counter if outside the rolling window.
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
         ON CONFLICT(username, ipAddress) DO UPDATE SET
           attemptCount = excluded.attemptCount,
           firstAttemptAt = excluded.firstAttemptAt,
           lockedUntil = excluded.lockedUntil`,
        [
          username,
          ipAddress,
          attemptCount,
          new Date(firstAttemptAtMs).toISOString(),
          lockedUntil
        ]
      );

      return { lockedNow };
    });
  }
}

module.exports = new AuthLockoutRepository();

