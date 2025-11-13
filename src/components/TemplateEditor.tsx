/**
 * Template Editor Component for creating and editing label templates
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import JsBarcode from 'jsbarcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { api } from '../lib/api';
import { 
  Settings, 
  Eye, 
  Save, 
  RotateCcw,
  Type,
  QrCode,
  Image,
  Square,
  Barcode,
  X,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Layers,
  Move,
  Trash2,
  Copy,
  Plus,
  Palette,
  ZoomIn,
  ZoomOut,
  Grid3x3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd
} from 'lucide-react';

interface TemplateSettings {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  dpi: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  status: 'draft' | 'active' | 'archived';
}

interface TemplateElement {
  id: string;
  type: 'text' | 'qrcode' | 'image' | 'rectangle' | 'barcode';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  dataField?: string; // Поле для привязки к данным товара
  imageUrl?: string; // URL загруженного изображения
}

interface TemplateEditorProps {
  template?: TemplateSettings;
  initialElements?: TemplateElement[];
  onSave: (template: TemplateSettings, elements: TemplateElement[]) => void;
  onClose: () => void;
}

// Компонент для рендеринга штрих-кода
function BarcodeRenderer({ value, width, height, errorLabel = 'Ошибка штрих-кода' }: { value: string; width: number; height: number; errorLabel?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value && width > 0 && height > 0) {
      try {
        // Убедимся что значение валидное для CODE128
        const safeValue = String(value).trim() || '0000000000000';
        const safeHeight = Math.max(height * 0.7, 20); // Минимальная высота 20px
        
        JsBarcode(canvasRef.current, safeValue, {
          format: 'CODE128',
          width: 2,
          height: safeHeight,
          displayValue: true,
          fontSize: 10,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000'
        });
      } catch (error) {
        console.error('Barcode generation error:', error);
        // Если не удалось сгенерировать, покажем сообщение
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.fillStyle = '#666';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(errorLabel, canvasRef.current.width / 2, canvasRef.current.height / 2);
        }
      }
    }
  }, [value, width, height]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%' }} />
    </div>
  );
}

export function TemplateEditor({ template, initialElements, onSave, onClose }: TemplateEditorProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<TemplateSettings>(template || {
    id: '',
    name: t('templateEditor.defaultTemplateName', 'Новый шаблон'),
    description: '',
    width: 58,
    height: 40,
    dpi: 203,
    marginTop: 2,
    marginRight: 2,
    marginBottom: 2,
    marginLeft: 2,
    status: 'draft'
  });

  // Парсим elements если это строка JSON из базы данных
  const parseElements = (els: any): TemplateElement[] => {
    if (!els) return [];
    let parsed: TemplateElement[] = [];
    
    if (Array.isArray(els)) {
      parsed = els;
    } else if (typeof els === 'string') {
      try {
        parsed = JSON.parse(els);
      } catch (error) {
        console.error('Error parsing elements:', error);
        return [];
      }
    } else {
      return [];
    }
    
    // Мигрируем старые R2 URLs в новые Worker URLs
    return parsed.map(el => {
      if (el.imageUrl && el.imageUrl.includes('r2.cloudflarestorage.com')) {
        // Извлекаем ключ из старого URL
        const match = el.imageUrl.match(/productlabelerpro\/(.+)$/);
        if (match) {
          return { ...el, imageUrl: `/api/images/${match[1]}` };
        }
      }
      return el;
    });
  };

  const [elements, setElements] = useState<TemplateElement[]>(parseElements(initialElements) || [
    {
      id: '1',
      type: 'text',
      x: 5,
      y: 5,
      width: 48,
      height: 8,
      content: t('templateEditor.fields.productName', 'Название товара'),
      fontSize: 12,
      fontWeight: 'bold'
    },
    {
      id: '2',
      type: 'qrcode',
      x: 15,
      y: 15,
      width: 28,
      height: 20,
      content: '{{qrcode}}'
    }
  ]);

  const [activeTab, setActiveTab] = useState('design');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draggedElement, setDraggedElement] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number; elementX: number; elementY: number } | null>(null);
  
  // Для плавного drag без re-renders используем ref
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // delta перемещения
  const clickOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // offset клика внутри элемента
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Keyboard shortcuts и undo/redo
  const [history, setHistory] = useState<TemplateElement[][]>([elements]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Alignment guides
  const [guides, setGuides] = useState<{ x: number[], y: number[] }>({ x: [], y: [] });
  const SNAP_THRESHOLD = 2; // mm - порог прилипания к направляющим
  const [showGuides, setShowGuides] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const GRID_SIZE = 1; // мм шаг сетки

  // Сохранение в историю при изменении elements
  useEffect(() => {
    if (JSON.stringify(elements) !== JSON.stringify(history[historyIndex])) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(elements)));
      // Ограничиваем историю 50 шагами
      if (newHistory.length > 50) {
        newHistory.shift();
      } else {
        setHistoryIndex(historyIndex + 1);
      }
      setHistory(newHistory);
    }
  }, [elements]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z (Windows/Linux) или Cmd+Z (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setElements(JSON.parse(JSON.stringify(history[historyIndex - 1])));
        }
      }
      
      // Redo: Ctrl+Shift+Z или Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setElements(JSON.parse(JSON.stringify(history[historyIndex + 1])));
        }
      }

      // Delete: удалить выбранный элемент
      if (e.key === 'Delete' && selectedElement) {
        e.preventDefault();
        setElements(elements.filter(el => el.id !== selectedElement));
        setSelectedElement(null);
      }

      // Arrow keys: точное перемещение выбранного элемента
      if (selectedElement && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1; // Shift для больших шагов
        
        setElements(elements.map(el => {
          if (el.id === selectedElement) {
            let newX = el.x;
            let newY = el.y;
            
            if (e.key === 'ArrowLeft') newX = Math.max(0, el.x - step);
            if (e.key === 'ArrowRight') newX = Math.min(settings.width - el.width, el.x + step);
            if (e.key === 'ArrowUp') newY = Math.max(0, el.y - step);
            if (e.key === 'ArrowDown') newY = Math.min(settings.height - el.height, el.y + step);
            
            return { ...el, x: newX, y: newY };
          }
          return el;
        }));
      }

      // Escape: снять выделение
      if (e.key === 'Escape') {
        setSelectedElement(null);
      }

      // Ctrl+D: дублировать элемент
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedElement) {
        e.preventDefault();
        const elementToDuplicate = elements.find(el => el.id === selectedElement);
        if (elementToDuplicate) {
          const newElement = {
            ...elementToDuplicate,
            id: Date.now().toString(),
            x: elementToDuplicate.x + 5,
            y: elementToDuplicate.y + 5
          };
          setElements([...elements, newElement]);
          setSelectedElement(newElement.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, elements, settings, historyIndex, history]);

  // Тестовые данные товара для предпросмотра
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

  // Минимальные динамические runtime поля (без фиксированных товарных моков)
  const runtimeDynamicData = () => ({
    printDate: getCurrentDate(),
    printDateTime: getCurrentDateTime(),
    currentDate: getCurrentDate(),
    currentDateTime: getCurrentDateTime()
  });

  const handleAddElement = (type: TemplateElement['type']) => {
    const newElement: TemplateElement = {
      id: Date.now().toString(),
      type,
      x: 10,
      y: 10,
      width: type === 'qrcode' ? 25 : (type === 'barcode' ? 60 : 40),
      height: type === 'qrcode' ? 25 : (type === 'barcode' ? 15 : 8),
  content: type === 'text' ? t('templateEditor.text.new', 'Новый текст') : undefined,
      fontSize: type === 'text' ? 12 : undefined,
      fontWeight: type === 'text' ? 'normal' : undefined,
      fontFamily: type === 'text' ? 'Inter' : undefined,
      textAlign: type === 'text' ? 'center' : undefined,
      verticalAlign: type === 'text' ? 'middle' : undefined,
      dataField: type === 'barcode' ? 'barcode' : (type === 'qrcode' ? 'name' : undefined)
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
  };

  const handleSave = () => {
    onSave(settings, elements);
  };

  // Загрузить изображение в R2
  const handleImageUpload = async (elementId: string, file: File) => {
    try {
      const data = await api.uploadFile(file, settings.id || 'temp');
      
      // Обновить элемент с URL изображения
      setElements(elements.map(el => 
        el.id === elementId 
          ? { ...el, imageUrl: data.url }
          : el
      ));
    } catch (error) {
      console.error('Image upload error:', error);
      alert(t('templateEditor.image.uploadError', 'Ошибка загрузки изображения'));
    }
  };

  // Переместить элемент вверх по слоям (ближе к верху в списке, выше z-index)
  const moveElementUp = (index: number) => {
    if (index > 0) {
      const newElements = [...elements];
      [newElements[index - 1], newElements[index]] = [newElements[index], newElements[index - 1]];
      setElements(newElements);
    }
  };

  // Переместить элемент вниз по слоям (ближе к низу в списке, ниже z-index)
  const moveElementDown = (index: number) => {
    if (index < elements.length - 1) {
      const newElements = [...elements];
      [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
      setElements(newElements);
    }
  };

  const scale = 2; // Масштаб для предпросмотра

  // Получить название поля для отображения
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      name: t('templateEditor.fields.productName', 'Название товара'),
      sku: 'SKU',
      price: t('templateEditor.fields.price', 'Цена'),
      weight: t('templateEditor.fields.weightVolume', 'Вес/Объем'),
      volume: t('templateEditor.fields.volume', 'Объем'),
      unit: t('templateEditor.fields.unit', 'Единица измерения'),
      barcode: t('templateEditor.fields.barcode', 'Штрихкод'),
      manufacturer: t('templateEditor.fields.manufacturer', 'Производитель'),
      expiryDate: t('templateEditor.fields.expiryDate', 'Срок годности'),
      productionDate: t('templateEditor.fields.productDate', 'Дата производства'),
      productDate: t('templateEditor.fields.productDate', 'Дата производства'),
      printDate: t('templateEditor.fields.printDate', 'Дата печати (ДД.ММ.ГГГГ)'),
      printDateTime: t('templateEditor.fields.printDateTime', 'Дата и время печати'),
      currentDate: t('templateEditor.fields.currentDate', 'Текущая дата'),
      currentDateTime: t('templateEditor.fields.currentDateTime', 'Текущая дата/время'),
      batchNumber: t('templateEditor.fields.batchNumber', 'Номер партии'),
      orderName: t('templateEditor.fields.orderName', 'Название заказа'),
      ORDER_NAME: t('templateEditor.fields.orderNameUpper', 'Название заказа (заглавные)')
    };
    return labels[field] || field;
  };

  // Извлечь плейсхолдеры из текста
  const extractPlaceholders = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/\{\{|\}\}/g, ''));
  };

  // Функция для замены плейсхолдеров на реальные данные
  const replacePlaceholders = (text: string, element: TemplateElement): string => {
    const dyn = runtimeDynamicData();
    return text.replace(/\{\{(\w+)\}\}/g, (match, field: string) => (dyn as Record<string,string>)[field] || match);
  };

  // Получить отображаемый текст с учетом привязки к данным
  const getDisplayContent = (element: TemplateElement): string => {
    if (element.dataField) {
      const dyn = runtimeDynamicData();
  return (dyn as Record<string,string>)[element.dataField] || `{{${element.dataField}}}`;
    }
    if (element.content) return replacePlaceholders(element.content, element);
    return '';
  };

  // Обработчики перетаскивания с плавным transform
  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    
    // Найдём элемент для получения его позиции
    const element = elements.find(el => el.id === elementId);
    if (!element) return;
    
    // Получаем позицию canvas относительно viewport
    const canvasRect = previewRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    
    // Canvas имеет размер settings.width * scale в mm
    // В пикселях это будет преобразовано браузером
    // Вычисляем реальную позицию клика относительно canvas
    // Координаты в пикселях относительно canvas
    const clickPxX = e.clientX - canvasRect.left;
    const clickPxY = e.clientY - canvasRect.top;
    
    // Преобразуем в mm с учётом масштаба canvas (canvas width = settings.width * scale mm)
    const clickX = (clickPxX / canvasRect.width) * settings.width;
    const clickY = (clickPxY / canvasRect.height) * settings.height;
    
    // Сохраняем offset от левого верхнего угла элемента до точки клика
    const offsetX = clickX - element.x;
    const offsetY = clickY - element.y;
    
    setIsDragging(true);
    setDraggedElement(elementId);
    setSelectedElement(elementId);
    setDragStart({ x: e.clientX, y: e.clientY });
    // Сохраняем offset клика внутри элемента
    clickOffsetRef.current = { x: offsetX, y: offsetY };
    dragOffsetRef.current = { x: 0, y: 0 }; // сбрасываем delta
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isResizing) {
      handleResizeMouseMove(e);
      return;
    }

    if (!isDragging || !draggedElement || !dragStart) return;

    // Получаем позицию canvas
    const canvasRect = previewRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Вычисляем текущую позицию мыши относительно canvas
    const clickPxX = e.clientX - canvasRect.left;
    const clickPxY = e.clientY - canvasRect.top;
    
    // Преобразуем в mm с учётом масштаба canvas
    const currentX = (clickPxX / canvasRect.width) * settings.width;
    const currentY = (clickPxY / canvasRect.height) * settings.height;

    // Получаем перетаскиваемый элемент
    const draggedEl = elements.find(el => el.id === draggedElement);
    if (!draggedEl) return;

    // Вычисляем новую позицию элемента с учётом offset клика
    const clickOffsetX = clickOffsetRef.current.x;
    const clickOffsetY = clickOffsetRef.current.y;
    
    let newX = currentX - clickOffsetX;
    let newY = currentY - clickOffsetY;
    
    // Вычисляем delta для transform
    let deltaX = newX - draggedEl.x;
    let deltaY = newY - draggedEl.y;

    // Snap to grid (до вычисления направляющих), если включено
    if (snapToGrid) {
      newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
      newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
      deltaX = newX - draggedEl.x;
      deltaY = newY - draggedEl.y;
    }

    // Находим направляющие линии от других элементов
    const otherElements = elements.filter(el => el.id !== draggedElement);
    const detectedGuides: { x: number[], y: number[] } = { x: [], y: [] };

    // Проверяем snap к другим элементам и границам холста
    const snapPoints = {
      x: [0, settings.width], // границы холста
      y: [0, settings.height]
    };

    // Добавляем точки привязки от других элементов
    otherElements.forEach(el => {
      snapPoints.x.push(el.x, el.x + el.width, el.x + el.width / 2);
      snapPoints.y.push(el.y, el.y + el.height, el.y + el.height / 2);
    });

    // Точки текущего элемента для проверки snap
    const currentPoints = {
      x: [newX, newX + draggedEl.width, newX + draggedEl.width / 2],
      y: [newY, newY + draggedEl.height, newY + draggedEl.height / 2]
    };

    // Проверяем snap по X
    for (const snapX of snapPoints.x) {
      for (let i = 0; i < currentPoints.x.length; i++) {
        const diff = Math.abs(currentPoints.x[i] - snapX);
        if (diff < SNAP_THRESHOLD) {
          newX = snapX - [0, draggedEl.width, draggedEl.width / 2][i];
          deltaX = newX - draggedEl.x;
          detectedGuides.x.push(snapX);
          break;
        }
      }
    }

    // Проверяем snap по Y
    for (const snapY of snapPoints.y) {
      for (let i = 0; i < currentPoints.y.length; i++) {
        const diff = Math.abs(currentPoints.y[i] - snapY);
        if (diff < SNAP_THRESHOLD) {
          newY = snapY - [0, draggedEl.height, draggedEl.height / 2][i];
          deltaY = newY - draggedEl.y;
          detectedGuides.y.push(snapY);
          break;
        }
      }
    }

    // Обновляем направляющие
  if (showGuides) setGuides(detectedGuides); else setGuides({ x: [], y: [] });

    dragOffsetRef.current = { x: deltaX, y: deltaY };

    // Применяем transform напрямую к DOM элементу для мгновенной реакции
    // Delta в mm, но элементы отрисованы с scale, поэтому умножаем на scale
    const draggedDomEl = previewRef.current?.querySelector(`[data-element-id="${draggedElement}"]`);
    if (draggedDomEl instanceof HTMLElement) {
      draggedDomEl.style.transform = `translate(${deltaX * scale}mm, ${deltaY * scale}mm)`;
      draggedDomEl.style.transition = 'none';
    }
  };

  const handleMouseUp = () => {
    if (isDragging && draggedElement && dragOffsetRef.current) {
      // Обновляем финальную позицию в state
      const { x: deltaX, y: deltaY } = dragOffsetRef.current;
      
      setElements(elements.map(el => {
        if (el.id === draggedElement) {
          const newX = Math.max(0, Math.min(settings.width - el.width, el.x + deltaX));
          const newY = Math.max(0, Math.min(settings.height - el.height, el.y + deltaY));
          return { ...el, x: newX, y: newY };
        }
        return el;
      }));

      // Сбрасываем transform
      const draggedEl = previewRef.current?.querySelector(`[data-element-id="${draggedElement}"]`);
      if (draggedEl instanceof HTMLElement) {
        draggedEl.style.transform = '';
        draggedEl.style.transition = '';
      }
      
      // Очищаем направляющие
      setGuides({ x: [], y: [] });
    }

    if (isResizing && draggedElement && resizeDataRef.current) {
      // Сохраняем финальный размер в state
      const { width, height, x, y } = resizeDataRef.current;
      
      setElements(elements.map(el => {
        if (el.id === draggedElement) {
          return { ...el, width, height, x, y };
        }
        return el;
      }));

      // Сбрасываем inline стили
      const resizedEl = previewRef.current?.querySelector(`[data-element-id="${draggedElement}"]`);
      if (resizedEl instanceof HTMLElement) {
        resizedEl.style.transition = '';
      }
    }

    setIsDragging(false);
    setDraggedElement(null);
    setDragStart(null);
    dragOffsetRef.current = { x: 0, y: 0 };
    setIsResizing(false);
    setResizeHandle(null);
    setResizeStart(null);
    resizeDataRef.current = { width: 0, height: 0, x: 0, y: 0 };
  };

  // Обработчики изменения размера с плавным transform
  const resizeDataRef = useRef<{ width: number; height: number; x: number; y: number }>({ width: 0, height: 0, x: 0, y: 0 });

  const handleResizeMouseDown = (e: React.MouseEvent, elementId: string, handle: string) => {
    e.stopPropagation();
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    setIsResizing(true);
    setDraggedElement(elementId);
    setResizeHandle(handle);
    setSelectedElement(elementId);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: element.width,
      height: element.height,
      elementX: element.x,
      elementY: element.y
    });
    resizeDataRef.current = { width: element.width, height: element.height, x: element.x, y: element.y };
  };

  const handleResizeMouseMove = (e: React.MouseEvent) => {
    if (!isResizing || !draggedElement || !resizeStart || !resizeHandle) return;

    const deltaX = (e.clientX - resizeStart.x) / scale;
    const deltaY = (e.clientY - resizeStart.y) / scale;

    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newX = resizeStart.elementX;
    let newY = resizeStart.elementY;

    // Обработка разных углов и сторон
    if (resizeHandle.includes('e')) {
      newWidth = Math.max(10, resizeStart.width + deltaX);
    }
    if (resizeHandle.includes('w')) {
      const maxDelta = Math.min(deltaX, resizeStart.width - 10);
      newWidth = resizeStart.width - maxDelta;
      newX = resizeStart.elementX + maxDelta;
    }
    if (resizeHandle.includes('s')) {
      newHeight = Math.max(5, resizeStart.height + deltaY);
    }
    if (resizeHandle.includes('n')) {
      const maxDelta = Math.min(deltaY, resizeStart.height - 5);
      newHeight = resizeStart.height - maxDelta;
      newY = resizeStart.elementY + maxDelta;
    }

    resizeDataRef.current = { width: newWidth, height: newHeight, x: newX, y: newY };

    // Применяем изменения через CSS для плавности
    const resizedEl = previewRef.current?.querySelector(`[data-element-id="${draggedElement}"]`);
    if (resizedEl instanceof HTMLElement) {
      resizedEl.style.width = `${newWidth * scale}mm`;
      resizedEl.style.height = `${newHeight * scale}mm`;
      resizedEl.style.left = `${newX * scale}mm`;
      resizedEl.style.top = `${newY * scale}mm`;
      resizedEl.style.transition = 'none';
    }
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <Card className="w-full h-full flex flex-col border-0 rounded-none shadow-none">
        <CardHeader className="relative flex-row items-center justify-between pb-3 pt-3 px-4 border-b bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white overflow-hidden">
          <div className="relative z-10 flex items-center gap-2">
            <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-1.5">
                {t('templateEditor.title')}
              </CardTitle>
            </div>
          </div>
          <div className="relative z-10 flex gap-2">
            <Button variant="outline" onClick={onClose} className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm">
              <X className="w-4 h-4 mr-2" />
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} className="bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg hover:shadow-xl transition-all font-semibold">
              <Save className="w-4 h-4 mr-2" />
              {t('common.save')}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col lg:flex-row gap-3 overflow-auto lg:overflow-hidden p-3 bg-gradient-to-br from-gray-50 to-white">
          {/* Левая панель - настройки */}
          <div className="order-2 lg:order-1 w-full lg:w-64 flex-shrink-0 space-y-4 max-h-[60vh] lg:max-h-none overflow-y-auto bg-white/50 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-gray-100">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="design">{t('templateEditor.tabs.design')}</TabsTrigger>
                <TabsTrigger value="settings">{t('templateEditor.tabs.settings')}</TabsTrigger>
              </TabsList>

              <TabsContent value="design" className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    {t('templateEditor.addElement')}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleAddElement('text')}
                      className="h-16 flex-col bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all group shadow-sm"
                    >
                      <Type className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium">{t('templateEditor.types.text')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAddElement('qrcode')}
                      className="h-16 flex-col bg-white hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all group shadow-sm"
                    >
                      <QrCode className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium">{t('templateEditor.types.qrcode')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAddElement('image')}
                      className="h-16 flex-col bg-white hover:bg-pink-50 hover:border-pink-300 hover:text-pink-700 transition-all group shadow-sm"
                    >
                      <Image className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium">{t('templateEditor.types.image')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAddElement('rectangle')}
                      className="h-16 flex-col bg-white hover:bg-gray-100 hover:border-gray-300 transition-all group shadow-sm"
                    >
                      <Square className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium">{t('templateEditor.types.rectangle')}</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAddElement('barcode')}
                      className="h-16 flex-col bg-white hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-all group shadow-sm"
                    >
                      <Barcode className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium">{t('templateEditor.types.barcode')}</span>
                    </Button>
                  </div>
                </div>

                {selectedElement && (() => {
                  const element = elements.find(el => el.id === selectedElement);
                  if (!element) return null;

                  return (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          {t('templateEditor.elementProps')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {element.type === 'text' && (
                          <>
                            <div>
                              <Label className="text-xs mb-1 block">{t('templateEditor.binding')}</Label>
                              <select
                                className="w-full h-9 px-3 rounded-md border border-gray-300 text-sm"
                                value={element.dataField || ''}
                                onChange={(e) => {
                                  setElements(elements.map(el => 
                                    el.id === selectedElement 
                                      ? { ...el, dataField: e.target.value || undefined }
                                      : el
                                  ));
                                }}
                              >
                                <option value="">{t('templateEditor.staticText')}</option>
                                <option value="name">{t('templateEditor.fields.productName')}</option>
                                <option value="price">{t('templateEditor.fields.price')}</option>
                                <option value="weight">{t('templateEditor.fields.weightVolume')}</option>
                                <option value="unit">{t('templateEditor.fields.unit')}</option>
                                <option value="manufacturer">{t('templateEditor.fields.manufacturer')}</option>
                                <option value="barcode">{t('templateEditor.fields.barcode')}</option>
                                <option value="expiryDate">{t('templateEditor.fields.expiryDate')}</option>
                                <option value="productDate">{t('templateEditor.fields.productDate')}</option>
                                <option value="printDate">{t('templateEditor.fields.printDate')}</option>
                                <option value="printDateTime">{t('templateEditor.fields.printDateTime')}</option>
                                <option value="orderName">{t('templateEditor.fields.orderName')}</option>
                              </select>
                            </div>
                            
                            {!element.dataField && (
                              <div>
                                <Label className="text-xs mb-1 block">{t('templateEditor.types.text')}</Label>
                                <Input
                                  value={element.content || ''}
                                  onChange={(e) => {
                                    setElements(elements.map(el => 
                                      el.id === selectedElement 
                                        ? { ...el, content: e.target.value }
                                        : el
                                    ));
                                  }}
                                  placeholder={t('templateEditor.text.placeholder')}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  {t('templateEditor.text.hint')}
                                </p>
                              </div>
                            )}

                            <div>
                              <Label className="text-xs mb-1 block">{t('templateEditor.fontSize')}</Label>
                              <Input
                                type="number"
                                value={element.fontSize || 12}
                                onChange={(e) => {
                                  setElements(elements.map(el => 
                                    el.id === selectedElement 
                                      ? { ...el, fontSize: Number(e.target.value) }
                                      : el
                                  ));
                                }}
                              />
                            </div>

                            <div>
                              <Label className="text-xs mb-1 block">{t('templateEditor.fontWeight.label', 'Жирность')}</Label>
                              <select
                                className="w-full h-9 px-3 rounded-md border border-gray-300 text-sm"
                                value={element.fontWeight || 'normal'}
                                onChange={(e) => {
                                  setElements(elements.map(el => 
                                    el.id === selectedElement 
                                      ? { ...el, fontWeight: e.target.value }
                                      : el
                                  ));
                                }}
                              >
                                <option value="normal">{t('templateEditor.fontWeight.normal')}</option>
                                <option value="bold">{t('templateEditor.fontWeight.bold')}</option>
                              </select>
                            </div>

                            <div>
                              <Label className="text-xs mb-1 block">{t('templateEditor.fontFamily')}</Label>
                              <select
                                className="w-full h-9 px-3 rounded-md border border-gray-300 text-sm"
                                value={element.fontFamily || 'Inter'}
                                onChange={(e) => {
                                  setElements(elements.map(el => 
                                    el.id === selectedElement 
                                      ? { ...el, fontFamily: e.target.value }
                                      : el
                                  ));
                                }}
                                style={{ fontFamily: element.fontFamily || 'Inter' }}
                              >
                                <option value="Inter" style={{ fontFamily: 'Inter' }}>Inter (Sans-serif)</option>
                                <option value="Roboto" style={{ fontFamily: 'Roboto' }}>Roboto</option>
                                <option value="Open Sans" style={{ fontFamily: 'Open Sans' }}>Open Sans</option>
                                <option value="Lato" style={{ fontFamily: 'Lato' }}>Lato</option>
                                <option value="Montserrat" style={{ fontFamily: 'Montserrat' }}>Montserrat</option>
                                <option value="Poppins" style={{ fontFamily: 'Poppins' }}>Poppins</option>
                                <option value="Playfair Display" style={{ fontFamily: 'Playfair Display' }}>Playfair Display (Serif)</option>
                                <option value="Merriweather" style={{ fontFamily: 'Merriweather' }}>Merriweather (Serif)</option>
                                <option value="Roboto Mono" style={{ fontFamily: 'Roboto Mono' }}>Roboto Mono (Mono)</option>
                                <option value="Courier New" style={{ fontFamily: 'Courier New' }}>Courier New (Mono)</option>
                                <option value="Arial" style={{ fontFamily: 'Arial' }}>Arial</option>
                                <option value="Times New Roman" style={{ fontFamily: 'Times New Roman' }}>Times New Roman</option>
                              </select>
                            </div>

                            {/* Горизонтальное выравнивание */}
                            <div>
                              <Label className="text-xs mb-2 flex items-center gap-2">
                                <AlignCenter className="w-4 h-4" />
                                {t('templateEditor.align.horizontal')}
                              </Label>
                              <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
                                <Button
                                  size="sm"
                                  variant={element.textAlign === 'left' ? 'default' : 'ghost'}
                                  onClick={() => {
                                    const newElements = elements.map(el => 
                                      el.id === selectedElement 
                                        ? { ...el, textAlign: 'left' as const }
                                        : el
                                    );
                                    setElements(newElements);
                                  }}
                                  className="h-9"
                                  title={t('templateEditor.align.left')}
                                >
                                  <AlignLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={element.textAlign === 'center' ? 'default' : 'ghost'}
                                  onClick={() => {
                                    const newElements = elements.map(el => 
                                      el.id === selectedElement 
                                        ? { ...el, textAlign: 'center' as const }
                                        : el
                                    );
                                    setElements(newElements);
                                  }}
                                  className="h-9"
                                  title={t('templateEditor.align.center')}
                                >
                                  <AlignCenter className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={element.textAlign === 'right' ? 'default' : 'ghost'}
                                  onClick={() => {
                                    const newElements = elements.map(el => 
                                      el.id === selectedElement 
                                        ? { ...el, textAlign: 'right' as const }
                                        : el
                                    );
                                    setElements(newElements);
                                  }}
                                  className="h-9"
                                  title={t('templateEditor.align.right')}
                                >
                                  <AlignRight className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Вертикальное выравнивание */}
                            <div>
                              <Label className="text-xs mb-2 flex items-center gap-2">
                                <AlignVerticalJustifyCenter className="w-4 h-4" />
                                {t('templateEditor.align.vertical')}
                              </Label>
                              <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
                                <Button
                                  size="sm"
                                  variant={element.verticalAlign === 'top' ? 'default' : 'ghost'}
                                  onClick={() => {
                                    const newElements = elements.map(el => 
                                      el.id === selectedElement 
                                        ? { ...el, verticalAlign: 'top' as const }
                                        : el
                                    );
                                    setElements(newElements);
                                  }}
                                  className="h-9"
                                  title={t('templateEditor.align.top')}
                                >
                                  <AlignVerticalJustifyStart className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={element.verticalAlign === 'middle' ? 'default' : 'ghost'}
                                  onClick={() => {
                                    const newElements = elements.map(el => 
                                      el.id === selectedElement 
                                        ? { ...el, verticalAlign: 'middle' as const }
                                        : el
                                    );
                                    setElements(newElements);
                                  }}
                                  className="h-9"
                                  title={t('templateEditor.align.center')}
                                >
                                  <AlignVerticalJustifyCenter className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={element.verticalAlign === 'bottom' ? 'default' : 'ghost'}
                                  onClick={() => {
                                    const newElements = elements.map(el => 
                                      el.id === selectedElement 
                                        ? { ...el, verticalAlign: 'bottom' as const }
                                        : el
                                    );
                                    setElements(newElements);
                                  }}
                                  className="h-9"
                                  title={t('templateEditor.align.bottom')}
                                >
                                  <AlignVerticalJustifyEnd className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </>
                        )}

                        {element.type === 'barcode' && (
                          <>
                            <div>
                              <Label className="text-xs mb-1 block">{t('templateEditor.barcode.source')}</Label>
                              <select
                                className="w-full h-9 px-3 rounded-md border border-gray-300 text-sm"
                                value={element.dataField || 'barcode'}
                                onChange={(e) => {
                                  setElements(elements.map(el => 
                                    el.id === selectedElement 
                                      ? { ...el, dataField: e.target.value }
                                      : el
                                  ));
                                }}
                              >
                                <option value="barcode">{t('templateEditor.barcode.sourceOptions.barcode')}</option>
                                <option value="sku">{t('templateEditor.barcode.sourceOptions.sku')}</option>
                                <option value="name">{t('templateEditor.barcode.sourceOptions.name')}</option>
                              </select>
                              <p className="text-xs text-gray-500 mt-1">
                                {t('templateEditor.barcode.hint')}
                              </p>
                            </div>
                          </>
                        )}

                        {element.type === 'qrcode' && (
                          <>
                            <div>
                              <Label className="text-xs mb-1 block">{t('templateEditor.qrcode.source')}</Label>
                              <select
                                className="w-full h-9 px-3 rounded-md border border-gray-300 text-sm"
                                value={element.dataField || 'name'}
                                onChange={(e) => {
                                  setElements(elements.map(el => 
                                    el.id === selectedElement 
                                      ? { ...el, dataField: e.target.value }
                                      : el
                                  ));
                                }}
                              >
                                <option value="name">{t('templateEditor.fields.productName')}</option>
                                <option value="barcode">{t('templateEditor.fields.barcode')}</option>
                                <option value="sku">{t('templateEditor.fields.sku', 'SKU')}</option>
                                <option value="price">{t('templateEditor.fields.price')}</option>
                                <option value="manufacturer">{t('templateEditor.fields.manufacturer')}</option>
                                <option value="expiryDate">{t('templateEditor.fields.expiryDate')}</option>
                                <option value="productDate">{t('templateEditor.fields.productDate')}</option>
                              </select>
                              <p className="text-xs text-gray-500 mt-1">
                                {t('templateEditor.qrcode.hint')}
                              </p>
                            </div>
                          </>
                        )}

                        {element.type === 'image' && (
                          <>
                            <div>
                              <Label className="text-xs mb-1 block">{t('templateEditor.image.upload')}</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file && selectedElement) {
                                    handleImageUpload(selectedElement, file);
                                  }
                                }}
                                className="text-sm"
                              />
                              {element.imageUrl && (
                                <div className="mt-2">
                                  <img 
                                    src={element.imageUrl} 
                                    alt="Preview" 
                                    className="w-full h-20 object-contain border rounded"
                                  />
                                  <p className="text-xs text-green-600 mt-1">✓ {t('templateEditor.image.uploaded')}</p>
                                  <p className="text-xs text-gray-500 mt-1 break-all">{element.imageUrl}</p>
                                </div>
                              )}
                              {!element.imageUrl && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {t('templateEditor.image.supported')}
                                </p>
                              )}
                            </div>
                          </>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">{t('templateEditor.coords.x')}</Label>
                            <Input
                              type="number"
                              value={element.x.toFixed(1)}
                              onChange={(e) => {
                                setElements(elements.map(el => 
                                  el.id === selectedElement 
                                    ? { ...el, x: Number(e.target.value) }
                                    : el
                                ));
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('templateEditor.coords.y')}</Label>
                            <Input
                              type="number"
                              value={element.y.toFixed(1)}
                              onChange={(e) => {
                                setElements(elements.map(el => 
                                  el.id === selectedElement 
                                    ? { ...el, y: Number(e.target.value) }
                                    : el
                                ));
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('templateEditor.coords.width')}</Label>
                            <Input
                              type="number"
                              value={element.width.toFixed(1)}
                              onChange={(e) => {
                                setElements(elements.map(el => 
                                  el.id === selectedElement 
                                    ? { ...el, width: Number(e.target.value) }
                                    : el
                                ));
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('templateEditor.coords.height')}</Label>
                            <Input
                              type="number"
                              value={element.height.toFixed(1)}
                              onChange={(e) => {
                                setElements(elements.map(el => 
                                  el.id === selectedElement 
                                    ? { ...el, height: Number(e.target.value) }
                                    : el
                                ));
                              }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="name">{t('templateEditor.settings.name')}</Label>
                    <Input
                      id="name"
                      value={settings.name}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">{t('templateEditor.settings.description')}</Label>
                    <Input
                      id="description"
                      value={settings.description}
                      onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">{t('templateEditor.settings.status')}</Label>
                    <Select
                      value={settings.status}
                      onValueChange={(value: 'draft' | 'active' | 'archived') => setSettings({ ...settings, status: value })}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder={t('templateEditor.settings.statusPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">📝 {t('templates.status.draft')}</SelectItem>
                        <SelectItem value="active">✅ {t('templates.status.active')}</SelectItem>
                        <SelectItem value="archived">📦 {t('templates.status.archived')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="width">{t('templateEditor.coords.width')}</Label>
                      <Input
                        id="width"
                        type="number"
                        value={settings.width}
                        onChange={(e) => setSettings({ ...settings, width: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="height">{t('templateEditor.coords.height')}</Label>
                      <Input
                        id="height"
                        type="number"
                        value={settings.height}
                        onChange={(e) => setSettings({ ...settings, height: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="dpi">DPI</Label>
                    <Input
                      id="dpi"
                      type="number"
                      value={settings.dpi}
                      onChange={(e) => setSettings({ ...settings, dpi: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <Label>{t('templateEditor.margins.title', 'Поля (мм)')}</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <Label className="text-xs">{t('templateEditor.margins.top', 'Верх')}</Label>
                        <Input
                          type="number"
                          value={settings.marginTop}
                          onChange={(e) => setSettings({ ...settings, marginTop: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('templateEditor.margins.right', 'Право')}</Label>
                        <Input
                          type="number"
                          value={settings.marginRight}
                          onChange={(e) => setSettings({ ...settings, marginRight: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('templateEditor.margins.bottom', 'Низ')}</Label>
                        <Input
                          type="number"
                          value={settings.marginBottom}
                          onChange={(e) => setSettings({ ...settings, marginBottom: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('templateEditor.margins.left', 'Лево')}</Label>
                        <Input
                          type="number"
                          value={settings.marginLeft}
                          onChange={(e) => setSettings({ ...settings, marginLeft: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Центральная панель - предпросмотр */}
          <div className="order-1 lg:order-2 flex-1 flex flex-col">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('templateEditor.preview.title')}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setShowGrid(v => !v)}>
                  {showGrid ? t('templateEditor.toggle.gridOn') : t('templateEditor.toggle.gridOff')}
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setSnapToGrid(v => !v)}>
                  {snapToGrid ? t('templateEditor.toggle.snapOn') : t('templateEditor.toggle.snapOff')}
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setShowGuides(v => !v)}>
                  {showGuides ? t('templateEditor.toggle.guidesOn') : t('templateEditor.toggle.guidesOff')}
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent">
                  <Eye className="w-4 h-4 mr-2" />
                  {t('templateEditor.previewButton')}
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t('templateEditor.reset')}
                </Button>
              </div>
            </div>

            <div className="flex-1 bg-gray-100 rounded-lg p-4 sm:p-6 lg:p-8 flex items-center justify-center overflow-auto">
              <div 
                ref={previewRef}
                className="bg-white border-2 border-gray-300 shadow-lg"
                style={{
                  width: `${settings.width * scale}mm`,
                  height: `${settings.height * scale}mm`,
                  position: 'relative'
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Grid overlay */}
                {showGrid && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)` ,
                      backgroundSize: `${GRID_SIZE * scale}mm ${GRID_SIZE * scale}mm`,
                      zIndex: 1
                    }}
                  />
                )}
                {/* Направляющие линии при перетаскивании */}
                {isDragging && (
                  <>
                    {guides.x.map((x, i) => (
                      <div
                        key={`guide-x-${i}`}
                        className="absolute bg-blue-500 pointer-events-none"
                        style={{
                          left: `${x * scale}mm`,
                          top: 0,
                          width: '1px',
                          height: '100%',
                          opacity: 0.6,
                          zIndex: 999
                        }}
                      />
                    ))}
                    {guides.y.map((y, i) => (
                      <div
                        key={`guide-y-${i}`}
                        className="absolute bg-blue-500 pointer-events-none"
                        style={{
                          left: 0,
                          top: `${y * scale}mm`,
                          width: '100%',
                          height: '1px',
                          opacity: 0.6,
                          zIndex: 999
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Элементы шаблона */}
                {elements.map((element) => (
                  <div
                    key={element.id}
                    data-element-id={element.id}
                    className={`absolute border-2 ${
                      selectedElement === element.id 
                        ? 'border-blue-500 bg-blue-50 shadow-lg' 
                        : 'border-transparent hover:border-gray-400 hover:shadow-md'
                    } ${isDragging && draggedElement === element.id ? 'cursor-grabbing shadow-2xl ring-2 ring-blue-400' : 'cursor-grab'} transition-all duration-150`}
                    style={{
                      left: `${(element.x || 0) * scale}mm`,
                      top: `${(element.y || 0) * scale}mm`,
                      width: `${(element.width || 40) * scale}mm`,
                      height: `${(element.height || 8) * scale}mm`,
                      userSelect: 'none',
                      willChange: isDragging && draggedElement === element.id ? 'transform' : 'auto',
                      zIndex: isDragging && draggedElement === element.id ? 1000 : selectedElement === element.id ? 100 : 'auto'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, element.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElement(element.id);
                    }}
                  >
                    {/* Badge с индикацией привязки к данным */}
                    {element.dataField ? (
                      <div 
                        className="absolute -top-5 left-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-10 pointer-events-none"
                        style={{ fontSize: '10px' }}
                      >
                        🔗 {getFieldLabel(element.dataField)}
                      </div>
                    ) : element.type === 'text' && element.content && extractPlaceholders(element.content).length > 0 ? (
                      <div 
                        className="absolute -top-5 left-0 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-10 pointer-events-none"
                        style={{ fontSize: '10px' }}
                      >
                        📝 {extractPlaceholders(element.content).map(p => getFieldLabel(p)).join(', ')}
                      </div>
                    ) : null}
                    {element.type === 'text' && (
                      <div 
                        className="w-full h-full flex p-1"
                        style={{
                          fontSize: `${(element.fontSize || 12) * scale}px`,
                          fontWeight: element.fontWeight || 'normal',
                          fontFamily: element.fontFamily || 'Inter',
                          textAlign: element.textAlign || 'center',
                          alignItems: element.verticalAlign === 'top' ? 'flex-start' 
                                    : element.verticalAlign === 'bottom' ? 'flex-end' 
                                    : 'center',
                          justifyContent: element.textAlign === 'left' ? 'flex-start'
                                        : element.textAlign === 'right' ? 'flex-end'
                                        : 'center'
                        }}
                      >
                        {replacePlaceholders(element.content || '', element)}
                      </div>
                    )}
                    {element.type === 'qrcode' && (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 text-gray-600 text-xs p-1">
                        <div className="font-semibold">{t('templateEditor.types.qrcode')}</div>
                        {element.dataField && (
                          <div className="text-[10px] text-gray-500 mt-1 text-center">
                            {getFieldLabel(element.dataField)}
                          </div>
                        )}
                      </div>
                    )}
                    {element.type === 'barcode' && (
                      <BarcodeRenderer 
                        value={element.dataField ? (runtimeDynamicData()[element.dataField as keyof ReturnType<typeof runtimeDynamicData>] || '0000000000000') : '0000000000000'}
                        width={(element.width || 60) * scale}
                        height={(element.height || 15) * scale}
                      />
                    )}
                    {element.type === 'image' && (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 border border-dashed overflow-hidden">
                        {element.imageUrl ? (
                          <img 
                            src={element.imageUrl} 
                            alt="Uploaded" 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">{t('templateEditor.types.image')}</span>
                        )}
                      </div>
                    )}
                    {element.type === 'rectangle' && (
                      <div className="w-full h-full border-2 border-gray-400 bg-transparent" />
                    )}

                    {/* Маркеры изменения размера для выбранного элемента */}
                    {selectedElement === element.id && (
                      <>
                        {/* Угловые маркеры */}
                        <div
                          className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-nw-resize hover:bg-blue-500 hover:scale-125 transition-all shadow-md"
                          style={{ top: '-8px', left: '-8px', zIndex: 10 }}
                          onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'nw')}
                        />
                        <div
                          className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-ne-resize hover:bg-blue-500 hover:scale-125 transition-all shadow-md"
                          style={{ top: '-8px', right: '-8px', zIndex: 10 }}
                          onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'ne')}
                        />
                        <div
                          className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-sw-resize hover:bg-blue-500 hover:scale-125 transition-all shadow-md"
                          style={{ bottom: '-8px', left: '-8px', zIndex: 10 }}
                          onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'sw')}
                        />
                        <div
                          className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-se-resize hover:bg-blue-500 hover:scale-125 transition-all shadow-md"
                          style={{ bottom: '-8px', right: '-8px', zIndex: 10 }}
                          onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'se')}
                        />
                        
                        {/* Боковые маркеры */}
                        <div
                          className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-n-resize hover:bg-blue-500 hover:scale-125 transition-all shadow-md"
                          style={{ top: '-6px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
                          onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'n')}
                        />
                        <div
                          className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-s-resize hover:bg-blue-500 hover:scale-125 transition-all shadow-md"
                          style={{ bottom: '-6px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
                          onMouseDown={(e) => handleResizeMouseDown(e, element.id, 's')}
                        />
                        <div
                          className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-w-resize hover:bg-blue-500 hover:scale-125 transition-all shadow-md"
                          style={{ top: '50%', left: '-6px', transform: 'translateY(-50%)', zIndex: 10 }}
                          onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'w')}
                        />
                        <div
                          className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-e-resize hover:bg-blue-500 hover:scale-125 transition-all shadow-md"
                          style={{ top: '50%', right: '-6px', transform: 'translateY(-50%)', zIndex: 10 }}
                          onMouseDown={(e) => handleResizeMouseDown(e, element.id, 'e')}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Правая панель - элементы */}
          <div className="order-3 w-full lg:w-52 flex-shrink-0 space-y-3 max-h-[50vh] lg:max-h-none overflow-y-auto">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('templateEditor.list.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {elements.map((element, index) => (
                  <div
                    key={element.id}
                    className={`flex items-center justify-between p-2 rounded border ${
                      selectedElement === element.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedElement(element.id)}
                  >
                    <div className="flex items-center gap-2">
                      {element.type === 'text' && <Type className="w-4 h-4" />}
                      {element.type === 'qrcode' && <QrCode className="w-4 h-4" />}
                      {element.type === 'barcode' && <Barcode className="w-4 h-4" />}
                      {element.type === 'image' && <Image className="w-4 h-4" />}
                      {element.type === 'rectangle' && <Square className="w-4 h-4" />}
                      <span className="text-sm">
                        {element.type === 'text' ? t('templateEditor.types.text') : 
                         element.type === 'qrcode' ? t('templateEditor.types.qrcode') :
                         element.type === 'barcode' ? t('templateEditor.types.barcode') :
                         element.type === 'image' ? t('templateEditor.types.image') : t('templateEditor.types.rectangle')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveElementUp(index);
                        }}
                        title={t('templateEditor.movement.moveUp')}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={index === elements.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveElementDown(index);
                        }}
                        title={t('templateEditor.movement.moveDown')}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setElements(elements.filter(el => el.id !== element.id));
                          if (selectedElement === element.id) {
                            setSelectedElement(null);
                          }
                        }}
                        title={t('templateEditor.movement.delete')}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('templateEditor.info.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t('templateEditor.info.size')}</span>
                  <span>{settings.width}×{settings.height} мм</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('templateEditor.info.dpi')}</span>
                  <span>{settings.dpi}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('templateEditor.info.status')}</span>
                  <Badge variant={settings.status === 'active' ? 'default' : 'secondary'}>
                    {settings.status === 'active' ? t('templates.status.active') : settings.status === 'archived' ? t('templates.status.archived') : t('templates.status.draft')}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('templateEditor.hotkeys.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('templateEditor.hotkeys.undo')}</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded border">Ctrl+Z</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('templateEditor.hotkeys.redo')}</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded border">Ctrl+Y</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('templateEditor.hotkeys.delete')}</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded border">Delete</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('templateEditor.hotkeys.duplicate')}</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded border">Ctrl+D</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('templateEditor.hotkeys.move')}</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded border">↑↓←→</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">+Shift:</span>
                  <span className="text-gray-500">{t('templateEditor.hotkeys.shift', '× 5 мм')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('templateEditor.hotkeys.deselect')}</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded border">Esc</kbd>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}