-- ============================================================================
-- Migration 00014: Make notifications.tenant_id nullable
-- ============================================================================
-- System-level notifications (e.g., main_admin actions) don't belong to any
-- tenant, so tenant_id must be nullable.
-- ============================================================================

ALTER TABLE public.notifications
  ALTER COLUMN tenant_id DROP NOT NULL;
