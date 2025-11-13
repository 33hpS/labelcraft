// Label Printer Library - Minimal Version
import { jsPDF } from 'jspdf';

export const parseMetadata = (raw: any): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); }
    catch (e) { return {}; }
  }
  return typeof raw === 'object' ? raw : {};
};
