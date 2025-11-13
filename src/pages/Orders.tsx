import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '../components/Layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { AlertTriangle, CheckCircle2, Loader2, Package, Printer, Upload, Key, ChevronDown, ChevronRight, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useOrders, type OrderItem, type OrderSummary } from '../hooks/useOrders';
import { renderAndPrintLabel, exportLabelToPdf } from '../lib/labelPrinter';
import { useTemplates } from '../hooks/useTemplates';
import { useProducts } from '../hooks/useProducts';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ImportPreviewItem {
  name: string;
  quantity: number;
}

interface ImportPreview {
  title: string;
  source?: string;
  items: ImportPreviewItem[];
}

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

const normalizeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const str = String(value).replace(/[^0-9,\.]/g, '').replace(',', '.');
  if (!str) return null;
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : null;
};

const detectHeaderRowIndex = (rows: unknown[][]): number => {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const firstCell = row[0];
    if (typeof firstCell !== 'string') continue;
    const normalized = firstCell.trim().toLowerCase();
    if (normalized.includes('продукц')) {
      return i;
    }
  }
  return -1;
};

const detectQuantityColumn = (headerRow: unknown[]): number => {
  if (!Array.isArray(headerRow)) return 1;
  for (let index = 0; index < headerRow.length; index += 1) {
    const cell = headerRow[index];
    if (typeof cell !== 'string') continue;
    const normalized = cell.trim().toLowerCase();
    if (normalized.includes('общее') && normalized.includes('кол')) {
      return index;
    }
  }
  return 1;
};

const extractTitle = (rows: unknown[][], fallback: string): string => {
  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (typeof cell !== 'string') continue;
      const normalized = cell.trim();
      if (!normalized) continue;
      const lower = normalized.toLowerCase();
      if (lower.includes('производственно') || lower.includes('задание')) {
        return normalized;
      }
    }
  }
  return fallback;
};

const parseProductionOrder = async (file: File): Promise<ImportPreview> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const headerIndex = detectHeaderRowIndex(rows);
  if (headerIndex === -1) {
    throw new Error('Не удалось найти секцию "Продукция" в файле');
  }

  const quantityColumn = detectQuantityColumn(rows[headerIndex] || []);
  const itemsMap = new Map<string, number>();

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    const firstCell = row[0];
    if (typeof firstCell === 'string' && firstCell.trim().toLowerCase().startsWith('материал')) {
      break;
    }

    const name = typeof firstCell === 'string' ? firstCell.trim() : '';
    const quantityRaw = row[quantityColumn];
    const quantity = normalizeNumber(quantityRaw);

    if (!name || quantity === null || quantity <= 0) {
      continue;
    }

    itemsMap.set(name, (itemsMap.get(name) || 0) + Math.round(quantity));
  }

  if (itemsMap.size === 0) {
    throw new Error('В файле нет позиций с количеством для печати');
  }

  const title = extractTitle(rows, file.name.replace(/\.[^/.]+$/, ''));

  return {
    title,
    source: file.name,
    items: Array.from(itemsMap.entries()).map(([name, quantity]) => ({ name, quantity })),
  };
};

// Date formatting will be localized inside the component using i18n.language

