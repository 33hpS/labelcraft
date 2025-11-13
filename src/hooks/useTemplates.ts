/**
 * React hook для управления шаблонами через API
 */
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

/**
 * Интерфейс шаблона
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  settings: TemplateSettings | string | null;
  elements: TemplateElement[];
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

/**
 * Настройки шаблона
 */
export interface TemplateSettings {
  width: number;
  height: number;
  dpi: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  unit: 'mm' | 'inch' | 'pixel';
}

/**
 * Элемент шаблона
 */
export interface TemplateElement {
  id: string;
  type: 'text' | 'qrcode' | 'image' | 'rectangle' | 'barcode';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  style?: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    border?: string;
  };
}

/**
 * Hook для работы с шаблонами
 */
export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Загрузить все шаблоны
   */
  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Создать новый шаблон
   */
  const createTemplate = async (templateData: Omit<Template, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newTemplate = await api.createTemplate(templateData);
      setTemplates(prev => [newTemplate, ...prev]);
      return newTemplate;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Обновить шаблон
   */
  const updateTemplate = async (id: string, templateData: Partial<Template>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedTemplate = await api.updateTemplate(id, templateData);
      setTemplates(prev => 
        prev.map(template => 
          template.id === id ? { ...template, ...updatedTemplate } : template
        )
      );
      return updatedTemplate;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Удалить шаблон
   */
  const deleteTemplate = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteTemplate(id);
      setTemplates(prev => prev.filter(template => template.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Экспортировать шаблон
   */
  const exportTemplate = async (id: string, format: 'pdf' | 'png') => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.exportTemplate(id, format);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export template');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Загрузить шаблоны при монтировании
  useEffect(() => {
    loadTemplates();
  }, []);

  return {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    exportTemplate,
    refetch: loadTemplates,
  };
}

/**
 * Hook для работы с конкретным шаблоном
 */
export function useTemplate(id: string) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplate = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTemplate(id);
      setTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate();
  }, [id]);

  return {
    template,
    loading,
    error,
    refetch: loadTemplate,
  };
}
