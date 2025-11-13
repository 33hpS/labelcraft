/**
 * Security Middleware для Cloudflare Worker
 * Защита от DDoS, брутфорса, SQL injection, XSS
 */

// ============= RATE LIMITING =============

const RATE_LIMITS = {
  global: { max: 100, window: 60 * 1000 }, // 100 запросов в минуту
  auth: { max: 10, window: 60 * 1000 }, // 10 попыток авторизации в минуту
  api: { max: 200, window: 60 * 1000 }, // 200 API запросов в минуту
  upload: { max: 20, window: 60 * 1000 }, // 20 загрузок в минуту
};

// In-memory store (для production использовать KV или Durable Objects)
const rateLimitStore = new Map();

/**
 * Rate limiter middleware
 * @param {string} identifier - IP или user ID
 * @param {string} action - тип действия (global, auth, api, upload)
 * @returns {boolean} - true если лимит не превышен
 */
export function checkRateLimit(identifier, action = 'global') {
  const limit = RATE_LIMITS[action] || RATE_LIMITS.global;
  const key = `${identifier}:${action}`;
  const now = Date.now();
  
  // Получить историю запросов
  let requests = rateLimitStore.get(key) || [];
  
  // Очистить старые записи
  requests = requests.filter(timestamp => now - timestamp < limit.window);
  
  // Проверить лимит
  if (requests.length >= limit.max) {
    return false; // Лимит превышен
  }
  
  // Добавить новый запрос
  requests.push(now);
  rateLimitStore.set(key, requests);
  
  return true; // OK
}

/**
 * Очистка старых записей (вызывать периодически)
 */
export function cleanupRateLimits() {
  const now = Date.now();
  const maxWindow = Math.max(...Object.values(RATE_LIMITS).map(r => r.window));
  
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const filtered = timestamps.filter(t => now - t < maxWindow);
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }
}

// НЕ используем setInterval в global scope - Cloudflare Workers это не поддерживает
// Очистка будет происходить автоматически при каждой проверке лимита (см. checkRateLimit)

// ============= INPUT VALIDATION =============

const DANGEROUS_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/i,
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick=, onerror=, etc.
  /<!--.*?-->/g,
  /\.\.\//g, // Path traversal
];

/**
 * Проверка строки на опасные паттерны
 * @param {string} input
 * @returns {boolean}
 */
export function containsDangerousContent(input) {
  if (typeof input !== 'string') return false;
  
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Sanitize строки от опасного содержимого
 * @param {string} input
 * @returns {string}
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  let sanitized = input;
  
  // Удаляем HTML теги
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Экранируем специальные символы
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return sanitized;
}

/**
 * Валидация объекта (рекурсивно)
 * @param {any} obj
 * @param {number} maxDepth
 * @returns {boolean}
 */
export function validateObject(obj, maxDepth = 10) {
  if (maxDepth <= 0) return false;
  
  if (typeof obj === 'string') {
    return !containsDangerousContent(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.every(item => validateObject(item, maxDepth - 1));
  }
  
  if (obj && typeof obj === 'object') {
    return Object.values(obj).every(value => validateObject(value, maxDepth - 1));
  }
  
  return true;
}

// ============= SECURITY HEADERS =============

/**
 * Добавляет security headers к ответу
 * @param {Headers} headers
 */
export function addSecurityHeaders(headers) {
  // Content Security Policy
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React требует unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind требует unsafe-inline
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.moysklad.ru https://*.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
  
  // Защита от clickjacking
  headers.set('X-Frame-Options', 'DENY');
  
  // Отключить MIME sniffing
  headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection (для старых браузеров)
  headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS (Strict Transport Security) - только HTTPS
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  return headers;
}

// ============= IP EXTRACTION =============

/**
 * Извлекает IP адрес из запроса
 * @param {Request} request
 * @returns {string}
 */
export function getClientIP(request) {
  // Cloudflare передает реальный IP в CF-Connecting-IP
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0] ||
         request.headers.get('X-Real-IP') ||
         'unknown';
}

// ============= INTEGRITY CHECKS =============

/**
 * Простая хеш-функция для проверки целостности
 * @param {string} data
 * @returns {Promise<string>}
 */
export async function generateHash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Проверка целостности данных
 * @param {string} data
 * @param {string} expectedHash
 * @returns {Promise<boolean>}
 */
export async function verifyIntegrity(data, expectedHash) {
  const actualHash = await generateHash(data);
  return actualHash === expectedHash;
}

// ============= ERROR SANITIZATION =============

/**
 * Sanitize ошибки для клиента (не показывать внутренние детали)
 * @param {Error} error
 * @param {boolean} isDev
 * @returns {object}
 */
export function sanitizeError(error, isDev = false) {
  if (isDev) {
    return {
      error: error.message,
      stack: error.stack,
      details: error.cause?.message,
    };
  }
  
  // В продакшене скрываем детали
  const safeMessages = {
    'not found': 'Ресурс не найден',
    'unauthorized': 'Требуется авторизация',
    'forbidden': 'Доступ запрещён',
    'invalid': 'Некорректные данные',
  };
  
  const messageLower = error.message.toLowerCase();
  for (const [key, value] of Object.entries(safeMessages)) {
    if (messageLower.includes(key)) {
      return { error: value };
    }
  }
  
  return { error: 'Произошла ошибка. Попробуйте позже.' };
}

// ============= MIDDLEWARE WRAPPER =============

/**
 * Security middleware для Worker
 * @param {Request} request
 * @param {Function} handler - основной обработчик
 * @param {object} options
 * @returns {Promise<Response>}
 */
export async function securityMiddleware(request, handler, options = {}) {
  const {
    enableRateLimit = true,
    enableValidation = true,
    enableSecurityHeaders = true,
    isDev = false,
  } = options;
  
  try {
    const ip = getClientIP(request);
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Rate limiting
    if (enableRateLimit) {
      let action = 'global';
      if (path.includes('/auth')) action = 'auth';
      else if (path.includes('/upload')) action = 'upload';
      else if (path.startsWith('/api')) action = 'api';
      
      if (!checkRateLimit(ip, action)) {
        return new Response(
          JSON.stringify({ 
            error: 'Превышен лимит запросов. Попробуйте позже.',
            retryAfter: 60 
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
            },
          }
        );
      }
    }
    
    // Input validation для POST/PUT запросов
    if (enableValidation && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const clonedRequest = request.clone();
        const contentType = request.headers.get('Content-Type') || '';
        
        if (contentType.includes('application/json')) {
          const body = await clonedRequest.json();
          
          if (!validateObject(body)) {
            return new Response(
              JSON.stringify({ 
                error: 'Обнаружено потенциально опасное содержимое в запросе' 
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
        }
      } catch (e) {
        // Игнорируем ошибки парсинга JSON
      }
    }
    
    // Вызываем основной обработчик
    let response = await handler(request);
    
    // Добавляем security headers
    if (enableSecurityHeaders && response.headers) {
      const headers = new Headers(response.headers);
      addSecurityHeaders(headers);
      
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    
    return response;
    
  } catch (error) {
    console.error('Security middleware error:', error);
    
    const sanitized = sanitizeError(error, isDev);
    
    return new Response(
      JSON.stringify(sanitized),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
