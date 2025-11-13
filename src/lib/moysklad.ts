/**
 * Модуль для работы с API МойСклад
 * https://dev.moysklad.ru/doc/api/remap/1.2/
 */

// Типы данных МойСклад
export interface MoySkladCredentials {
  login: string; // Логин или токен
  password?: string; // Пароль (если используется логин)
  token?: string; // Токен API (альтернатива логин+пароль)
}

export interface MoySkladConfig {
  credentials: MoySkladCredentials;
  organization?: string; // ID организации для фильтрации
}

// Типы сущностей МойСклад
export interface MoySkladDemand {
  id: string;
  name: string;
  moment: string; // Дата документа
  sum: number;
  organization?: {
    meta: {
      href: string;
    };
  };
  agent?: {
    name: string;
  };
  positions?: {
    rows: MoySkladPosition[];
  };
  description?: string;
  attributes?: Array<{
    name: string;
    value: any;
  }>;
}

export interface MoySkladPosition {
  id: string;
  quantity: number;
  price: number;
  assortment: {
    meta: {
      href: string;
      type: string;
    };
    name: string;
  };
}

export interface MoySkladCustomerOrder {
  id: string;
  name: string;
  moment: string;
  sum: number;
  organization?: {
    meta: {
      href: string;
    };
  };
  agent?: {
    name: string;
  };
  positions?: {
    rows: MoySkladPosition[];
  };
  description?: string;
  state?: {
    name: string;
  };
}

/**
 * Клиент для работы с API МойСклад
 */
export class MoySkladClient {
  private readonly baseUrl = 'https://api.moysklad.ru/api/remap/1.2';
  private readonly credentials: MoySkladCredentials;
  private readonly organizationId?: string;

  constructor(config: MoySkladConfig) {
    this.credentials = config.credentials;
    this.organizationId = config.organization;
  }

  /**
   * Получить заголовки авторизации
   */
  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.credentials.token) {
      // Используем токен
      headers['Authorization'] = `Bearer ${this.credentials.token}`;
    } else if (this.credentials.login && this.credentials.password) {
      // Используем Basic Auth (login:password)
      const auth = btoa(`${this.credentials.login}:${this.credentials.password}`);
      headers['Authorization'] = `Basic ${auth}`;
    }

    return headers;
  }

  /**
   * Выполнить GET запрос к API
   */
  private async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`МойСклад API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Выполнить POST запрос к API
   */
  private async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`МойСклад API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Получить список отгрузок (demands)
   * @param limit Максимальное количество документов (по умолчанию 100)
   * @param offset Смещение для пагинации
   */
  async getDemands(limit: number = 100, offset: number = 0): Promise<{rows: MoySkladDemand[], meta: any}> {
    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
      expand: 'positions,agent,organization',
    };

    if (this.organizationId) {
      params['filter'] = `organization=${this.organizationId}`;
    }

    return this.get('/entity/demand', params);
  }

  /**
   * Получить конкретную отгрузку по ID
   */
  async getDemand(id: string): Promise<MoySkladDemand> {
    return this.get(`/entity/demand/${id}`, {
      expand: 'positions,agent,organization',
    });
  }

  /**
   * Получить список заказов покупателей (customerorders)
   * @param limit Максимальное количество документов
   * @param offset Смещение для пагинации
   */
  async getCustomerOrders(limit: number = 100, offset: number = 0): Promise<{rows: MoySkladCustomerOrder[], meta: any}> {
    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
      expand: 'positions,agent,organization,state',
    };

    if (this.organizationId) {
      params['filter'] = `organization=${this.organizationId}`;
    }

    return this.get('/entity/customerorder', params);
  }

  /**
   * Получить конкретный заказ покупателя по ID
   */
  async getCustomerOrder(id: string): Promise<MoySkladCustomerOrder> {
    return this.get(`/entity/customerorder/${id}`, {
      expand: 'positions,agent,organization,state',
    });
  }

  /**
   * Получить позиции документа (отгрузки или заказа)
   */
  async getPositions(documentType: 'demand' | 'customerorder', documentId: string): Promise<MoySkladPosition[]> {
    const response = await this.get<{rows: MoySkladPosition[]}>(`/entity/${documentType}/${documentId}/positions`);
    return response.rows;
  }

  /**
   * Создать атрибут для учёта напечатанных этикеток (вызывается один раз при настройке)
   */
  async createPrintedLabelsAttribute(): Promise<void> {
    // Создаём дополнительное поле для хранения количества напечатанных этикеток
    const attribute = {
      name: 'Напечатано этикеток',
      type: 'long',
      required: false,
      description: 'Количество напечатанных этикеток для этой позиции',
    };

    try {
      await this.post('/entity/demand/metadata/attributes', attribute);
    } catch (error) {
      // Атрибут уже существует или нет прав - не критично
      console.warn('Не удалось создать атрибут:', error);
    }
  }

  /**
   * Обновить количество напечатанных этикеток в МойСклад
   * (требует права на изменение документов)
   */
  async updatePrintedCount(
    documentType: 'demand' | 'customerorder',
    documentId: string,
    positionId: string,
    printedCount: number
  ): Promise<void> {
    // Обновляем позицию документа
    await this.post(`/entity/${documentType}/${documentId}/positions/${positionId}`, {
      meta: {
        href: `${this.baseUrl}/entity/${documentType}/${documentId}/positions/${positionId}`,
        type: 'demandposition',
      },
      attributes: [
        {
          meta: {
            href: `${this.baseUrl}/entity/demand/metadata/attributes/printed_labels`,
            type: 'attributemetadata',
          },
          value: printedCount,
        },
      ],
    });
  }
}

