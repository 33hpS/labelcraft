import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { registerRobotoFont } from './pdfFonts';

export { registerRobotoFont } from './pdfFonts';

export const LABEL_FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Lato:wght@400;700&family=Montserrat:wght@400;700&family=Poppins:wght@400;700&family=Playfair+Display:wght@400;700&family=Merriweather:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap&subset=latin,latin-ext,cyrillic,cyrillic-ext');`;

export const parseMetadata = (rawMetadata: any): Record<string, any> | null => {
  if (rawMetadata === null || rawMetadata === undefined) return null;
  if (typeof rawMetadata === 'string') {
    const s = rawMetadata.trim();
    if (s === '') return null;
    try {
      return JSON.parse(s);
    } catch (error) {
      console.error('Failed to parse metadata JSON:', error);
      return null;
    }
  }
  if (typeof rawMetadata === 'object') return rawMetadata as Record<string, any>;
  return null;
};

export const parseTemplateData = (template: any) => {
  let templateSettings = template?.settings ?? {};
  let templateElements = template?.elements ?? [];

  if (typeof templateSettings === 'string') {
    try { templateSettings = JSON.parse(templateSettings); } catch { templateSettings = {}; }
  }
  if (typeof templateElements === 'string') {
    try { templateElements = JSON.parse(templateElements); } catch { templateElements = []; }
  }
  if (!Array.isArray(templateElements)) templateElements = [];

  const settingsWithDefaults = {
    width: Number(templateSettings.width) || 100,
    height: Number(templateSettings.height) || 50,
    marginTop: Number(templateSettings.marginTop) || 0,
    marginRight: Number(templateSettings.marginRight) || 0,
    marginBottom: Number(templateSettings.marginBottom) || 0,
    marginLeft: Number(templateSettings.marginLeft) || 0,
    dpi: Number(templateSettings.dpi) || 203,
    unit: templateSettings.unit || 'mm',
  };

  return { templateSettings: settingsWithDefaults, templateElements };
};

// NOTE: Keep the return shape EXACT to satisfy unit tests
export const buildTemplateProductData = (product: any): Record<string, string> => {
  const metadata = parseMetadata(product?.metadata) ?? {};

  const toStr = (v: any) => (v === null || v === undefined ? '' : String(v));
  const formatPrice = (p: any): string => {
    if (p === null || p === undefined || p === '') return '';
    const num = Number(p);
    if (!Number.isFinite(num)) return '';
    return Number.isInteger(num) ? `${num} ₽` : `${num.toFixed(2)} ₽`;
  };

  return {
    name: toStr(product?.name ?? product?.productName ?? metadata?.name ?? ''),
    barcode: toStr(product?.barcode ?? metadata?.barcode ?? ''),
    SKU: toStr(product?.SKU ?? product?.sku ?? metadata?.sku ?? ''),
    price: formatPrice(product?.price ?? metadata?.price),
    manufacturer: toStr(product?.manufacturer ?? metadata?.manufacturer ?? ''),
    expiryDate: toStr(product?.expiryDate ?? metadata?.expiryDate ?? ''),
    productDate: toStr(product?.productDate ?? product?.productionDate ?? metadata?.productDate ?? metadata?.productionDate ?? ''),
  };
};

// Extra fields for templates (not part of unit test expectations)
const buildProductExtras = (product: any, base: Record<string, string>) => {
  const now = new Date();
  const metadata = parseMetadata(product?.metadata) ?? {};
  const toStr = (v: any) => (v === null || v === undefined ? '' : String(v));

  // Order name placeholders
  const orderName = toStr(
    product?.orderName ?? product?.order?.title ?? metadata?.orderName ?? ''
  );

  // Additional placeholders frequently used in templates
  const lang = (typeof window !== 'undefined' && localStorage.getItem('language')) || (typeof navigator !== 'undefined' ? navigator.language : 'ru-RU') || 'ru-RU';
  
  // Формируем qrCode с множественными fallback
  let qrCode = toStr(
    product?.qrCode ?? 
    product?.qr_code ?? 
    metadata?.qrCode ?? 
    base.barcode ?? 
    base.SKU ?? 
    base.name ?? 
    `PRODUCT-${product?.id || 'UNKNOWN'}`
  );
  
  // Финальная проверка - если qrCode всё равно пустой, используем ID товара
  if (!qrCode || qrCode.trim() === '' || qrCode === 'PRODUCT-UNKNOWN') {
    qrCode = `PRODUCT-${product?.id || 'UNKNOWN'}`;
    console.warn('QR code was empty, using product ID:', qrCode);
  }
  
  return {
    // Synonyms
    productName: base.name,
    qrCode,
    // Order placeholders
    orderName,
    ORDER_NAME: orderName,
    // Dates (localized)
    printDate: now.toLocaleDateString(lang),
    printDateTime: now.toLocaleString(lang),
    currentDate: now.toLocaleDateString(lang),
    currentDateTime: now.toLocaleString(lang),
  } as Record<string, string>;
};

