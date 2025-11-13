# 👥 Создание аккаунтов для Production модуля

**Дата:** 10 ноября 2025  
**Цель:** Создать учётные записи для всех ролей производственного процесса

---

## 📝 Список пользователей для создания

### 👔 Администраторы (admin)
```json
{
  "username": "admin",
  "password": "admin123",
  "role": "admin",
  "displayName": "Главный администратор"
}
```

### 👨‍💼 Менеджеры (manager)
```json
{
  "username": "manager1",
  "password": "pass123",
  "role": "manager",
  "displayName": "Менеджер 1"
},
{
  "username": "manager2",
  "password": "pass123",
  "role": "manager",
  "displayName": "Менеджер 2"
}
```

### 👷 Операторы (operator) - Для общих этапов
```json
{
  "username": "operator1",
  "password": "op123",
  "role": "operator",
  "displayName": "Оператор - Распил"
},
{
  "username": "operator2",
  "password": "op123",
  "role": "operator",
  "displayName": "Оператор - Кромка"
},
{
  "username": "operator3",
  "password": "op123",
  "role": "operator",
  "displayName": "Оператор - Сверление"
},
{
  "username": "operator4",
  "password": "op123",
  "role": "operator",
  "displayName": "Оператор - ЧПУ"
},
{
  "username": "operator5",
  "password": "op123",
  "role": "operator",
  "displayName": "Оператор - Зеркало"
}
```

### 🏭 Операторы Цех 1 / Люкс (operator)
```json
{
  "username": "lux_led",
  "password": "op123",
  "role": "operator",
  "displayName": "Люкс - LED-цех"
},
{
  "username": "lux_boxes",
  "password": "op123",
  "role": "operator",
  "displayName": "Люкс - Коробки"
},
{
  "username": "lux_grind",
  "password": "op123",
  "role": "operator",
  "displayName": "Люкс - Шлифовка"
},
{
  "username": "lux_primer",
  "password": "op123",
  "role": "operator",
  "displayName": "Люкс - Грунтовка"
},
{
  "username": "lux_paint",
  "password": "op123",
  "role": "operator",
  "displayName": "Люкс - Малярка"
},
{
  "username": "lux_polish",
  "password": "op123",
  "role": "operator",
  "displayName": "Люкс - Полировка"
},
{
  "username": "lux_pack",
  "password": "op123",
  "role": "operator",
  "displayName": "Люкс - Упаковка"
}
```

### 🏗️ Операторы Цех 2 / Эконом (operator)
```json
{
  "username": "eco_grind",
  "password": "op123",
  "role": "operator",
  "displayName": "Эконом - Шлифовка"
},
{
  "username": "eco_glue",
  "password": "op123",
  "role": "operator",
  "displayName": "Эконом - Клей"
},
{
  "username": "eco_vacuum",
  "password": "op123",
  "role": "operator",
  "displayName": "Эконом - Вакуум-пресс"
},
{
  "username": "eco_assembly",
  "password": "op123",
  "role": "operator",
  "displayName": "Эконом - Сборка"
},
{
  "username": "eco_pack",
  "password": "op123",
  "role": "operator",
  "displayName": "Эконом - Упаковка"
}
```

### 🔧 Сборщики (assembler)
```json
{
  "username": "assembler1",
  "password": "asm123",
  "role": "assembler",
  "displayName": "Сборщик 1"
},
{
  "username": "assembler2",
  "password": "asm123",
  "role": "assembler",
  "displayName": "Сборщик 2"
}
```

### 📦 Складские работники (warehouse)
```json
{
  "username": "warehouse1",
  "password": "wh123",
  "role": "warehouse",
  "displayName": "Кладовщик 1"
},
{
  "username": "warehouse2",
  "password": "wh123",
  "role": "warehouse",
  "displayName": "Кладовщик 2"
}
```

---

## 📋 Полный JSON массив для AUTH_USERS

