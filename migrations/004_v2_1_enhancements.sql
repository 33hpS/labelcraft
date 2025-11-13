-- v2.1 Enhancement: Template Versioning, Synchronization, and User Settings

-- 1. Template Versions Table (для истории версий)
CREATE TABLE IF NOT EXISTS template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  elements TEXT NOT NULL, -- JSON array of elements
  settings TEXT, -- JSON object with template settings
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT 'system',
  is_autosave INTEGER DEFAULT 0, -- 1 если это автосохранение
  change_summary TEXT, -- описание изменений vs previous version
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  UNIQUE(template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_created_at ON template_versions(created_at DESC);

-- 2. User Settings Table (сохранение пользовательских настроек)
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE, -- может быть session_id или user_id
  grid_size INTEGER DEFAULT 20, -- px
  snap_to_grid INTEGER DEFAULT 1, -- boolean as integer
  clipboard_history TEXT, -- JSON array
  clipboard_history_size INTEGER DEFAULT 5,
  max_history_entries INTEGER DEFAULT 500,
  auto_save_interval INTEGER DEFAULT 30000, -- ms
  auto_save_enabled INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'light', -- light, dark
  language TEXT DEFAULT 'ru',
  last_template_id TEXT,
  recent_templates TEXT, -- JSON array of template IDs
  ui_layout TEXT DEFAULT 'default', -- compact, default, extended
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 3. Template Sync State Table (для синхронизации между устройствами)
CREATE TABLE IF NOT EXISTS template_sync_state (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_synced_at TEXT,
  last_local_change_at TEXT,
  last_remote_change_at TEXT,
  sync_version INTEGER DEFAULT 0, -- версия синхронизации
  needs_sync INTEGER DEFAULT 0, -- 1 если нужна синхронизация
  conflict_detected INTEGER DEFAULT 0, -- 1 если обнаружен конфликт
  conflict_resolution TEXT DEFAULT 'latest', -- latest, manual, merge
  device_id TEXT, -- уникальный ID устройства
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  UNIQUE(template_id, user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_template_sync_state_template_id ON template_sync_state(template_id);
CREATE INDEX IF NOT EXISTS idx_template_sync_state_user_id ON template_sync_state(user_id);
CREATE INDEX IF NOT EXISTS idx_template_sync_state_needs_sync ON template_sync_state(needs_sync);

-- 4. Change Log Table (для отслеживания всех изменений)
CREATE TABLE IF NOT EXISTS change_log (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  change_type TEXT NOT NULL, -- 'element_added', 'element_modified', 'element_deleted', 'settings_changed', 'sync'
  affected_element_id TEXT,
  affected_element_name TEXT,
  old_value TEXT, -- JSON с предыдущим значением
  new_value TEXT, -- JSON с новым значением
  user_id TEXT,
  user_name TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  device_id TEXT,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_change_log_template_id ON change_log(template_id);
CREATE INDEX IF NOT EXISTS idx_change_log_timestamp ON change_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_version ON change_log(version_number DESC);

-- 5. Дополнительные колонки для таблицы templates
-- (если их еще нет, добавим при необходимости)
-- ALTER TABLE templates ADD COLUMN version INTEGER DEFAULT 1;
-- ALTER TABLE templates ADD COLUMN last_version_id TEXT;
-- ALTER TABLE templates ADD COLUMN sync_required INTEGER DEFAULT 0;
-- ALTER TABLE templates ADD COLUMN last_synced_at TEXT;

-- 6. Обновляем templates таблицу для поддержки версионирования
ALTER TABLE templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS current_version_id TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS auto_save_enabled INTEGER DEFAULT 1;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS last_auto_saved_at TEXT;

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_templates_version ON templates(version DESC);
CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON templates(updated_at DESC);
