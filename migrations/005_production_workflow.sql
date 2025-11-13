-- 005_production_workflow.sql
-- Production stages workflow schema and seed

PRAGMA foreign_keys=ON;

-- Main stages catalog
CREATE TABLE IF NOT EXISTS production_stages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workshop INTEGER NULL,            -- 1 / 2 or NULL for common
  segment TEXT NULL,                -- 'lux' | 'econom' | NULL
  sequence_order INTEGER NOT NULL,  -- global ordering within selected path
  is_active INTEGER NOT NULL DEFAULT 1,
  color TEXT NULL,
  icon TEXT NULL,
  estimated_duration INTEGER NULL,  -- minutes
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_production_stages_order ON production_stages(sequence_order);
CREATE INDEX IF NOT EXISTS idx_production_stages_workshop ON production_stages(workshop);

-- Transitions per order
CREATE TABLE IF NOT EXISTS stage_transitions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  stage_id TEXT NOT NULL REFERENCES production_stages(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('started','completed')),
  operator_name TEXT NOT NULL,
  operator_id TEXT NULL,
  notes TEXT NULL,
  duration_minutes INTEGER NULL,
  scan_time TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT NULL,
  UNIQUE(order_id, stage_id, status, scan_time)
);

CREATE INDEX IF NOT EXISTS idx_transitions_order ON stage_transitions(order_id, scan_time DESC);
CREATE INDEX IF NOT EXISTS idx_transitions_stage ON stage_transitions(stage_id, scan_time DESC);

-- Individual scans (start/finish)
CREATE TABLE IF NOT EXISTS stage_scans (
  id TEXT PRIMARY KEY,
  transition_id TEXT NOT NULL REFERENCES stage_transitions(id) ON DELETE CASCADE,
  qr_code TEXT NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('start','finish')),
  location TEXT NULL,
  ip_address TEXT NULL,
  scan_time TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scans_transition ON stage_scans(transition_id);

-- Current stage per order (view)
DROP VIEW IF EXISTS order_current_stage;
CREATE VIEW order_current_stage AS
SELECT
  st.order_id,
  ps.id AS stage_id,
  ps.name AS stage_name,
  ps.sequence_order,
  st.status,
  st.scan_time AS started_at,
  st.operator_name,
  (strftime('%s','now') - strftime('%s', st.scan_time)) / 60 AS elapsed_minutes
FROM stage_transitions st
JOIN production_stages ps ON ps.id = st.stage_id
WHERE st.status = 'started'
  AND NOT EXISTS (
    SELECT 1 FROM stage_transitions st2
    WHERE st2.order_id = st.order_id
      AND st2.status = 'started'
      AND st2.scan_time > st.scan_time
  );

-- Seed stages according to provided list
DELETE FROM production_stages;

-- Common pre-stages
INSERT INTO production_stages (id, name, workshop, segment, sequence_order, is_active, color, icon)
VALUES
  ('st_001','Распил',NULL,NULL,1,1,'#6b7280','saw'),
  ('st_002','Кромка',NULL,NULL,2,1,'#6b7280','border'),
  ('st_003','Сверление',NULL,NULL,3,1,'#6b7280','drill'),
  ('st_004','ЧПУ',NULL,NULL,4,1,'#6b7280','cpu'),
  ('st_005','Зеркало (кромка + резка)',NULL,NULL,5,1,'#6b7280','activity');

-- Workshop 1 (map to segment 'lux')
INSERT INTO production_stages (id, name, workshop, segment, sequence_order, is_active, color, icon)
VALUES
  ('st_101','LED-цех',1,'lux',6,1,'#0ea5e9','lightbulb'),
  ('st_102','Коробки (резка)',1,'lux',7,1,'#0ea5e9','box'),
  ('st_103','Шлифовка',1,'lux',8,1,'#0ea5e9','sand'),
  ('st_104','Грунтовка',1,'lux',9,1,'#0ea5e9','paint'),
  ('st_105','Малярка',1,'lux',10,1,'#0ea5e9','spray'),
  ('st_106','Полировка',1,'lux',11,1,'#0ea5e9','sparkles'),
  ('st_107','Сборка',1,'lux',12,0,'#0ea5e9','wrench'),
  ('st_108','Упаковка',1,'lux',13,1,'#0ea5e9','package');

-- Workshop 2 (map to segment 'econom')
INSERT INTO production_stages (id, name, workshop, segment, sequence_order, is_active, color, icon)
VALUES
  ('st_201','Шлифовка',2,'econom',14,1,'#34d399','sand'),
  ('st_202','Клей',2,'econom',15,1,'#34d399','droplet'),
  ('st_203','(пусто)',2,'econom',16,0,'#34d399','dash'),
  ('st_204','Вакуум-пресс',2,'econom',17,1,'#34d399','layers'),
  ('st_205','Сборка',2,'econom',18,1,'#34d399','wrench'),
  ('st_206','Упаковка',2,'econom',19,1,'#34d399','package');

-- Helpful defaults
-- Ensure after "Малярка" must be "Полировка" by order numbers 10 -> 11
-- Backwards move is forbidden by API logic (see handler)
