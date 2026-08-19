-- =============================================================================
-- Nirmaan ERP — Migration 0039: Add phone column to public.users
-- =============================================================================
-- Note: this column was already applied directly to the live database while
-- building the profile page feature; this file documents it for repo/schema
-- parity so a fresh environment bootstrapped from these migrations matches
-- production. IF NOT EXISTS makes it a no-op against the live database.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- No RLS change needed: users_select_all (0031) already grants SELECT on all
-- columns to any authenticated user, which is the intended visibility for a
-- basic contact card (name, role, email, phone) — nothing more sensitive than
-- what was already exposed.

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
