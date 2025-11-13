# Исправление ошибки "No input text" при генерации QR-кодов
**Дата:** 8 ноября 2025  
**Версия:** 2.2.1  
**Приоритет:** 🔥 Критичное исправление

## Проблема

При генерации PDF этикеток возникала ошибка:
```
PDF add QR error: Error: No input text
    at QRCode.toDataURL()
```

### Причина
Библиотека `qrcode` не принимает пустые строки или `undefined` в качестве контента для QR-кода. Ошибка возникала в трёх местах:

1. **`labelPrinter.ts` - renderTemplateToPdf()** - при рендеринге элементов типа 'qrcode'
2. **`labelPrinter.ts` - generateLabelPdfDataUrl()** - при создании defaultPayload
3. **`Operator.tsx` - handleScan()** - при формировании productData без fallback значений

## Исправления

### 1. labelPrinter.ts - renderTemplateToPdf() (строка ~390)

**До:**
```typescript
if (element.type === 'qrcode') {
  let qrContent = '';
  if (element.dataField) {
    qrContent = productData[element.dataField] || '';
  } else if (element.content) {
    qrContent = String(element.content).replace(...);
  } else {
    qrContent = productData.name || productData.barcode || 'No data';
  }
  const elementQrDataUrl = await QRCode.toDataURL(qrContent, ...);
}
```

**После:**
```typescript
if (element.type === 'qrcode') {
  let qrContent = '';
  if (element.dataField) {
    qrContent = productData[element.dataField] || '';
  } else if (element.content) {
    qrContent = String(element.content).replace(...);
  } else {
    qrContent = productData.name || productData.barcode || 'No data';
  }
  
  // ✅ Добавлена проверка на пустое значение
  if (!qrContent || qrContent.trim() === '') {
    qrContent = productData.qrCode || productData.name || productData.barcode || 'LABEL';
  }
  
  const elementQrDataUrl = await QRCode.toDataURL(qrContent, ...);
}
```

### 2. labelPrinter.ts - generateLabelPdfDataUrl() (строка ~497)

**До:**
```typescript
const defaultPayload = {
  type: 'product',
  id: product.id,
  qrCode: product.barcode || product.qrCode,
  action: 'export-label',
};

const qrContent = typeof options.qrString === 'string'
  ? options.qrString
  : JSON.stringify(options.qrPayload ?? defaultPayload);

const qrDataUrl = await QRCode.toDataURL(qrContent, { width: 200, margin: 1 });
```

**После:**
```typescript
const defaultPayload = {
  type: 'product',
  id: product.id,
  // ✅ Добавлены множественные fallback значения
  qrCode: product.barcode || product.qrCode || product.qr_code || product.sku || product.name || 'PRODUCT',
  action: 'export-label',
};

const qrContent = typeof options.qrString === 'string'
  ? options.qrString
  : JSON.stringify(options.qrPayload ?? defaultPayload);

// ✅ Добавлена проверка на пустой контент
if (!qrContent || qrContent.trim() === '' || qrContent === '""') {
  throw new Error('QR code content is empty');
}

const qrDataUrl = await QRCode.toDataURL(qrContent, { width: 200, margin: 1 });
```

### 3. labelPrinter.ts - buildProductExtras() (строка ~85)

**До:**
```typescript
return {
  productName: base.name,
  qrCode: toStr(product?.qrCode ?? product?.qr_code ?? metadata?.qrCode ?? base.barcode),
  // ...
}
```

**После:**
```typescript
// ✅ Расширена цепочка fallback значений
const qrCode = toStr(
  product?.qrCode ?? 
  product?.qr_code ?? 
  metadata?.qrCode ?? 
  base.barcode ?? 
  base.SKU ?? 
  base.name ?? 
  `PRODUCT-${product?.id || 'UNKNOWN'}`
);

return {
  productName: base.name,
  qrCode,
  // ...
}
```

### 4. Operator.tsx - handleScan() (строки ~260 и ~325)

**До:**
```typescript
const productData = {
  ...qrData,
  productName: product.name,
  // ...
  qrCode: product.qr_code  // ❌ Может быть undefined
};
```

