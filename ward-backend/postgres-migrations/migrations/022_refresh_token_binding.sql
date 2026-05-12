-- Migration 022: Bind refresh tokens to the issuing IP address and user agent.
-- ipAddress: used to detect sessions suddenly used from a different network.
-- userAgent: used to detect sessions suddenly used from a different browser/device.
-- Both are nullable so rows created before this migration are unaffected.
ALTER TABLE RefreshTokens ADD COLUMN ipAddress TEXT;
ALTER TABLE RefreshTokens ADD COLUMN userAgent TEXT;
