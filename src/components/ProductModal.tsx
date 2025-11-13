/**
 * Modal for creating and editing products
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { X, Save } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku?: string;
  weight: number;
  volume: number;
  createdAt: string;
  qrCode: string;
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'qrCode'>) => void;
  product?: Product | null;
}

export function ProductModal({ isOpen, onClose, onSave, product }: ProductModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [volume, setVolume] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (product) {
      setName(product.name);
      setWeight(product.weight.toString());
      setVolume(product.volume.toString());
    } else {
      setName('');
      setWeight('');
      setVolume('');
    }
    setErrors({});
  }, [product, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t('productModal.nameRequired');
    } else if (name.length > 200) {
      newErrors.name = t('productModal.nameMax');
    }

    const weightNum = parseFloat(weight);
    if (!weight || isNaN(weightNum) || weightNum < 0) {
      newErrors.weight = t('productModal.weightInvalid');
    } else if (!/^\d+(\.\d{1,3})?$/.test(weight)) {
      newErrors.weight = t('productModal.weightFormat');
    }

    const volumeNum = parseFloat(volume);
    if (!volume || isNaN(volumeNum) || volumeNum < 0) {
      newErrors.volume = t('productModal.volumeInvalid');
    } else if (!/^\d+(\.\d{1,3})?$/.test(volume)) {
      newErrors.volume = t('productModal.volumeFormat');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave({
        name: name.trim(),
        weight: parseFloat(weight),
        volume: parseFloat(volume)
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{product ? t('productModal.titleEdit') : t('productModal.titleCreate')}</CardTitle>
            <CardDescription>
              {product ? t('productModal.descEdit') : t('productModal.descCreate')}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {product?.sku && (
              <div className="space-y-2">
                <label htmlFor="sku" className="text-sm font-medium">
                  {t('productModal.skuLabel', 'Артикул (SKU)')}
                </label>
                <Input
                  id="sku"
                  value={product.sku}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {t('productModal.skuHint', 'Артикул присваивается автоматически и связан с QR-кодом')}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                {t('productModal.nameLabel')}
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('productModal.namePlaceholder')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="weight" className="text-sm font-medium">
                  {t('productModal.weightLabel')}
                </label>
                <Input
                  id="weight"
                  type="number"
                  step="0.001"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.000"
                  className={errors.weight ? 'border-destructive' : ''}
                />
                {errors.weight && (
                  <p className="text-sm text-destructive">{errors.weight}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="volume" className="text-sm font-medium">
                  {t('productModal.volumeLabel')}
                </label>
                <Input
                  id="volume"
                  type="number"
                  step="0.001"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  placeholder="0.000"
                  className={errors.volume ? 'border-destructive' : ''}
                />
                {errors.volume && (
                  <p className="text-sm text-destructive">{errors.volume}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                {t('productModal.cancel')}
              </Button>
              <Button type="submit" className="flex-1">
                <Save size={16} className="mr-2" />
                {product ? t('productModal.save') : t('productModal.create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
