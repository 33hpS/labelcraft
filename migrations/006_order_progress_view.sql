-- 006_order_progress_view.sql
-- View to compute per-order production progress (completed stages / total stages)
-- Assumes production_stages, stage_transitions already exist.

DROP VIEW IF EXISTS order_progress;
CREATE VIEW order_progress AS
SELECT 
  o.id AS order_id,
  o.title AS order_title,
  o.status AS order_status,
  COUNT(DISTINCT ps.id) AS total_stages,
  COUNT(DISTINCT CASE WHEN st.status = 'completed' THEN st.stage_id END) AS completed_stages,
  ROUND( 
    100.0 * COUNT(DISTINCT CASE WHEN st.status = 'completed' THEN st.stage_id END) 
    / NULLIF(COUNT(DISTINCT ps.id),0)
  , 2) AS progress_percentage,
  MAX(CASE WHEN st.status = 'started' THEN st.scan_time END) AS last_started_at,
  MAX(CASE WHEN st.status = 'completed' THEN st.scan_time END) AS last_completed_at
FROM orders o
LEFT JOIN stage_transitions st ON st.order_id = o.id
LEFT JOIN production_stages ps ON ps.is_active = 1
GROUP BY o.id;

-- Note: total_stages counts active catalog stages globally; if you need per-segment filtering,
-- extend this view (e.g., join orders.segment and filter production_stages.segment=NULL or matching).
