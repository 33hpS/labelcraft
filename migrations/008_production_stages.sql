-- v2.3 Enhancement: Production Stage Tracking System

-- 1. Таблица этапов производства (справочник)
CREATE TABLE IF NOT EXISTS production_stages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- Название этапа (Раскрой, Кромление, Сборка, ...)
  description TEXT,                      -- Описание этапа
  sequence_order INTEGER NOT NULL,       -- Порядок выполнения (1, 2, 3, ...)
  color TEXT DEFAULT '#3b82f6',          -- Цвет для UI
  icon TEXT DEFAULT 'box',               -- Иконка для UI
  is_active INTEGER DEFAULT 1,           -- Активен ли этап (1=да, 0=нет)
  requires_double_scan INTEGER DEFAULT 1, -- Требуется ли двойное сканирование (старт/финиш)
  estimated_duration INTEGER,            -- Примерное время в минутах
  department TEXT,                       -- Отдел/цех
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Индексы для production_stages
CREATE INDEX IF NOT EXISTS idx_production_stages_sequence ON production_stages(sequence_order);
CREATE INDEX IF NOT EXISTS idx_production_stages_active ON production_stages(is_active);
CREATE INDEX IF NOT EXISTS idx_production_stages_department ON production_stages(department);

-- 2. Таблица переходов между этапами (история)
CREATE TABLE IF NOT EXISTS stage_transitions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,                -- ID заказа
  product_id TEXT,                       -- ID товара (опционально, если отслеживаем по товарам)
  stage_id TEXT NOT NULL,                -- ID этапа
  status TEXT NOT NULL,                  -- 'started', 'completed', 'paused', 'cancelled'
  operator_name TEXT,                    -- Имя оператора
  operator_id TEXT,                      -- ID оператора
  scan_time TEXT NOT NULL DEFAULT (datetime('now')), -- Время сканирования
  notes TEXT,                            -- Заметки оператора
  duration_minutes INTEGER,              -- Фактическая длительность (для completed)
  previous_transition_id TEXT,           -- ID предыдущего перехода (для completed)
  metadata TEXT,                         -- JSON с доп. данными
  FOREIGN KEY (stage_id) REFERENCES production_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Индексы для stage_transitions
