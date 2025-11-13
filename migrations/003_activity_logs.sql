-- Migration: Activity Logs
-- Created: 2025-10-15
-- Description: Add activity_logs table for tracking user operations

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL, -- 'product_created', 'product_updated', 'template_created', 'order_created', 'label_printed', etc.
  target_type TEXT NOT NULL, -- 'product', 'template', 'order'
  target_id TEXT, -- ID of the affected entity
  target_name TEXT, -- Name/title of the entity for display
  user_name TEXT DEFAULT 'Система', -- User who performed the action
  user_role TEXT, -- 'admin', 'operator', 'system'
  metadata TEXT, -- JSON with additional data (e.g., order quantity, template format)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT -- Optional: track IP for security
);

-- Index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Index for filtering by action type
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);

-- Index for filtering by target
CREATE INDEX IF NOT EXISTS idx_activity_logs_target ON activity_logs(target_type, target_id);
