-- Migration: Stripe event idempotency table
-- Stores processed Stripe event IDs to prevent double-processing on retries.

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id     text        PRIMARY KEY,
  event_type   text        NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-clean events older than 90 days (run periodically)
-- DELETE FROM public.stripe_events WHERE processed_at < now() - interval '90 days';
