# Production Workflow (Этапы производства)

Документ описывает реализованную модель производственного процесса и соответствующие API / правила.

## Таблицы

1. production_stages
   - id TEXT PK
   - name TEXT
   - workshop INTEGER NULL (1 / 2) или NULL для общих этапов
   - segment TEXT ('lux' | 'econom' | NULL)
   - sequence_order INTEGER (общая упорядоченность маршрута)
   - is_active INTEGER (1 активен)
   - color / icon декоративные
   - estimated_duration INTEGER (минуты, опционально)

2. stage_transitions
   - id TEXT PK
   - order_id TEXT (ссылка на orders)
   - stage_id TEXT (FK production_stages)
   - status ('started' | 'completed')
   - operator_name / operator_id
   - notes, duration_minutes, metadata JSON
   - scan_time TEXT

3. stage_scans (сырые события сканера)
   - id TEXT PK
   - transition_id TEXT FK
   - qr_code TEXT
   - scan_type ('start' | 'finish')
   - location, ip_address, scan_time

4. VIEW order_current_stage
   - order_id, order_qr, stage_id, stage_name, sequence_order, status, started_at, operator_name, elapsed_minutes

## Основные правила

- Последовательность: этапы запускаются строго по возрастанию sequence_order.
- Нельзя начать новый этап пока предыдущий активный (status='started') не завершён.
- Нельзя пропустить этап: для sequence_order > 1 требуется завершённый предыдущий этап.
- Двойное сканирование: первое сканирование stage_id -> status 'started', второе -> 'completed'.
- Роли:
  - Сканирование: operator, assembler, manager, admin.
  - Просмотр: все вышеперечисленные + warehouse (только чтение).
  - Warehouse не может сканировать.

## API

GET /api/production/stages
  Возвращает активные этапы.

POST /api/production/path { segment?, workshop? }
  Возвращает активные этапы с фильтром по segment/workshop (включая общие NULL) в порядке sequence_order.

POST /api/production/scan (headers: X-Role)
  Body: { qr_code, stage_id, operator_name, operator_id?, notes?, location? }
  Логика:
    1. Находит заказ по qr_code (order.qr_code или продукт -> последний активный заказ).
    2. Проверяет корректность последовательности.
    3. Запускает или завершает переход.
    4. Записывает запись в stage_scans.
    5. Возвращает обновлённый переход и stage.

GET /api/production/order/:id/history
  История всех переходов.

GET /api/production/order/:id/current
  Текущий активный этап + elapsed_minutes + overdue.

GET /api/production/dashboard
  Использует VIEW order_current_stage + агрегаты по этапам (in_progress, completed_today, avg_duration).

## Seed

Файл migrations/005_production_workflow.sql включает базовые общие этапы и сегментированные:
- Общие: Распил, Кромка, Сверление, ЧПУ, Зеркало.
- Lux: LED-цех, Коробки (резка), Шлифовка, Грунтовка, Малярка, Полировка, (Сборка - выключен), Упаковка.
- Econom: Шлифовка, Клей, (пусто - выключен), Вакуум-пресс, Сборка, Упаковка.

## Расширение

- Можно добавить estimated_duration для SLA и расчёта отклонений.
- Возможна интеграция с реальным трекером операторов (operator_id) через auth.
- Можно добавить таблицу production_alerts для оповещений о задержках.

## Безопасность

- Роль передаётся через заголовок X-Role (упрощено). В продакшене замените на JWT / session.
- Защита от внепорядковых запусков реализована в worker/index.js.

## Логирование

- Все сканы логируются в activity_logs с action_type='production_stage_scan'.
- duration_minutes пишется при завершении этапа.

## TODO

- Расчёт progress_percentage для order_current_stage (можно материализовать через отдельную view).
- Обновить фронтенд (ProductionDashboard) для использования новых данных.