const safeNumber = (value: any, fallback: number): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const pxToPt = (px: number): number => px * 0.75;

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  if (!hex || typeof hex !== 'string') return null;
  const cleanHex = hex.replace(/^#/, '');
  if (!/^[0-9A-F]{6}$/i.test(cleanHex)) return null;
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

const mmToPx = (mm: number, dpi: number): number => (mm / 25.4) * dpi;

const normalizeFontFamilyWithFallback = (fontFamily?: string): string => {
  const normalized = (fontFamily || 'Inter').replace(/['"]/g, '').trim();
  const genericFallback = 'Inter, Roboto, "Open Sans", Lato, Montserrat, Poppins, sans-serif';
  return `${normalized}, ${genericFallback}`;
};

const loadImageAsDataUrl = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
};

const renderTextToDataUrl = async (
  text: string,
  widthMm: number,
  heightMm: number,
  opts: { fontSizePx: number; fontWeight?: string; fontFamily?: string; color?: string; background?: string; textAlign?: 'left' | 'center' | 'right'; verticalAlign?: 'top' | 'middle' | 'bottom'; lineHeight?: number; fitToBox?: boolean; minFontPx?: number },
) => {
  const dpi = 300;
  const w = mmToPx(widthMm, dpi);
  const h = mmToPx(heightMm, dpi);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.fillStyle = opts.background || 'transparent';
  if (opts.background && opts.background !== 'transparent') ctx.fillRect(0, 0, w, h);

  const scaleFactor = dpi / 96;
  let fontSizePxTarget = Math.max(4, Math.round(opts.fontSizePx * scaleFactor));
  const minFontPx = Math.max(4, Math.round((opts.minFontPx ?? 6) * scaleFactor));
  const fontWeight = opts.fontWeight === 'bold' ? '700' : '400';
  const fontFamily = normalizeFontFamilyWithFallback(opts.fontFamily);
  ctx.fillStyle = opts.color || '#000000';
  ctx.textBaseline = 'top';
  ctx.font = `${fontWeight} ${fontSizePxTarget}px ${fontFamily}`;

  const padding = 2 * scaleFactor;
  const maxWidth = w - padding * 2;
  const makeLines = (fsPx: number) => {
    ctx.font = `${fontWeight} ${fsPx}px ${fontFamily}`;
    const words = String(text).split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      const metrics = ctx.measureText(test);
      if (metrics.width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  let lines = makeLines(fontSizePxTarget);
  let lineHeightPx = Math.round((opts.lineHeight || 1.2) * fontSizePxTarget);
  
  if (opts.fitToBox !== false) {
    let guard = 0;
    while (guard++ < 32) {
      const maxLinesFit = Math.max(1, Math.floor((h - padding * 2) / Math.max(1, lineHeightPx)));
      if (lines.length <= maxLinesFit) break;
      if (fontSizePxTarget <= minFontPx) break;
      fontSizePxTarget = Math.max(minFontPx, Math.floor(fontSizePxTarget * 0.92));
      lines = makeLines(fontSizePxTarget);
      lineHeightPx = Math.round((opts.lineHeight || 1.2) * fontSizePxTarget);
    }
  }
  
  const maxLines = Math.max(1, Math.floor((h - padding * 2) / Math.max(1, lineHeightPx)));
  const toDraw = lines.slice(0, maxLines);
  
  const totalTextHeight = toDraw.length * lineHeightPx;
  let y = padding;
  const verticalAlign = opts.verticalAlign || 'middle';
  if (verticalAlign === 'middle') {
    y = (h - totalTextHeight) / 2;
  } else if (verticalAlign === 'bottom') {
    y = h - totalTextHeight - padding;
  }
  
  for (const ln of toDraw) {
    const textWidthPx = ctx.measureText(ln).width;
    let xPx = padding;
    if (opts.textAlign === 'center') {
      xPx = (w - textWidthPx) / 2;
    } else if (opts.textAlign === 'right') {
      xPx = w - padding - textWidthPx;
    }
    ctx.fillText(ln, xPx, y);
    y += lineHeightPx;
  }

  return canvas.toDataURL('image/png');
};

export const renderTemplateToPdf = async (
  pdf: jsPDF,
  templateSettings: any,
  templateElements: any[],
  productData: Record<string, string>,
  fontsOk = true,
) => {
  // Логирование для отладки
  console.log('renderTemplateToPdf - productData:', {
    qrCode: productData.qrCode,
    name: productData.name,
    barcode: productData.barcode,
    SKU: productData.SKU,
    hasQrCode: !!productData.qrCode,
    qrCodeLength: productData.qrCode?.length
  });
  
  for (const element of templateElements) {
    const x = safeNumber(element.x, 0);
    const y = safeNumber(element.y, 0);
    const w = safeNumber(element.width, 0);
    const h = safeNumber(element.height, 0);
    const rotation = safeNumber(element.rotation || element.style?.rotation || 0, 0);
    const color = element.color || element.style?.color || '#000000';
    const bg = element.backgroundColor || element.style?.backgroundColor || 'transparent';
    const border = element.border || element.style?.border || 'none';

    const rgb = hexToRgb(color);
    if (rgb) pdf.setTextColor(rgb.r, rgb.g, rgb.b);

    if (element.type === 'rectangle') {
      const fillRgb = hexToRgb(bg || '#ffffff');
      if (fillRgb) pdf.setFillColor(fillRgb.r, fillRgb.g, fillRgb.b);
      let borderWidth = 0;
      let borderColor = { r: 0, g: 0, b: 0 };
      if (border && border !== 'none') {
        const parts = String(border).split(' ');
        const widthPart = parts.find((p: string) => p.includes('px'));
        const colorPart = parts.find((p: string) => p.startsWith('#'));
        borderWidth = widthPart ? parseFloat(widthPart) * 0.264583 : 0;
        const bc = colorPart ? hexToRgb(colorPart) : null;
        if (bc) borderColor = bc;
      }
      if (borderWidth > 0) {
        pdf.setLineWidth(borderWidth);
        pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
        pdf.rect(x, y, w, h, fillRgb ? 'FD' : 'S');
      } else {
        pdf.rect(x, y, w, h, fillRgb ? 'F' : 'S');
      }
      continue;
    }

    if (element.type === 'text') {
      const raw = element.dataField ? productData[element.dataField] ?? '' : typeof element.content === 'string' ? element.content : '';
      const text = raw.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => productData[key] ?? '');
      const fontSizePx = safeNumber(element.fontSize || element.style?.fontSize || 12, 12);
      const fontSizePt = pxToPt(fontSizePx);
      const fontWeight = (element.fontWeight || element.style?.fontWeight || 'normal') as string;
      const jsPdfFont = 'Roboto';
      const jsPdfStyle = fontWeight === 'bold' ? 'bold' : 'normal';
      const textAlign = (element.textAlign || element.style?.textAlign || 'center') as 'left' | 'center' | 'right';
      const verticalAlign = (element.verticalAlign || 'middle') as 'top' | 'middle' | 'bottom';
      const contentWidth = w > 0 ? w : undefined;
      let drawn = false;
      
      if (fontsOk) {
        try {
          pdf.setFont(jsPdfFont, jsPdfStyle as any);
          pdf.setFontSize(fontSizePt);
          
          if (contentWidth) {
            let currentPt = fontSizePt;
            let lines = pdf.splitTextToSize(text, contentWidth) as string[];
            let lineHeightMm = (currentPt * 0.352778) * (element.lineHeight || 1.2);
            let maxLines = Math.max(1, Math.floor((h || lineHeightMm) / Math.max(1, lineHeightMm)));
            let guard = 0;
            while (guard++ < 32 && lines.length > maxLines && currentPt > 4) {
              currentPt = Math.max(4, Math.floor(currentPt * 0.92));
              pdf.setFontSize(currentPt);
              lines = pdf.splitTextToSize(text, contentWidth) as string[];
              lineHeightMm = (currentPt * 0.352778) * (element.lineHeight || 1.2);
              maxLines = Math.max(1, Math.floor((h || lineHeightMm) / Math.max(1, lineHeightMm)));
            }
            lines = lines.slice(0, maxLines);
            
            const totalTextHeight = lines.length * lineHeightMm;
            let yStart = y;
            if (verticalAlign === 'top') {
              yStart = y + lineHeightMm * 0.8;
            } else if (verticalAlign === 'middle') {
              yStart = y + (h - totalTextHeight) / 2 + (currentPt * 0.352778) / 2;
            } else if (verticalAlign === 'bottom') {
              yStart = y + h - totalTextHeight + (currentPt * 0.352778) / 2;
            }
            
            let currentY = yStart;
            for (const line of lines) {
              const lineWidth = pdf.getTextWidth(line);
              let xPos = x;
              if (textAlign === 'center') {
                xPos = x + (w - lineWidth) / 2;
              } else if (textAlign === 'right') {
                xPos = x + w - lineWidth;
              }
              pdf.text(line, xPos, currentY, { rotation: rotation } as any);
              currentY += lineHeightMm;
            }
          } else {
            let yStart = y;
            const lineHeightMm = (fontSizePt * 0.352778) * (element.lineHeight || 1.2);
            if (verticalAlign === 'top') {
              yStart = y + lineHeightMm * 0.8;
            } else if (verticalAlign === 'middle') {
              yStart = y + h / 2;
            } else if (verticalAlign === 'bottom') {
              yStart = y + h - (fontSizePt * 0.352778) / 2;
            }
            
            const lineWidth = pdf.getTextWidth(text);
            let xPos = x;
            if (textAlign === 'center' && w > 0) {
              xPos = x + (w - lineWidth) / 2;
            } else if (textAlign === 'right') {
              xPos = x + w - lineWidth;
            }
            pdf.text(text, xPos, yStart, { rotation: rotation } as any);
          }
          drawn = true;
        } catch (err) {
          console.warn('jsPDF.text failed — falling back to rasterized text image:', err);
        }
      }

      if (!drawn) {
        try {
          const textWidthMm = w > 0 ? w : Math.min(80, Math.max(30, templateSettings.width - x - 2));
          const textHeightMm = h > 0 ? h : Math.max(6, fontSizePt * 0.352778 * 1.5);
          const fontFamily = element.fontFamily || element.style?.fontFamily || 'Roboto';
          const dataUrl = await renderTextToDataUrl(text, textWidthMm, textHeightMm, {
            fontSizePx: fontSizePx,
            fontWeight: fontWeight,
            fontFamily,
            color: color,
            background: bg,
            textAlign,
            verticalAlign: element.verticalAlign || 'middle',
            lineHeight: element.lineHeight || 1.2,
            fitToBox: true,
          });
          const imgW = w > 0 ? w : textWidthMm;
          const imgH = h > 0 ? h : textHeightMm;
          pdf.addImage(dataUrl, 'PNG', x, y, imgW, imgH, undefined, undefined, rotation);
        } catch (e) {
          console.error('Failed to rasterize text for PDF fallback:', e);
        }
      }
      continue;
    }

    if (element.type === 'qrcode') {
      try {
        let qrContent = '';
        if (element.dataField) {
          qrContent = productData[element.dataField] || '';
        } else if (element.content) {
          qrContent = String(element.content).replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => productData[key] ?? '');
        } else {
          qrContent = productData.name || productData.barcode || 'No data';
        }
        
        // Проверяем, что qrContent не пустой
        if (!qrContent || qrContent.trim() === '') {
          qrContent = productData.qrCode || productData.name || productData.barcode || 'LABEL';
        }
        
        // Финальная проверка перед генерацией QR
        if (!qrContent || qrContent.trim() === '' || qrContent === 'undefined' || qrContent === 'null') {
          qrContent = productData.qrCode || productData.barcode || productData.SKU || `PRODUCT-${productData.id || 'UNKNOWN'}`;
          console.warn('QR content was empty, using product data fallback:', qrContent);
        }
        
        const elementQrDataUrl = await QRCode.toDataURL(qrContent, { width: 200, margin: 1 });
        pdf.addImage(elementQrDataUrl, 'PNG', x, y, w, h, undefined, undefined, rotation);
      } catch (e) {
        console.error('PDF add QR error:', e);
      }
      continue;
    }

    if (element.type === 'image') {
      const imageSrc = element.imageUrl || element.content;
      if (imageSrc) {
        try {
          const dataUrl = await loadImageAsDataUrl(imageSrc);
          pdf.addImage(dataUrl, 'PNG', x, y, w, h, undefined, undefined, rotation);
        } catch (e) {
          console.error('PDF add image error:', e);
        }
      }
      continue;
    }

    if (element.type === 'barcode') {
      let value = element.dataField ? productData[element.dataField] || '' : typeof element.content === 'string' ? element.content : productData.qrCode || '';
      if (!value || !String(value).trim()) value = '0000000000000';
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, value, { format: 'CODE128', displayValue: true, fontSize: 10, margin: 0, lineColor: '#000000' });
        const dataUrl = canvas.toDataURL('image/png');
        pdf.addImage(dataUrl, 'PNG', x, y, w, h, undefined, undefined, rotation);
      } catch (e) {
        console.error('PDF add barcode error:', e);
      }
      continue;
    }
  }
};

