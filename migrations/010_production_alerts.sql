-- 010_production_alerts.sql
-- Persistence for overdue production stage alerts (SLA breaches)
-- Tracks when a stage exceeded its estimated_duration and operator/manager acknowledgement lifecycle.

CREATE TABLE IF NOT EXISTS production_alerts (
  id TEXT PRIMARY KEY,
  transition_id TEXT NOT NULL UNIQUE,          -- stage_transitions.id (started status)
  order_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT NOT NULL,                    -- copy of transition scan_time
  estimated_duration INTEGER,                  -- from production_stages at detect time
  overdue_minutes INTEGER NOT NULL DEFAULT 0,  -- current overdue (elapsed - estimated)
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','ack','closed')),
  acknowledged_by TEXT,                        -- user/operator who acknowledged
  acknowledged_at TEXT,
  closed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (transition_id) REFERENCES stage_transitions(id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES production_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_alerts_status ON production_alerts(status);
CREATE INDEX IF NOT EXISTS idx_production_alerts_stage ON production_alerts(stage_id);
CREATE INDEX IF NOT EXISTS idx_production_alerts_order ON production_alerts(order_id);
CREATE INDEX IF NOT EXISTS idx_production_alerts_detected ON production_alerts(detected_at DESC);

-- Helper view for dashboard aggregation (optional)
DROP VIEW IF EXISTS production_alerts_stats;
CREATE VIEW production_alerts_stats AS
SELECT 
  COUNT(*) AS total,
  COUNT(CASE WHEN status = 'new' THEN 1 END) AS new_count,
  COUNT(CASE WHEN status = 'ack' THEN 1 END) AS ack_count,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) AS closed_count
FROM production_alerts;
