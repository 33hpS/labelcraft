# Инструкция по применению миграции этапов производства

## ⚠️ Важно

Миграцию `008_production_stages.sql` нужно применить вручную через Cloudflare Dashboard.

## 📝 Шаги применения

### Вариант 1: Через Cloudflare Dashboard

1. **Открыть D1 консоль:**
   - Перейти: https://dash.cloudflare.com/
   - Workers & Pages → D1
   - Выбрать базу: `productlabelerpro`

2. **Открыть Console (SQL редактор)**

3. **Скопировать и выполнить SQL из файла:**
   ```
   migrations/008_production_stages.sql
   ```

4. **Проверить результат:**
   ```sql
   SELECT COUNT(*) FROM production_stages;
   -- Должно быть 13 этапов
   
   SELECT COUNT(*) FROM stage_transitions;
   -- Должно быть 0 (пока нет переходов)
   ```

### Вариант 2: Через Wrangler CLI (после решения проблемы авторизации)

```bash
# 1. Повторный логин
npx wrangler login

# 2. Применить миграцию
npx wrangler d1 execute productlabelerpro --file=migrations/008_production_stages.sql --remote

# 3. Проверить
npx wrangler d1 execute productlabelerpro --remote --command="SELECT * FROM production_stages"
```

## ✅ Проверка успешного применения

После применения миграции выполните:

```sql
-- 1. Проверить этапы
SELECT id, name, sequence_order, department 
FROM production_stages 
ORDER BY sequence_order;

-- Должно вернуть 13 этапов:
-- stage-001: Приём заказа
-- stage-002: Закупка материалов
-- stage-003: Раскрой
-- ... и т.д.

-- 2. Проверить таблицы
SELECT name FROM sqlite_master 
WHERE type='table' 
  AND (name LIKE '%stage%' OR name LIKE '%transition%');

-- Должно вернуть:
-- production_stages
-- stage_transitions
-- stage_scans

-- 3. Проверить представление
SELECT * FROM order_current_stage LIMIT 1;
```

## 🚀 После применения миграции

### Тестирование API

**1. Получить этапы:**
```bash
curl https://labelcraft.sherhan1988hp.workers.dev/api/production/stages
```

**2. Тестовое сканирование (если есть заказы):**
```bash
curl -X POST https://labelcraft.sherhan1988hp.workers.dev/api/production/scan \
  -H "Content-Type: application/json" \
  -d '{
    "qr_code": "ORD-XXXXX",
    "stage_id": "stage-003",
    "operator_name": "Тестовый Оператор"
  }'
```

## 📚 Статус

- ✅ Worker задеплоен: `816dcb9a-7cf1-41b6-be8d-9fff41548c54`
- ✅ API готов: `/api/production/*`
- ⏳ Миграция: Нужно применить вручную
- ⏳ UI: В разработке

## 🔧 Troubleshooting

### Ошибка "Authentication error"
```bash
# Решение: Логин через браузер
npx wrangler login

# Или использовать API токен
export CLOUDFLARE_API_TOKEN="your-token"
npx wrangler d1 execute ...
```

### Ошибка "Table already exists"
```sql
-- Проверить существующие таблицы
SELECT name FROM sqlite_master WHERE type='table';

-- Если таблица уже есть, пропустить CREATE TABLE
-- и выполнить только INSERT данных
```

### Ошибка "Trigger already exists"
```sql
-- Удалить триггер если нужно
DROP TRIGGER IF EXISTS calculate_stage_duration;
DROP TRIGGER IF EXISTS log_stage_transition;

-- Создать заново
-- (скопировать из миграции)
```

## 📞 Поддержка

При возникновении проблем:
1. Проверить логи Cloudflare Dashboard
2. Проверить версию Worker: `816dcb9a-7cf1-41b6-be8d-9fff41548c54`
3. Убедиться что БД доступна: `productlabelerpro`
