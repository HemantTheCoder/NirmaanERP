-- =============================================================================
-- Nirmaan ERP — Migration 0006: Admin Module & User Active Status
-- Adds is_active column to public.users table and creates an index.
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.is_active IS 'Whether the user account is active. Inactive users are blocked at login.';

CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
