-- Migration 002: Add stripe_session_id to acquisitions
-- Run date: 2026-02-24
-- Purpose: Allow success page to look up acquisition details by Stripe session ID

ALTER TABLE acquisitions
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

CREATE INDEX IF NOT EXISTS idx_acquisitions_stripe_session
  ON acquisitions(stripe_session_id);
