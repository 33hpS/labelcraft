import { jsPDF } from 'jspdf';

const REGULAR_FONT_SOURCES = [
  '/fonts/Roboto-Regular.ttf',
  'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf',
];

const BOLD_FONT_SOURCES = [
  '/fonts/Roboto-Bold.ttf',
  'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAx05IsDqlA.ttf',
];

const MIN_FONT_BASE64_LENGTH = 1000;
const NOT_FOUND_BASE64 = 'NDA0OiBOb3QgRm91bmQ='; // "404: Not Found"

let fontDataPromise: Promise<void> | null = null;
let regularFontData: string | null = null;
let boldFontData: string | null = null;

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const subArray = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...subArray);
  }
  return btoa(binary);
};

const fetchFont = async (path: string): Promise<string | null> => {
  if (typeof fetch === 'undefined') {
    console.warn('PDF font fetch skipped: fetch is not available in this environment.');
    return null;
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      console.error(`Failed to load font from ${path}: ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    return arrayBufferToBase64(buffer);
  } catch (error) {
    console.error(`Error fetching font from ${path}:`, error);
    return null;
  }
};

const resolveFontData = async (sources: string[]): Promise<string | null> => {
  for (const source of sources) {
    const data = await fetchFont(source);
    if (!data) continue;
    if (data.length < MIN_FONT_BASE64_LENGTH) continue;
    if (data === NOT_FOUND_BASE64) continue;
    return data;
  }
  return null;
};

const loadFontData = async () => {
  if (!fontDataPromise) {
    fontDataPromise = (async () => {
      regularFontData = await resolveFontData(REGULAR_FONT_SOURCES);
      boldFontData = await resolveFontData(BOLD_FONT_SOURCES);

      if (!regularFontData) {
        console.warn('Roboto regular font data not available; PDF text may not render Cyrillic characters.');
      }
    })();
  }

  return fontDataPromise;
};

export const registerRobotoFont = async (pdf: jsPDF): Promise<boolean> => {
  try {
    await loadFontData();
    if (!regularFontData) {
      return false;
    }

    (pdf as any).addFileToVFS('Roboto-Regular.ttf', regularFontData);
    (pdf as any).addFont('Roboto-Regular.ttf', 'Roboto', 'normal', 'Identity-H');

    if (boldFontData) {
      (pdf as any).addFileToVFS('Roboto-Bold.ttf', boldFontData);
      (pdf as any).addFont('Roboto-Bold.ttf', 'Roboto', 'bold', 'Identity-H');
    }

    return true;
  } catch (error) {
    console.error('Failed to register Roboto font for PDF:', error);
    return false;
  }
};
