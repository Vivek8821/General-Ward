-- Migration 021: Password reset tokens
-- Stores single-use, time-limited tokens for the forgot-password flow.
-- tokenHash: SHA-256 of the raw token — raw token is only ever held in memory / email.
-- usedAt: set on first use so replays are rejected even before TTL expires.
CREATE TABLE IF NOT EXISTS PasswordResetTokens (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  tenantId    TEXT NOT NULL,
  tokenHash   TEXT NOT NULL UNIQUE,
  expiresAt   TEXT NOT NULL,
  usedAt      TEXT,
  createdAt   TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_prt_user    ON PasswordResetTokens(userId);
CREATE INDEX IF NOT EXISTS idx_prt_hash    ON PasswordResetTokens(tokenHash);
