-- Migration 009: Add optional email column to Users
ALTER TABLE Users ADD COLUMN IF NOT EXISTS email TEXT;