```json
[
  {
    "username": "admin",
    "password": "admin123",
    "role": "admin",
    "displayName": "Главный администратор"
  },
  {
    "username": "manager1",
    "password": "pass123",
    "role": "manager",
    "displayName": "Менеджер 1"
  },
  {
    "username": "manager2",
    "password": "pass123",
    "role": "manager",
    "displayName": "Менеджер 2"
  },
  {
    "username": "operator1",
    "password": "op123",
    "role": "operator",
    "displayName": "Оператор - Распил"
  },
  {
    "username": "operator2",
    "password": "op123",
    "role": "operator",
    "displayName": "Оператор - Кромка"
  },
  {
    "username": "operator3",
    "password": "op123",
    "role": "operator",
    "displayName": "Оператор - Сверление"
  },
  {
    "username": "operator4",
    "password": "op123",
    "role": "operator",
    "displayName": "Оператор - ЧПУ"
  },
  {
    "username": "operator5",
    "password": "op123",
    "role": "operator",
    "displayName": "Оператор - Зеркало"
  },
  {
    "username": "lux_led",
    "password": "op123",
    "role": "operator",
    "displayName": "Люкс - LED-цех"
  },
  {
    "username": "lux_boxes",
    "password": "op123",
    "role": "operator",
    "displayName": "Люкс - Коробки"
  },
  {
    "username": "lux_grind",
    "password": "op123",
    "role": "operator",
    "displayName": "Люкс - Шлифовка"
  },
  {
    "username": "lux_primer",
    "password": "op123",
    "role": "operator",
    "displayName": "Люкс - Грунтовка"
  },
  {
    "username": "lux_paint",
    "password": "op123",
    "role": "operator",
    "displayName": "Люкс - Малярка"
  },
  {
    "username": "lux_polish",
    "password": "op123",
    "role": "operator",
    "displayName": "Люкс - Полировка"
  },
  {
    "username": "lux_pack",
    "password": "op123",
    "role": "operator",
    "displayName": "Люкс - Упаковка"
  },
  {
    "username": "eco_grind",
    "password": "op123",
    "role": "operator",
    "displayName": "Эконом - Шлифовка"
  },
  {
    "username": "eco_glue",
    "password": "op123",
    "role": "operator",
    "displayName": "Эконом - Клей"
  },
  {
    "username": "eco_vacuum",
    "password": "op123",
    "role": "operator",
    "displayName": "Эконом - Вакуум-пресс"
  },
  {
    "username": "eco_assembly",
    "password": "op123",
    "role": "operator",
    "displayName": "Эконом - Сборка"
  },
  {
    "username": "eco_pack",
    "password": "op123",
    "role": "operator",
    "displayName": "Эконом - Упаковка"
  },
  {
    "username": "assembler1",
    "password": "asm123",
    "role": "assembler",
    "displayName": "Сборщик 1"
  },
  {
    "username": "assembler2",
    "password": "asm123",
    "role": "assembler",
    "displayName": "Сборщик 2"
  },
  {
    "username": "warehouse1",
    "password": "wh123",
    "role": "warehouse",
    "displayName": "Кладовщик 1"
  },
  {
    "username": "warehouse2",
    "password": "wh123",
    "role": "warehouse",
    "displayName": "Кладовщик 2"
  }
]
```

---

## 🚀 Как применить

### Способ 1: Через Cloudflare Dashboard (Рекомендуется)

1. Перейти на https://dash.cloudflare.com
2. **Workers & Pages** → Выбрать **labelcraft**
3. **Settings** → **Variables**
4. Найти или создать переменную **AUTH_USERS**
5. Тип: **Secret** (для безопасности) или **Text**
6. Вставить JSON массив выше (весь, одной строкой или отформатированный)
7. **Save** → **Deploy**

### Способ 2: Через wrangler CLI

#### Создать файл .dev.vars (для локальной разработки):
```bash
AUTH_USERS='[{"username":"admin","password":"admin123","role":"admin","displayName":"Главный администратор"},...]'
```

#### Установить secret для production:
```bash
# Создать файл users.json с массивом
npx wrangler secret put AUTH_USERS < users.json

# Или через команду
echo '[...]' | npx wrangler secret put AUTH_USERS
```

