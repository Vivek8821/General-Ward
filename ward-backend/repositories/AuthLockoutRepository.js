const dbAdapter = require('../db-adapter');

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

class AuthLockoutRepository {
  constructor() {
    this.windowMs = Number(process.env.LOGIN_LOCKOUT_WINDOW_MS || DEFAULT_WINDOW_MS);
    this.maxAttempts = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
    this.lockoutMs = Number(process.env.LOGIN_LOCKOUT_DURATION_MS || DEFAULT_LOCKOUT_MS);
  }

  async reset(username, ipAddress) {
    if (!username || !ipAddress) return;
    await dbAdapter.run(`DELETE FROM AuthLoginAttempts WHERE username = ? AND ipAddress = ?`, [
      username,
      ipAddress,
    ]);
  }

  // Atomic: in a single transaction, check the lockout state and reserve an attempt slot.
  // Caller MUST invoke this BEFORE running bcrypt so that concurrent failed attempts
  // can't all slip past a stale lockout check and burn through the counter in parallel.
  // Returns { locked: true } if the request must be rejected, { locked: false } if the
  // caller may proceed (and a slot has already been atomically debited).
  async tryAttempt(username, ipAddress) {
    if (!username || !ipAddress) return { locked: false };

    return dbAdapter.withTransaction(async ({ getAsync, runAsync }) => {
      const now = Date.now();
      const row = await getAsync(
        `SELECT attemptCount, firstAttemptAt, lockedUntil FROM AuthLoginAttempts WHERE username = ? AND ipAddress = ?`,
        [username, ipAddress]
      );

      // Active lockout from a previous round? Reject without incrementing.
      if (row?.lockedUntil) {
        const lockedUntilMs = new Date(row.lockedUntil).getTime();
        if (Number.isFinite(lockedUntilMs) && lockedUntilMs >= now) {
          return { locked: true };
        }
      }

      let attemptCount = Number(row?.attemptCount || 0);
      let firstAttemptAtMs = row?.firstAttemptAt ? new Date(row.firstAttemptAt).getTime() : null;

      // Rolling window expired -> reset the counter.
      if (!Number.isFinite(firstAttemptAtMs) || now - firstAttemptAtMs > this.windowMs) {
        attemptCount = 0;
        firstAttemptAtMs = now;
      }

      // Counter already at the limit (e.g. parallel siblings just filled it) -> lock and reject.
      if (attemptCount >= this.maxAttempts) {
        const lockedUntil = new Date(now + this.lockoutMs).toISOString();
        await runAsync(
          `INSERT INTO AuthLoginAttempts (username, ipAddress, attemptCount, firstAttemptAt, lockedUntil)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (username, ipAddress) DO UPDATE SET
             attemptCount = excluded.attemptCount,
             firstAttemptAt = excluded.firstAttemptAt,
             lockedUntil = excluded.lockedUntil`,
          [username, ipAddress, attemptCount, new Date(firstAttemptAtMs).toISOString(), lockedUntil]
        );
        return { locked: true };
      }

      // Reserve the slot: increment counter atomically before bcrypt runs.
      attemptCount += 1;
      await runAsync(
        `INSERT INTO AuthLoginAttempts (username, ipAddress, attemptCount, firstAttemptAt, lockedUntil)
         VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT (username, ipAddress) DO UPDATE SET
           attemptCount = excluded.attemptCount,
           firstAttemptAt = excluded.firstAttemptAt,
           lockedUntil = NULL`,
        [username, ipAddress, attemptCount, new Date(firstAttemptAtMs).toISOString()]
      );
      return { locked: false };
    });
  }
}

module.exports = new AuthLockoutRepository();
