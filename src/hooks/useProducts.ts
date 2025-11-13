/**
 * React hook для управления товарами через API
 */
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

/**
 * Интерфейс товара
 */
export interface Product {
  id: string;
  name: string;
  sku?: string;
  weight?: number;
  volume?: number;
  barcode?: string;
  qr_code: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

/**
 * Hook для работы с товарами
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Загрузить все товары
   */
  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Создать новый товар
   */
  const createProduct = async (productData: Omit<Product, 'id' | 'qr_code' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newProduct = await api.createProduct(productData);
      setProducts(prev => [newProduct, ...prev]);
      return newProduct;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Обновить товар
   */
  const updateProduct = async (id: string, productData: Partial<Product>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedProduct = await api.updateProduct(id, productData);
      setProducts(prev => 
        prev.map(product => 
          product.id === id ? { ...product, ...updatedProduct } : product
        )
      );
      return updatedProduct;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Удалить товар
   */
  const deleteProduct = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteProduct(id);
      setProducts(prev => prev.filter(product => product.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Загрузить товары при монтировании
  useEffect(() => {
    loadProducts();
  }, []);

  return {
    products,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    refetch: loadProducts,
  };
}

/**
 * Hook для работы с конкретным товаром
 */
export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProduct(id);
      setProduct(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [id]);

  return {
    product,
    loading,
    error,
    refetch: loadProduct,
  };
}
