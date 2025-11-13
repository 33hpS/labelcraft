# 🔒 Безопасность — LabelCraft

## Обзор

LabelCraft реализует многоуровневую защиту от хакерских атак, DDoS, SQL инъекций, XSS и других угроз.

---

## 🛡️ Уровни защиты

### 1. **Инфраструктурная защита (Cloudflare)**

✅ **DDoS Protection** — встроенная защита Cloudflare от распределённых атак  
✅ **WAF (Web Application Firewall)** — фильтрация вредоносного трафика  
✅ **TLS/HTTPS** — все соединения зашифрованы (SSL сертификат автоматически)  
✅ **CDN Edge Network** — защита на уровне пограничных серверов

---

### 2. **Rate Limiting (Защита от брутфорса)**

📍 **Расположение:** `worker/security.js` → `checkRateLimit()`

**Лимиты:**
- **Global:** 100 запросов/минуту на IP
- **Auth:** 10 попыток авторизации/минуту
- **API:** 200 запросов/минуту
- **Upload:** 20 загрузок/минуту

**Как работает:**
```javascript
// Пример проверки лимита
if (!checkRateLimit(clientIP, 'auth')) {
  return Response(429, 'Too Many Requests');
}
```

**Превышение лимита:**
- HTTP 429 (Too Many Requests)
- Retry-After: 60 секунд
- Автоматическая очистка истории каждые 5 минут

---

### 3. **Content Security Policy (CSP)**

📍 **Расположение:** `worker/security.js` → `addSecurityHeaders()`

**Политики:**
- ✅ `default-src 'self'` — загрузка только с нашего домена
- ✅ `script-src 'self' 'unsafe-inline'` — разрешены только наши скрипты (React требует unsafe-inline)
- ✅ `style-src 'self' 'unsafe-inline'` — стили только с домена
- ✅ `img-src 'self' data: blob: https:` — изображения с домена + data URI
- ✅ `connect-src 'self' https://api.moysklad.ru` — API запросы только к доверенным
- ✅ `frame-ancestors 'none'` — защита от clickjacking
- ✅ `base-uri 'self'` — защита от base tag injection

**Дополнительные заголовки:**
- `X-Frame-Options: DENY` — запрет встраивания в iframe
- `X-Content-Type-Options: nosniff` — запрет MIME sniffing
- `X-XSS-Protection: 1; mode=block` — браузерная защита от XSS
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

---

### 4. **Валидация и санитизация входных данных**

📍 **Расположение:** `worker/security.js` → `validateObject()`, `sanitizeInput()`

**Опасные паттерны (блокируются):**
```javascript
const DANGEROUS_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/i,
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick=, onerror=, etc.
  /<!--.*?-->/g,
  /\.\.\//g, // Path traversal
];
```

**Санитизация:**
- Удаление HTML тегов
- Экранирование спецсимволов (`<`, `>`, `"`, `'`, `&`)
- Рекурсивная валидация объектов (до 10 уровней вложенности)

**Применение:**
- Автоматически на всех POST/PUT/PATCH запросах
- Перед сохранением в БД
- HTTP 400 если обнаружен опасный контент

---

### 5. **SQL Injection Protection**

✅ **Prepared Statements** — все запросы к D1 используют параметризованные запросы

**Пример безопасного кода:**
```javascript
// ✅ БЕЗОПАСНО
await DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first();

// ❌ ОПАСНО (НЕ ИСПОЛЬЗУЕТСЯ)
await DB.prepare(`SELECT * FROM products WHERE id = ${productId}`).first();
```

✅ Все SQL запросы в `worker/index.js` параметризованы  
✅ Дополнительная валидация через `containsDangerousContent()`

---

### 6. **XSS (Cross-Site Scripting) Protection**

**Многоуровневая защита:**

1. **React автоматическое экранирование**
   - React автоматически экранирует все переменные в JSX
   - dangerouslySetInnerHTML не используется

2. **Content Security Policy**
   - Блокировка inline scripts (кроме разрешённых React)
   - Только доверенные источники

3. **Санитизация HTML**
   - `sanitizeInput()` удаляет все теги
   - Экранирование спецсимволов

---

### 7. **Защита данных в транзите и покое**

✅ **HTTPS/TLS 1.3** — все данные зашифрованы при передаче  
✅ **Cloudflare R2** — безопасное хранилище файлов  
✅ **D1 SQLite** — изолированная база данных  
✅ **Проверка целостности** — SHA-256 хеши для критичных данных

**Функции:**
```javascript
// Генерация хеша
const hash = await generateHash(data);

// Проверка целостности
const isValid = await verifyIntegrity(data, expectedHash);
```

---

### 8. **Безопасная обработка ошибок**

📍 **Расположение:** `worker/security.js` → `sanitizeError()`

**Production режим:**
- ❌ Никакие стеки ошибок не отправляются клиенту
- ✅ Только безопасные сообщения (`"Произошла ошибка"`)
- ✅ Детали логируются в Sentry

**Development режим:**
- ✅ Полные стеки для отладки

**Пример:**
```javascript
try {
  // код
} catch (error) {
  const safe = sanitizeError(error, isDev);
  return Response(500, safe); // Клиент не видит внутренние детали
}
```

---

### 9. **Аутентификация и авторизация**

📍 **Расположение:** `src/lib/auth.ts`, `src/context/AuthContext.tsx`

✅ **JWT токены** — сессии пользователя  
✅ **RBAC (Role-Based Access Control)** — роли: admin, operator, warehouse  
✅ **Пароли** — хешированы (bcrypt/argon2)  
✅ **Admin Key** — дополнительный ключ для критичных операций

