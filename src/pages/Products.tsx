/**
 * Products management page
 */
import { useState, useEffect } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Plus, Search, Edit, QrCode, Trash2, Loader2 } from 'lucide-react';
import { ProductModal } from '../components/ProductModal';
import { ProductQRModal } from '../components/ProductQRModal';
import { useProducts, Product as ProductType } from '../hooks/useProducts';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Локальный интерфейс для совместимости с ProductModal
interface Product {
  id: string;
  name: string;
  weight: number;
  volume: number;
  createdAt: string;
  qrCode: string;
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const { 
    products: apiProducts, 
    loading, 
    error,
    createProduct: apiCreateProduct, 
    updateProduct: apiUpdateProduct, 
    deleteProduct: apiDeleteProduct 
  } = useProducts();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 50;

  // Конвертируем API продукты в локальный формат
  const products: Product[] = apiProducts.map(p => ({
    id: p.id,
    name: p.name,
    weight: p.weight || 0,
    volume: p.volume || 0,
    createdAt: p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '',
    qrCode: p.qr_code
  }));

  // Обработка ошибок
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginated products
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'qrCode'>) => {
    try {
      if (editingProduct) {
        // Update existing product
        await apiUpdateProduct(editingProduct.id, {
          name: productData.name,
          weight: productData.weight,
          volume: productData.volume
        });
  toast.success(t('products.updated'));
      } else {
        // Create new product
        await apiCreateProduct({
          name: productData.name,
          weight: productData.weight,
          volume: productData.volume
        });
  toast.success(t('products.created_success'));
      }
      
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('products.saveError'));
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    try {
      await apiDeleteProduct(product.id);
      toast.success(t('products.deleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('products.deleteError'));
      throw err;
    }
  };

  const handleShowQR = (product: Product) => {
    setQrProduct(product);
    setIsQRModalOpen(true);
  };

  // Convert local Product to API Product for QR modal
  const qrProductForModal = qrProduct ? {
    id: qrProduct.id,
    name: qrProduct.name,
    weight: qrProduct.weight,
    volume: qrProduct.volume,
    created_at: qrProduct.createdAt,
    qr_code: qrProduct.qrCode
  } : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('products.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">{t('products.subtitle')}</p>
          </div>
          <Button 
            className="flex items-center justify-center space-x-2 w-full sm:w-auto"
            onClick={handleCreateProduct}
          >
            <Plus size={18} />
            <span>{t('products.addNew')}</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('products.search')}</CardTitle>
            <CardDescription>
              {t('products.searchDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-full sm:w-auto sm:flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('products.searchPlaceholder')}
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <Card>
            <CardContent className="p-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2 text-primary" />
              <span>{t('products.loading')}</span>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {!loading && paginatedProducts.map((product) => (
            <Card key={product.id} className="p-4 sm:p-6 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div className="space-y-2 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">{product.name}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                    <span>{t('products.weight')}: {product.weight} кг</span>
                    <span>{t('products.volume')}: {product.volume} л</span>
                    <span className="hidden sm:inline">{t('products.created')}: {product.createdAt}</span>
                  </div>
                  <div className="flex space-x-2">
                    <Badge variant="secondary" className="flex items-center space-x-1 text-xs">
                      <QrCode size={12} />
                      <span>{product.qrCode}</span>
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-transparent w-full sm:w-auto"
                    onClick={() => handleEditProduct(product)}
                  >
                    <Edit size={16} className="mr-2" />
                    <span className="hidden sm:inline">{t('common.edit')}</span>
                    <span className="sm:hidden">{t('common.edit')}</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-transparent w-full sm:w-auto"
                    onClick={() => handleShowQR(product)}
                  >
                    <QrCode size={16} className="mr-2" />
                    {t('products.qr')}
                  </Button>
                  <ConfirmDialog
                    title={t('products.deleteDialogTitle', { name: product.name })}
                    description={t('products.deleteDialogDescription')}
                    confirmLabel={t('common.delete')}
                    cancelLabel={t('common.cancel')}
                    onConfirm={() => handleDeleteProduct(product)}
                  >
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="w-full sm:w-auto"
                    >
                      <Trash2 size={16} className="mr-2" />
                      <span className="hidden sm:inline">{t('common.delete')}</span>
                      <span className="sm:hidden">{t('common.delete')}</span>
                    </Button>
                  </ConfirmDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {!loading && filteredProducts.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                {searchTerm ? t('products.notFound') : t('products.empty')}
              </p>
              {!searchTerm && (
                <Button onClick={handleCreateProduct} className="mt-4">
                  <Plus size={18} className="mr-2" />
                  {t('products.createFirst')}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {filteredProducts.length > PRODUCTS_PER_PAGE && (
          <div className="flex items-center justify-between px-2 py-4 text-sm text-muted-foreground">
            <span>
              {t('products.showing')} {((currentPage - 1) * PRODUCTS_PER_PAGE) + 1}-{Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length)} {t('products.of')} {filteredProducts.length} {t('products.items')}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                {t('common.prev')}
              </Button>
              <span className="flex items-center px-3">
                {t('common.page')} {currentPage} {t('products.of')} {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        )}

        <ProductModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingProduct(null);
          }}
          onSave={handleSaveProduct}
          product={editingProduct}
        />

        <ProductQRModal
          isOpen={isQRModalOpen}
          onClose={() => {
            setIsQRModalOpen(false);
            setQrProduct(null);
          }}
          product={qrProductForModal}
        />
      </div>
    </AppLayout>
  );
}
