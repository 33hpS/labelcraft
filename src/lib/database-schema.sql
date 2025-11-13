/**
 * Схема базы данных D1 для ProductLabelerPro
 * Выполнить в Cloudflare D1 Database
 */

-- Таблица шаблонов
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  settings TEXT NOT NULL, -- JSON с настройками шаблона
  elements TEXT NOT NULL, -- JSON с элементами шаблона
  status TEXT DEFAULT 'draft', -- draft, active, archived
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица элементов шаблонов
CREATE TABLE IF NOT EXISTS template_elements (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  type TEXT NOT NULL, -- text, qrcode, image, rectangle, barcode
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  content TEXT,
  style TEXT, -- JSON со стилями
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- Таблица настроек принтера
CREATE TABLE IF NOT EXISTS printer_settings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- thermal, laser, inkjet
  connection_type TEXT NOT NULL, -- usb, network, bluetooth
  settings TEXT NOT NULL, -- JSON с настройками принтера
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица истории печати
CREATE TABLE IF NOT EXISTS print_history (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  printer_id TEXT,
  copies INTEGER DEFAULT 1,
  status TEXT DEFAULT 'completed', -- queued, printing, completed, failed
  printed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id),
  FOREIGN KEY (printer_id) REFERENCES printer_settings(id)
);

-- Таблица AI генераций
CREATE TABLE IF NOT EXISTS ai_generations (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  type TEXT NOT NULL, -- text, layout, optimization
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_created ON templates(created_at);
CREATE INDEX IF NOT EXISTS idx_elements_template ON template_elements(template_id);
CREATE INDEX IF NOT EXISTS idx_print_history_date ON print_history(printed_at);

-- Таблица заказов (импорт из Excel)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Позиции заказа с квотами на печать
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  name TEXT NOT NULL,
  requested_quantity INTEGER NOT NULL,
  printed_quantity INTEGER NOT NULL DEFAULT 0,
  extra_quantity INTEGER NOT NULL DEFAULT 0,
  product_id TEXT,
  last_printed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT uniq_order_item UNIQUE(order_id, name)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