### Способ 3: Минифицированная версия (одна строка)

Для удобства вставки в Dashboard:

```json
[{"username":"admin","password":"admin123","role":"admin","displayName":"Главный администратор"},{"username":"manager1","password":"pass123","role":"manager","displayName":"Менеджер 1"},{"username":"manager2","password":"pass123","role":"manager","displayName":"Менеджер 2"},{"username":"operator1","password":"op123","role":"operator","displayName":"Оператор - Распил"},{"username":"operator2","password":"op123","role":"operator","displayName":"Оператор - Кромка"},{"username":"operator3","password":"op123","role":"operator","displayName":"Оператор - Сверление"},{"username":"operator4","password":"op123","role":"operator","displayName":"Оператор - ЧПУ"},{"username":"operator5","password":"op123","role":"operator","displayName":"Оператор - Зеркало"},{"username":"lux_led","password":"op123","role":"operator","displayName":"Люкс - LED-цех"},{"username":"lux_boxes","password":"op123","role":"operator","displayName":"Люкс - Коробки"},{"username":"lux_grind","password":"op123","role":"operator","displayName":"Люкс - Шлифовка"},{"username":"lux_primer","password":"op123","role":"operator","displayName":"Люкс - Грунтовка"},{"username":"lux_paint","password":"op123","role":"operator","displayName":"Люкс - Малярка"},{"username":"lux_polish","password":"op123","role":"operator","displayName":"Люкс - Полировка"},{"username":"lux_pack","password":"op123","role":"operator","displayName":"Люкс - Упаковка"},{"username":"eco_grind","password":"op123","role":"operator","displayName":"Эконом - Шлифовка"},{"username":"eco_glue","password":"op123","role":"operator","displayName":"Эконом - Клей"},{"username":"eco_vacuum","password":"op123","role":"operator","displayName":"Эконом - Вакуум-пресс"},{"username":"eco_assembly","password":"op123","role":"operator","displayName":"Эконом - Сборка"},{"username":"eco_pack","password":"op123","role":"operator","displayName":"Эконом - Упаковка"},{"username":"assembler1","password":"asm123","role":"assembler","displayName":"Сборщик 1"},{"username":"assembler2","password":"asm123","role":"assembler","displayName":"Сборщик 2"},{"username":"warehouse1","password":"wh123","role":"warehouse","displayName":"Кладовщик 1"},{"username":"warehouse2","password":"wh123","role":"warehouse","displayName":"Кладовщик 2"}]
```

---

## 📊 Распределение пользователей

| Роль | Количество | Назначение |
|------|------------|------------|
| **admin** | 1 | Полный доступ ко всем функциям |
| **manager** | 2 | Управление производством, просмотр дашборда, закрытие алертов |
| **operator** | 17 | Сканирование QR-кодов на этапах (5 общих + 7 люкс + 5 эконом) |
| **assembler** | 2 | Сборка изделий |
| **warehouse** | 2 | Управление складом |
| **ИТОГО** | 24 | |

---

## 🔑 Учётные данные по умолчанию

### Для администраторов:
- **Username:** admin
- **Password:** admin123

### Для менеджеров:
- **Username:** manager1 / manager2
- **Password:** pass123

### Для операторов:
- **Username:** operator1-5, lux_*, eco_*
- **Password:** op123

### Для сборщиков:
- **Username:** assembler1-2
- **Password:** asm123

### Для склада:
- **Username:** warehouse1-2
- **Password:** wh123

⚠️ **ВАЖНО:** После применения в production рекомендуется сменить все пароли!

---

## ✅ Проверка работы

