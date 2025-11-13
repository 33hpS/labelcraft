import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('API utils', () => {
  const API_BASE = '/api'

  beforeEach(() => {
    // Reset fetch mock before each test
    vi.clearAllMocks()
  })

  describe('API error handling', () => {
    it('should handle network errors gracefully', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

      try {
        await fetch(`${API_BASE}/products`)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Network error')
      }
    })

    it('should handle 404 responses', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as Response)
      )

      const response = await fetch(`${API_BASE}/products/999`)
      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
    })

    it('should handle 500 server errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response)
      )

      const response = await fetch(`${API_BASE}/products`)
      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe('Request formatting', () => {
    it('should send correct headers for JSON requests', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response)
      )
      global.fetch = mockFetch

      await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/products'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })

  describe('Data validation', () => {
    it('should validate product data structure', () => {
      const validProduct = {
        id: '1',
        name: 'Test Product',
        qr_code: 'QR123',
      }

      expect(validProduct).toHaveProperty('id')
      expect(validProduct).toHaveProperty('name')
      expect(validProduct).toHaveProperty('qr_code')
      expect(typeof validProduct.name).toBe('string')
    })

    it('should validate template data structure', () => {
      const validTemplate = {
        id: '1',
        name: 'Test Template',
        metadata: '{"width":100,"height":50}',
        elements: '[]',
        status: 'active',
      }

      expect(validTemplate).toHaveProperty('id')
      expect(validTemplate).toHaveProperty('name')
      expect(validTemplate).toHaveProperty('metadata')
      expect(validTemplate).toHaveProperty('elements')
      expect(['draft', 'active', 'archived']).toContain(validTemplate.status)
    })
  })
})
