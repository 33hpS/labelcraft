/**
 * Template Preview Component - Shows filled template with sample data
 */
import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import JsBarcode from 'jsbarcode';

interface TemplatePreviewProps {
  template: any;
  onClose: () => void;
}

// Компонент для рендеринга штрих-кода
function BarcodeRenderer({ value, width, height }: { value: string; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value && width > 0 && height > 0) {
      try {
        const safeValue = String(value).trim() || '0000000000000';
        // Конвертируем мм в пиксели для canvas (используем 96 DPI экрана)
        const pixelWidth = (width / 25.4) * 96;
        const pixelHeight = (height / 25.4) * 96;
        
        JsBarcode(canvasRef.current, safeValue, {
          format: 'CODE128',
          width: Math.max(1, pixelWidth / 100),
          height: Math.max(pixelHeight * 0.7, 20),
          displayValue: true,
          fontSize: 10,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000'
        });
      } catch (error) {
        console.error('Barcode generation error:', error);
      }
    }
  }, [value, width, height]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-card">
      <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%' }} />
    </div>
  );
}

export function TemplatePreview({ template, onClose }: TemplatePreviewProps) {
  // Данные для предпросмотра
  const getCurrentDate = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  // В предпросмотре теперь отсутствуют жёстко заданные тестовые продуктовые данные.
  // Допускаются только динамические поля даты/времени. Любые другие {{placeholders}}
  // остаются как есть, чтобы пользователь видел, что нужно предоставить на этапе печати.
  const runtimeDynamicData = () => ({
    printDate: getCurrentDate(),
    printDateTime: getCurrentDateTime(),
    currentDate: getCurrentDate(),
    currentDateTime: getCurrentDateTime()
  });

  // Функция для замены плейсхолдеров
  const replacePlaceholders = (text: string): string => {
    if (!text) return '';
    const dyn = runtimeDynamicData();
    return text.replace(/\{\{(\w+)\}\}/g, (match, field) => {
      return (dyn as Record<string,string>)[field] || match; // не подставляем фиктивные данные
    });
  };

  // Получить контент с учетом привязки
  const getDisplayContent = (element: any): string => {
    // Если задано поле данных - подставляем только динамические поля даты/времени,
    // иначе отображаем исходный контент с попыткой заменить плейсхолдеры.
    const dyn = runtimeDynamicData();
    if (element.dataField) {
      if ((dyn as Record<string,string>)[element.dataField]) {
        return (dyn as Record<string,string>)[element.dataField];
      }
      // Неизвестное поле данных показываем как {{field}} или fallback к контенту
      return `{{${element.dataField}}}`;
    }
    if (element.content) {
      return replacePlaceholders(element.content);
    }
    return '';
  };

  // Парсим settings если это строка JSON
  let settings: any = {};
  try {
    if (typeof template.settings === 'string') {
      settings = JSON.parse(template.settings);
    } else if (typeof template.settings === 'object' && template.settings !== null) {
      settings = template.settings;
    }
  } catch (error) {
    console.error('Error parsing settings:', error);
    settings = {};
  }

  const width = settings.width || template.width || 58;
  const height = settings.height || template.height || 40;
  const dpi = settings.dpi || 203;
  
  // Парсим elements если это строка JSON
  let elements = [];
  try {
    if (typeof template.elements === 'string') {
      elements = JSON.parse(template.elements);
    } else if (Array.isArray(template.elements)) {
      elements = template.elements;
    }
  } catch (error) {
    console.error('Error parsing elements:', error);
    elements = [];
  }
  
  // Мигрируем старые R2 URLs в новые Worker URLs
  elements = elements.map((el: any) => {
    if (el.imageUrl && el.imageUrl.includes('r2.cloudflarestorage.com')) {
      // Извлекаем ключ из старого URL
      const match = el.imageUrl.match(/productlabelerpro\/(.+)$/);
      if (match) {
        return { ...el, imageUrl: `/api/images/${match[1]}` };
      }
    }
    return el;
  });

  // Используем CSS единицы mm для физического размера на экране
  // Пересчет мм в пиксели только для информации: (мм / 25.4) * DPI
  const mmToPixels = (mm: number) => Math.round((mm / 25.4) * dpi);
  const widthPx = mmToPixels(width);
  const heightPx = mmToPixels(height);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <Card className="w-full max-w-5xl max-h-[90vh] sm:max-h-[92vh] h-full sm:h-auto overflow-hidden">
        <CardHeader className="border-b bg-muted flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Предпросмотр этикетки</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{template.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 overflow-auto">
          <div className="flex justify-center">
            <div 
              className="bg-card border-2 border-border shadow-xl relative"
              style={{
                width: `${width}mm`,
                height: `${height}mm`
              }}
            >
              {/* Рендеринг элементов */}
              {elements.map((element: any) => (
                <div
                  key={element.id}
                  className="absolute"
                  style={{
                    left: `${element.x || 0}mm`,
                    top: `${element.y || 0}mm`,
                    width: `${element.width || 40}mm`,
                    height: `${element.height || 8}mm`
                  }}
                >
                  {element.type === 'text' && (
                    <div 
                      className="w-full h-full flex items-center justify-center text-center p-1"
                      style={{
                        fontSize: `${element.fontSize || 12}px`,
                        fontWeight: element.fontWeight || 'normal',
                        fontFamily: element.fontFamily || 'Inter'
                      }}
                    >
                      {getDisplayContent(element)}
                    </div>
                  )}
                  {element.type === 'qrcode' && (
                    <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
                      QR-код
                    </div>
                  )}
                  {element.type === 'barcode' && (
                    <BarcodeRenderer 
                      value={(() => {
                        const dyn = runtimeDynamicData();
                        if (element.dataField && (dyn as Record<string,string>)[element.dataField]) {
                          return (dyn as Record<string,string>)[element.dataField];
                        }
                        // Показываем техническое значение-заглушку, без бизнес данных
                        return '0000000000000';
                      })()}
                      width={element.width || 60}
                      height={element.height || 15}
                    />
                  )}
                  {element.type === 'image' && (
                    <div className="w-full h-full flex items-center justify-center bg-muted border border-dashed border-border overflow-hidden">
                      {element.imageUrl ? (
                        <img 
                          src={element.imageUrl} 
                          alt="Uploaded" 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">Изображение</span>
                      )}
                    </div>
                  )}
                  {element.type === 'rectangle' && (
                    <div className="w-full h-full border-2 border-border bg-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Размер: {width}×{height} мм ({widthPx}×{heightPx} px) | DPI: {dpi}</p>
            <p className="mt-2 text-xs">Предпросмотр: без продуктовых моков (только динамические дата-поля)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
