import { describe, it, expect } from 'vitest'
import { parseMetadata, buildTemplateProductData } from '../lib/labelPrinter'

describe('labelPrinter utils', () => {
  describe('parseMetadata', () => {
    it('should parse valid JSON metadata', () => {
      const metadata = { width: 100, height: 50, unit: 'mm' }
      const json = JSON.stringify(metadata)
      const result = parseMetadata(json)
      
      expect(result).toEqual(metadata)
    })

    it('should return null for invalid JSON', () => {
      const result = parseMetadata('invalid json')
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = parseMetadata('')
      expect(result).toBeNull()
    })

    it('should return null for null input', () => {
      const result = parseMetadata(null)
      expect(result).toBeNull()
    })
  })

  describe('buildTemplateProductData', () => {
    it('should build correct product data object', () => {
      const product = {
        id: '1',
        name: 'Тестовый товар',
        barcode: '1234567890',
        sku: 'TEST-001',
        price: 100.50,
        manufacturer: 'Test Manufacturer',
        expiryDate: '2025-12-31',
        productDate: '2025-01-01',
        qr_code: 'QR123',
      }

      const result = buildTemplateProductData(product)

      expect(result).toEqual({
        name: 'Тестовый товар',
        barcode: '1234567890',
        SKU: 'TEST-001',
        price: '100.50 ₽',
        manufacturer: 'Test Manufacturer',
        expiryDate: '2025-12-31',
        productDate: '2025-01-01',
      })
    })

    it('should handle missing optional fields', () => {
      const product = {
        id: '1',
        name: 'Минимальный товар',
        qr_code: 'QR123',
      }

      const result = buildTemplateProductData(product)

      expect(result.name).toBe('Минимальный товар')
      expect(result.barcode).toBe('')
      expect(result.SKU).toBe('')
      expect(result.manufacturer).toBe('')
    })

    it('should format price correctly', () => {
      const product = {
        id: '1',
        name: 'Test',
        price: 1234.56,
        qr_code: 'QR',
      }

      const result = buildTemplateProductData(product)
      expect(result.price).toBe('1234.56 ₽')
    })

    it('should handle zero price', () => {
      const product = {
        id: '1',
        name: 'Test',
        price: 0,
        qr_code: 'QR',
      }

      const result = buildTemplateProductData(product)
      expect(result.price).toBe('0 ₽')
    })
  })
})
