# Orders Workflow Design

## Implementation Status

✅ **COMPLETED** - All core features have been implemented and integrated.

### Implemented Features

- Excel import with production task parsing
- Order and order item data models with database schema
- Backend API endpoints for orders management
- Frontend Orders page with full workflow
- Quota-based printing enforcement
- Admin override functionality for extra prints
- Integration with shared label printer utilities

## Goals

- Import production task spreadsheets (Excel) and persist order line items with required quantities.
- Provide an "Orders" page where operators can see each item, track how many labels were printed, and print labels directly from the list.
- Enforce single-use (quota-based) printing per item; operators cannot print more labels than allowed without an admin override.
- Allow administrators to allocate additional print quantities when needed.

## Data Model

### orders

| Column     | Type        | Notes                                           |
| ---------- | ----------- | ----------------------------------------------- |
| id         | TEXT (UUID) | Primary key                                     |
| title      | TEXT        | Human-friendly name, e.g. production task title |
| source     | TEXT        | Optional metadata about the file/import         |
| status     | TEXT        | `active`, `archived`                            |
| created_at | DATETIME    | Default `CURRENT_TIMESTAMP`                     |
| updated_at | DATETIME    | Auto-updated                                    |

### order_items

| Column             | Type        | Notes                                     |
| ------------------ | ----------- | ----------------------------------------- |
| id                 | TEXT (UUID) | Primary key                               |
| order_id           | TEXT        | FK → orders(id)                           |
| name               | TEXT        | Raw item name from spreadsheet            |
| requested_quantity | INTEGER     | Quantity from spreadsheet                 |
| printed_quantity   | INTEGER     | How many labels have been printed         |
| extra_quantity     | INTEGER     | Additional labels approved by admin       |
| product_id         | TEXT        | Optional FK → products(id) for label data |
| last_printed_at    | DATETIME    | Audit trail                               |
| created_at         | DATETIME    | Default now                               |
| updated_at         | DATETIME    | Auto-updated                              |

Indexes:

- `orders(status)`
- `order_items(order_id)`
- unique constraint on `(order_id, name)` to avoid duplicates within one import.

## API Surface (Cloudflare Worker)

- `GET /api/orders` → list orders with summary (id, title, total items, total remaining, created_at).
- `GET /api/orders/:id` → order detail with items (including computed `remaining_quantity`).
- `POST /api/orders/import` → body: `{ title, sourceFileName?, items: [{ name, quantity }] }`. Creates a new order with items and zeroes printed counters.
- `PUT /api/orders/:orderId/items/:itemId` → update metadata (assign `product_id`).
- `POST /api/orders/:orderId/items/:itemId/print` → body `{ count?: number }`. Decrements allowance; fails with 409 if `count` exceeds remaining.
- `POST /api/orders/:orderId/items/:itemId/allow-extra` → body `{ amount }`, header `x-admin-key`. Increments `extra_quantity`.

Responses include updated item snapshots so the UI stays in sync. Worker uses `env.ADMIN_KEY` for admin validation (calls succeed automatically when the key is unset in development).

## UI / Frontend

### Orders Page Layout

✅ **IMPLEMENTED** in `src/pages/Orders.tsx`

- **Header**: page title, template selector (default template for prints), indicator of active order.
- **Import panel**:
  - Upload Excel (`.xlsx`) file.
  - Parse in-browser with `xlsx` library, detect the "Продукция" table (first section before "Материалы").
  - Preview parsed rows and confirm import → POST to `/api/orders/import`.
- **Orders sidebar/list**: cards with order title, created date, remaining totals. Clicking loads items.
- **Items table** columns:
  - Item name
  - Required quantity
  - Printed + Remaining
  - Extra approved (if any)
  - Product mapping (dropdown populated from `/api/products`; auto-select by exact name match if possible)
  - Print button (disabled when remaining = 0 or no `product_id`/template selected)
  - Admin override button ("Доп. печать") to add extra quota
  - Remaining counter updates immediately after successful print.

### Printing Flow

✅ **IMPLEMENTED** with full quota enforcement

1. Operator picks template (global select at page header).
2. Pressing "Печать" triggers `POST /api/orders/:orderId/items/:itemId/print` endpoint.
3. Backend validates quota and returns `{ allowed: true/false, message }`.
4. On success, the frontend calls `renderAndPrintLabel` (shared utility from `src/lib/labelPrinter.ts`) to open the print window.
5. After successful print, order data is refetched to update UI counters.
6. If backend returns quota exceeded, error message is displayed.

### Admin Override

✅ **IMPLEMENTED** with dialog UI

- "Доп. печать" button opens a dialog for adding extra prints.
- Dialog prompts for:
  - Quantity of additional prints to allow
  - Admin key (password field)
- Calls `POST /api/orders/:orderId/items/:itemId/allow-extra` with admin key in request body.
- On success, refetches order to show updated extra_quantity and remaining counts.
- Backend validates admin key against `ADMIN_KEY` environment variable.

## Excel Parsing Strategy

✅ **IMPLEMENTED** in `src/pages/Orders.tsx`

- Use `xlsx` library (already in dependencies).
- Read the first sheet.
- Locate header row containing `"Продукция"` and `"Общее Кол-во"` (case-insensitive, trimmed).
- Collect subsequent rows until encountering an empty row or a row starting with `"Материалы"`.
- Extract `{ name, quantity }`, skipping empty names or non-numeric quantities.
- If duplicate names occur, sum quantities before sending to backend.
- Auto-detect title from cells containing keywords like "производственно" or "задание".

## Testing Checklist

### Manual Testing Required

- [ ] Upload Excel file with production task
- [ ] Verify correct parsing and preview display
- [ ] Import order and verify database persistence
- [ ] Assign products to order items
- [ ] Print labels with quota enforcement (should succeed until quota exhausted)
- [ ] Attempt to print beyond quota (should fail with error message)
- [ ] Use admin override to add extra prints
- [ ] Verify admin key validation (wrong key should fail)
- [ ] Print using newly allocated extra quota
- [ ] Verify counters update correctly after each operation

### Integration Points to Verify

- Backend `/api/orders/*` endpoints respond correctly
- Database migrations applied (`migrations/002_orders_schema.sql`)
- Environment variable `ADMIN_KEY` set in `wrangler.toml`
- Shared `labelPrinter` utilities work correctly with orders data
- Worker routes handle orders alongside existing products/templates

## Assumptions & Open Questions

- Product names in the spreadsheet generally match existing entries; otherwise operators can assign manually.
- Printing is one label per click. If bulk printing is required later we can extend the payload with `count`.
- Authentication/authorization is simplified to an admin key header. Integrating with a full auth system remains future work.
- Orders are immutable after import; re-importing the same file creates a new order record. Cleanup/archival can be handled separately.

## Future Enhancements

- Batch printing (print N labels in a single job) once hardware integration is clarified.
- Notifications/logging for exhausted quotas.
- Excel parsing on the Worker to keep raw data off the client.
- Automatic product matching by SKU or other metadata.
