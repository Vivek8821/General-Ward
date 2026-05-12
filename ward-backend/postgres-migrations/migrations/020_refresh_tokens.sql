-- Stores opaque refresh token IDs (UUIDs). The ID itself is sent to the browser
-- in an httpOnly cookie; the server looks it up here to verify it hasn't been
-- revoked and hasn't expired. Tokens are rotated on every use (old deleted,
-- new issued) to detect token theft via replay.
CREATE TABLE IF NOT EXISTS RefreshTokens (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL,
  tenantId  TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON RefreshTokens(userId);
