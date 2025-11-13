-- v2.2 Enhancement: Automatic SKU Generation and Compact QR Codes

-- 1. Auto SKU Counter Table (для автоматической генерации артикулов)
CREATE TABLE IF NOT EXISTS auto_sku_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_value INTEGER NOT NULL DEFAULT 10000,
  prefix TEXT NOT NULL DEFAULT 'SKU',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (id = 1) -- Гарантируем только одну строку
);

-- Инициализация счётчика (если таблица пустая)
INSERT OR IGNORE INTO auto_sku_counter (id, current_value, prefix) 
VALUES (1, 10000, 'SKU');

-- 2. Обновление существующих товаров с пустыми SKU
-- Используем подзапрос с ROW_NUMBER для генерации последовательных номеров
WITH numbered_products AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM products
  WHERE sku IS NULL OR sku = '' OR sku = name
)
UPDATE products 
SET sku = 'SKU-' || printf('%05d', 10000 + (
  SELECT row_num - 1 FROM numbered_products WHERE numbered_products.id = products.id
))
WHERE id IN (SELECT id FROM numbered_products);

-- 3. Обновляем счётчик до максимального значения + 1
UPDATE auto_sku_counter 
SET current_value = (
  SELECT COALESCE(MAX(CAST(SUBSTR(sku, 5) AS INTEGER)), 9999) + 1
  FROM products 
  WHERE sku LIKE 'SKU-%'
  AND LENGTH(sku) = 9
  AND CAST(SUBSTR(sku, 5) AS INTEGER) > 0
),
updated_at = datetime('now')
WHERE id = 1;

-- 4. Обновляем QR-коды на компактные (только для авто-генерированных)
-- Меняем длинные AUTO-timestamp-uuid на компактные SKU-based
UPDATE products 
SET qr_code = sku,
    updated_at = datetime('now')
WHERE qr_code LIKE 'AUTO-%'
AND sku LIKE 'SKU-%';

-- 5. Создаём индекс для быстрого поиска по артикулу
CREATE INDEX IF NOT EXISTS idx_products_sku_lookup ON products(sku) WHERE sku IS NOT NULL;

-- 6. Создаём уникальный индекс для QR-кодов (гарантия уникальности)
DROP INDEX IF EXISTS idx_products_qr_code;
CREATE UNIQUE INDEX idx_products_qr_code_unique ON products(qr_code) WHERE qr_code IS NOT NULL;

-- 7. Добавляем таблицу для истории изменений артикулов (опционально)
CREATE TABLE IF NOT EXISTS sku_change_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  old_sku TEXT,
  new_sku TEXT NOT NULL,
  old_qr_code TEXT,
  new_qr_code TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  reason TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sku_change_history_product_id ON sku_change_history(product_id);
CREATE INDEX IF NOT EXISTS idx_sku_change_history_changed_at ON sku_change_history(changed_at DESC);

-- Проверка результатов миграции
-- SELECT 
--   COUNT(*) as total_products,
--   COUNT(CASE WHEN sku LIKE 'SKU-%' THEN 1 END) as auto_generated_sku,
--   COUNT(CASE WHEN qr_code = sku THEN 1 END) as compact_qr_codes,
--   (SELECT current_value FROM auto_sku_counter WHERE id = 1) as next_sku_number
-- FROM products;
