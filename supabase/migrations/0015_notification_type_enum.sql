-- =============================================================================
-- Nirmaan ERP — Migration 0015: Add safety & grievance to notification_type enum
-- Extends the notification_type enum with values required by safety_incidents
-- and grievances triggers (notify_critical_safety_incident, notify_safety_events,
-- and notify_grievance_events).
--
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a multi-statement transaction
-- block in PostgreSQL, so this migration is kept isolated in its own file.
-- =============================================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'safety';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'grievance';
