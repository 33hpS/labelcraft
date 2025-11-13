import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from './ui/button';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean; // Keep scanning after successful scan
}

export function QRScanner({ onScan, onError, continuous = false }: QRScannerProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerIdRef = useRef<string>(`qr-reader-${Math.random().toString(36).substring(7)}`);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create beep sound
  useEffect(() => {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,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';
    audioRef.current = audio;
  }, []);

  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => console.log('Audio play failed:', err));
    }
  };

  const startScanning = async () => {
    setIsLoading(true);
    try {
      const scanner = new Html5Qrcode(scannerIdRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Use back camera on mobile
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Success callback
          playBeep(); // Play sound
          toast.success(t('qrScanner.scanned', 'Код отсканирован'));
          onScan(decodedText);
          
          // Only stop if not in continuous mode
          if (!continuous) {
            stopScanning();
          }
        },
        (errorMessage) => {
          // Error callback (fires on every frame without QR, so we ignore it)
          // Only log actual errors
          if (!errorMessage.includes('No MultiFormat Readers')) {
            console.debug('QR scan error:', errorMessage);
          }
        }
      );

      setIsScanning(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to start scanner:', err);
  const errorMsg = err instanceof Error ? err.message : t('qrScanner.startError', 'Не удалось запустить камеру');
      toast.error(errorMsg);
      if (onError) onError(errorMsg);
      setIsLoading(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        // Wait a bit before clearing to ensure stop is complete
        await new Promise(resolve => setTimeout(resolve, 100));
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error('Failed to stop scanner:', err);
        // Force cleanup even on error
        try {
          scannerRef.current?.clear();
        } catch (clearErr) {
          console.error('Failed to clear scanner:', clearErr);
        }
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      const cleanup = async () => {
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
            await new Promise(resolve => setTimeout(resolve, 100));
            scannerRef.current.clear();
          } catch (err) {
            console.error('Cleanup error:', err);
          }
        }
      };
      cleanup();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div 
        id={scannerIdRef.current} 
        className={`rounded-lg overflow-hidden border-2 ${isScanning ? 'border-primary' : 'border-border'}`}
        style={{ maxWidth: '100%', minHeight: isScanning ? '300px' : '0' }}
      />
      
      {!isScanning && !isLoading && (
        <div className="flex items-center justify-center py-12 border-2 border-dashed border-border rounded-lg bg-muted">
          <div className="text-center">
            <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">{t('qrScanner.startPrompt', 'Нажмите кнопку, чтобы запустить камеру')}</p>
            <Button onClick={startScanning}>
              <Camera className="h-4 w-4 mr-2" />
              {t('qrScanner.start', 'Запустить камеру')}
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">{t('qrScanner.starting', 'Запуск камеры...')}</span>
        </div>
      )}

      {isScanning && (
        <div className="space-y-3">
          <div className="flex justify-center">
            <Button onClick={stopScanning} variant="destructive">
              <CameraOff className="h-4 w-4 mr-2" />
              {t('qrScanner.stop', 'Остановить')}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>💡 {t('qrScanner.hint', 'Наведите камеру на QR-код, удерживайте устройство стабильно')}</p>
            <p>🔊 {t('qrScanner.hintBeep', 'Слышен звуковой сигнал при успешном сканировании')}</p>
            {continuous && <p className="text-primary font-medium">✓ {t('qrScanner.continuous', 'Непрерывное сканирование включено')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