CREATE INDEX IF NOT EXISTS idx_stage_transitions_order ON stage_transitions(order_id);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_product ON stage_transitions(product_id);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_stage ON stage_transitions(stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_status ON stage_transitions(status);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_scan_time ON stage_transitions(scan_time DESC);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_operator ON stage_transitions(operator_id);

-- 3. Таблица QR-сканирований (детальная история каждого скана)
CREATE TABLE IF NOT EXISTS stage_scans (
  id TEXT PRIMARY KEY,
  transition_id TEXT NOT NULL,           -- ID перехода
  qr_code TEXT NOT NULL,                 -- Отсканированный QR-код
  scan_type TEXT NOT NULL,               -- 'start', 'finish', 'pause', 'resume', 'cancel'
  scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
  scanner_device TEXT,                   -- Устройство сканера (опционально)
  ip_address TEXT,                       -- IP адрес оператора
  location TEXT,                         -- Локация (цех/участок)
  FOREIGN KEY (transition_id) REFERENCES stage_transitions(id) ON DELETE CASCADE
);

-- Индексы для stage_scans
CREATE INDEX IF NOT EXISTS idx_stage_scans_transition ON stage_scans(transition_id);
CREATE INDEX IF NOT EXISTS idx_stage_scans_qr_code ON stage_scans(qr_code);
CREATE INDEX IF NOT EXISTS idx_stage_scans_scanned_at ON stage_scans(scanned_at DESC);

-- 4. Представление для текущего состояния заказов
CREATE VIEW IF NOT EXISTS order_current_stage AS
SELECT 
  o.id as order_id,
  o.order_number,
  o.customer_name,
  st.stage_id,
  ps.name as stage_name,
  ps.sequence_order,
  st.status as stage_status,
  st.operator_name,
  st.scan_time as started_at,
  st.id as transition_id,
  CASE 
    WHEN st.status = 'started' THEN 
      CAST((julianday('now') - julianday(st.scan_time)) * 24 * 60 AS INTEGER)
    ELSE 
      st.duration_minutes
  END as duration_minutes
FROM orders o
LEFT JOIN (
  SELECT order_id, MAX(scan_time) as last_scan
  FROM stage_transitions
  GROUP BY order_id
) latest ON o.id = latest.order_id
LEFT JOIN stage_transitions st ON o.id = st.order_id AND st.scan_time = latest.last_scan
LEFT JOIN production_stages ps ON st.stage_id = ps.id;

-- 5. Инициализация стандартных этапов производства мебели
INSERT OR IGNORE INTO production_stages (id, name, description, sequence_order, color, icon, department, estimated_duration) VALUES
('stage-001', 'Приём заказа', 'Регистрация и подтверждение заказа', 1, '#10b981', 'clipboard-check', 'Офис', 15),
('stage-002', 'Закупка материалов', 'Заказ и получение необходимых материалов', 2, '#f59e0b', 'shopping-cart', 'Снабжение', 1440),
('stage-003', 'Раскрой', 'Распиловка материалов по размерам', 3, '#3b82f6', 'scissors', 'Цех раскроя', 60),
('stage-004', 'Кромление', 'Обработка кромок деталей', 4, '#8b5cf6', 'layers', 'Цех обработки', 45),
('stage-005', 'Сверловка', 'Сверление отверстий под фурнитуру', 5, '#ec4899', 'circle-dot', 'Цех обработки', 30),
('stage-006', 'Фрезеровка', 'Фрезерование пазов и профилей', 6, '#06b6d4', 'tool', 'Цех обработки', 40),
('stage-007', 'Шлифовка', 'Шлифование поверхностей', 7, '#f97316', 'brush', 'Цех отделки', 50),
('stage-008', 'Покраска/Лакировка', 'Нанесение покрытия', 8, '#ef4444', 'paintbrush', 'Цех покраски', 180),
('stage-009', 'Сушка', 'Высыхание покрытия', 9, '#84cc16', 'sun', 'Цех покраски', 480),
('stage-010', 'Сборка', 'Сборка изделия', 10, '#14b8a6', 'package', 'Цех сборки', 90),
('stage-011', 'Контроль качества', 'Проверка готового изделия', 11, '#6366f1', 'check-circle', 'ОТК', 20),
('stage-012', 'Упаковка', 'Упаковка для отправки', 12, '#a855f7', 'box', 'Склад', 30),
('stage-013', 'Отгрузка', 'Передача клиенту/доставка', 13, '#22c55e', 'truck', 'Склад', 15);

-- 6. Триггер для автоматического расчёта длительности при завершении этапа
CREATE TRIGGER IF NOT EXISTS calculate_stage_duration
AFTER UPDATE OF status ON stage_transitions
WHEN NEW.status = 'completed' AND OLD.status = 'started'
BEGIN
  UPDATE stage_transitions
  SET duration_minutes = CAST((julianday(NEW.scan_time) - julianday(OLD.scan_time)) * 24 * 60 AS INTEGER),
      previous_transition_id = OLD.id
  WHERE id = NEW.id;
END;

-- 7. Триггер для логирования в activity_logs
CREATE TRIGGER IF NOT EXISTS log_stage_transition
AFTER INSERT ON stage_transitions
BEGIN
  INSERT INTO activity_logs (
    action_type, 
    target_type, 
    target_id, 
    target_name, 
    user_name, 
    user_role,
    metadata
  )
  SELECT 
    'stage_' || NEW.status,
    'order',
    NEW.order_id,
    o.order_number,
    NEW.operator_name,
    'operator',
    json_object(
      'stage_id', NEW.stage_id,
      'stage_name', ps.name,
      'transition_id', NEW.id,
      'status', NEW.status
    )
  FROM orders o
  LEFT JOIN production_stages ps ON ps.id = NEW.stage_id
  WHERE o.id = NEW.order_id;
END;

-- 8. Функция для получения следующего этапа
-- (будет реализована в Worker API)

-- Проверка миграции
-- SELECT 
--   'Stages' as table_name, COUNT(*) as count FROM production_stages
-- UNION ALL
-- SELECT 'Transitions', COUNT(*) FROM stage_transitions
-- UNION ALL
-- SELECT 'Scans', COUNT(*) FROM stage_scans;
