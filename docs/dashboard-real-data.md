# Система статистики и логирования активности

**Дата:** 15 октября 2025  
**Версия:** 0ce519a3-9eff-45b2-b910-511a1ee53d04

## Обзор изменений

Заменены все моки на дашборде реальными данными из базы данных. Добавлена полноценная система статистики и логирования активности пользователей.

## Новые компоненты

### 1. База данных

**Миграция:** `migrations/003_activity_logs.sql`

Создана таблица `activity_logs` для хранения всех операций в системе:

```sql
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,        -- Тип операции
  target_type TEXT NOT NULL,        -- Тип объекта (product, template, order)
  target_id TEXT,                   -- ID объекта
  target_name TEXT,                 -- Название для отображения
  user_name TEXT DEFAULT 'Система', -- Имя пользователя
  user_role TEXT,                   -- Роль (admin, operator, system)
  metadata TEXT,                    -- JSON с дополнительными данными
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT
);
```

**Индексы:**

- `idx_activity_logs_created_at` - для быстрой сортировки по дате
- `idx_activity_logs_action_type` - для фильтрации по типу операции
- `idx_activity_logs_target` - для поиска по объекту

### 2. API Endpoints

#### GET /api/stats

Возвращает агрегированную статистику:

```json
{
  "products": 156,
  "templates": 8,
  "orders": 42,
  "todayActivity": 15
}
```

#### GET /api/activity-logs?limit=10

Возвращает последние операции:

```json
{
  "logs": [
    {
      "action_type": "label_printed",
      "target_type": "order_item",
      "target_id": "uuid",
      "target_name": "Товар ABC",
      "user_name": "Оператор",
      "user_role": "operator",
      "metadata": "{\"count\":3,\"order_id\":\"...\"}",
      "created_at": "2025-10-15T12:30:00Z"
    }
  ]
}
```

### 3. Frontend хуки

**Файл:** `src/hooks/useStats.ts`

#### `useStats()`

Загружает статистику с сервера:

```typescript
const { stats, loading, error } = useStats();
// stats: { products, templates, orders, todayActivity }
```

#### `useActivityLogs(limit: number)`

Загружает логи активности:

```typescript
const { logs, loading, error } = useActivityLogs(5);
// logs: ActivityLog[]
```

### 4. Обновленный дашборд

**Файл:** `src/pages/Home.tsx`

Изменения:

- ✅ Статистика загружается из `/api/stats`
- ✅ "Последние операции" загружаются из `/api/activity-logs`
- ✅ Индикатор загрузки (Loader2)
- ✅ Форматирование времени ("5 мин назад", "2 ч назад")
- ✅ Перевод action_type на русский язык
- ❌ Удалены все захардкоженные моки

## Логируемые операции

### Товары (Products)

- `product_created` - создание товара
- `product_updated` - обновление товара
- `product_deleted` - удаление товара

### Шаблоны (Templates)

- `template_created` - создание шаблона
- `template_updated` - обновление шаблона
- `template_deleted` - удаление шаблона

### Заказы (Orders)

- `order_imported` - импорт заказа (с метаданными: items_count, source)
- `label_printed` - печать этикетки (с метаданными: count, order_id)

## Технические детали

### Функция логирования

В `worker/index.js` добавлена вспомогательная функция:

```javascript
async function logActivity(
  DB,
  actionType,
  targetType,
  targetId,
  targetName,
  userName,
  userRole,
  metadata
) {
  // Записывает операцию в activity_logs
  // Не бросает ошибки при сбое - logging failures shouldn't break the main operation
}
```

### Примеры использования

**После создания товара:**

```javascript
await logActivity(
  DB,
  "product_created",
  "product",
  id,
  data.name,
  "Админ",
  "admin"
);
```

**После печати этикетки:**

```javascript
await logActivity(
  DB,
  "label_printed",
  "order_item",
  itemId,
  item.name,
  "Оператор",
  "operator",
  {
    count: count,
    order_id: orderId,
  }
);
```

## Развертывание

1. **Локальная миграция:**

   ```bash
   npx wrangler d1 execute productlabelerpro --local --file=migrations/003_activity_logs.sql
   ```

2. **Продакшн миграция:**

   ```bash
   npx wrangler d1 execute productlabelerpro --remote --file=migrations/003_activity_logs.sql
   ```

3. **Деплой:**
   ```bash
   npm run build
   npx wrangler deploy
   ```

## Что было удалено

- ❌ Моки статистики в `Home.tsx`:

  ```typescript
  // УДАЛЕНО
  const stats = [
    { label: 'Всего товаров', value: '156', ... },
    // ...
  ];
  ```

- ❌ Моки последних операций:
  ```typescript
  // УДАЛЕНО
  { action: 'Печать этикетки', target: 'Товар "Пример 1"', ... }
  ```

## Производительность

- Статистика кешируется на клиенте (useEffect без dependencies)
- Логи ограничены параметром `limit` (по умолчанию 10)
- Индексы БД обеспечивают быстрые запросы
- Логирование асинхронное и не блокирует основные операции

## Будущие улучшения

- [ ] Добавить фильтрацию логов по типу операции
- [ ] Пагинация для истории активности
- [ ] График активности по дням/неделям
- [ ] Экспорт логов в CSV
- [ ] Настройка автоочистки старых логов

## Версия деплоя

**Version ID:** `0ce519a3-9eff-45b2-b910-511a1ee53d04`  
**URL:** https://productlabelerpro-worker.sherhan1988hp.workers.dev
**Дата:** 15 октября 2025
