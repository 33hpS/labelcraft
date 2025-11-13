# Подключение к Cloudflare D1 Database

## ✅ База данных успешно подключена!

**Database ID**: `6bcefdbd-4109-4545-b521-d42694b7144c`  
**Database Name**: `productlabelerpro`  
**Worker URL**: https://productlabelerpro-worker.sherhan1988hp.workers.dev

---

## 📊 Текущее состояние

- ✅ **База данных пустая** - готова к использованию
- ✅ Все миграции применены успешно
- ✅ Схема полностью настроена

---

## 🔧 Управление базой данных

### Просмотр схемы базы данных

```powershell
# Подключиться к базе данных
npx wrangler d1 execute productlabelerpro --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### Просмотр данных

```powershell
# Посмотреть все товары
npx wrangler d1 execute productlabelerpro --remote --command "SELECT * FROM products"

# Посмотреть все шаблоны
npx wrangler d1 execute productlabelerpro --remote --command "SELECT * FROM templates"

# Посмотреть все заказы
npx wrangler d1 execute productlabelerpro --remote --command "SELECT * FROM orders"
```

### Применение миграций

```powershell
# Применить миграцию из файла
npx wrangler d1 execute productlabelerpro --remote --file=migrations/001_initial_schema.sql
```

### Очистка данных

```powershell
# Удалить все товары
npx wrangler d1 execute productlabelerpro --remote --command "DELETE FROM products"

# Удалить все заказы
npx wrangler d1 execute productlabelerpro --remote --command "DELETE FROM orders"
```

---

## 📦 Структура таблиц

### `products` - Товары

- `id` - UUID товара
- `name` - Название товара
- `sku` - Артикул (SKU)
- `weight` - Вес (кг)
- `volume` - Объём (л)
- `barcode` - Штрихкод
- `qr_code` - QR-код (уникальный)
- `metadata` - Дополнительная информация (JSON)

### `templates` - Шаблоны этикеток

- `id` - UUID шаблона
- `name` - Название шаблона
- `description` - Описание
- `settings` - Настройки страницы (JSON)
- `elements` - Элементы шаблона (JSON)
- `status` - Статус (draft/active)

### `orders` - Заказы

- `id` - UUID заказа
- `title` - Название заказа
- `source` - Источник (МойСклад и т.д.)
- `status` - Статус (active/completed)

### `order_items` - Позиции заказа

- `id` - UUID позиции
- `order_id` - ID заказа
- `name` - Название товара
- `requested_quantity` - Запрошено этикеток
- `printed_quantity` - Напечатано этикеток
- `extra_quantity` - Дополнительных этикеток разрешено
- `product_id` - Связь с товаром

### `template_versions` - Версии шаблонов (v2.1)

- История изменений шаблонов
- Автосохранение и версионирование

### `user_settings` - Настройки пользователя (v2.1)

- Персональные настройки интерфейса
- Сетка, тема, язык

### `activity_logs` - Лог активности

- История всех действий в системе

---

## 🌐 API Endpoints

Все эндпоинты доступны по адресу: `https://productlabelerpro-worker.sherhan1988hp.workers.dev/api/`

### Товары

- `GET /api/products` - Список всех товаров
- `GET /api/products/:id` - Получить товар
- `POST /api/products` - Создать товар
- `PUT /api/products/:id` - Обновить товар
- `DELETE /api/products/:id` - Удалить товар

### Шаблоны

- `GET /api/templates` - Список всех шаблонов
- `GET /api/templates/:id` - Получить шаблон
- `POST /api/templates` - Создать шаблон
- `PUT /api/templates/:id` - Обновить шаблон
- `DELETE /api/templates/:id` - Удалить шаблон

### Заказы

- `GET /api/orders` - Список всех заказов
- `GET /api/orders/:id` - Получить заказ с позициями
- `POST /api/orders/import` - Импортировать заказ
- `POST /api/orders/:orderId/items/:itemId/print` - Печать этикетки

### Статистика

- `GET /api/stats` - Общая статистика системы
- `GET /api/activity-logs?limit=10` - Лог активности

### МойСклад интеграция

- `POST /api/moysklad/test` - Проверить подключение
- `POST /api/moysklad/sync` - Синхронизировать заказы

---

## 🔗 Полезные ссылки

- [Cloudflare D1 Dashboard](https://dash.cloudflare.com/704015f3ab3baf13d815b254aee29972/workers/d1/databases/6bcefdbd-4109-4545-b521-d42694b7144c)
- [Worker Dashboard](https://dash.cloudflare.com/704015f3ab3baf13d815b254aee29972/workers/productlabelerpro-worker)
- [R2 Bucket](https://dash.cloudflare.com/704015f3ab3baf13d815b254aee29972/r2/buckets/productlabelerpro)

---

## 📝 Примечания

1. **Локальная разработка**: Используйте `.dev.vars` файл для локальных переменных окружения
2. **Production**: Все секреты настраиваются в Cloudflare Dashboard → Workers → Settings → Variables
3. **Миграции**: Все файлы миграций находятся в папке `migrations/`
4. **Backup**: D1 автоматически создаёт бэкапы, доступ через Dashboard

---

**Последнее обновление**: 22 октября 2025  
**Worker Version**: `3418c3af-5c9b-4796-a453-1a07baf0f5d5`
