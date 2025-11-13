import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface OrderSummary {
  id: string;
  title: string;
  status: string;
  segment?: 'lux' | 'econom' | null;
  created_at: string;
  updated_at: string;
  items_count: number;
  requested_total: number;
  printed_total: number;
  extra_total: number;
  remaining_total: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  name: string;
  requested_quantity: number;
  printed_quantity: number;
  extra_quantity: number;
  remaining_quantity: number;
  product_id?: string | null;
  last_printed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderDetail {
  order: OrderSummary;
  items: OrderItem[];
}

export function useOrders() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OrderSummary | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setError(null);
    try {
      const result = await api.getOrders();
      const list = Array.isArray(result.orders) ? result.orders : [];
      setOrders(list);
      if (!selectedOrderId && list.length > 0) {
        setSelectedOrderId(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить заказы');
    }
  }, [selectedOrderId]);

  const loadOrderDetail = useCallback(async (orderId: string) => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getOrder(orderId);
      const detail = result as OrderDetail;
      setCurrentOrder(detail.order);
      setItems(detail.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить заказ');
      setCurrentOrder(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetail(selectedOrderId);
    }
  }, [selectedOrderId, loadOrderDetail]);

  return {
    orders,
    selectedOrderId,
    setSelectedOrderId,
    currentOrder,
    items,
    loading,
    error,
    refetchOrders: loadOrders,
    refetchOrder: loadOrderDetail,
    setOrders,
    setItems,
  };
}
