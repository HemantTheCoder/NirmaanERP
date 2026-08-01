-- =============================================================================
-- Nirmaan ERP — Migration 0016: Contractor Role Enum Addition
-- Adds 'contractor' to user_role enum type.
-- Note: Must be committed in its own transaction before using 'contractor'.
-- =============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'contractor';
