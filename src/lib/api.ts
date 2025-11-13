/**
 * API клиент для работы с бэкендом ProductLabelerPro
 */
class ProductLabelerAPI {
  private baseURL: string;
  
  constructor() {
    // Замените на ваш реальный Worker URL после деплоя
    this.baseURL = import.meta.env.VITE_API_URL || 'https://productlabelerpro-worker.your-username.workers.dev';
  }


  /**
   * Базовый метод для HTTP запросов
   */
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generic GET request
   */
  async get<T>(endpoint: string): Promise<T> {
    return this.request(endpoint);
  }

  /**
   * Generic POST request
   */
  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Получить список шаблонов
   */
  async getTemplates() {
    return this.request('/api/templates');
  }

  /**
   * Получить шаблон по ID
   */
  async getTemplate(id: string) {
    return this.request(`/api/templates/${id}`);
  }

  /**
   * Создать новый шаблон
   */
  async createTemplate(templateData: any) {
    return this.request('/api/templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  /**
   * Обновить шаблон
   */
  async updateTemplate(id: string, templateData: any) {
    return this.request(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(templateData),
    });
  }

  /**
   * Удалить шаблон
   */
  async deleteTemplate(id: string) {
    return this.request(`/api/templates/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Экспортировать шаблон в PDF/PNG
   */
  async exportTemplate(id: string, format: 'pdf' | 'png') {
    return this.request(`/api/templates/${id}/export`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    });
  }

  /**
   * Сохранить файл в R2 Storage
   */
  async uploadFile(file: File, templateId: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('templateId', templateId);

    const response = await fetch(`${this.baseURL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * AI генерация элементов
   */
  async generateAIContent(prompt: string, context: any) {
    return this.request('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, context }),
    });
  }

  /**
   * Синхронизация с облачными хранилищами
   */
  async syncWithCloud(provider: 'google' | 'dropbox', action: 'save' | 'load') {
    return this.request('/api/cloud/sync', {
      method: 'POST',
      body: JSON.stringify({ provider, action }),
    });
  }

  /**
   * Отправить на печать
   */
  async printTemplate(templateId: string, printerSettings: any) {
    return this.request('/api/print', {
      method: 'POST',
      body: JSON.stringify({ templateId, printerSettings }),
    });
  }

  // ============= PRODUCTS API =============

  /**
   * Получить список товаров
   */
  async getProducts() {
    return this.request('/api/products');
  }

  /**
   * Получить товар по ID
   */
  async getProduct(id: string) {
    return this.request(`/api/products/${id}`);
  }

  /**
   * Создать новый товар
   */
  async createProduct(productData: any) {
    return this.request('/api/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  }

  /**
   * Обновить товар
   */
  async updateProduct(id: string, productData: any) {
    return this.request(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  }

  /**
   * Удалить товар
   */
  async deleteProduct(id: string) {
    return this.request(`/api/products/${id}`, {
      method: 'DELETE',
    });
  }

  // ============= ORDERS API =============

  async getOrders() {
    return this.request('/api/orders');
  }

  async getOrder(id: string) {
    return this.request(`/api/orders/${id}`);
  }

  async importOrder(payload: { title: string; source?: string | null; items: Array<{ name: string; quantity: number }> }): Promise<{ order: any; products_created: number }> {
    return this.request('/api/orders/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateOrderItem(orderId: string, itemId: string, payload: { productId?: string | null }) {
    return this.request(`/api/orders/${orderId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async printOrderItem(orderId: string, itemId: string, count = 1) {
    return this.request(`/api/orders/${orderId}/items/${itemId}/print`, {
      method: 'POST',
      body: JSON.stringify({ count }),
    });
  }

  async allowExtraPrints(orderId: string, itemId: string, amount: number, adminKey: string) {
    return this.request(`/api/orders/${orderId}/items/${itemId}/allow-extra`, {
      method: 'POST',
      headers: {
        'X-Admin-Key': adminKey,
      },
      body: JSON.stringify({ amount }),
    });
  }

  async deleteOrder(orderId: string, adminKey?: string) {
    const headers: Record<string, string> = {};
    if (adminKey) {
      headers['X-Admin-Key'] = adminKey;
    }
    return this.request(`/api/orders/${orderId}`, {
      method: 'DELETE',
      headers,
    });
  }

  // ============= MOYSKLAD API =============

  /**
   * Проверить подключение к МойСклад
   */
  async testMoySkladConnection(credentials: { token?: string; login?: string; password?: string }) {
    return this.request('/api/moysklad/test', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  /**
   * Синхронизировать заказы из МойСклад
   */
  async syncMoySkladOrders(params: {
    token?: string;
    login?: string;
    password?: string;
    documentType?: 'demand' | 'customerorder';
    limit?: number;
  }) {
    return this.request('/api/moysklad/sync', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ============= TEMPLATE VERSIONS API =============

  /**
   * Получить список всех версий шаблона
   */
  async getTemplateVersions(templateId: string, limit = 50) {
    return this.request(`/api/templates/${templateId}/versions?limit=${limit}`);
  }

  /**
   * Получить конкретную версию шаблона
   */
  async getTemplateVersion(templateId: string, versionNumber: number) {
    return this.request(`/api/templates/${templateId}/versions/${versionNumber}`);
  }

  /**
   * Сохранить новую версию (checkpoint) шаблона
   */
  async saveTemplateVersion(templateId: string, versionData: {
    name: string;
    description?: string;
    elements: any[];
    settings?: any;
    createdBy?: string;
    isAutosave?: boolean;
    changeSummary?: string;
  }) {
    return this.request(`/api/templates/${templateId}/versions`, {
      method: 'POST',
      body: JSON.stringify(versionData),
    });
  }

  /**
   * Восстановить шаблон из конкретной версии
   */
  async restoreTemplateVersion(templateId: string, versionNumber: number, restoredBy?: string) {
    return this.request(`/api/templates/${templateId}/versions/${versionNumber}/restore`, {
      method: 'POST',
      body: JSON.stringify({ restoredBy }),
    });
  }

  // ============= USER SETTINGS API =============

  /**
   * Получить настройки пользователя (grid size, snap, theme, etc)
   */
  async getUserSettings(userId: string) {
    return this.request(`/api/user-settings/${userId}`);
  }

  /**
   * Полностью обновить настройки пользователя
   */
  async updateUserSettings(userId: string, settings: {
    gridSize?: number;
    snapToGrid?: boolean;
    clipboardHistory?: any[];
    theme?: 'light' | 'dark';
    language?: string;
    lastTemplateId?: string;
    recentTemplates?: string[];
    autoSaveEnabled?: boolean;
    autoSaveInterval?: number;
  }) {
    return this.request(`/api/user-settings/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  /**
   * Частичное обновление настроек (PATCH - обновляет только переданные поля)
   */
  async patchUserSettings(userId: string, partialSettings: {
    gridSize?: number;
    snapToGrid?: boolean;
    theme?: 'light' | 'dark';
    lastTemplateId?: string;
    recentTemplates?: string[];
  }) {
    return this.request(`/api/user-settings/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(partialSettings),
    });
  }

  // ============= SYNC API =============

  /**
   * Синхронизировать шаблон между устройствами
   */
  async syncTemplate(templateId: string, syncData: {
    userId: string;
    deviceId: string;
    elements?: any[];
    settings?: any;
    currentVersion?: number;
  }) {
    return this.request(`/api/sync/templates/${templateId}`, {
      method: 'POST',
      body: JSON.stringify(syncData),
    });
  }

  /**
   * Получить состояние синхронизации шаблона
   */
  async getSyncState(templateId: string, userId: string, deviceId: string) {
    return this.request(
      `/api/sync/templates/${templateId}/state?userId=${userId}&deviceId=${deviceId}`
    );
  }

  // ============= CHANGES & REAL-TIME API =============

  /**
   * Подписаться на изменения шаблона (для real-time обновлений)
   * Возвращает clientId и инструкции по polling
   */
  async subscribeToChanges(templateId: string) {
    return this.request(`/api/changes/${templateId}/subscribe`);
  }

  /**
   * Получить последние изменения шаблона для polling
   */
  async getLatestChanges(templateId: string) {
    return this.request(`/api/changes/${templateId}/latest`);
  }

  /**
   * Уведомить об изменении в шаблоне (вызывается автоматически)
   */
  async notifyChange(templateId: string, changeData: {
    versionNumber: number;
    changeType: 'element_added' | 'element_modified' | 'element_deleted' | 'settings_changed' | 'sync';
    affectedElementId?: string;
    affectedElementName?: string;
    oldValue?: any;
    newValue?: any;
    userId?: string;
    userName?: string;
    deviceId?: string;
  }) {
    return this.request(`/api/changes/${templateId}/notify`, {
      method: 'POST',
      body: JSON.stringify(changeData),
    });
  }
}

export const api = new ProductLabelerAPI();
