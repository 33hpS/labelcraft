/**
 * Operator interface for scanning and printing + Production stage tracking
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '../components/Layout/AppLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Label } from '../components/ui/label';
import { Scan, Download, CheckCircle, XCircle, FileText, Printer, RefreshCw, Camera, Keyboard, Factory, Clock, Play, Square } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useTemplates } from '../hooks/useTemplates';
import {
  buildTemplateProductData,
  parseMetadata,
  parseTemplateData,
  registerRobotoFont,
  renderTemplateToPdf,
  renderAndPrintLabel,
} from '../lib/labelPrinter';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { QRScanner } from '../components/QRScanner';
import { SegmentPathViewer } from '../components/SegmentPathViewer';

interface PrintLog {
  id: string;
  productName: string;
  timestamp: string;
  status: 'success' | 'error';
  template: string;
}

interface ProductionStage {
  id: string;
  name: string;
  sequence_order: number;
  department?: string;
  estimated_duration?: number;
}

interface ScanHistory {
  id: string;
  qr_code: string;
  stage_name: string;
  scan_type: 'start' | 'finish';
  timestamp: string;
  operator_name: string;
  order_id?: string;
}

interface CurrentStageInfo {
  order_id: string;
  order_qr: string;
  stage_name: string;
  status: 'started' | 'completed';
  start_time: string;
  operator_name: string;
  elapsed_minutes?: number;
}

export default function OperatorPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'printing' | 'production'>('printing');
  const [scanInput, setScanInput] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  
  // Production stage tracking
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [operatorName, setOperatorName] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [currentStageInfo, setCurrentStageInfo] = useState<CurrentStageInfo | null>(null);
  const [loadingStages, setLoadingStages] = useState(false);
  
  // Загрузка товаров и шаблонов из базы данных
  const { products } = useProducts();
  const { templates } = useTemplates();

  // Автоматически выбираем активный шаблон или первый доступный
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      const activeTemplate = templates.find(t => t.status === 'active');
      setSelectedTemplateId(activeTemplate?.id || templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  // Загрузка производственных этапов
  useEffect(() => {
    if (mode === 'production') {
      loadProductionStages();
      // Загрузить имя оператора из localStorage
      const savedOperatorName = localStorage.getItem('operator_name');
      if (savedOperatorName) {
        setOperatorName(savedOperatorName);
      }
    }
  }, [mode]);

  const loadProductionStages = async () => {
    setLoadingStages(true);
    try {
      const response = await fetch('/api/production/stages');
      if (response.ok) {
        const data = await response.json();
        setProductionStages(data.stages || []);
        if (data.stages && data.stages.length > 0 && !selectedStageId) {
          setSelectedStageId(data.stages[0].id);
        }
      } else {
        setMessage({ type: 'error', text: 'Не удалось загрузить этапы производства' });
      }
    } catch (error) {
      console.error('Error loading production stages:', error);
      setMessage({ type: 'error', text: 'Ошибка подключения к серверу' });
    } finally {
      setLoadingStages(false);
    }
  };

  const handleProductionScan = async () => {
    const qrCode = scanInput.trim();
    if (!qrCode) {
      setMessage({ type: 'error', text: 'Введите QR-код заказа' });
      return;
    }

    if (!selectedStageId) {
      setMessage({ type: 'error', text: 'Выберите этап производства' });
      return;
    }

    if (!operatorName.trim()) {
      setMessage({ type: 'error', text: 'Введите ваше имя' });
      return;
    }

    // Сохранить имя оператора
    localStorage.setItem('operator_name', operatorName);

    try {
      const response = await fetch('/api/production/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_code: qrCode,
          stage_id: selectedStageId,
          operator_name: operatorName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const stage = productionStages.find(s => s.id === selectedStageId);
        const scanType = data.scan_type === 'start' ? 'НАЧАЛО' : 'ЗАВЕРШЕНИЕ';
        
        setMessage({
          type: 'success',
          text: `✓ ${scanType} этапа "${stage?.name}"\nЗаказ: ${data.order?.qr_code || qrCode}\n${data.scan_type === 'finish' ? `Длительность: ${data.duration_minutes} мин` : ''}`,
        });

        // Добавить в историю
        const newScan: ScanHistory = {
          id: Date.now().toString(),
          qr_code: qrCode,
          stage_name: stage?.name || '',
          scan_type: data.scan_type,
          timestamp: new Date().toLocaleString('ru-RU'),
          operator_name: operatorName,
          order_id: data.order?.id,
        };
        setScanHistory([newScan, ...scanHistory.slice(0, 9)]);

        // Обновить текущий статус этапа
        if (data.scan_type === 'start') {
          setCurrentStageInfo({
            order_id: data.order?.id,
            order_qr: data.order?.qr_code || qrCode,
            stage_name: stage?.name || '',
            status: 'started',
            start_time: new Date().toISOString(),
            operator_name: operatorName,
          });
        } else {
          setCurrentStageInfo(null);
        }

        setScanInput('');
      } else {
        setMessage({ type: 'error', text: data.message || 'Ошибка сканирования' });
      }
    } catch (error) {
      console.error('Production scan error:', error);
      setMessage({ type: 'error', text: 'Ошибка подключения к серверу' });
    }
  };

  const printLogs: PrintLog[] = [
    {
      id: '1',
      productName: t('operator.sample.product1', 'Пример товара 1'),
      timestamp: '2024-01-15 14:30',
      status: 'success',
      template: t('operator.sample.templateMain', 'Основной шаблон')
    },
    {
      id: '2',
      productName: t('operator.sample.product2', 'Пример товара 2'), 
      timestamp: '2024-01-15 14:25',
      status: 'success',
      template: t('operator.sample.templateSmall', 'Малый QR-код')
    },
    {
      id: '3',
      productName: t('operator.sample.unknown', 'Неизвестный код'),
      timestamp: '2024-01-15 14:20',
      status: 'error',
      template: '-'
    }
  ];

  useEffect(() => {
    // Автофокус на поле ввода для сканирования
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleScan = (code?: string) => {
    const scanCode = code || scanInput.trim();
    if (scanCode) {
      setLastScanned(scanCode);
      
      try {
        // Попытка распарсить как JSON (QR-код товара из модального окна)
        const qrData = JSON.parse(scanCode);
        
        if (qrData.type === 'product' && qrData.action === 'print-label') {
          // Это QR-код для печати этикетки (полный формат)
          // Найти товар в базе данных для получения актуальных данных
          const product = products.find(p => p.id === qrData.id || p.qr_code === qrData.qrCode);
          
          if (product) {
            const metadata = parseMetadata(product.metadata);

            const productData = {
              ...qrData,
              productName: product.name,
              name: product.name,
              sku: product.sku,
              price: metadata?.price,
              weight: product.weight,
              volume: product.volume,
              unit: metadata?.unit,
              barcode: product.barcode || metadata?.barcode,
              manufacturer: metadata?.manufacturer,
              expiryDate: metadata?.expiryDate,
              productionDate: metadata?.productionDate || metadata?.productDate,
              batchNumber: metadata?.batchNumber,
              metadata,
              qrCode: product.qr_code || product.sku || product.barcode || product.name || `PRODUCT-${product.id}`,
              qr_code: product.qr_code || product.sku || product.barcode || product.name || `PRODUCT-${product.id}`
            };
            
            setCurrentProduct(productData);
            setMessage({ 
              type: 'success', 
              text: t('operator.scan.productRecognized', { defaultValue: '✓ Товар "{{name}}" распознан! QR: {{qr}}. Готово к печати.', name: product.name, qr: product.qr_code })
            });
          } else {
            setMessage({ 
              type: 'error', 
              text: t('operator.scan.notFoundByQr', { defaultValue: 'Товар с QR "{{qr}}" не найден в базе данных', qr: qrData.qrCode })
            });
          }
        } else {
          setMessage({ type: 'error', text: t('operator.scan.unknownFormat', 'Неизвестный формат QR-кода') });
        }
      } catch (e) {
        // Не JSON - попробовать найти товар по текстовому QR-коду, названию или артикулу
        const searchText = scanCode.trim();
        
        // 1. Поиск по точному совпадению QR-кода
        let product = products.find(p => p.qr_code === searchText);
        
        // 2. Если не найден по QR, искать по точному совпадению названия
        if (!product) {
          product = products.find(p => p.name.toLowerCase() === searchText.toLowerCase());
        }
        
        // 3. Если не найден, искать по точному совпадению артикула
        if (!product) {
          product = products.find(p => p.sku?.toLowerCase() === searchText.toLowerCase());
        }
        
        // 4. Если не найден, искать по частичному совпадению названия
        if (!product) {
          product = products.find(p => p.name.toLowerCase().includes(searchText.toLowerCase()));
        }
        
        // 5. Если не найден, искать по штрихкоду
        if (!product) {
          product = products.find(p => p.barcode === searchText);
        }
        
        if (product) {
          // Товар найден
          const metadata = parseMetadata(product.metadata);

          const productData = {
            type: 'product',
            id: product.id,
            qrCode: product.qr_code || product.sku || product.barcode || product.name || `PRODUCT-${product.id}`,
            qr_code: product.qr_code || product.sku || product.barcode || product.name || `PRODUCT-${product.id}`,
            productName: product.name,
            name: product.name,
            sku: product.sku,
            price: metadata?.price,
            weight: product.weight,
            volume: product.volume,
            unit: metadata?.unit,
            barcode: product.barcode || metadata?.barcode,
            manufacturer: metadata?.manufacturer,
            expiryDate: metadata?.expiryDate,
            productionDate: metadata?.productionDate || metadata?.productDate,
            batchNumber: metadata?.batchNumber,
            metadata,
            action: 'print-label'
          };
          
          setCurrentProduct(productData);
          setMessage({ 
            type: 'success', 
            text: t('operator.scan.foundByQr', { defaultValue: '✓ Товар "{{name}}" найден по QR: {{qr}}. Готово к печати.', name: product.name, qr: product.qr_code })
          });
        } else {
          setMessage({ 
            type: 'error', 
            text: t('operator.scan.notFoundTextQr', { defaultValue: 'Товар с QR-кодом "{{qr}}" не найден в базе данных. Проверьте код или создайте товар.', qr: searchText })
          });
        }
      }
      
      setScanInput('');
    }
  };

  const handlePrint = async (productData?: any) => {
    try {
      const product = productData || currentProduct;
      if (!product) {
        setMessage({ type: 'error', text: t('operator.print.noScan', 'Сначала отсканируйте QR-код товара') });
        return;
      }
      const templateId = selectedTemplateId || templates[0]?.id;
      if (!templateId) {
        setMessage({ type: 'error', text: t('operator.print.noTemplates', 'Нет доступных шаблонов для печати') });
        return;
      }
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        setMessage({ type: 'error', text: t('operator.print.templateNotFound', 'Выбранный шаблон не найден') });
        return;
      }
      await renderAndPrintLabel(product, template);
      setMessage({ type: 'success', text: t('operator.print.sent', 'Этикетка отправлена на печать') });
    } catch (err) {
      console.error('Operator print error:', err);
      setMessage({ type: 'error', text: t('operator.print.error', 'Не удалось напечатать этикетку') });
    }
  };

  const handleSavePDF = async () => {
    const product = currentProduct;
    if (!product) {
      setMessage({ type: 'error', text: t('operator.pdf.noProduct', 'Нет данных товара для сохранения') });
      return;
    }
    
    if (!selectedTemplateId) {
      setMessage({ type: 'error', text: t('operator.pdf.noTemplateSelected', 'Выберите шаблон для сохранения') });
      return;
    }
    
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) {
      setMessage({ type: 'error', text: t('operator.pdf.templateNotFound', 'Выбранный шаблон не найден') });
      return;
    }

    setMessage({ 
      type: 'success', 
      text: t('operator.pdf.creating', { defaultValue: 'Создание PDF для товара {{qr}}...', qr: product.qrCode })
    });

    try {
      const { templateSettings, templateElements } = parseTemplateData(template);
      const productData = buildTemplateProductData(product);

      // Определяем QR-код с fallback значениями
      const qrCodeValue = product.qrCode || product.qr_code || product.barcode || product.sku || product.name || `PRODUCT-${product.id}`;

      const qrDataUrl = await QRCode.toDataURL(
        JSON.stringify({
          type: 'product',
          id: product.id,
          qrCode: qrCodeValue,
          action: 'print-label'
        }),
        {
          width: 150,
          margin: 1,
          errorCorrectionLevel: 'M'
        }
      );

      const pdf = new jsPDF(
        templateSettings.width >= templateSettings.height ? 'landscape' : 'portrait',
        'mm',
        [templateSettings.width, templateSettings.height]
      );

      const fontsOk = await registerRobotoFont(pdf);
      if (!fontsOk) {
        console.warn('Roboto font could not be registered; Cyrillic rendering may be incorrect.');
      }

      await renderTemplateToPdf(pdf, templateSettings, templateElements, productData, fontsOk);

      const fileName = `этикетка_${product.qrCode || product.qr_code || 'label'}_${Date.now()}.pdf`;
      pdf.save(fileName);

      setMessage({
        type: 'success',
        text: t('operator.pdf.saved', { defaultValue: '✓ PDF сохранен! Товар: {{qr}}, Шаблон: {{template}}', qr: product.qrCode, template: template.name })
      });

    } catch (err) {
      console.error('PDF generation error:', err);
      setMessage({ 
        type: 'error', 
        text: t('operator.pdf.error', { defaultValue: 'Ошибка создания PDF: {{msg}}', msg: (err instanceof Error ? err.message : 'Неизвестная ошибка') })
      });
    }
  };

  const repeatLast = () => {
    if (lastScanned) {
      setScanInput(lastScanned);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">{t('operator.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('operator.subtitle')}</p>
        </div>

        {/* Переключатель режима */}
        <Card className="border-2">
          <CardContent className="pt-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'printing' | 'production')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="printing" className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Печать этикеток
                </TabsTrigger>
                <TabsTrigger value="production" className="flex items-center gap-2">
                  <Factory className="h-4 w-4" />
                  Производственные этапы
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {mode === 'printing' ? (
          <>
            {/* Режим печати этикеток */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Панель сканирования */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scan className="h-5 w-5" />
                    {t('operator.scanQR')}
                  </CardTitle>
                  <CardDescription>
                    {t('operator.scanInstruction')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Выбор шаблона */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t('operator.selectTemplate')}
                    </label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('operator.selectTemplate')} />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.length === 0 ? (
                          <SelectItem value="none" disabled>
                            {t('operator.noTemplates')}
                          </SelectItem>
                        ) : (
                          templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name} {template.status === 'active' ? '✓' : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">QR</label>
                    <Input
                      ref={inputRef}
                      placeholder={t('operator.scanQR')}
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => handleScan()} className="w-full sm:flex-1">
                      <Scan className="h-4 w-4 mr-2" />
                      {t('operator.scanQR')}
                    </Button>
                    <Button variant="outline" onClick={() => setScannerOpen(true)} className="w-full sm:flex-1">
                      <Camera className="h-4 w-4 mr-2" />
                      {t('operator.scan.openCamera', 'Камера')}
                    </Button>
                    <Button variant="outline" onClick={repeatLast} disabled={!lastScanned} className="w-full sm:w-auto">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  {message && (
                    <div className={`p-3 border rounded-md ${
                      message.type === 'success'
                        ? 'bg-accent border-border'
                        : 'bg-destructive/10 border-border'
                    }`}>
                      <p className={`text-sm ${
                        message.type === 'success' ? 'text-primary' : 'text-destructive'
                      }`}>
                        {message.text}
                      </p>
                    </div>
                  )}

                  {currentProduct && (
                    <div className="p-3 bg-accent border border-border rounded-md">
                      <p className="text-sm text-primary">
                        <strong>Текущий товар:</strong> {currentProduct.qrCode}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Панель действий */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Printer className="h-5 w-5" />
                    {t('operator.printLabel')}
                  </CardTitle>
                  <CardDescription>
                    {t('operator.scanInstruction')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full"
                    disabled={!currentProduct || !selectedTemplateId}
                    onClick={() => handlePrint()}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    {t('orders.print')}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full bg-transparent" 
                    disabled={!currentProduct || !selectedTemplateId}
                    onClick={handleSavePDF}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('orders.savePdf')}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Журнал операций печати */}
            <Card>
              <CardHeader>
                <CardTitle>{t('home.recentActivity')}</CardTitle>
                <CardDescription>
                  {t('home.recentActivityDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {printLogs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        {log.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                        <div>
                          <p className="font-medium">{log.productName}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.timestamp} • {log.template}
                          </p>
                        </div>
                      </div>
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status === 'success' ? t('common.success') : t('common.error')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Режим производственных этапов */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Панель сканирования для производства */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scan className="h-5 w-5" />
                    Сканирование этапа
                  </CardTitle>
                  <CardDescription>
                    Сканируйте QR-код заказа для начала/завершения этапа
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Имя оператора */}
                  <div className="space-y-2">
                    <Label htmlFor="operator-name">Ваше имя</Label>
                    <Input
                      id="operator-name"
                      placeholder="Введите ваше имя"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                    />
                  </div>

                  {/* Выбор этапа */}
                  <div className="space-y-2">
                    <Label>Этап производства</Label>
                    <Select 
                      value={selectedStageId} 
                      onValueChange={setSelectedStageId}
                      disabled={loadingStages}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите этап" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionStages.length === 0 ? (
                          <SelectItem value="none" disabled>
                            {loadingStages ? 'Загрузка...' : 'Нет доступных этапов'}
                          </SelectItem>
                        ) : (
                          productionStages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.sequence_order}. {stage.name}
                              {stage.department ? ` (${stage.department})` : ''}
                              {stage.estimated_duration ? ` - ~${stage.estimated_duration} мин` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Поле ввода QR */}
                  <div className="space-y-2">
                    <Label>QR-код заказа</Label>
                    <Input
                      ref={inputRef}
                      placeholder="Отсканируйте QR заказа"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleProductionScan();
                        }
                      }}
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleProductionScan} 
                      className="flex-1"
                      disabled={!scanInput.trim() || !selectedStageId || !operatorName.trim()}
                    >
                      <Scan className="h-4 w-4 mr-2" />
                      Сканировать
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setScannerOpen(true)}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>

                  {message && (
                    <div className={`p-3 border rounded-md whitespace-pre-line ${
                      message.type === 'success'
                        ? 'bg-accent border-border'
                        : 'bg-destructive/10 border-border'
                    }`}>
                      <p className={`text-sm ${
                        message.type === 'success' ? 'text-primary' : 'text-destructive'
                      }`}>
                        {message.text}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Текущий статус и информация */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Текущий этап
                  </CardTitle>
                  <CardDescription>
                    Информация о выполняемом этапе
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentStageInfo ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Play className="h-5 w-5 text-primary animate-pulse" />
                          <div>
                            <p className="font-medium">{currentStageInfo.stage_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Заказ: {currentStageInfo.order_qr}
                            </p>
                          </div>
                        </div>
                        <Badge variant="default">В работе</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Оператор:</p>
                          <p className="font-medium">{currentStageInfo.operator_name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Начало:</p>
                          <p className="font-medium">
                            {new Date(currentStageInfo.start_time).toLocaleTimeString('ru-RU')}
                          </p>
                        </div>
                      </div>
                      <div className="p-3 bg-accent border border-border rounded-md">
                        <p className="text-sm text-center">
                          Для завершения этапа отсканируйте QR-код заказа повторно
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Square className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Нет активного этапа</p>
                      <p className="text-sm mt-1">
                        Отсканируйте QR-код заказа для начала работы
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Маршрут производства (сегмент/цех) */}
              <div className="lg:col-span-2">
                <SegmentPathViewer />
              </div>

              {/* История сканирований */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>История сканирований</CardTitle>
                  <CardDescription>
                    Последние операции за смену
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {scanHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Нет записей за сегодня</p>
                      </div>
                    ) : (
                      scanHistory.map((scan) => (
                        <div 
                          key={scan.id} 
                          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border border-border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {scan.scan_type === 'start' ? (
                              <Play className="h-5 w-5 text-primary" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            )}
                            <div>
                              <p className="font-medium">
                                {scan.scan_type === 'start' ? 'НАЧАЛО' : 'ЗАВЕРШЕНИЕ'}: {scan.stage_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {scan.timestamp} • {scan.qr_code} • {scan.operator_name}
                              </p>
                            </div>
                          </div>
                          <Badge variant={scan.scan_type === 'start' ? 'default' : 'outline'}>
                            {scan.scan_type === 'start' ? 'Старт' : 'Финиш'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* QR Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('operator.scan.dialogTitle', 'Сканирование QR-кода')}</DialogTitle>
            <DialogDescription>
              {t('operator.scan.dialogDescription', 'Используйте камеру телефона или введите код вручную')}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="camera" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera">
                <Camera className="h-4 w-4 mr-2" />
                {t('operator.scan.tabCamera', 'Камера')}
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Keyboard className="h-4 w-4 mr-2" />
                {t('operator.scan.tabManual', 'Ввод вручную')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="camera" className="space-y-4 py-4">
              <QRScanner
                continuous={false}
                onScan={(decodedText) => {
                  if (mode === 'printing') {
                    handleScan(decodedText);
                  } else {
                    setScanInput(decodedText);
                  }
                  setTimeout(() => {
                    setScannerOpen(false);
                  }, 500);
                }}
                onError={(error) => {
                  console.error('Scanner error:', error);
                }}
              />
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="qr-manual-input">
                  {mode === 'printing' ? 'QR/Штрих-код/Артикул' : 'QR-код заказа'}
                </Label>
                <Input
                  id="qr-manual-input"
                  ref={scanInputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (mode === 'printing') {
                        handleScan();
                      } else {
                        handleProductionScan();
                      }
                      setScannerOpen(false);
                    }
                  }}
                  placeholder={mode === 'printing' ? 'Введите код товара...' : 'Введите QR заказа...'}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setScannerOpen(false);
                  setScanInput('');
                }}>
                  {t('common.close', 'Закрыть')}
                </Button>
                <Button onClick={() => {
                  if (mode === 'printing') {
                    handleScan();
                  } else {
                    handleProductionScan();
                  }
                  setScannerOpen(false);
                }}>
                  <Scan className="h-4 w-4 mr-2" />
                  {t('common.add', 'Добавить')}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
