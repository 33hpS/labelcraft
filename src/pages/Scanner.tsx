/**
 * Mobile QR Scanner page with live camera scanning
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { AppLayout } from "../components/Layout/AppLayout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Camera, Download, StopCircle, CheckCircle, AlertCircle, ScanLine } from "lucide-react";
import { useProducts } from "../hooks/useProducts";
import { useTemplates } from "../hooks/useTemplates";
import { Html5Qrcode } from "html5-qrcode";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import QRCode from "qrcode";

interface ScanResult {
  product: any;
  qrData: {
    type: string;
    id: string;
    qrCode: string;
    action: string;
  };
  timestamp: string;
}

export default function ScannerPage() {
  const { t } = useTranslation();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "qr-reader";
  const { products } = useProducts();
  const { templates } = useTemplates();

  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current && isScanning) {
        html5QrcodeRef.current.stop().catch(console.error);
      }
    };
  }, [isScanning]);

  const processQRCode = (decodedText: string): void => {
    try {
      const qrData = JSON.parse(decodedText);
      
      if (qrData.type === "product" && qrData.action === "print-label") {
        const product = products.find(p => p.id === qrData.id || p.qr_code === qrData.qrCode);
        
        if (product) {
          setScanResult({
            product,
            qrData,
            timestamp: new Date().toISOString()
          });
          setError(null);
          stopScanning();
        } else {
          setError(`Товар не найден в базе данных. QR-код: ${qrData.qrCode || qrData.id}`);
        }
      } else {
        setError(`Неверный формат QR-кода. Ожидается QR-код товара с type="product" и action="print-label"`);
      }
    } catch (parseError) {
      const product = products.find(p => p.qr_code === decodedText.trim());
      
      if (product) {
        setScanResult({
          product,
          qrData: {
            type: "product",
            id: product.id,
            qrCode: product.qr_code,
            action: "print-label"
          },
          timestamp: new Date().toISOString()
        });
        setError(null);
        stopScanning();
      } else {
        setError(`QR-код распознан: "${decodedText}", но товар не найден. Используйте QR-код из раздела "Товары"`);
      }
    }
  };

  const startScanning = async () => {
    setError(null);
    setScanResult(null);
    setIsScanning(true);
    
    try {
      const html5Qrcode = new Html5Qrcode(scannerDivId);
      html5QrcodeRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          processQRCode(decodedText);
        },
        (errorMessage) => {
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setError(t('scanner.permissionDenied'));
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
  };

  const generatePDF = async () => {
    if (!scanResult) return;

    setLoading(true);
    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [100, 50]
      });

      const qrDataUrl = await QRCode.toDataURL(
        JSON.stringify({
          type: "product",
          id: scanResult.product.id,
          qrCode: scanResult.product.qr_code,
          action: "print-label"
        }),
        {
          width: 150,
          margin: 1,
          errorCorrectionLevel: "M"
        }
      );

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(scanResult.product.name, 10, 10);

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Вес: ${scanResult.product.weight || 0} кг`, 10, 20);
      pdf.text(`Объем: ${scanResult.product.volume || 0} л`, 10, 27);

      pdf.addImage(qrDataUrl, "PNG", 65, 5, 30, 30);

      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`QR: ${scanResult.product.qr_code}`, 10, 35);

      pdf.setFontSize(7);
  const locale = (typeof window !== 'undefined' && localStorage.getItem('language')) || navigator.language || 'ru-RU';
  pdf.text(`Дата печати: ${new Date().toLocaleString(locale)}`, 10, 42);

      const fileName = `этикетка_${scanResult.product.qr_code}_${Date.now()}.pdf`;
      pdf.save(fileName);

  setError(null);
  toast.success(t('scanner.pdfDownloaded', 'PDF скачан успешно!'));

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError("Ошибка генерации PDF: " + errorMsg);
      console.error("PDF generation error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 w-full max-w-screen-lg mx-auto pb-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">{t('scanner.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('scanner.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              {isScanning ? t('scanner.startScanning') : t('scanner.title')}
            </CardTitle>
            <CardDescription>
              {isScanning 
                ? t('scanner.subtitle')
                : t('scanner.startScanning')
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              id={scannerDivId} 
              className={`w-full ${isScanning ? "block" : "hidden"}`}
              style={{ minHeight: "300px" }}
            />

            {!isScanning && !scanResult && (
              <div className="flex flex-col items-center justify-center py-12 bg-muted rounded-lg border-2 border-dashed border-border">
                <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">{t('scanner.noCamera')}</p>
                <Button 
                  onClick={startScanning}
                  size="lg"
                  className="w-full max-w-xs"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  {t('scanner.startScanning')}
                </Button>
              </div>
            )}

            {isScanning && (
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={stopScanning}
                  variant="destructive"
                  size="lg"
                  className="w-full"
                >
                  <StopCircle className="mr-2 h-5 w-5" />
                  {t('scanner.stopScanning')}
                </Button>
                
                <div className="bg-muted border border-border rounded-lg p-4">
                  <p className="text-sm text-foreground flex items-center gap-2">
                    <div className="animate-pulse h-2 w-2 bg-primary rounded-full"></div>
                    <span>Наведите камеру на QR-код...</span>
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">{t('common.error')}</p>
                  <p className="text-sm text-destructive mt-1">{error}</p>
                  <p className="text-xs text-destructive mt-2">
                    💡 Убедитесь, что:
                    <br />• Разрешен доступ к камере
                    <br />• QR-код создан в разделе "Товары"
                    <br />• QR-код четкий и хорошо освещен
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {scanResult && (
          <Card className="bg-muted border border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CheckCircle className="h-5 w-5 text-primary" />
                {t('scanner.result')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="font-semibold text-lg mb-3">{scanResult.product.name}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('products.weight')}:</span>
                    <p className="font-medium">{scanResult.product.weight || 0} кг</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('products.volume')}:</span>
                    <p className="font-medium">{scanResult.product.volume || 0} л</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <Badge variant="secondary" className="font-mono">
                    {scanResult.product.qr_code}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={generatePDF}
                  className="flex-1"
                  size="lg"
                  disabled={loading}
                >
                  <Download className="mr-2 h-5 w-5" />
                  {loading ? t('common.loading') : t('orders.savePdf')}
                </Button>
                <Button 
                  onClick={() => {
                    setScanResult(null);
                    setError(null);
                  }}
                  variant="outline"
                  size="lg"
                >
                  {t('scanner.new')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted border-border">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-3">💡 {t('scanner.howTo.title', 'Как использовать:')}</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-semibold">1.</span>
                <span>{t('scanner.howTo.step1', 'Создайте товары в разделе "Товары"')}</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">2.</span>
                <span>{t('scanner.howTo.step2', 'Нажмите "QR-код" у товара и распечатайте')}</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">3.</span>
                <span>{t('scanner.howTo.step3', 'На телефоне нажмите "Включить камеру"')}</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">4.</span>
                <span>{t('scanner.howTo.step4', 'Наведите камеру на QR-код')}</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">5.</span>
                <span>{t('scanner.howTo.step5', 'Товар распознается автоматически!')}</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">6.</span>
                <span>{t('scanner.howTo.step6', 'Нажмите "Скачать PDF" для сохранения этикетки')}</span>
              </li>
            </ol>
            
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <strong>📊 {t('scanner.stats.inDb', 'В базе:')}</strong> {products.length} {t('scanner.stats.products', 'товаров')}
                {templates.length > 0 && <> | <strong>🎨 {t('scanner.stats.templates', 'Шаблонов')}:</strong> {templates.length}</>}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