### 1. Тест логина администратора:
```bash
curl -X POST https://labelcraft.sherhan1988hp.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Ожидаемый ответ:
```json
{
  "token": "eyJhbGc...",
  "role": "admin",
  "exp": 1731267600
}
```

### 2. Тест логина оператора:
```bash
curl -X POST https://labelcraft.sherhan1988hp.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"lux_paint","password":"op123"}'
```

### 3. Тест логина менеджера:
```bash
curl -X POST https://labelcraft.sherhan1988hp.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager1","password":"pass123"}'
```

---

## 🔒 Безопасность

### Рекомендации для production:

1. **Смените пароли по умолчанию:**
   - admin123 → сложный пароль
   - pass123 → сложный пароль
   - op123 → уникальные пароли для каждого оператора

2. **Используйте Secret тип для AUTH_USERS:**
   - В Cloudflare Dashboard выбрать "Encrypt" при создании переменной
   - Secret переменные не отображаются в логах

3. **Настройте JWT TTL:**
   - Для операторов: 8 часов (рабочая смена)
   - Для менеджеров: 2 часа (по умолчанию)
   - Установить через переменную `JWT_TTL_SEC`

4. **Регулярный аудит:**
   - Проверяйте логи авторизации
   - Удаляйте неактивных пользователей
   - Обновляйте пароли раз в 3 месяца

5. **2FA (будущее):**
   - Добавить двухфакторную аутентификацию для admin/manager
   - Использовать TOTP (Google Authenticator)

---

## 📝 Дополнительные переменные окружения

Кроме AUTH_USERS, убедитесь что установлены:

```bash
# JWT секрет (обязательно!)
JWT_SECRET=your_super_secret_key_min_32_chars

# TTL токенов (опционально, по умолчанию 7200 сек = 2 часа)
JWT_TTL_SEC=7200

# Старые fallback ключи (можно удалить если используется AUTH_USERS)
# ADMIN_KEY=admin_secret
# OPERATOR_PIN=1234
# MANAGER_KEY=manager_secret
```

---

## 🧪 Тестовые сценарии

### Сценарий 1: Полный цикл работы оператора

1. **Логин оператора Распил:**
```bash
TOKEN=$(curl -s -X POST https://labelcraft.sherhan1988hp.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"operator1","password":"op123"}' | jq -r .token)
```

2. **Создать тестовый заказ (от имени менеджера):**
```bash
curl -X POST https://labelcraft.sherhan1988hp.workers.dev/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Role: manager" \
  -d '{"title":"Тест заказ","segment":"lux","workshop":1}'
```

3. **Сканировать начало этапа Распил:**
```bash
curl -X POST https://labelcraft.sherhan1988hp.workers.dev/api/production/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "qr_code": "ORD-XXX-START-st_001",
    "operator_name": "Оператор Распил"
  }'
```

### Сценарий 2: Менеджер закрывает алерт

1. **Логин менеджера:**
```bash
TOKEN=$(curl -s -X POST https://labelcraft.sherhan1988hp.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager1","password":"pass123"}' | jq -r .token)
```

2. **Посмотреть алерты:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://labelcraft.sherhan1988hp.workers.dev/api/production/alerts
```

3. **Закрыть алерт:**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://labelcraft.sherhan1988hp.workers.dev/api/production/alerts/ALERT_ID/close
```

---

## ✅ Чеклист

- [ ] Открыт Cloudflare Dashboard
- [ ] Выбран Worker **labelcraft**
- [ ] Перейдено в **Settings** → **Variables**
- [ ] Создана переменная **AUTH_USERS** (тип: Secret)
- [ ] Вставлен JSON массив с 24 пользователями
- [ ] Переменная сохранена
- [ ] Worker переразвернут (Deploy)
- [ ] Протестирован логин admin
- [ ] Протестирован логин manager1
- [ ] Протестирован логин operator1
- [ ] Протестирован логин lux_paint
- [ ] Все логины успешны ✅

---

**Статус:** ✅ **УСПЕШНО ПРИМЕНЕНО** (10.11.2025, 17:25)  
**Результат:** ✅ **24 ПОЛЬЗОВАТЕЛЯ ГОТОВЫ К РАБОТЕ**  
**Версия:** 1f2572ac-fc85-42cb-bd15-b28782becfde

📄 **Подробный отчёт:** См. `AUTH_USERS_REPORT.md`  
📋 **Быстрая справка:** См. `USERS_QUICK_REFERENCE.md`
