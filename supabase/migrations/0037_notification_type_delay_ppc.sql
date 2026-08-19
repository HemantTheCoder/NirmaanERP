-- =============================================================================
-- Nirmaan ERP — Migration 0037: Add delay, PPC & messaging notification types
-- Extends the notification_type enum with values required by the triggers in
-- 0038 (notify_ppc_below_target, notify_delay_reported, notify_delay_rectified)
-- and 0040 (notify_new_message).
--
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a multi-statement transaction
-- block in PostgreSQL, so this migration is kept isolated in its own file.
-- =============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ppc_below_target';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delay_reported';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delay_rectified';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_message';
