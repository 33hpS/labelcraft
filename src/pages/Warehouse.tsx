import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '../components/Layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Loader2, Package, Plus, Trash2, Save, Eye, QrCode, Check, X, Download, FileText, Camera, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useProducts } from '../hooks/useProducts';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { QRScanner } from '../components/QRScanner';
import { registerRobotoFont } from '../lib/pdfFonts';

interface ReceiptItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  notes?: string;
}

interface Receipt {
  id: string;
  receipt_number: string;
  status: 'draft' | 'completed' | 'cancelled';
  notes?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  completed_at?: string;
  items?: ReceiptItem[];
}

export default function WarehousePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const locale = i18n.language === 'ru' ? 'ru-RU' : i18n.language === 'ky' ? 'ky-KG' : 'en-US';
  
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  
  // Current receipt being created/edited
  const [currentReceipt, setCurrentReceipt] = useState<Receipt | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [receiptNotes, setReceiptNotes] = useState('');
  
  // QR Scanner dialog
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // View receipt dialog
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [viewReceiptItems, setViewReceiptItems] = useState<ReceiptItem[]>([]);
  
  // Load receipts
  const loadReceipts = async () => {
    setLoadingReceipts(true);
    try {
      const result = await api.get('/api/warehouse/receipts') as { receipts: Receipt[] };
      setReceipts(result.receipts || []);
    } catch (err) {
      console.error('Failed to load receipts:', err);
      toast.error(t('warehouse.loadError', 'Не удалось загрузить приёмки'));
    } finally {
      setLoadingReceipts(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  // Create new receipt
  const createNewReceipt = () => {
    const now = new Date();
    const receiptNumber = `РЦ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    
    setCurrentReceipt({
      id: crypto.randomUUID(),
      receipt_number: receiptNumber,
      status: 'draft',
      created_by: user?.id || '',
      created_by_name: user?.displayName || '',
      created_at: now.toISOString(),
    });
    setReceiptItems([]);
    setReceiptNotes('');
  };

  // Handle QR scan
  const handleScan = (code?: string) => {
    const codeToProcess = code || scannedCode.trim();
    if (!codeToProcess) {
      toast.error(t('warehouse.scan.enterOrScan', 'Введите или отсканируйте QR код'));
      return;
    }

    // Prevent duplicate scans within 200ms
    const now = Date.now();
    if (now - lastScanTimeRef.current < 200) {
      setScannedCode('');
      return;
    }
    lastScanTimeRef.current = now;

    const product = products.find(p => p.qr_code === codeToProcess || p.barcode === codeToProcess || p.sku === codeToProcess);
    
    if (!product) {
      toast.error(t('warehouse.scan.notFound', { defaultValue: 'Товар с кодом "{{code}}" не найден', code: codeToProcess }));
      setScannedCode('');
      scanInputRef.current?.focus();
      return;
    }

    // Check if already in list
    const existingIndex = receiptItems.findIndex(i => i.product_id === product.id);
    
    if (existingIndex >= 0) {
      // Increment quantity
      const updated = [...receiptItems];
      updated[existingIndex].quantity += 1;
      setReceiptItems(updated);
      toast.success(t('warehouse.scan.incremented', { defaultValue: '{{name}}: количество увеличено до {{qty}}', name: product.name, qty: updated[existingIndex].quantity }));
    } else {
      // Add new item
      const newItem: ReceiptItem = {
        id: crypto.randomUUID(),
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
      };
      setReceiptItems([...receiptItems, newItem]);
      toast.success(t('warehouse.scan.added', { defaultValue: 'Добавлен: {{name}}', name: product.name }));
    }
    
    // Clear immediately for next scan
    setScannedCode('');
    // Refocus input for barcode scanner
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 50);
  };

  // Update item quantity
  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) {
      toast.error(t('warehouse.quantity.minError', 'Количество должно быть больше 0'));
      return;
    }
    setReceiptItems(items => 
      items.map(i => i.id === itemId ? { ...i, quantity } : i)
    );
  };

  // Remove item
  const removeItem = (itemId: string) => {
    setReceiptItems(items => items.filter(i => i.id !== itemId));
  };

  // Save receipt
  const saveReceipt = async () => {
    if (!currentReceipt) return;
    
    if (receiptItems.length === 0) {
      toast.error(t('warehouse.save.noItems', 'Добавьте хотя бы один товар в приёмку'));
      return;
    }

    try {
      const payload = {
        receipt_number: currentReceipt.receipt_number,
        notes: receiptNotes || null,
        items: receiptItems.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          notes: i.notes || null,
        })),
      };

      await api.post('/api/warehouse/receipts', payload);
      
      toast.success(t('warehouse.save.success', 'Приёмка сохранена'));
      setCurrentReceipt(null);
      setReceiptItems([]);
      setReceiptNotes('');
      loadReceipts();
    } catch (err) {
      console.error('Failed to save receipt:', err);
      toast.error(t('warehouse.save.error', 'Не удалось сохранить приёмку'));
    }
  };

  // View receipt details
  const openReceiptDetails = async (receipt: Receipt) => {
    try {
      const result = await api.get(`/api/warehouse/receipts/${receipt.id}`) as { receipt: Receipt; items: ReceiptItem[] };
      setViewReceipt(result.receipt);
      setViewReceiptItems(result.items || []);
    } catch (err) {
      console.error('Failed to load receipt details:', err);
      toast.error(t('warehouse.view.loadError', 'Не удалось загрузить детали приёмки'));
    }
  };

  // Complete receipt
  const completeReceipt = async (receiptId: string) => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'https://productlabelerpro-worker.sherhan1988hp.workers.dev';
      const response = await fetch(`${baseURL}/api/warehouse/receipts/${receiptId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to complete receipt');
      toast.success(t('warehouse.complete.success', 'Приёмка завершена'));
      loadReceipts();
      if (viewReceipt && viewReceipt.id === receiptId) {
        setViewReceipt(null);
      }
    } catch (err) {
      console.error('Failed to complete receipt:', err);
      toast.error(t('warehouse.complete.error', 'Не удалось завершить приёмку'));
    }
  };

  // Export receipt to PDF
  const exportToPDF = async () => {
    if (!viewReceipt || viewReceiptItems.length === 0) return;

    try {
      const doc = new jsPDF();
      const fontsLoaded = await registerRobotoFont(doc);
      const baseFont = fontsLoaded ? 'Roboto' : 'helvetica';
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFont(baseFont, 'bold');
      doc.setFontSize(18);
      doc.text(t('warehouse.export.pdf.title', 'ПРИЁМКА НА СКЛАД'), pageWidth / 2, 20, { align: 'center' });
      
      // Receipt info
      doc.setFont(baseFont, 'normal');
      doc.setFontSize(12);
      doc.text(`${t('warehouse.export.pdf.number', 'Номер:')} ${viewReceipt.receipt_number}`, 20, 35);
      doc.text(`${t('warehouse.export.pdf.date', 'Дата:')} ${new Date(viewReceipt.created_at).toLocaleString(locale)}`, 20, 42);
      doc.text(`${t('warehouse.export.pdf.createdBy', 'Создал:')} ${viewReceipt.created_by_name}`, 20, 49);
      
      if (viewReceipt.notes) {
        doc.setFontSize(10);
        doc.text(`${t('warehouse.export.pdf.notes', 'Примечания:')} ${viewReceipt.notes}`, 20, 56);
      }

      // Table header
      const startY = viewReceipt.notes ? 65 : 58;
      doc.setFontSize(10);
      doc.setFont(baseFont, 'bold');
      doc.text(t('warehouse.export.pdf.colNo', '№'), 20, startY);
      doc.text(t('warehouse.export.pdf.colProduct', 'Товар'), 30, startY);
      doc.text(t('warehouse.export.pdf.colQty', 'Количество'), 160, startY);
      
      // Line under header
      doc.line(20, startY + 2, 190, startY + 2);

      // Table rows
      doc.setFont(baseFont, 'normal');
      let currentY = startY + 8;
      viewReceiptItems.forEach((item, index) => {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.text(`${index + 1}`, 20, currentY);
        const itemName = item.product_name.length > 80 
          ? item.product_name.substring(0, 77) + '...'
          : item.product_name;
        doc.text(itemName, 30, currentY);
        doc.text(`${item.quantity}`, 165, currentY);
        currentY += 7;
      });

      // Total
      currentY += 3;
      doc.line(20, currentY, 190, currentY);
      currentY += 7;
      doc.setFont(baseFont, 'bold');
      doc.text(t('warehouse.export.pdf.total', 'ИТОГО:'), 30, currentY);
      doc.text(`${t('warehouse.export.pdf.positions', 'Позиций:')} ${viewReceiptItems.length}`, 90, currentY);
      doc.text(`${t('warehouse.export.pdf.units', 'Единиц:')} ${viewReceiptItems.reduce((sum, i) => sum + i.quantity, 0)}`, 130, currentY);

      // Save
      doc.save(`${t('warehouse.export.pdf.filenamePrefix', 'Приёмка')}_${viewReceipt.receipt_number}.pdf`);
      toast.success(t('warehouse.export.pdf.saved', 'PDF сохранён'));
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(t('warehouse.export.pdf.error', 'Не удалось создать PDF'));
    }
  };

  // Export receipt to Excel
  const exportToExcel = () => {
    if (!viewReceipt || viewReceiptItems.length === 0) return;

    try {
      // Prepare data
      const data = [
        [t('warehouse.export.excel.title', 'ПРИЁМКА НА СКЛАД')],
        [],
        [t('warehouse.export.excel.number', 'Номер:'), viewReceipt.receipt_number],
        [t('warehouse.export.excel.date', 'Дата:'), new Date(viewReceipt.created_at).toLocaleString(locale)],
        [t('warehouse.export.excel.createdBy', 'Создал:'), viewReceipt.created_by_name],
      ];

      if (viewReceipt.notes) {
        data.push([t('warehouse.export.excel.notes', 'Примечания:'), viewReceipt.notes]);
      }

      data.push(
        [],
        [t('warehouse.export.excel.colNo', '№'), t('warehouse.export.excel.colProduct', 'Товар'), t('warehouse.export.excel.colQty', 'Количество')]
      );

      viewReceiptItems.forEach((item, index) => {
        data.push([String(index + 1), item.product_name, String(item.quantity)]);
      });

      data.push(
        [],
        [t('warehouse.export.excel.total', 'ИТОГО:'), `${t('warehouse.export.excel.positions', 'Позиций:')} ${viewReceiptItems.length}`, `${t('warehouse.export.excel.units', 'Единиц:')} ${viewReceiptItems.reduce((sum, i) => sum + i.quantity, 0)}`]
      );

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 5 },  // №
        { wch: 50 }, // Товар
        { wch: 15 }, // Количество
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('warehouse.export.excel.sheetName', 'Приёмка'));

      // Save
      XLSX.writeFile(wb, `${t('warehouse.export.excel.filenamePrefix', 'Приёмка')}_${viewReceipt.receipt_number}.xlsx`);
      toast.success(t('warehouse.export.excel.saved', 'Excel сохранён'));
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error(t('warehouse.export.excel.error', 'Не удалось создать Excel'));
    }
  };

  const totalItems = receiptItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('warehouse.title', 'Склад')}</h1>
            <p className="text-muted-foreground mt-1">{t('warehouse.subtitle', 'Приёмка товаров на склад')}</p>
          </div>
          {!currentReceipt && (
            <Button onClick={createNewReceipt} size="lg" className="w-full md:w-auto">
              <Plus className="h-5 w-5 mr-2" />
              {t('warehouse.create', 'Создать приёмку')}
            </Button>
          )}
        </div>

        {/* Create/Edit Receipt */}
        {currentReceipt && (
          <Card className="border-primary shadow-lg">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>{`${t('warehouse.newReceipt', 'Новая приёмка')}: ${currentReceipt.receipt_number}`}</CardTitle>
                  <CardDescription>{t('warehouse.scan.subtitle', 'Сканируйте QR-коды товаров или добавляйте вручную')}</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button onClick={() => setScannerOpen(true)} variant="outline" className="w-full sm:w-auto">
                    <QrCode className="h-4 w-4 mr-2" />
                    {t('warehouse.scan.open', 'Сканировать QR')}
                  </Button>
                  <Button onClick={saveReceipt} disabled={receiptItems.length === 0} className="w-full sm:w-auto">
                    <Save className="h-4 w-4 mr-2" />
                    {t('common.save', 'Сохранить')}
                  </Button>
                  <Button onClick={() => {
                    setCurrentReceipt(null);
                    setReceiptItems([]);
                    setReceiptNotes('');
                  }} variant="outline" className="w-full sm:w-auto">
                    <X className="h-4 w-4 mr-2" />
                    {t('common.cancel', 'Отмена')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('warehouse.notes.label', 'Примечания')}</Label>
                <Textarea
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  placeholder={t('warehouse.notes.placeholder', 'Дополнительная информация о приёмке...')}
                  rows={2}
                />
              </div>

              {receiptItems.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('warehouse.table.product', 'Товар')}</TableHead>
                        <TableHead className="w-32">{t('warehouse.table.quantity', 'Количество')}</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receiptItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  </div>
                  <div className="bg-muted px-4 py-3 border-t border-border">
                    <p className="text-sm font-medium">
                      {t('warehouse.totals.positions', 'Всего позиций')}: {receiptItems.length} | {t('warehouse.totals.units', 'Всего единиц')}: {totalItems}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground border border-border rounded-lg bg-muted">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('warehouse.empty.title', 'Нет товаров в приёмке')}</p>
                  <p className="text-sm mt-1">{t('warehouse.empty.hint', 'Нажмите "Сканировать QR" для добавления товаров')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Receipts History */}
        <Card>
          <CardHeader>
            <CardTitle>{t('warehouse.history.title', 'История приёмок')}</CardTitle>
            <CardDescription>{t('warehouse.history.subtitle', 'Все созданные приёмки на склад')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingReceipts ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t('warehouse.history.empty', 'Приёмки ещё не создавались')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('warehouse.history.number', 'Номер')}</TableHead>
                    <TableHead>{t('warehouse.history.status', 'Статус')}</TableHead>
                    <TableHead>{t('warehouse.history.createdBy', 'Создал')}</TableHead>
                    <TableHead>{t('warehouse.history.createdAt', 'Дата создания')}</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map(receipt => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-medium">{receipt.receipt_number}</TableCell>
                      <TableCell>
                        <Badge variant={receipt.status === 'completed' ? 'default' : 'secondary'}>
                          {receipt.status === 'draft' && t('warehouse.status.draft', 'Черновик')}
                          {receipt.status === 'completed' && t('warehouse.status.completed', 'Завершена')}
                          {receipt.status === 'cancelled' && t('warehouse.status.cancelled', 'Отменена')}
                        </Badge>
                      </TableCell>
                      <TableCell>{receipt.created_by_name}</TableCell>
                      <TableCell>
                        {new Date(receipt.created_at).toLocaleString(locale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReceiptDetails(receipt)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('warehouse.scan.dialogTitle', 'Сканирование QR-кода')}</DialogTitle>
            <DialogDescription>
              {t('warehouse.scan.dialogDescription', 'Используйте камеру телефона или введите код вручную')}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="camera" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera">
                <Camera className="h-4 w-4 mr-2" />
                {t('warehouse.camera.tabCamera', 'Камера')}
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Keyboard className="h-4 w-4 mr-2" />
                {t('warehouse.camera.tabManual', 'Ввод вручную')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="camera" className="space-y-4 py-4">
              <QRScanner
                continuous={true}
                onScan={(decodedText) => {
                  handleScan(decodedText);
                  // Don't close dialog - allow continuous scanning
                }}
                onError={(error) => {
                  console.error('Scanner error:', error);
                }}
              />
              <div className="text-center pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setScannerOpen(false)}
                  className="w-full"
                >
                  {t('warehouse.camera.close', 'Закрыть сканер')}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="qr-input">{t('warehouse.scan.label', 'QR/Штрих-код/Артикул')}</Label>
                <Input
                  id="qr-input"
                  ref={scanInputRef}
                  value={scannedCode}
                  onChange={(e) => {
                    const value = e.target.value;
                    setScannedCode(value);
                    
                    // Clear existing debounce timer
                    if (scanDebounceRef.current) {
                      clearTimeout(scanDebounceRef.current);
                    }
                    
                    // Auto-scan after 100ms of no input (USB scanner simulation)
                    if (value.trim().length > 3) {
                      scanDebounceRef.current = setTimeout(() => {
                        if (value.trim()) {
                          handleScan(value);
                        }
                      }, 100);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Clear debounce timer on Enter
                      if (scanDebounceRef.current) {
                        clearTimeout(scanDebounceRef.current);
                      }
                      handleScan();
                    }
                  }}
                  placeholder={t('warehouse.scan.placeholder', 'Введите код товара или используйте сканер...')}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  💡 {t('warehouse.scan.usbHint', 'USB сканер: просто сканируйте, код обработается автоматически')}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setScannerOpen(false);
                  setScannedCode('');
                }}>
                  {t('common.close', 'Закрыть')}
                </Button>
                <Button onClick={() => handleScan()}>
                  <Check className="h-4 w-4 mr-2" />
                  {t('common.add', 'Добавить')}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={!!viewReceipt} onOpenChange={() => setViewReceipt(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('warehouse.view.title', { defaultValue: 'Приёмка {{number}}', number: viewReceipt?.receipt_number })}</DialogTitle>
            <DialogDescription>
              {t('warehouse.view.meta', { defaultValue: 'Создана: {{date}} | Создал: {{name}}', date: viewReceipt && new Date(viewReceipt.created_at).toLocaleString(locale), name: viewReceipt?.created_by_name || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {viewReceipt?.notes && (
              <div>
                <Label>{t('warehouse.notes.label', 'Примечания')}</Label>
                <p className="text-sm text-muted-foreground mt-1">{viewReceipt.notes}</p>
              </div>
            )}
            
            {viewReceiptItems.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('warehouse.table.product', 'Товар')}</TableHead>
                      <TableHead className="text-right">{t('warehouse.table.quantity', 'Количество')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewReceiptItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="bg-muted px-4 py-3 border-t border-border">
                  <p className="text-sm font-medium">
                    {t('warehouse.totals.positions', 'Всего позиций')}: {viewReceiptItems.length} | 
                    {t('warehouse.totals.units', 'Всего единиц')}: {viewReceiptItems.reduce((sum, i) => sum + i.quantity, 0)}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex items-center gap-2 flex-1">
              <Button variant="outline" onClick={exportToPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {viewReceipt?.status === 'draft' && (
                <Button onClick={() => viewReceipt && completeReceipt(viewReceipt.id)}>
                  <Check className="h-4 w-4 mr-2" />
                  {t('warehouse.complete.action', 'Завершить приёмку')}
                </Button>
              )}
              <Button variant="outline" onClick={() => setViewReceipt(null)}>
                {t('common.close', 'Закрыть')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