**Защищённые endpoints:**
- `/api/orders/:id` — удаление требует `X-Admin-Key`
- `/api/products` — CRUD только для авторизованных
- `/api/templates` — доступ по ролям

---

### 10. **Резервное копирование (Бэкапы)**

📍 **Скрипт:** `scripts/backup-d1.mjs`  
📍 **GitHub Actions:** `.github/workflows/backup.yml`

**Автоматические бэкапы:**
- ⏰ Каждый день в 3:00 UTC (6:00 по Бишкеку)
- 📦 Полный SQL dump всех таблиц
- 💾 Хранение 30 дней
- ☁️ Загрузка в GitHub Artifacts

**Ручной бэкап:**
```bash
npm run db:backup
```

**Восстановление:**
```bash
npm run db:restore backups/backup-2025-10-28.sql
```

**Структура бэкапа:**
```sql
-- Cloudflare D1 Database Backup
-- Date: 2025-10-28T03:00:00.000Z

DELETE FROM products;
INSERT INTO products (id, name, sku, ...) VALUES (...);

DELETE FROM templates;
INSERT INTO templates (id, name, ...) VALUES (...);
```

---

## 🚨 Мониторинг и алерты

### Sentry (Error Tracking)

📍 **Интеграция:** `src/lib/sentry.ts`, `src/components/ErrorBoundary.tsx`

✅ **Production только** — автоматическая инициализация  
✅ **Performance tracing** — мониторинг производительности  
✅ **Session Replay** — воспроизведение сессий с ошибками  
✅ **Breadcrumbs** — события до ошибки

**DSN:** устанавливается через `VITE_SENTRY_DSN`

**Что отслеживается:**
- JavaScript исключения
- React компонент ошибки (ErrorBoundary)
- API ошибки (через interceptors)
- Производительность (Core Web Vitals)

---

## 📋 Checklist безопасности

### Infrastructure
- [x] HTTPS/TLS enabled (Cloudflare автоматически)
- [x] DDoS protection (Cloudflare встроено)
- [x] CDN edge caching
- [x] WAF rules (Cloudflare)

### Application
- [x] Rate limiting (100/min global, 10/min auth)
- [x] Input validation (SQL, XSS patterns)
- [x] Output sanitization
- [x] CSP headers
- [x] Security headers (X-Frame-Options, HSTS, etc.)
- [x] Prepared statements (SQL injection protection)
- [x] Error sanitization (no stack traces in prod)

### Data
- [x] HTTPS for all connections
- [x] Encrypted storage (R2, D1)
- [x] Data integrity checks (SHA-256)
- [x] Automated backups (daily)
- [x] Backup retention (30 days)

### Monitoring
- [x] Sentry error tracking
- [x] Activity logs (audit trail)
- [x] Performance monitoring

### Authentication
- [x] Password hashing
- [x] JWT tokens
- [x] RBAC (role-based access)
- [x] Admin key for sensitive operations

---

## 🔧 Как использовать

### Включить защиту в Worker

Защита **автоматически включена** через middleware в `worker/index.js`:

```javascript
import { securityMiddleware } from './security.js';

export default {
  async fetch(request, env) {
    return securityMiddleware(request, async (req) => {
      // ваш код здесь
    }, {
      enableRateLimit: true,
      enableValidation: true,
      enableSecurityHeaders: true,
      isDev: env.ENVIRONMENT === 'development'
    });
  }
}
```

### Ручной запуск бэкапа

```bash
# Создать бэкап
npm run db:backup

# Восстановить из файла
npm run db:restore backups/backup-2025-10-28T03-00-00-000Z.sql
```

### Настройка GitHub Actions

1. Добавьте secrets в GitHub:
   - `CLOUDFLARE_API_TOKEN` — API токен с правами Workers/D1
   - `CLOUDFLARE_ACCOUNT_ID` — ID аккаунта Cloudflare

2. Workflow запускается автоматически каждый день в 3:00 UTC

3. Ручной запуск: Actions → Daily Database Backup → Run workflow

---

## 🆘 Что делать при атаке

### DDoS атака обнаружена

1. **Cloudflare автоматически блокирует** большинство DDoS
2. Проверить Cloudflare Analytics → Security
3. Включить "I'm Under Attack Mode" (временно):
   - Cloudflare Dashboard → Security → Settings → Security Level → I'm Under Attack

### Подозрительная активность

1. Проверить Activity Logs: `/api/activity-logs`
2. Найти подозрительный IP
3. Добавить IP в Cloudflare WAF Firewall Rules

### Утечка данных

1. **Немедленно** сменить все API ключи:
   - `ADMIN_KEY` в Cloudflare Workers → Settings → Variables
   - `CLOUDFLARE_API_TOKEN`
   - Database credentials

2. Восстановить из последнего чистого бэкапа

3. Проверить Sentry на наличие логов атаки

---

## 📞 Контакты

**Security Issues:** Отправляйте на sherhan1988hp@gmail.com  
**Sentry Dashboard:** https://sentry.io/organizations/ваш-org/  
**Cloudflare Dashboard:** https://dash.cloudflare.com/

---

## 🔗 Связанные документы

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Инструкции по деплою
- [docs/operator-guide.md](./docs/operator-guide.md) — Руководство оператора
- [docs/FULL_AUDIT_2025-10-16.md](./docs/FULL_AUDIT_2025-10-16.md) — Полный аудит системы

---

**Дата последнего обновления:** 28 октября 2025  
**Версия:** 2.1 (Production-Ready)
