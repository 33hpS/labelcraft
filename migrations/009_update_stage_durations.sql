-- 009_update_stage_durations.sql
-- Установка реальных длительностей этапов (в минутах) для производственного конвейера
-- Значения можно корректировать по опыту; эти — разумные стартовые SLA

-- Общие предэтапы
UPDATE production_stages SET estimated_duration = 60 WHERE id = 'st_001'; -- Распил
UPDATE production_stages SET estimated_duration = 45 WHERE id = 'st_002'; -- Кромка
UPDATE production_stages SET estimated_duration = 30 WHERE id = 'st_003'; -- Сверление
UPDATE production_stages SET estimated_duration = 40 WHERE id = 'st_004'; -- ЧПУ
UPDATE production_stages SET estimated_duration = 50 WHERE id = 'st_005'; -- Зеркало (кромка + резка)

-- Цех 1 / segment = 'lux'
UPDATE production_stages SET estimated_duration = 120 WHERE id = 'st_101'; -- LED-цех
UPDATE production_stages SET estimated_duration = 60  WHERE id = 'st_102'; -- Коробки (резка)
UPDATE production_stages SET estimated_duration = 60  WHERE id = 'st_103'; -- Шлифовка
UPDATE production_stages SET estimated_duration = 90  WHERE id = 'st_104'; -- Грунтовка
UPDATE production_stages SET estimated_duration = 180 WHERE id = 'st_105'; -- Малярка
UPDATE production_stages SET estimated_duration = 60  WHERE id = 'st_106'; -- Полировка
UPDATE production_stages SET estimated_duration = 90  WHERE id = 'st_107'; -- Сборка (неактивен, на будущее)
UPDATE production_stages SET estimated_duration = 30  WHERE id = 'st_108'; -- Упаковка

-- Цех 2 / segment = 'econom'
UPDATE production_stages SET estimated_duration = 45 WHERE id = 'st_201'; -- Шлифовка
UPDATE production_stages SET estimated_duration = 30 WHERE id = 'st_202'; -- Клей
-- st_203 пусто/неактивен, длительность не задаём
UPDATE production_stages SET estimated_duration = 60 WHERE id = 'st_204'; -- Вакуум-пресс
UPDATE production_stages SET estimated_duration = 60 WHERE id = 'st_205'; -- Сборка
UPDATE production_stages SET estimated_duration = 20 WHERE id = 'st_206'; -- Упаковка

-- Проверка: выбрать этапы без длительности (должен быть пустой набор)
-- SELECT id, name FROM production_stages WHERE is_active = 1 AND estimated_duration IS NULL;
