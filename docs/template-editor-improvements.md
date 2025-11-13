# Улучшения редактора шаблонов (14.10.2025)

## Новые возможности

### 1. Плавный drag & drop (zero-lag)

- Используется `CSS transform` вместо постоянных setState
- Мгновенный отклик даже при большом количестве элементов
- Сохранение положения только при отпускании мыши

### 2. Направляющие (Alignment Guides)

- Авто-появление вертикальных и горизонтальных линий при приближении к:
  - Границам холста (лево/центр/право, верх/центр/низ)
  - Краям и центрам других элементов
- Порог прилипания: 2 мм (можно изменить `SNAP_THRESHOLD`)

### 3. Сетка и привязка к сетке (Grid + Snap to Grid)

- Переключатели: "Сетка", "Snap", "Гайды" над предпросмотром
- Шаг сетки: 1 мм (`GRID_SIZE`)
- Можно отключать независимо

### 4. Улучшенный resize

- Плавное изменение размеров через прямые CSS изменения (без лагов)
- Увеличенные маркеры (легче хватать)
- Hover эффекты и тень

### 5. История действий (Undo/Redo)

- Горячие клавиши: `Ctrl+Z`, `Ctrl+Y` или `Ctrl+Shift+Z`
- Хранится до 50 шагов (ограничение в коде)
- История создаётся при каждом стабильном изменении `elements`

### 6. Точные перемещения клавиатурой

- Стрелки ← ↑ → ↓: перемещение на 1 мм
- Shift+Стрелки: перемещение на 5 мм
- Delete: удалить элемент
- Esc: снять выделение
- Ctrl+D: дублировать элемент

### 7. Визуальные улучшения

- Тень у активного элемента
- Подсветка + ring при drag
- `will-change: transform` для оптимизации
- Бейджи с привязкой данных

## Ключевые участки кода

Файл: `src/components/TemplateEditor.tsx`

### Состояния навигационных улучшений

```ts
const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({
  x: [],
  y: [],
});
const [showGuides, setShowGuides] = useState(true);
const [showGrid, setShowGrid] = useState(true);
const [snapToGrid, setSnapToGrid] = useState(true);
const GRID_SIZE = 1;
const SNAP_THRESHOLD = 2;
```

### Drag & Drop ядро

```ts
const handleMouseMove = (...) => {
  // deltaX/deltaY -> newX/newY
  if (snapToGrid) { newX = Math.round(newX / GRID_SIZE) * GRID_SIZE; }
  // сбор snapPoints от других элементов + холста
  // проверка прилипания краёв и центра
  draggedDomEl.style.transform = `translate(${deltaX * scale}mm, ${deltaY * scale}mm)`;
};
```

### Применение итоговой позиции

```ts
const handleMouseUp = () => {
  setElements((prev) =>
    prev.map((el) =>
      el.id === dragged ? { ...el, x: el.x + deltaX, y: el.y + deltaY } : el
    )
  );
  // сброс transform
};
```

### История действий

```ts
useEffect(() => {
  if (JSON.stringify(elements) !== JSON.stringify(history[historyIndex])) {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(elements)));
    if (newHistory.length > 50) newHistory.shift();
    else setHistoryIndex(historyIndex + 1);
    setHistory(newHistory);
  }
}, [elements]);
```

## Как менять параметры

| Параметр         | Значение | Назначение             |
| ---------------- | -------- | ---------------------- |
| `GRID_SIZE`      | 1        | Шаг сетки (мм)         |
| `SNAP_THRESHOLD` | 2        | Радиус прилипания (мм) |
| `history` limit  | 50       | Глубина undo/redo      |

## Возможные будущие улучшения

- Масштабирование холста (zoom 0.5x–4x)
- Группировка элементов (multi-select + shift)
- Привязка к базовым направляющим (отступы, поля)
- Автоматическое выравнивание распределением (equal spacing)
- Экспорт/импорт шаблона в файл JSON через UI

## Troubleshooting

| Проблема                       | Причина                          | Решение                  |
| ------------------------------ | -------------------------------- | ------------------------ |
| Элемент "дёргается" при drag   | Слишком маленький SNAP_THRESHOLD | Увеличить до 3–4         |
| Гайды мешают                   | Включены привязки                | Отключите кнопку "Гайды" |
| Тяжело попасть в маркер resize | Масштаб маленький                | В будущем: добавить zoom |

## Итог

Редактор стал ближе к UX профессиональных инструментов (Figma, Canva):

- Мгновенные drag/resize
- Интеллектуальные направляющие
- История действий и шорткаты
- Сетка и snapping

Готово к дальнейшему расширению (группы, zoom, экспорт). Если нужно продолжить — создайте задачу.