export interface RenderPrintOptions {
  printOnlyQR?: boolean;
  qrPayload?: unknown;
  qrString?: string;
  vectorText?: boolean;
}

export const renderAndPrintLabel = async (
  product: any,
  template: any,
  options: RenderPrintOptions = {},
) => {
  const { templateSettings, templateElements } = parseTemplateData(template);
  const base = buildTemplateProductData(product);
  const extras = buildProductExtras(product, base);
  const productData = { ...base, ...extras };

  const pdf = new jsPDF({
    orientation: templateSettings.width > templateSettings.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [templateSettings.width, templateSettings.height],
    compress: true,
  });

  const fontsOk = await registerRobotoFont(pdf);
  await renderTemplateToPdf(pdf, templateSettings, templateElements, productData, fontsOk);
  
  const pdfBlob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  
  const printWindow = window.open(blobUrl, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
      setTimeout(() => { URL.revokeObjectURL(blobUrl); }, 1000);
    };
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${productData.name || 'label'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }
};

export const exportLabelToPdf = async (
  product: any,
  template: any,
  options: RenderPrintOptions = {},
) => {
  const { templateSettings, templateElements } = parseTemplateData(template);
  const base = buildTemplateProductData(product);
  const extras = buildProductExtras(product, base);
  const productData = { ...base, ...extras };

  // Формируем надёжный QR код с множественными fallback
  const safeQrCode = product.barcode || product.qrCode || product.qr_code || product.sku || product.name || `PRODUCT-${product.id || Date.now()}`;
  
  const defaultPayload = {
    type: 'product',
    id: product.id,
    qrCode: safeQrCode,
    action: 'export-label',
  };

  const qrContent = typeof options.qrString === 'string'
    ? options.qrString
    : JSON.stringify(options.qrPayload ?? defaultPayload);

  // Проверяем, что контент не пустой и валидный
  if (!qrContent || qrContent.trim() === '' || qrContent === '""' || qrContent === 'null' || qrContent === 'undefined') {
    console.error('Invalid QR content:', qrContent, 'Product:', product);
    throw new Error('QR code content is empty or invalid');
  }

  const qrDataUrl = await QRCode.toDataURL(qrContent, { width: 200, margin: 1 });

  const pdf = new jsPDF({
    orientation: templateSettings.width > templateSettings.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [templateSettings.width, templateSettings.height],
    compress: true,
  });

  const fontsOk = await registerRobotoFont(pdf);
  await renderTemplateToPdf(pdf, templateSettings, templateElements, productData, fontsOk);
  
  return pdf.output('dataurlstring');
};
