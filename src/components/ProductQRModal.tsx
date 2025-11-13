/**
 * Modal for printing small product QR code
 * This QR code can be scanned to automatically print the main product label
 */
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Printer, Download } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

interface Product {
  id: string;
  name: string;
  weight: number;
  volume: number;
  created_at: string;
  qr_code: string;
}

interface ProductQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export function ProductQRModal({ isOpen, onClose, product }: ProductQRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen && product && canvasRef.current) {
      // Генерируем QR-код с данными товара
      const qrData = JSON.stringify({
        type: 'product',
        id: product.id,
        qrCode: product.qr_code,
        action: 'print-label'
      });

      QRCode.toCanvas(canvasRef.current, qrData, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'H'
      }, (error) => {
        if (error) console.error('QR generation error:', error);
      });

      // Генерируем data URL для скачивания
      QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'H'
      }).then(url => {
        setQrDataUrl(url);
      });
    }
  }, [isOpen, product]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && product) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${t('qrModal.title')}: ${product.name}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-code {
              margin: 20px 0;
            }
            h2 {
              margin: 10px 0;
              font-size: 18px;
            }
            p {
              margin: 5px 0;
              font-size: 14px;
              color: #666;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h2>${product.name}</h2>
            <p>${t('qrModal.scanToPrint')}</p>
            <div class="qr-code">
              <img src="${qrDataUrl}" alt="QR Code" style="width: 200px; height: 200px;" />
            </div>
            <p><strong>${t('qrModal.codeLabel')}:</strong> ${product.qr_code}</p>
            <p style="font-size: 12px; margin-top: 15px;">
              ${t('qrModal.scanToPrint')}
            </p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleDownload = () => {
    if (qrDataUrl && product) {
      const link = document.createElement('a');
      link.download = `qr-${product.qr_code}.png`;
      link.href = qrDataUrl;
      link.click();
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <h2 className="text-xl font-bold">{t('qrModal.title')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{product.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-card border-2 border-border rounded-lg p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {t('qrModal.scanToPrint')}
                </p>
                <canvas 
                  ref={canvasRef} 
                  className="mx-auto border border-border rounded"
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{t('qrModal.codeLabel')}</p>
                <p className="text-lg font-mono font-semibold">{product.qr_code}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-accent border border-border rounded-lg p-4">
              <p className="text-sm text-primary">
                <strong>{t('qrModal.howToUse')}</strong>
              </p>
              <ol className="text-xs text-primary mt-2 space-y-1 ml-4 list-decimal">
                <li>{t('qrModal.step1')}</li>
                <li>{t('qrModal.step2')}</li>
                <li>{t('qrModal.step3')}</li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                className="flex-1"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4 mr-2" />
                {t('qrModal.printQR')}
              </Button>
              <Button 
                variant="outline"
                className="flex-1"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-2" />
                {t('qrModal.download')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
