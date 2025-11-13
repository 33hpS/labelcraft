# Руководство по темам (Light/Dark)

Это краткий гайд по добавлению/поддержке тёмной темы в интерфейсе.

## Базовые принципы

- Включён режим `darkMode: ['class']` в Tailwind. Активная тема определяется классом `html.dark`.
- Цвета берутся из CSS-переменных в `shadcn.css`:
  - `--background`, `--foreground`, `--card`, `--accent`, `--muted`, `--border`, `--primary`, `--destructive`, и др.
  - Для dark эти переменные переопределяются внутри селектора `.dark { ... }`.
- Tailwind-алиасы к переменным уже настроены в `tailwind.config.js`:
  - Примеры: `bg-background`, `text-foreground`, `border-border`, `bg-accent`, `text-muted-foreground`, `bg-card`, `text-primary`.
  - Состояния/сигналы: `text-destructive`, `bg-destructive/10`, `focus-visible:ring-ring`.

## Как правильно красить UI

- Вместо «жёстких» цветов (`bg-white`, `text-gray-900`, `border-gray-200`) используйте токены:
  - Фон блока: `bg-card` (карточки) или `bg-background` (страница)
  - Текст: `text-foreground` или `text-muted-foreground`
  - Граница: `border-border`
  - Подсветка/hover: `bg-accent`
  - Акцентный текст/иконки: `text-primary`
  - Ошибки/предупреждения: `text-destructive`, `bg-destructive/10`
- Для состояний «активная ссылка» используйте комбинацию: `bg-primary/10 text-primary`.

## Где задаётся тема

- Провайдер: `src/context/ThemeContext.tsx` — управляет `light | dark | system`, хранит в localStorage, слушает системные настройки.
- Ранний скрипт: `index.html` — применяет класс `dark` до загрузки стилей, чтобы не было визуальной вспышки неправильной темы.
- Переключатель темы: в `Navigation` (иконки Sun/Moon), доступен на desktop и в мобильном меню.

## Легаси-классы: быстрый мост

Чтобы не переписывать весь UI сразу, добавлены точечные переопределения в `shadcn.css` для часто встречающихся классов (`text-gray-*`, `bg-white`, `bg-gray-*`, `border-gray-*`, `bg-blue-100`, `text-blue-700` и т.п.). Это делает существующие экраны читаемыми в dark.

Рекомендуется постепенно переводить компоненты на токены (`bg-background`, `text-foreground` и т.д.) — это упростит поддержку тем и улучшит консистентность.

Пример миграции (фрагмент из Scanner):

```
- <div className="p-4 bg-red-50 border border-red-200 rounded-lg">...
+ <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">...

- <p className="text-gray-600">Подсказка</p>
+ <p className="text-muted-foreground">Подсказка</p>

- <div className="bg-gray-50 border-gray-300">...
+ <div className="bg-muted border-border">...
```

## Шаблон компонента

```tsx
export function Panel({ title, children }) {
  return (
    <section className="bg-card text-foreground border border-border rounded-lg p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-sm text-muted-foreground mt-1">Описание</div>
      <div className="mt-4">{children}</div>
    </section>
  )
}
```

## Частые паттерны

- Контейнер страницы: `min-h-screen bg-background text-foreground`.
- Нейтральная панель: `bg-card border border-border rounded-xl`.
- Активный пункт: `bg-primary/10 text-primary`.
- Hover: `hover:bg-accent hover:text-foreground`.

Обновление статуса: экраны Orders, Templates, Products, Operator, Warehouse и Scanner переведены на дизайн‑токены и полностью поддерживают тёмную тему. Дополнительно токенизированы QRScanner и общий фон (`AppLayout`). Также переведены: Navigation, Home, Login, InfoWidget, Admin Users, LanguageSwitcher и ErrorBoundary.

## Локализация

- Подсказки переключателя темы: ключи `common.light`, `common.dark`, `common.system` в `src/i18n/locales/*.json`.

---

Вопросы/предложения по теме — добавляйте в issue или пишите в чат разработки.