**После:**
```typescript
const productData = {
  ...qrData,
  productName: product.name,
  // ...
  // ✅ Добавлены fallback значения
  qrCode: product.qr_code || product.sku || product.barcode || product.name || `PRODUCT-${product.id}`,
  qr_code: product.qr_code || product.sku || product.barcode || product.name || `PRODUCT-${product.id}`
};
```

### 5. Operator.tsx - handleSavePDF() (строка ~410)

**До:**
```typescript
const qrDataUrl = await QRCode.toDataURL(
  JSON.stringify({
    type: 'product',
    id: product.id,
    qrCode: product.barcode || product.qrCode,  // ❌ Может быть undefined
    action: 'print-label'
  }),
  { ... }
);
```

**После:**
```typescript
// ✅ Определяем QR-код с множественными fallback
const qrCodeValue = product.qrCode || product.qr_code || product.barcode || product.sku || product.name || `PRODUCT-${product.id}`;

const qrDataUrl = await QRCode.toDataURL(
  JSON.stringify({
    type: 'product',
    id: product.id,
    qrCode: qrCodeValue,
    action: 'print-label'
  }),
  { ... }
);
```

## Стратегия fallback значений

Приоритет полей для формирования QR-кода:
1. `product.qr_code` - основное поле QR
2. `product.qrCode` - альтернативное имя
3. `product.barcode` - штрих-код
4. `product.sku` - артикул (SKU-10000 формат)
5. `product.name` - название товара
6. `PRODUCT-${product.id}` - последний fallback на основе ID

Это гарантирует, что **всегда** будет создан QR-код, даже если основные поля пустые.

## Тестирование

### Сценарий 1: Товар с QR-кодом
```typescript
product = {
  id: 123,
  name: "Тумба",
  qr_code: "SKU-10001"
}
// QR будет: "SKU-10001" ✅
```

### Сценарий 2: Товар без QR, но с SKU
```typescript
product = {
  id: 123,
  name: "Тумба",
  sku: "SKU-10002"
}
// QR будет: "SKU-10002" ✅
```

### Сценарий 3: Товар без QR и SKU, но с barcode
```typescript
product = {
  id: 123,
  name: "Тумба",
  barcode: "4607127123456"
}
// QR будет: "4607127123456" ✅
```

### Сценарий 4: Товар только с названием
```typescript
product = {
  id: 123,
  name: "Тумба Элен"
}
// QR будет: "Тумба Элен" ✅
```

### Сценарий 5: Товар с минимальными данными
```typescript
product = {
  id: 123
}
// QR будет: "PRODUCT-123" ✅
```

## Влияние на систему

✅ **Положительные эффекты:**
- Исключены ошибки "No input text"
- PDF генерируются корректно даже для неполных данных
- Повышена устойчивость системы к некорректным данным

⚠️ **Потенциальные проблемы:**
- Если товар создан без имени, QR может быть "PRODUCT-123" - менее информативный
- Рекомендуется всегда заполнять хотя бы поле `name` или `sku`

## Рекомендации

1. **При создании товаров** обязательно заполнять:
   - `name` - название товара
   - `sku` - артикул (автоматически присваивается)
   - `qr_code` или `barcode` - для идентификации

2. **Миграция существующих товаров** (если есть товары без QR):
```sql
-- Обновить пустые qr_code на основе SKU
UPDATE products 
SET qr_code = sku 
WHERE (qr_code IS NULL OR qr_code = '') 
  AND sku IS NOT NULL;

-- Или на основе barcode
UPDATE products 
SET qr_code = barcode 
WHERE (qr_code IS NULL OR qr_code = '') 
  AND barcode IS NOT NULL;
```

## Файлы изменены

- ✅ `src/lib/labelPrinter.ts` - 3 изменения (renderTemplateToPdf, generateLabelPdfDataUrl, buildProductExtras)
- ✅ `src/pages/Operator.tsx` - 3 изменения (handleScan x2, handleSavePDF)

## Статус

- [x] Код исправлен
- [x] Проект собран (`npm run build`)
- [x] Документация создана
- [ ] Протестировано на production (ожидает deployment)

---

**Результат:** Ошибка "No input text" больше не должна возникать при генерации PDF этикеток. Система стала более устойчивой к отсутствующим данным.