export default function OrdersPage() {
  const { t, i18n } = useTranslation();
  const {
    orders: ordersData,
    refetchOrders,
  } = useOrders();
  const orders = Array.isArray(ordersData) ? ordersData : [];
  const { templates: templatesData } = useTemplates();
  const templates = Array.isArray(templatesData) ? templatesData : [];
  const { products: productsData } = useProducts();
  const products = Array.isArray(productsData) ? productsData : [];
  const { user } = useAuth();

  // Debug: Log user info
  useEffect(() => {
    console.log('Current user:', user);
    console.log('User role:', user?.role);
    console.log('Is admin?:', user?.role === 'admin');
  }, [user]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const [savingItems, setSavingItems] = useState<Record<string, boolean>>({});
  const [printingItems, setPrintingItems] = useState<Record<string, boolean>>({});
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [adminExtraQty, setAdminExtraQty] = useState('');
  const [adminTargetItem, setAdminTargetItem] = useState<OrderItem | null>(null);
  const [adminTargetOrderId, setAdminTargetOrderId] = useState('');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetOrderId, setDeleteTargetOrderId] = useState('');
  const [deleteTargetOrderTitle, setDeleteTargetOrderTitle] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ORDERS_PER_PAGE = 20;

  // Filter visible orders for assemblers with segment (lux/econom)
  const visibleOrders = useMemo(() => {
    if (!user || user.role !== 'assembler' || !user.segment) return orders;
    // Use order.segment field for reliable filtering
    return orders.filter(o => o.segment === user.segment);
  }, [orders, user]);

  // Автоматически выбираем первый шаблон при загрузке
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);
  
  // Track which orders are expanded
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Track items for each order
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<Set<string>>(new Set());

  // Toggle order expansion
  const toggleOrder = async (orderId: string) => {
    const isExpanding = !expandedOrders.has(orderId);
    
    if (isExpanding) {
      setExpandedOrders(prev => new Set(prev).add(orderId));
      
      // Load items if not already loaded
      if (!orderItems[orderId]) {
        setLoadingOrders(prev => new Set(prev).add(orderId));
        try {
          const response = await api.getOrder(orderId);
          setOrderItems(prev => ({ ...prev, [orderId]: response.items || [] }));
        } catch (err) {
          console.error('Failed to load order items:', err);
        } finally {
          setLoadingOrders(prev => {
            const next = new Set(prev);
            next.delete(orderId);
            return next;
          });
        }
      }
    } else {
      setExpandedOrders(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Update local items after changes
  const updateOrderItems = (orderId: string, newItems: OrderItem[]) => {
    setOrderItems(prev => ({ ...prev, [orderId]: newItems }));
  };

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      const activeTemplate = templates.find((tpl) => tpl.status === 'active');
      setSelectedTemplateId(activeTemplate?.id || templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFileName(file ? file.name : null);
    if (!file) return;

    setImportError(null);
    setImportPreview(null);
    setParsing(true);
    try {
      const preview = await parseProductionOrder(file);
      setImportPreview(preview);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('orders.parseError'));
    } finally {
      setParsing(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const response = await api.importOrder({
        title: importPreview.title,
        source: importPreview.source,
        items: importPreview.items,
      });
      setImportPreview(null);
      await refetchOrders();
      
      // Показываем информацию о созданных продуктах
      if (response.products_created > 0) {
        toast.success(t('orders.toasts.importedCreated', { count: response.products_created }));
      } else {
        toast.success(t('orders.toasts.importedAllBound'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('orders.toasts.importError'));
    } finally {
      setImporting(false);
    }
  };

  const handleAssignProduct = async (orderId: string, item: OrderItem, productId: string | null) => {
    setSavingItems((prev) => ({ ...prev, [item.id]: true }));
    try {
      const response = await api.updateOrderItem(orderId, item.id, { productId });
      if (response?.item) {
        // Update local items
        const currentItems = orderItems[orderId] || [];
        const updatedItems = currentItems.map((row) => (row.id === item.id ? response.item : row));
        updateOrderItems(orderId, updatedItems);
      } else {
        // Refetch order
        const orderResponse = await api.getOrder(orderId);
        updateOrderItems(orderId, orderResponse.items || []);
      }
      // Refetch orders list to update summary
      await refetchOrders();
      toast.success(productId ? t('orders.toasts.assignBound') : t('orders.toasts.assignCleared'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('orders.toasts.assignUpdateError'));
    } finally {
      setSavingItems((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handlePrint = async (orderId: string, item: OrderItem) => {
    // Автоматически используем первый шаблон если не выбран
    const templateId = selectedTemplateId || templates[0]?.id;
    if (!templateId) {
      toast.error(t('orders.toasts.noTemplatesToPrint'));
      return;
    }
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      toast.error(t('orders.toasts.templateNotFound'));
      return;
    }
    const product = products.find((p) => p.id === item.product_id);
    if (!product) {
      toast.error(t('orders.toasts.productNotBound'));
      return;
    }
    setPrintingItems((prev) => ({ ...prev, [item.id]: true }));
    try {
      // Check quota before printing
      const canPrint = await api.printOrderItem(orderId, item.id);
      if (!canPrint.allowed) {
        toast.error(canPrint.message || t('orders.toasts.printForbidden'));
        return;
      }
      // Render and print label (pass order title for placeholders)
  const order = orders.find(o => o.id === orderId) || visibleOrders.find(o => o.id === orderId);
      const productForLabel = { ...product, orderName: order?.title ?? '' };
      await renderAndPrintLabel(productForLabel, template);
      // Refetch to update printed count
      const orderResponse = await api.getOrder(orderId);
      updateOrderItems(orderId, orderResponse.items || []);
      await refetchOrders();
      toast.success(t('orders.toasts.labelPrintedFor', { name: item.name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('orders.toasts.printError'));
    } finally {
      setPrintingItems((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleAdminOpen = (orderId: string, item: OrderItem) => {
    setAdminTargetItem(item);
    setAdminTargetOrderId(orderId);
    setAdminKey('');
    setAdminExtraQty('');
    setAdminDialogOpen(true);
  };

  const handleAdminConfirm = async () => {
    if (!adminTargetOrderId || !adminTargetItem) return;
    const qty = parseInt(adminExtraQty, 10);
    if (!qty || qty <= 0) {
      toast.error(t('orders.toasts.extraQtyInvalid'));
      return;
    }
    try {
      await api.allowExtraPrints(adminTargetOrderId, adminTargetItem.id, qty, adminKey);
      const orderResponse = await api.getOrder(adminTargetOrderId);
      updateOrderItems(adminTargetOrderId, orderResponse.items || []);
      await refetchOrders();
      toast.success(t('orders.toasts.extraAllowed', { qty, name: adminTargetItem.name }));
      setAdminDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('orders.toasts.extraAllowError'));
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteTargetOrderId) return;
    setDeleting(true);
    try {
      await api.deleteOrder(deleteTargetOrderId);
      await refetchOrders();
      toast.success(t('orders.toasts.deletedWithTitle', { title: deleteTargetOrderTitle }));
      setDeleteDialogOpen(false);
      setDeleteTargetOrderId('');
      setDeleteTargetOrderTitle('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('orders.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const handleAdminSavePdf = async (orderId: string, item: OrderItem) => {
    try {
      if (!user || user.role !== 'admin') {
        toast.error(t('orders.toasts.pdfAdminOnly'));
        return;
      }
      const templateId = selectedTemplateId || templates[0]?.id;
      if (!templateId) {
        toast.error(t('orders.toasts.noTemplatesToSave'));
        return;
      }
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        toast.error(t('orders.toasts.templateNotFound'));
        return;
      }
      
      // Если товар привязан - используем его, иначе создаем временный объект с данными из позиции заказа
      let product = products.find(p => p.id === item.product_id);
  const order = orders.find(o => o.id === orderId) || visibleOrders.find(o => o.id === orderId);
      if (!product) {
        // Создаем временный продукт из данных позиции заказа
        product = {
          id: `temp-${item.id}`,
          name: item.name,
          sku: item.name,
          barcode: '',
          qr_code: `ORDER-${orderId}-${item.id}`,
          orderName: order?.title ?? '',
          metadata: { source: 'order', order_id: orderId, item_id: item.id, orderName: order?.title ?? '' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any;
      } else {
        // Attach orderName for templates
        product = { ...product, orderName: order?.title ?? '' } as any;
      }

      const pdfDataUrl = await exportLabelToPdf(product, template);
      
      // Скачиваем PDF файл
      const link = document.createElement('a');
      link.href = pdfDataUrl;
      link.download = `${item.name || 'label'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(t('orders.toasts.pdfSavedFor', { name: item.name }));
    } catch (err) {
      console.error('Admin PDF export error:', err);
      toast.error(err instanceof Error ? err.message : t('orders.toasts.pdfSaveError'));
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('orders.pageTitle')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{t('orders.pageSubtitle')}</p>
          </div>
          <div className="flex flex-col gap-3 sm:gap-2 sm:flex-row sm:items-end">
            <div className="w-full sm:w-64">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">{t('orders.labelTemplate')}</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('orders.chooseTemplate')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && (
                    <SelectItem value="none" disabled>
                      {t('orders.noTemplates')}
                    </SelectItem>
                  )}
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} {template.status === 'active' ? '✓' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 sm:pt-6">
              <Checkbox 
                id="auto-print" 
                checked={autoPrintEnabled} 
                onCheckedChange={(checked) => setAutoPrintEnabled(checked === true)}
              />
              <label
                htmlFor="auto-print"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                🖨️ {t('orders.autoPrint')}
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t('orders.importExcelTitle')}
              </CardTitle>
              <CardDescription>
                {t('orders.importExcelDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <input
                  id="excel-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={parsing || importing}
                  className="hidden"
                />
                <label htmlFor="excel-file" className="w-full sm:w-auto">
                  <Button type="button" variant="outline" disabled={parsing || importing} className="w-full sm:w-auto">
                    {t('orders.chooseFile', 'Choose file')}
                  </Button>
                </label>
                <span className="text-sm text-muted-foreground break-words">
                  {selectedFileName || t('orders.noFileSelected', 'No file selected')}
                </span>
                <Button onClick={handleImportConfirm} disabled={!importPreview || importing} className="w-full sm:w-auto">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('orders.importFile')}
                </Button>
              </div>
              {parsing && (
                <div className="flex items-center gap-2 text-primary text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('orders.parsing')}</span>
                </div>
              )}
              {importError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{importError}</span>
                </div>
              )}
              {importPreview && (
                <div className="border border-border rounded-md p-3 bg-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                    <div className="w-full sm:flex-1">
                      <p className="font-medium text-foreground">{importPreview.title}</p>
                      <p className="text-sm text-muted-foreground">{t('orders.source')}: {importPreview.source || t('orders.unknown')}</p>
                    </div>
                    <Badge variant="secondary" className="w-fit">{t('orders.positions')}: {importPreview.items.length}</Badge>
                  </div>
                  <div className="max-h-56 overflow-y-auto border border-border rounded bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('orders.itemName')}</TableHead>
                          <TableHead className="w-32 text-right">{t('orders.quantity')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.items.map((item) => (
                          <TableRow key={item.name}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {visibleOrders.length === 0 && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t('orders.noOrdersYet')}</p>
                  <p className="text-sm mt-1">{t('orders.uploadExcelHint')}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination info */}
          {visibleOrders.length > ORDERS_PER_PAGE && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-2 text-sm text-muted-foreground">
              <span className="text-center sm:text-left">
                {t('orders.paginationRange', { from: ((currentPage - 1) * ORDERS_PER_PAGE) + 1, to: Math.min(currentPage * ORDERS_PER_PAGE, visibleOrders.length), total: visibleOrders.length })}
              </span>
              <div className="flex gap-2 justify-center sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {t('common.prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(visibleOrders.length / ORDERS_PER_PAGE), p + 1))}
                  disabled={currentPage >= Math.ceil(visibleOrders.length / ORDERS_PER_PAGE)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}

          {visibleOrders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE).map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const isLoading = loadingOrders.has(order.id);
            const currentItems = orderItems[order.id] || [];
            
            return (
              <Collapsible
                key={order.id}
                open={isExpanded}
                onOpenChange={() => toggleOrder(order.id)}
              >
                <Card className={isExpanded ? 'border-primary shadow-md' : ''}>
                  <CollapsibleTrigger asChild>
                    <div className="cursor-pointer hover:bg-accent transition-colors">
                      <CardHeader>
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div className="flex-1">
                              <CardTitle className="text-lg">{order.title}</CardTitle>
                              <CardDescription className="mt-1">
                                {t('orders.createdAt')} {(() => {
                                  const value = order.created_at; if (!value) return '';
                                  const d = new Date(value); if (Number.isNaN(d.getTime())) return value;
                                  return new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
                                })()}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 md:flex-nowrap flex-wrap md:justify-end">
                            <div className="text-right">
                              <div className="flex flex-wrap items-center gap-2 justify-end">
                                {order.segment && (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-sm font-semibold ${
                                      order.segment === 'lux' 
                                        ? 'bg-primary/10 text-primary border-primary/20' 
                                        : 'bg-muted text-foreground/80 border-border'
                                    }`}
                                  >
                                    {order.segment === 'lux' ? 'Люкс' : 'Эконом'}
                                  </Badge>
                                )}
                                <Badge variant={order.remaining_total > 0 ? 'default' : 'secondary'} className="text-sm">
                                  {t('orders.remaining')}: {order.remaining_total}
                                </Badge>
                                <Badge variant="outline" className="text-sm">
                                  {t('orders.printed')}: {order.printed_total}
                                </Badge>
                              </div>
                            </div>
                            {user && user.role === 'admin' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTargetOrderId(order.id);
                                  setDeleteTargetOrderTitle(order.title);
                                  setDeleteDialogOpen(true);
                                }}
                                title={t('orders.deleteOrder')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {isLoading && (
                        <div className="flex items-center gap-2 text-primary text-sm py-8 justify-center">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>{t('orders.loadingItems')}</span>
                        </div>
                      )}
                      
                      {!isLoading && currentItems.length === 0 && (
                        <p className="text-sm text-muted-foreground py-8 text-center">{t('orders.orderNoItems')}</p>
                      )}
                      
                      {!isLoading && currentItems.length > 0 && (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t('orders.itemName')}</TableHead>
                                <TableHead className="w-20 text-right">{t('orders.plan')}</TableHead>
                                <TableHead className="w-24 text-right">{t('orders.printed')}</TableHead>
                                <TableHead className="w-20 text-right">{t('orders.extra')}</TableHead>
                                <TableHead className="w-24 text-right">{t('orders.remaining')}</TableHead>
                                <TableHead className="w-56">{t('orders.product')}</TableHead>
                                <TableHead className="w-40">{t('orders.actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {currentItems.map((item) => {
                                const isSaving = savingItems[item.id];
                                const isPrinting = printingItems[item.id];
                                const productOptions = products;
                                const remaining = item.remaining_quantity;
                                return (
                                  <TableRow key={item.id} className={remaining === 0 ? 'bg-muted' : ''}>
                                    <TableCell>
                                      <p className="font-medium text-foreground">{item.name}</p>
                                      {item.last_printed_at && (
                                        <p className="text-xs text-muted-foreground">{t('orders.lastPrintedAt')} {(() => { const value = item.last_printed_at; const d = new Date(value); if (Number.isNaN(d.getTime())) return value; return new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d); })()}</p>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">{item.requested_quantity}</TableCell>
                                    <TableCell className="text-right">{item.printed_quantity}</TableCell>
                                    <TableCell className="text-right">{item.extra_quantity}</TableCell>
                                    <TableCell className={`text-right font-semibold ${remaining === 0 ? 'text-muted-foreground' : 'text-primary'}`}>
                                      {remaining}
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={item.product_id || 'none'}
                                        onValueChange={(value) => handleAssignProduct(order.id, item, value === 'none' ? null : value)}
                                        disabled={isSaving}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder={t('orders.selectProduct')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">{t('orders.unbound')}</SelectItem>
                                          {productOptions.map((product) => (
                                            <SelectItem key={product.id} value={product.id}>
                                              {product.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-1.5 sm:gap-2">
                                        <Button
                                          size="sm"
                                          className="w-full sm:w-auto"
                                          disabled={!item.product_id || remaining <= 0 || isPrinting}
                                          onClick={() => handlePrint(order.id, item)}
                                          title={autoPrintEnabled ? t('orders.titleSendToPrinter') : t('orders.titleDownloadPdfToPrint')}
                                        >
                                          {isPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                                          <span className="hidden sm:inline">{autoPrintEnabled ? t('orders.print') : 'PDF'}</span>
                                          <span className="sm:hidden">{autoPrintEnabled ? '🖨️' : '📄'}</span>
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="w-full sm:w-auto"
                                          variant="outline"
                                          onClick={() => handleAdminOpen(order.id, item)}
                                        >
                                          <Key className="h-4 w-4 mr-2" />
                                          <span className="hidden sm:inline">{t('orders.extraPrint')}</span>
                                          <span className="sm:hidden">{t('orders.extraShort')}</span>
                                        </Button>
                                        {user && user.role === 'admin' && (
                                          <Button
                                            size="sm"
                                            className="w-full sm:w-auto"
                                            variant="secondary"
                                            onClick={() => handleAdminSavePdf(order.id, item)}
                                            title={t('orders.savePdf')}
                                          >
                                            <Download className="h-4 w-4 mr-2" />
                                            <span className="hidden sm:inline">{t('orders.pdfAdmin')}</span>
                                            <span className="sm:hidden">📥</span>
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </div>

      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('orders.allowExtraPrintsTitle')}</DialogTitle>
            <DialogDescription>
              {t('orders.allowExtraPrintsDesc', { name: adminTargetItem?.name || t('orders.itemName').toLowerCase() })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdminConfirm();
            }}
          >
            {/* Hidden username field for password form accessibility */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
            />
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('orders.extraQtyLabel')}</label>
                <Input
                  type="number"
                  name="extra-qty"
                  inputMode="numeric"
                  autoComplete="off"
                  min="1"
                  value={adminExtraQty}
                  onChange={(e) => setAdminExtraQty(e.target.value)}
                  placeholder={t('orders.qtyPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('orders.adminKeyLabel')}</label>
                <Input
                  type="password"
                  name="admin-key"
                  autoComplete="current-password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder={t('orders.adminKeyPlaceholder')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdminDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!adminKey || !adminExtraQty}>
                {t('orders.allow')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('orders.deleteOrderTitle')}</DialogTitle>
            <DialogDescription>
              {t('orders.deleteConfirm')} "{deleteTargetOrderTitle}"?
              <br />
              <strong className="text-destructive">{t('orders.deleteIrreversible')}</strong> {t('orders.deleteAllItems')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)} 
              disabled={deleting}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              type="button"
              variant="destructive" 
              onClick={handleDeleteOrder}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t('orders.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