/**
 * Преобразовать документ МойСклад в формат нашей системы (Order)
 */
export function convertMoySkladToOrder(
  doc: MoySkladDemand | MoySkladCustomerOrder,
  type: 'demand' | 'customerorder'
): {
  title: string;
  source: string;
  items: Array<{ name: string; quantity: number }>;
  metadata?: any;
} {
  const items = (doc.positions?.rows || []).map((pos) => ({
    name: pos.assortment.name,
    quantity: Math.round(pos.quantity),
  }));

  return {
    title: `${type === 'demand' ? 'Отгрузка' : 'Заказ'} ${doc.name} от ${new Date(doc.moment).toLocaleDateString('ru-RU')}`,
    source: `МойСклад (${type})`,
    items,
    metadata: {
      moysklad_id: doc.id,
      moysklad_type: type,
      moysklad_moment: doc.moment,
      moysklad_sum: doc.sum,
      moysklad_agent: doc.agent?.name,
      moysklad_description: doc.description,
    },
  };
}

/**
 * Получить конфигурацию МойСклад из переменных окружения или параметров
 */
export function getMoySkladConfig(env?: any): MoySkladConfig | null {
  // Приоритет: переменные окружения > локальное хранилище
  const token = env?.MOYSKLAD_TOKEN || (typeof localStorage !== 'undefined' ? localStorage.getItem('moysklad_token') : null);
  const login = env?.MOYSKLAD_LOGIN || (typeof localStorage !== 'undefined' ? localStorage.getItem('moysklad_login') : null);
  const password = env?.MOYSKLAD_PASSWORD || (typeof localStorage !== 'undefined' ? localStorage.getItem('moysklad_password') : null);
  const org = env?.MOYSKLAD_ORGANIZATION || (typeof localStorage !== 'undefined' ? localStorage.getItem('moysklad_organization') : null);

  if (token) {
    return {
      credentials: { login: '', token },
      organization: org || undefined,
    };
  }

  if (login && password) {
    return {
      credentials: { login, password },
      organization: org || undefined,
    };
  }

  return null;
}
