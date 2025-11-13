// ============= SECURITY IMPORTS =============
import { 
  securityMiddleware,
  checkRateLimit,
  getClientIP,
  sanitizeError,
  addSecurityHeaders,
  containsDangerousContent,
  sanitizeInput
} from './security.js';
import { verifyJWTFromRequest, signJWT } from './auth.js';

export default {
  async fetch(request, env) {
    // Оборачиваем в security middleware
    return securityMiddleware(request, async (req) => {
      const url = new URL(req.url);
      const path = url.pathname;
      
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
      };

      // Handle preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

    try {
      // --- Sentry tunnel to bypass adblockers ---
      if (path === '/monitor' && req.method === 'POST') {
        try {
          // Forward envelope to Sentry ingest
          const sentryUrl = 'https://o4510234175275008.ingest.de.sentry.io/api/4510328181030992/envelope/';
          const res = await fetch(sentryUrl, {
            method: 'POST',
            body: req.body,
            headers: {
              'Content-Type': req.headers.get('content-type') || 'application/x-sentry-envelope',
            },
          });

          return new Response(null, {
            status: res.status,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store',
            },
          });
        } catch (e) {
          console.error('Sentry tunnel error:', e);
          return new Response(null, { status: 204, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
        }
      }

      // API routing - More specific routes first!
      if (path.startsWith('/api/templates') && path.includes('/versions')) {
        return await handleTemplateVersions(request, env, path, corsHeaders);
      } else if (path.startsWith('/api/changes')) {
        return await handleChanges(request, env, path, corsHeaders);
      } else if (path.startsWith('/api/templates')) {
        return await handleTemplates(request, env, path, corsHeaders);
      } else if (path.startsWith('/api/products')) {
        return await handleProducts(request, env, path, corsHeaders);
      } else if (path.startsWith('/api/orders')) {
        return await handleOrders(request, env, path, corsHeaders);
      } else if (path.startsWith('/api/warehouse')) {
        return await handleWarehouse(request, env, path, corsHeaders);
      } else if (path.startsWith('/api/production')) {
        return await handleProductionStages(request, env, path, corsHeaders);
      } else if (path.startsWith('/api/moysklad')) {
        return await handleMoySklad(request, env, path, corsHeaders);
      } else if (path === '/api/auth/login' && req.method === 'POST') {
        return await handleAuthLogin(request, env, corsHeaders);
      } else if (path === '/api/auth/refresh' && req.method === 'POST') {
        return await handleAuthRefresh(request, env, corsHeaders);
      } else if (path.startsWith('/api/upload')) {
        return await handleUpload(request, env, corsHeaders);
      } else if (path.startsWith('/api/images/')) {
        return await handleImageRequest(request, env, path, corsHeaders);
      } else if (path === '/api/stats') {
        return await handleStats(request, env, corsHeaders);
      } else if (path === '/api/activity-logs') {
        return await handleActivityLogs(request, env, corsHeaders);
      } else if (path.startsWith('/api/user-settings')) {
        return await handleUserSettings(request, env, path, corsHeaders);
      } else if (path.startsWith('/api/sync')) {
        return await handleSync(request, env, path, corsHeaders);
      } else {
        return new Response('Not Found', { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      console.error('Worker error:', error);
      
      // Используем безопасный вывод ошибок
      const sanitized = sanitizeError(error, env.ENVIRONMENT === 'development');
      
      return new Response(
        JSON.stringify(sanitized), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }, {
    enableRateLimit: true,
    enableValidation: true,
    enableSecurityHeaders: true,
    isDev: env.ENVIRONMENT === 'development'
  });
  },
  async scheduled(event, env, ctx) {
    // Периодический пересчёт просрочек
    ctx.waitUntil(recalculateOverdueAlerts(env));
  }
};

async function recalculateOverdueAlerts(env) {
  const { DB } = env;
  try {
    const { results: rawOverdue } = await DB.prepare(`
      SELECT st.id as transition_id, st.order_id, ps.id as stage_id, ps.name as stage_name,
             ps.estimated_duration,
             st.scan_time as started_at,
             CAST((strftime('%s','now') - strftime('%s', st.scan_time)) / 60 AS INTEGER) AS elapsed_minutes
      FROM stage_transitions st
      JOIN production_stages ps ON ps.id = st.stage_id
      WHERE st.status = 'started'
        AND ps.estimated_duration IS NOT NULL
        AND (strftime('%s','now') - strftime('%s', st.scan_time)) / 60 > ps.estimated_duration
    `).all();

    for (const row of rawOverdue || []) {
      const overdueMinutes = Math.max(0, row.elapsed_minutes - (row.estimated_duration || 0));
      try {
        const existing = await DB.prepare(`SELECT id FROM production_alerts WHERE transition_id = ?`).bind(row.transition_id).first();
        if (existing) {
          await DB.prepare(`UPDATE production_alerts SET overdue_minutes = ?, updated_at = datetime('now') WHERE transition_id = ?`).bind(overdueMinutes, row.transition_id).run();
        } else {
          await DB.prepare(`INSERT INTO production_alerts (id, transition_id, order_id, stage_id, stage_name, started_at, estimated_duration, overdue_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(crypto.randomUUID(), row.transition_id, row.order_id, row.stage_id, row.stage_name, row.started_at, row.estimated_duration, overdueMinutes).run();
        }
      } catch(_){}
    }

    await DB.prepare(`UPDATE production_alerts SET status='closed', closed_at=datetime('now'), updated_at=datetime('now') WHERE status!='closed' AND transition_id IN (SELECT id FROM stage_transitions WHERE status='completed')`).run().catch(()=>{});
    await DB.prepare(`DELETE FROM production_alerts WHERE status='closed' AND closed_at < datetime('now','-30 days')`).run().catch(()=>{});
  } catch (e) {
    // swallow errors
  }
}

// ============= AUTH API (login/JWT issuance) =============
async function handleAuthLogin(request, env, corsHeaders) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, password, role: requestedRole } = body;

    const allowedRoles = ['operator','assembler','warehouse','manager','admin'];
    const resolveUsers = () => {
      try {
        if (env.AUTH_USERS) {
          const parsed = JSON.parse(env.AUTH_USERS);
          return Array.isArray(parsed) ? parsed : [];
        }
      } catch (_) {}
      return [];
    };

    const users = resolveUsers();
    let user = null;

    if (users.length > 0) {
      user = users.find(u => u.username === username && u.password === password);
      if (!user) {
        return jsonResponse({ error: 'Неверные учетные данные' }, corsHeaders, 401);
      }
    } else {
      // Fallback на секреты окружения
      if (password && env.ADMIN_KEY && password === env.ADMIN_KEY && (requestedRole === 'admin' || requestedRole === 'manager')) {
        user = { username: username || 'admin', role: requestedRole || 'admin' };
      } else if (password && env.OPERATOR_PIN && password === env.OPERATOR_PIN && (requestedRole === 'operator' || requestedRole === 'assembler')) {
        user = { username: username || 'operator', role: requestedRole || 'operator' };
      } else if (password && env.MANAGER_KEY && password === env.MANAGER_KEY && requestedRole === 'manager') {
        user = { username: username || 'manager', role: 'manager' };
      } else {
        return jsonResponse({ error: 'Неверные учетные данные' }, corsHeaders, 401);
      }
    }

    const role = user.role || requestedRole;
    if (!allowedRoles.includes(role)) {
      return jsonResponse({ error: 'Недопустимая роль' }, corsHeaders, 400);
    }

    if (!env.JWT_SECRET) {
      return jsonResponse({ error: 'Секрет JWT не настроен' }, corsHeaders, 500);
    }

    const ttl = Number(env.JWT_TTL_SEC || 7200); // по умолчанию 2 часа
    const { token, payload } = await signJWT({
      sub: user.username,
      role,
    }, env.JWT_SECRET, { expiresInSec: ttl });

    return jsonResponse({ token, role, exp: payload.exp }, corsHeaders, 201);
  } catch (error) {
    console.error('Auth login error:', error);
    return jsonResponse({ error: 'Auth error', details: error.message }, corsHeaders, 500);
  }
}

// ============= AUTH REFRESH (re-issue JWT) =============
async function handleAuthRefresh(request, env, corsHeaders) {
  try {
    if (!env.JWT_SECRET) {
      return jsonResponse({ error: 'Секрет JWT не настроен' }, corsHeaders, 500);
    }
    const res = await verifyJWTFromRequest(request, env.JWT_SECRET);
    if (!res.valid || !res.payload?.sub || !res.payload?.role) {
      return jsonResponse({ error: 'Необходим действительный токен' }, corsHeaders, 401);
    }
    const ttl = Number(env.JWT_TTL_SEC || 7200);
    const { token, payload } = await signJWT({ sub: res.payload.sub, role: res.payload.role }, env.JWT_SECRET, { expiresInSec: ttl });
    return jsonResponse({ token, role: res.payload.role, exp: payload.exp }, corsHeaders, 200);
  } catch (error) {
    console.error('Auth refresh error:', error);
    return jsonResponse({ error: 'Refresh error', details: error.message }, corsHeaders, 500);
  }
}

// Template operations
async function handleTemplates(request, env, path, corsHeaders) {
  const { DB } = env;
  
  try {
    if (request.method === 'GET') {
      if (path === '/api/templates') {
        const { results } = await DB.prepare(`
          SELECT * FROM templates ORDER BY created_at DESC
        `).all();
        return jsonResponse(results.map(parseTemplate), corsHeaders);
      } else {
        const id = path.split('/').pop();
        const template = await DB.prepare(`
          SELECT * FROM templates WHERE id = ?
        `).bind(id).first();
        
        if (!template) {
          return new Response(
            JSON.stringify({ error: 'Template not found', id }), 
            { 
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        return jsonResponse(parseTemplate(template), corsHeaders);
      }
    }
  } catch (error) {
    console.error('handleTemplates error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        method: request.method,
        path
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  
  if (request.method === 'POST') {
    try {
      const data = await request.json();
      const id = crypto.randomUUID();
      await DB.prepare(`
        INSERT INTO templates (id, name, description, settings, elements, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        id,
        data.name,
        data.description,
        JSON.stringify(data.settings),
        JSON.stringify(data.elements),
        data.status || 'draft'
      ).run();
      
      // Получить созданный шаблон и вернуть его
      const createdTemplate = await DB.prepare(`
        SELECT * FROM templates WHERE id = ?
      `).bind(id).first();
      
      // Log activity
      await logActivity(DB, 'template_created', 'template', id, data.name, 'Админ', 'admin');
      
      return jsonResponse(parseTemplate(createdTemplate), corsHeaders);
    } catch (error) {
      console.error('POST error:', error);
      return new Response(
        JSON.stringify({ error: error.message, stack: error.stack }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  if (request.method === 'PUT') {
    try {
      const id = path.split('/').pop();
      const data = await request.json();
      
      await DB.prepare(`
        UPDATE templates 
        SET name = ?, description = ?, settings = ?, elements = ?, status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        data.name,
        data.description,
        JSON.stringify(data.settings),
        JSON.stringify(data.elements),
        data.status,
        id
      ).run();
      
      // Получить обновлённый шаблон и вернуть его
      const updatedTemplate = await DB.prepare(`
        SELECT * FROM templates WHERE id = ?
      `).bind(id).first();
      
      // Log activity
      await logActivity(DB, 'template_updated', 'template', id, data.name, 'Админ', 'admin');
      
      return jsonResponse(parseTemplate(updatedTemplate), corsHeaders);
    } catch (error) {
      console.error('PUT error:', error);
      return new Response(
        JSON.stringify({ error: error.message, stack: error.stack }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  if (request.method === 'DELETE') {
    try {
      const id = path.split('/').pop();
      
      // Get template name before deletion
      const template = await DB.prepare('SELECT name FROM templates WHERE id = ?').bind(id).first();
      
      await DB.prepare('DELETE FROM templates WHERE id = ?').bind(id).run();
      
      // Log activity
      if (template) {
        await logActivity(DB, 'template_deleted', 'template', id, template.name, 'Админ', 'admin');
      }
      
      return jsonResponse({ message: 'Template deleted' }, corsHeaders);
    } catch (error) {
      console.error('DELETE error:', error);
      return new Response(
        JSON.stringify({ error: error.message, stack: error.stack }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }), 
    { 
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Products CRUD operations
async function handleProducts(request, env, path, corsHeaders) {
  const { DB } = env;
  const method = request.method;
  
  // GET /api/products - List all products (with optional search)
  if (method === 'GET' && path === '/api/products') {
    try {
      const url = new URL(request.url);
      const searchQuery = url.searchParams.get('search');
      
      let query, results;
      
      if (searchQuery && searchQuery.trim()) {
        // Поиск по названию, артикулу, QR-коду или штрихкоду
        const searchTerm = `%${searchQuery.trim()}%`;
        query = DB.prepare(`
          SELECT * FROM products 
          WHERE name LIKE ? 
             OR sku LIKE ? 
             OR qr_code LIKE ?
             OR barcode LIKE ?
          ORDER BY created_at DESC
        `).bind(searchTerm, searchTerm, searchTerm, searchTerm);
      } else {
        // Вернуть все товары
        query = DB.prepare('SELECT * FROM products ORDER BY created_at DESC');
      }
      
      const queryResult = await query.all();
      results = queryResult.results;
      
      return jsonResponse(results, corsHeaders);
    } catch (error) {
      console.error('Error fetching products:', error);
      return jsonResponse({ error: 'Failed to fetch products', details: error.message }, corsHeaders, 500);
    }
  }
  
  // GET /api/products/:id - Get single product
  if (method === 'GET' && path.startsWith('/api/products/')) {
    const id = path.split('/')[3];
    try {
      const result = await DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
      if (!result) {
        return jsonResponse({ error: 'Product not found' }, corsHeaders, 404);
      }
      return jsonResponse(result, corsHeaders);
    } catch (error) {
      console.error('Error fetching product:', error);
      return jsonResponse({ error: 'Failed to fetch product', details: error.message }, corsHeaders, 500);
    }
  }
  
  // POST /api/products - Create new product
  if (method === 'POST' && path === '/api/products') {
    try {
      const data = await request.json();
      const id = crypto.randomUUID();
      
      // Генерация артикула: используем указанный или генерируем автоматически
      let sku = data.sku;
      if (!sku || sku.trim() === '' || sku === data.name) {
        sku = await generateAutoSKU(DB);
      }
      
      // Генерация QR-кода: компактный на основе артикула
      const qrCode = data.qrCode || sku;
      
      await DB.prepare(`
        INSERT INTO products (id, name, sku, weight, volume, barcode, qr_code, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        id,
        data.name,
        sku,
        data.weight || null,
        data.volume || null,
        data.barcode || null,
        qrCode,
        data.metadata ? JSON.stringify(data.metadata) : null
      ).run();
      
      const result = await DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
      
      // Log activity
      await logActivity(DB, 'product_created', 'product', id, data.name, 'Админ', 'admin', {
        sku: sku,
        qr_code: qrCode,
        auto_generated: !data.sku
      });
      
      return jsonResponse(result, corsHeaders, 201);
    } catch (error) {
      console.error('Error creating product:', error);
      return jsonResponse({ error: 'Failed to create product', details: error.message }, corsHeaders, 500);
    }
  }
  
  // PUT /api/products/:id - Update product
  if (method === 'PUT' && path.startsWith('/api/products/')) {
    const id = path.split('/')[3];
    try {
      const data = await request.json();
      
      // Получить старые данные для логирования изменений SKU
      const oldProduct = await DB.prepare('SELECT sku, qr_code FROM products WHERE id = ?').bind(id).first();
      
      let newSKU = data.sku;
      let newQR = data.qr_code;
      
      // Если SKU изменился или не задан, обработать
      if (!newSKU || newSKU.trim() === '') {
        newSKU = await generateAutoSKU(DB);
      }
      
      // Если QR не задан или изменился SKU, использовать компактный формат
      if (!newQR || (oldProduct && oldProduct.sku !== newSKU)) {
        newQR = newSKU;
      }
      
      await DB.prepare(`
        UPDATE products 
        SET name = ?, sku = ?, weight = ?, volume = ?, barcode = ?, qr_code = ?, metadata = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        data.name,
        newSKU,
        data.weight || null,
        data.volume || null,
        data.barcode || null,
        newQR,
        data.metadata ? JSON.stringify(data.metadata) : null,
        id
      ).run();
      
      // Логировать изменение SKU если оно произошло
      if (oldProduct && oldProduct.sku !== newSKU) {
        await logSKUChange(DB, id, oldProduct.sku, newSKU, oldProduct.qr_code, newQR, 'Админ', 'Manual update');
      }
      
      const result = await DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
      
      // Log activity
      await logActivity(DB, 'product_updated', 'product', id, data.name, 'Админ', 'admin', {
        sku_changed: oldProduct && oldProduct.sku !== newSKU,
        old_sku: oldProduct?.sku,
        new_sku: newSKU
      });
      
      return jsonResponse(result, corsHeaders);
    } catch (error) {
      console.error('Error updating product:', error);
      return jsonResponse({ error: 'Failed to update product', details: error.message }, corsHeaders, 500);
    }
  }
  
  // DELETE /api/products/:id - Delete product
  if (method === 'DELETE' && path.startsWith('/api/products/')) {
    const id = path.split('/')[3];
    try {
      // Get product name before deletion for logging
      const product = await DB.prepare('SELECT name FROM products WHERE id = ?').bind(id).first();
      
      await DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      
      // Log activity
      if (product) {
        await logActivity(DB, 'product_deleted', 'product', id, product.name, 'Админ', 'admin');
      }
      
      return jsonResponse({ message: 'Product deleted successfully' }, corsHeaders);
    } catch (error) {
      console.error('Error deleting product:', error);
      return jsonResponse({ error: 'Failed to delete product', details: error.message }, corsHeaders, 500);
    }
  }
  
  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

// Orders and order items management
async function handleOrders(request, env, path, corsHeaders) {
  const { DB, ADMIN_KEY, ADMIN_SECRET } = env;
  const method = request.method;
  const segments = path.split('/').filter(Boolean); // e.g. ['api','orders',...]

  const adminKey = ADMIN_KEY || ADMIN_SECRET || null;

  const mapOrderItem = (row) => {
    if (!row) return null;
    const requested = Number(row.requested_quantity) || 0;
    const printed = Number(row.printed_quantity) || 0;
    const extra = Number(row.extra_quantity) || 0;
    const remaining = Math.max(0, requested + extra - printed);
    return {
      id: row.id,
      order_id: row.order_id,
      name: row.name,
      requested_quantity: requested,
      printed_quantity: printed,
      extra_quantity: extra,
      remaining_quantity: remaining,
      product_id: row.product_id,
      last_printed_at: row.last_printed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  };

  try {
    // GET /api/orders
    if (method === 'GET' && segments.length === 2) {
      const { results } = await DB.prepare(`
        SELECT 
          o.id,
          o.title,
          o.status,
          o.segment,
          o.created_at,
          o.updated_at,
          COUNT(oi.id) AS items_count,
          COALESCE(SUM(oi.requested_quantity), 0) AS requested_total,
          COALESCE(SUM(oi.printed_quantity), 0) AS printed_total,
          COALESCE(SUM(oi.extra_quantity), 0) AS extra_total,
          COALESCE(SUM((oi.requested_quantity + oi.extra_quantity) - oi.printed_quantity), 0) AS remaining_total
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `).all();

      return jsonResponse({ orders: results }, corsHeaders);
    }

    // GET /api/orders/:id
    if (method === 'GET' && segments.length === 3) {
      const orderId = segments[2];
      const order = await DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
      if (!order) {
        return jsonResponse({ error: 'Order not found' }, corsHeaders, 404);
      }

      const { results } = await DB.prepare(`
        SELECT *, (requested_quantity + extra_quantity - printed_quantity) AS remaining_quantity
        FROM order_items
        WHERE order_id = ?
        ORDER BY created_at ASC
      `).bind(orderId).all();

      return jsonResponse({
        order,
        items: results.map(mapOrderItem),
      }, corsHeaders);
    }

    // POST /api/orders/import
    if (method === 'POST' && segments.length === 3 && segments[2] === 'import') {
      const payload = await request.json();
      const title = (payload.title || '').trim() || `Заказ ${new Date().toISOString()}`;
      const orderId = crypto.randomUUID();

      // Auto-detect segment from title
      let segment = null;
      const titleLower = title.toLowerCase();
      if (/(^|\b)(люкс|lux)(\b|$)/i.test(titleLower)) {
        segment = 'lux';
      } else if (/(^|\b)(эконом|econom|ekonom)(\b|$)/i.test(titleLower)) {
        segment = 'econom';
      }

      await DB.prepare(`
        INSERT INTO orders (id, title, source, status, segment)
        VALUES (?, ?, ?, 'active', ?)
      `).bind(orderId, title, payload.source || null, segment).run();

      const items = Array.isArray(payload.items) ? payload.items : [];
      let productsCreated = 0;
      
      for (const item of items) {
        const name = (item.name || '').trim();
        const quantity = Number(item.quantity);

        if (!name || !Number.isFinite(quantity) || quantity <= 0) {
          continue;
        }

        // Проверяем, существует ли продукт с таким именем
        let existingProduct = await DB.prepare(`
          SELECT id FROM products WHERE name = ? LIMIT 1
        `).bind(name).first();

        let productId = existingProduct ? existingProduct.id : null;

        // Если продукта нет - создаем его автоматически
        if (!existingProduct) {
          productId = crypto.randomUUID();
          const qrCode = `AUTO-${Date.now()}-${productId.substring(0, 8)}`;
          
          await DB.prepare(`
            INSERT INTO products (
              id, name, sku, barcode, qr_code, metadata
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            productId,
            name,
            name, // SKU = name
            '', // barcode пустой
            qrCode,
            JSON.stringify({ source: 'auto_import', order_id: orderId })
          ).run();
          
          productsCreated++;
          
          // Log activity для созданного продукта
          await logActivity(DB, 'product_created', 'product', productId, name, 'Система', 'system', {
            source: 'auto_import_from_order',
            order_id: orderId
          });
        }

        // Создаем позицию заказа с привязанным product_id
        const itemId = crypto.randomUUID();
        await DB.prepare(`
          INSERT INTO order_items (
            id, order_id, name, requested_quantity, printed_quantity, extra_quantity, product_id
          ) VALUES (?, ?, ?, ?, 0, 0, ?)
        `).bind(itemId, orderId, name, Math.round(quantity), productId).run();
      }

      const created = await DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();

      // Log activity
      await logActivity(DB, 'order_imported', 'order', orderId, title, 'Админ', 'admin', {
        items_count: items.length,
        products_created: productsCreated,
        source: payload.source
      });

      return jsonResponse({ order: created, products_created: productsCreated }, corsHeaders, 201);
    }

    // PUT /api/orders/:orderId/items/:itemId
    if (method === 'PUT' && segments.length === 5 && segments[3] === 'items') {
      const orderId = segments[2];
      const itemId = segments[4];
      const payload = await request.json();

      const itemExists = await DB.prepare(`
        SELECT id FROM order_items WHERE id = ? AND order_id = ?
      `).bind(itemId, orderId).first();

      if (!itemExists) {
        return jsonResponse({ error: 'Order item not found' }, corsHeaders, 404);
      }

      await DB.prepare(`
        UPDATE order_items
        SET product_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(payload.productId || null, itemId).run();

      const updated = await DB.prepare(`SELECT * FROM order_items WHERE id = ?`).bind(itemId).first();
      return jsonResponse({ item: mapOrderItem(updated) }, corsHeaders);
    }

    // POST /api/orders/:orderId/items/:itemId/print
    if (method === 'POST' && segments.length === 6 && segments[3] === 'items' && segments[5] === 'print') {
      const orderId = segments[2];
      const itemId = segments[4];
      const payload = await request.json().catch(() => ({}));
      const count = Math.max(1, Math.round(Number(payload.count) || 1));

      const item = await DB.prepare(`SELECT * FROM order_items WHERE id = ? AND order_id = ?`)
        .bind(itemId, orderId)
        .first();

      if (!item) {
        return jsonResponse({ error: 'Order item not found' }, corsHeaders, 404);
      }

      const remaining = (item.requested_quantity + item.extra_quantity) - item.printed_quantity;
      if (remaining < count) {
        return jsonResponse({
          allowed: false,
          message: `Печать запрещена: осталось ${remaining} из ${item.requested_quantity + item.extra_quantity}`,
          remaining,
        }, corsHeaders, 200);
      }

      await DB.prepare(`
        UPDATE order_items
        SET printed_quantity = printed_quantity + ?, last_printed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(count, itemId).run();

      const updated = await DB.prepare(`SELECT * FROM order_items WHERE id = ?`).bind(itemId).first();
      
      // Log activity
      await logActivity(DB, 'label_printed', 'order_item', itemId, item.name, 'Оператор', 'operator', {
        count: count,
        order_id: orderId
      });
      
      return jsonResponse({ allowed: true, item: mapOrderItem(updated) }, corsHeaders);
    }

    // DELETE /api/orders/:orderId
    if (method === 'DELETE' && segments.length === 3) {
      const orderId = segments[2];

      // Check admin key if configured
      if (adminKey) {
        const providedKey = request.headers.get('x-admin-key') || request.headers.get('X-Admin-Key');
        if (providedKey !== adminKey) {
          return jsonResponse({ error: 'Invalid admin key' }, corsHeaders, 403);
        }
      }

      // Check if order exists
      const order = await DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
      if (!order) {
        return jsonResponse({ error: 'Order not found' }, corsHeaders, 404);
      }

      // Delete order items first (foreign key constraint)
      await DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(orderId).run();

      // Delete the order
      await DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(orderId).run();

      // Log activity
      await logActivity(DB, 'order_deleted', 'order', orderId, order.title, 'Админ', 'admin', {
        deleted_at: new Date().toISOString()
      });

      return jsonResponse({ success: true, message: 'Order deleted successfully' }, corsHeaders);
    }

    // POST /api/orders/:orderId/items/:itemId/allow-extra
    if (method === 'POST' && segments.length === 6 && segments[3] === 'items' && segments[5] === 'allow-extra') {
      const orderId = segments[2];
      const itemId = segments[4];
      const payload = await request.json().catch(() => ({}));
      const amount = Math.round(Number(payload.amount) || 0);

      if (amount <= 0) {
        return jsonResponse({ error: 'Amount must be greater than zero' }, corsHeaders, 400);
      }

      if (adminKey) {
        const providedKey = request.headers.get('x-admin-key') || request.headers.get('X-Admin-Key');
        if (providedKey !== adminKey) {
          return jsonResponse({ error: 'Invalid admin key' }, corsHeaders, 403);
        }
      }

      const item = await DB.prepare(`SELECT id FROM order_items WHERE id = ? AND order_id = ?`)
        .bind(itemId, orderId)
        .first();

      if (!item) {
        return jsonResponse({ error: 'Order item not found' }, corsHeaders, 404);
      }

      await DB.prepare(`
        UPDATE order_items
        SET extra_quantity = extra_quantity + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(amount, itemId).run();

      const updated = await DB.prepare(`SELECT * FROM order_items WHERE id = ?`).bind(itemId).first();
      return jsonResponse({ item: mapOrderItem(updated) }, corsHeaders);
    }
  } catch (error) {
    console.error('handleOrders error:', error);
    return jsonResponse({
      error: 'Orders handler error',
      details: error.message,
      path,
      method,
    }, corsHeaders, 500);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

// File upload to R2
async function handleUpload(request, env, corsHeaders) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }), 
      { 
        status: 405,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Allow': 'POST'
        }
      }
    );
  }

  const { R2_BUCKET } = env;
  const formData = await request.formData();
  const file = formData.get('file');
  const templateId = formData.get('templateId');
  
  if (!file) {
    return new Response(
      JSON.stringify({ error: 'No file provided' }), 
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  
  const fileKey = `templates/${templateId}/${Date.now()}-${file.name}`;
  await R2_BUCKET.put(fileKey, file);
  
  // Return URL that points to our Worker endpoint
  const imageUrl = `/api/images/${fileKey}`;
  
  return jsonResponse({ 
    url: imageUrl, 
    key: fileKey,
    message: 'File uploaded successfully'
  }, corsHeaders);
}

// Serve images from R2
async function handleImageRequest(request, env, path, corsHeaders) {
  const { R2_BUCKET } = env;
  
  // Extract the key from path: /api/images/templates/...
  let key = path.replace('/api/images/', '');
  
  // Decode URL-encoded characters (for filenames with Cyrillic, spaces, etc.)
  try {
    key = decodeURIComponent(key);
  } catch (e) {
    // If decoding fails, use original key
    console.warn('Failed to decode key:', key, e);
  }
  
  if (!key) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
  
  try {
    const object = await R2_BUCKET.get(key);
    
    if (!object) {
      console.error('Image not found in R2:', key);
      return new Response('Image not found', { status: 404, headers: corsHeaders });
    }
    
    const headers = {
      ...corsHeaders,
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000',
    };
    
    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Error fetching image:', error);
    return new Response('Error fetching image', { status: 500, headers: corsHeaders });
  }
}

// МойСклад integration
async function handleMoySklad(request, env, path, corsHeaders) {
  const { DB } = env;
  
  // POST /api/moysklad/sync - синхронизация документов из МойСклад
  if (path === '/api/moysklad/sync' && request.method === 'POST') {
    try {
      const payload = await request.json();
      const { token, login, password, documentType = 'customerorder', limit = 20 } = payload;
      
      if (!token && (!login || !password)) {
        return jsonResponse(
          { error: 'Требуется token или login+password для авторизации' },
          corsHeaders,
          400
        );
      }

      // Формируем заголовки авторизации
      const authHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      } else {
        const auth = btoa(`${login}:${password}`);
        authHeaders['Authorization'] = `Basic ${auth}`;
      }

      // Запрашиваем документы из МойСклад
      const moyskladUrl = `https://api.moysklad.ru/api/remap/1.2/entity/${documentType}`;
      const params = new URLSearchParams({
        limit: String(limit),
        expand: 'positions,agent,organization,state',
        order: 'moment,desc', // Сначала новые
      });

      const response = await fetch(`${moyskladUrl}?${params}`, {
        method: 'GET',
        headers: authHeaders,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return jsonResponse(
          { 
            error: `Ошибка МойСклад API: ${response.status}`,
            details: errorText
          },
          corsHeaders,
          response.status
        );
      }

      const data = await response.json();
      const documents = data.rows || [];

      // Преобразуем документы в заказы
      const importedOrders = [];
      
      for (const doc of documents) {
        // Получаем позиции
        const positions = doc.positions?.rows || [];
        
        if (positions.length === 0) {
          continue; // Пропускаем пустые документы
        }

        const items = positions.map(pos => ({
          name: pos.assortment?.name || 'Без названия',
          quantity: Math.round(pos.quantity || 0),
        })).filter(item => item.quantity > 0);

        if (items.length === 0) {
          continue;
        }

        // Формируем название заказа
        const docTypeName = documentType === 'demand' ? 'Отгрузка' : 'Заказ покупателя';
        const docDate = new Date(doc.moment).toLocaleDateString('ru-RU');
        const title = `${docTypeName} ${doc.name} от ${docDate}`;

        // Создаём заказ в БД
        const orderId = crypto.randomUUID();
        
        await DB.prepare(`
          INSERT INTO orders (id, title, source, status, created_at, updated_at)
          VALUES (?, ?, ?, 'active', datetime('now'), datetime('now'))
        `).bind(
          orderId,
          title,
          `МойСклад (${documentType})`
        ).run();

        // Добавляем позиции
        for (const item of items) {
          const itemId = crypto.randomUUID();
          await DB.prepare(`
            INSERT INTO order_items (
              id, order_id, name, requested_quantity, printed_quantity, extra_quantity,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, 0, 0, datetime('now'), datetime('now'))
          `).bind(
            itemId,
            orderId,
            item.name,
            item.quantity
          ).run();
        }

        importedOrders.push({
          id: orderId,
          title,
          itemsCount: items.length,
          moysklad_id: doc.id,
        });
      }

      return jsonResponse({
        success: true,
        imported: importedOrders.length,
        orders: importedOrders,
      }, corsHeaders);

    } catch (error) {
      console.error('МойСклад sync error:', error);
      return jsonResponse(
        { 
          error: error.message,
          stack: error.stack 
        },
        corsHeaders,
        500
      );
    }
  }

  // GET /api/moysklad/test - проверка подключения
  if (path === '/api/moysklad/test' && request.method === 'POST') {
    try {
      const payload = await request.json();
      const { token, login, password } = payload;
      
      if (!token && (!login || !password)) {
        return jsonResponse(
          { error: 'Требуется token или login+password' },
          corsHeaders,
          400
        );
      }

      const authHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      } else {
        const auth = btoa(`${login}:${password}`);
        authHeaders['Authorization'] = `Basic ${auth}`;
      }

      // Запрашиваем информацию об организации (простой тест)
      const response = await fetch('https://api.moysklad.ru/api/remap/1.2/entity/organization', {
        method: 'GET',
        headers: authHeaders,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return jsonResponse(
          { 
            connected: false,
            error: `Ошибка авторизации: ${response.status}`,
            details: errorText
          },
          corsHeaders,
          200 // Возвращаем 200, чтобы клиент мог обработать ошибку
        );
      }

      const data = await response.json();
      
      return jsonResponse({
        connected: true,
        organizations: (data.rows || []).map(org => ({
          id: org.id,
          name: org.name,
        })),
      }, corsHeaders);

    } catch (error) {
      return jsonResponse(
        { 
          connected: false,
          error: error.message 
        },
        corsHeaders,
        200
      );
    }
  }

  return jsonResponse({ error: 'Неизвестный endpoint МойСклад API' }, corsHeaders, 404);
}

// Helper function to parse template JSON fields from D1
function parseTemplate(template) {
  if (!template) return template;
  
  const parsed = { ...template };
  
  // Parse elements if it's a string
  if (typeof parsed.elements === 'string') {
    try {
      parsed.elements = JSON.parse(parsed.elements);
    } catch (e) {
      console.error('Failed to parse template elements:', e);
      parsed.elements = [];
    }
  }
  
  // Parse settings if it's a string
  if (typeof parsed.settings === 'string') {
    try {
      parsed.settings = JSON.parse(parsed.settings);
    } catch (e) {
      console.error('Failed to parse template settings:', e);
      parsed.settings = {};
    }
  }
  
  // Ensure elements is always an array
  if (!Array.isArray(parsed.elements)) {
    parsed.elements = [];
  }
  
  return parsed;
}

// Helper function for JSON responses
function jsonResponse(data, corsHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...corsHeaders,
    },
  });
}

// Statistics endpoint
async function handleStats(request, env, corsHeaders) {
  const { DB } = env;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
  }

  try {
    // Get counts for products, templates, orders
    const productsCount = await DB.prepare('SELECT COUNT(*) as count FROM products').first();
    const templatesCount = await DB.prepare('SELECT COUNT(*) as count FROM templates').first();
    const ordersCount = await DB.prepare('SELECT COUNT(*) as count FROM orders').first();

    // Get today's activity count
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    
    const todayActivityCount = await DB.prepare(
      'SELECT COUNT(*) as count FROM activity_logs WHERE created_at >= ?'
    ).bind(todayISO).first();

    return jsonResponse({
      products: productsCount?.count || 0,
      templates: templatesCount?.count || 0,
      orders: ordersCount?.count || 0,
      todayActivity: todayActivityCount?.count || 0,
    }, corsHeaders);
  } catch (error) {
    console.error('Stats error:', error);
    return jsonResponse({ error: error.message }, corsHeaders, 500);
  }
}

// Activity logs endpoint
async function handleActivityLogs(request, env, corsHeaders) {
  const { DB } = env;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    const { results } = await DB.prepare(
      `SELECT 
        action_type,
        target_type,
        target_id,
        target_name,
        user_name,
        user_role,
        metadata,
        created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT ?`
    ).bind(limit).all();

    return jsonResponse({ logs: results || [] }, corsHeaders);
  } catch (error) {
    console.error('Activity logs error:', error);
    return jsonResponse({ error: error.message }, corsHeaders, 500);
  }
}

// Helper function to generate automatic SKU
async function generateAutoSKU(DB) {
  try {
    // Получить текущий счётчик
    const counter = await DB.prepare(
      'SELECT current_value, prefix FROM auto_sku_counter WHERE id = 1'
    ).first();
    
    if (!counter) {
      // Инициализация, если таблица пустая
      await DB.prepare(
        'INSERT INTO auto_sku_counter (id, current_value, prefix) VALUES (1, 10000, ?)'
      ).bind('SKU').run();
      return 'SKU-10000';
    }
    
    const newValue = counter.current_value;
    const sku = `${counter.prefix}-${String(newValue).padStart(5, '0')}`;
    
    // Увеличить счётчик
    await DB.prepare(
      'UPDATE auto_sku_counter SET current_value = current_value + 1, updated_at = datetime(?) WHERE id = 1'
    ).bind('now').run();
    
    return sku;
  } catch (error) {
    console.error('Failed to generate auto SKU:', error);
    // Fallback на старый метод
    return `SKU-${Date.now().toString().slice(-5)}`;
  }
}

// Helper function to log SKU change
async function logSKUChange(DB, productId, oldSKU, newSKU, oldQR, newQR, changedBy = 'system', reason = null) {
  try {
    await DB.prepare(
      `INSERT INTO sku_change_history 
        (id, product_id, old_sku, new_sku, old_qr_code, new_qr_code, changed_by, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      productId,
      oldSKU,
      newSKU,
      oldQR,
      newQR,
      changedBy,
      reason
    ).run();
  } catch (error) {
    console.error('Failed to log SKU change:', error);
  }
}

// Helper function to log activity
async function logActivity(DB, actionType, targetType, targetId, targetName, userName = 'Система', userRole = 'system', metadata = null) {
  try {
    await DB.prepare(
      `INSERT INTO activity_logs 
        (action_type, target_type, target_id, target_name, user_name, user_role, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      actionType,
      targetType,
      targetId,
      targetName,
      userName,
      userRole,
      metadata ? JSON.stringify(metadata) : null
    ).run();
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}

// ============= TEMPLATE VERSIONS API =============

async function handleTemplateVersions(request, env, path, corsHeaders) {
  const { DB } = env;
  const segments = path.split('/').filter(Boolean);

  try {
    // GET /api/templates/:id/versions - список всех версий
    if (request.method === 'GET' && segments.length === 4 && segments[3] === 'versions') {
      const templateId = segments[2];
      const limit = parseInt(new URL(request.url).searchParams.get('limit') || '50', 10);
      
      // Для временных шаблонов (temp-*) возвращаем пустой список версий
      if (templateId.startsWith('temp-')) {
        return jsonResponse({ versions: [] }, corsHeaders);
      }
      
      const { results } = await DB.prepare(`
        SELECT * FROM template_versions 
        WHERE template_id = ?
        ORDER BY version_number DESC
        LIMIT ?
      `).bind(templateId, limit).all();

      return jsonResponse({ versions: results || [] }, corsHeaders);
    }

    // GET /api/templates/:id/versions/:version - получить конкретную версию
    if (request.method === 'GET' && segments.length === 5 && segments[3] === 'versions') {
      const templateId = segments[2];
      const versionNumber = parseInt(segments[4], 10);

      // Для временных шаблонов версий не существует
      if (templateId.startsWith('temp-')) {
        return jsonResponse({ error: 'Version not found' }, corsHeaders, 404);
      }

      const version = await DB.prepare(`
        SELECT * FROM template_versions
        WHERE template_id = ? AND version_number = ?
      `).bind(templateId, versionNumber).first();

      if (!version) {
        return jsonResponse({ error: 'Version not found' }, corsHeaders, 404);
      }

      return jsonResponse(version, corsHeaders);
    }

    // POST /api/templates/:id/versions - создать новую версию (сохранение)
    if (request.method === 'POST' && segments.length === 4 && segments[3] === 'versions') {
      const templateId = segments[2];
      
      // Нельзя создать версию для временного шаблона - сначала сохраните шаблон
      if (templateId.startsWith('temp-')) {
        return jsonResponse({ error: 'Cannot create version for temporary template. Save template first.' }, corsHeaders, 400);
      }
      
      try {
        const payload = await request.json();

        // Получить текущую версию - попробуем с версией, если не работает, используем значение по умолчанию
        let currentVersion;
        try {
          currentVersion = await DB.prepare(`
            SELECT version FROM templates WHERE id = ?
          `).bind(templateId).first();
        } catch (e) {
          // Column doesn't exist, use default version 1
          currentVersion = { version: 1 };
        }

        if (!currentVersion && !currentVersion.version) {
          // Template might not exist or is empty
          const templateExists = await DB.prepare(`
            SELECT id FROM templates WHERE id = ?
          `).bind(templateId).first();
          
          if (!templateExists) {
            return jsonResponse({ error: 'Template not found' }, corsHeaders, 404);
          }
        }

        const newVersionNumber = (currentVersion?.version || 0) + 1;
        const versionId = crypto.randomUUID();

        // Создать запись версии - используем существующую схему
        const versionData = {
          name: payload.name || 'Version ' + newVersionNumber,
          description: payload.description || '',
          elements: payload.elements || [],
          settings: payload.settings || {},
          createdBy: payload.createdBy || 'auto',
          isAutosave: !!payload.isAutosave,
          changeSummary: payload.changeSummary || ''
        };

        try {
          // Попробуем новую схему (v2.1)
          await DB.prepare(`
            INSERT INTO template_versions 
            (id, template_id, version_number, name, description, elements, settings, created_by, is_autosave, change_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            versionId,
            templateId,
            newVersionNumber,
            versionData.name,
            versionData.description,
            JSON.stringify(versionData.elements),
            JSON.stringify(versionData.settings),
            versionData.createdBy,
            versionData.isAutosave ? 1 : 0,
            versionData.changeSummary
          ).run();
        } catch (schemaError) {
          // Используем простую схему (v1.0) 
          await DB.prepare(`
            INSERT INTO template_versions 
            (id, template_id, version_number, data)
            VALUES (?, ?, ?, ?)
          `).bind(
            versionId,
            templateId,
            newVersionNumber,
            JSON.stringify(versionData)
          ).run();
        }

        // Обновить templates таблицу - only if version column exists
        try {
          await DB.prepare(`
            UPDATE templates 
            SET version = ?, current_version_id = ?, updated_at = datetime('now'), last_auto_saved_at = datetime('now')
            WHERE id = ?
          `).bind(newVersionNumber, versionId, templateId).run();
        } catch (e) {
          // Version columns don't exist yet, just update what we can
          await DB.prepare(`
            UPDATE templates 
            SET updated_at = datetime('now')
            WHERE id = ?
          `).bind(templateId).run();
        }

        // Log activity
        try {
          await logActivity(DB, 'template_version_saved', 'template', templateId, payload.name || 'Version ' + newVersionNumber, payload.createdBy || 'auto', 'user', {
            version: newVersionNumber,
            is_autosave: !!payload.isAutosave
          });
        } catch (e) {
          // Logging might fail if activity_logs table doesn't exist, ignore
          console.warn('Activity logging failed:', e.message);
        }

        return jsonResponse({ versionId, versionNumber: newVersionNumber }, corsHeaders, 201);
      } catch (error) {
        console.error('Version save error:', error.message, error.cause);
        return jsonResponse({
          error: 'Failed to save version',
          details: error.message,
          cause: error.cause?.message
        }, corsHeaders, 500);
      }
    }

    // POST /api/templates/:id/versions/:version/restore - восстановить версию
    if (request.method === 'POST' && segments.length === 6 && segments[3] === 'versions' && segments[5] === 'restore') {
      const templateId = segments[2];
      const versionNumber = parseInt(segments[4], 10);
      const payload = await request.json();

      try {
        // Получить версию для восстановления
        const version = await DB.prepare(`
          SELECT * FROM template_versions
          WHERE template_id = ? AND version_number = ?
        `).bind(templateId, versionNumber).first();

        if (!version) {
          return jsonResponse({ error: 'Version not found' }, corsHeaders, 404);
        }

        // Сохранить как новую версию
        const newVersionId = crypto.randomUUID();
        
        let currentVersion = { version: 1 };
        try {
          currentVersion = await DB.prepare(`SELECT version FROM templates WHERE id = ?`).bind(templateId).first();
        } catch (e) {
          // Column doesn't exist, use default
        }
        
        const newVersionNumber = (currentVersion?.version || 0) + 1;

        // Parse version data
        let versionElements = version.elements;
        let versionSettings = version.settings;
        
        try {
          if (typeof version.data === 'string') {
            const parsed = JSON.parse(version.data);
            versionElements = JSON.stringify(parsed.elements || version.elements || []);
            versionSettings = JSON.stringify(parsed.settings || version.settings || {});
          }
        } catch (e) {
          // Keep original values
        }

        try {
          // Попробуем новую схему (v2.1)
          await DB.prepare(`
            INSERT INTO template_versions 
            (id, template_id, version_number, name, description, elements, settings, created_by, change_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newVersionId,
            templateId,
            newVersionNumber,
            'Restored from v' + versionNumber,
            'Restored from version ' + versionNumber,
            versionElements,
            versionSettings,
            payload.restoredBy || 'system',
            'Restored from version ' + versionNumber
          ).run();
        } catch (schemaError) {
          // Используем простую схему (v1.0)
          const restoreData = {
            name: 'Restored from v' + versionNumber,
            description: 'Restored from version ' + versionNumber,
            elements: JSON.parse(versionElements),
            settings: JSON.parse(versionSettings),
            createdBy: payload.restoredBy || 'system'
          };
          
          await DB.prepare(`
            INSERT INTO template_versions 
            (id, template_id, version_number, data)
            VALUES (?, ?, ?, ?)
          `).bind(
            newVersionId,
            templateId,
            newVersionNumber,
            JSON.stringify(restoreData)
          ).run();
        }

        // Обновить template - попробуем обновить все колонки, затем fallback
        try {
          await DB.prepare(`
            UPDATE templates 
            SET version = ?, current_version_id = ?, elements = ?, settings = ?, updated_at = datetime('now')
            WHERE id = ?
          `).bind(newVersionNumber, newVersionId, versionElements, versionSettings, templateId).run();
        } catch (e) {
          // Some columns don't exist, just update what we can
          try {
            await DB.prepare(`
              UPDATE templates 
              SET elements = ?, settings = ?, updated_at = datetime('now')
              WHERE id = ?
            `).bind(versionElements, versionSettings, templateId).run();
          } catch (e2) {
            // Even that failed, just update timestamp
            await DB.prepare(`
              UPDATE templates 
              SET updated_at = datetime('now')
              WHERE id = ?
            `).bind(templateId).run();
          }
        }

        // Log activity
        try {
          await logActivity(DB, 'template_version_restored', 'template', templateId, 'Restored from v' + versionNumber, payload.restoredBy || 'system', 'user', {
            from_version: versionNumber,
            to_version: newVersionNumber
          });
        } catch (e) {
          // Logging might fail, ignore
          console.warn('Activity logging failed:', e.message);
        }

        return jsonResponse({ success: true, newVersionNumber }, corsHeaders);
      } catch (error) {
        console.error('Restore version error:', error.message);
        return jsonResponse({
          error: 'Failed to restore version',
          details: error.message
        }, corsHeaders, 500);
      }
    }

  } catch (error) {
    console.error('handleTemplateVersions error:', error);
    return jsonResponse({
      error: 'Template versions handler error',
      details: error.message,
      path
    }, corsHeaders, 500);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

// ============= USER SETTINGS API =============

async function handleUserSettings(request, env, path, corsHeaders) {
  const { DB } = env;
  const segments = path.split('/').filter(Boolean);

  try {
    // GET /api/user-settings/:userId - получить настройки
    if (request.method === 'GET' && segments.length === 3) {
      const userId = segments[2];

      let settings = await DB.prepare(`
        SELECT * FROM user_settings WHERE user_id = ?
      `).bind(userId).first();

      if (!settings) {
        // Создать настройки по умолчанию
        const settingsId = crypto.randomUUID();
        await DB.prepare(`
          INSERT INTO user_settings (id, user_id, grid_size, snap_to_grid)
          VALUES (?, ?, 20, 1)
        `).bind(settingsId, userId).run();

        settings = await DB.prepare(`
          SELECT * FROM user_settings WHERE user_id = ?
        `).bind(userId).first();
      }

      return jsonResponse(settings, corsHeaders);
    }

    // PUT /api/user-settings/:userId - обновить настройки (полностью)
    if (request.method === 'PUT' && segments.length === 3) {
      const userId = segments[2];
      const payload = await request.json();

      await DB.prepare(`
        UPDATE user_settings 
        SET grid_size = ?,
            snap_to_grid = ?,
            clipboard_history = ?,
            clipboard_history_size = ?,
            max_history_entries = ?,
            auto_save_interval = ?,
            auto_save_enabled = ?,
            theme = ?,
            language = ?,
            last_template_id = ?,
            recent_templates = ?,
            ui_layout = ?,
            updated_at = datetime('now')
        WHERE user_id = ?
      `).bind(
        payload.gridSize || 20,
        payload.snapToGrid ? 1 : 0,
        payload.clipboardHistory ? JSON.stringify(payload.clipboardHistory) : null,
        payload.clipboardHistorySize || 5,
        payload.maxHistoryEntries || 500,
        payload.autoSaveInterval || 30000,
        payload.autoSaveEnabled ? 1 : 0,
        payload.theme || 'light',
        payload.language || 'ru',
        payload.lastTemplateId || null,
        payload.recentTemplates ? JSON.stringify(payload.recentTemplates) : null,
        payload.uiLayout || 'default',
        userId
      ).run();

      const updated = await DB.prepare(`
        SELECT * FROM user_settings WHERE user_id = ?
      `).bind(userId).first();

      return jsonResponse(updated, corsHeaders);
    }

    // PATCH /api/user-settings/:userId - обновить только некоторые настройки
    if (request.method === 'PATCH' && segments.length === 3) {
      const userId = segments[2];
      const payload = await request.json();

      // Построить динамический UPDATE запрос
      const updates = [];
      const binds = [];

      if (payload.gridSize !== undefined) {
        updates.push('grid_size = ?');
        binds.push(payload.gridSize);
      }
      if (payload.snapToGrid !== undefined) {
        updates.push('snap_to_grid = ?');
        binds.push(payload.snapToGrid ? 1 : 0);
      }
      if (payload.theme !== undefined) {
        updates.push('theme = ?');
        binds.push(payload.theme);
      }
      if (payload.lastTemplateId !== undefined) {
        updates.push('last_template_id = ?');
        binds.push(payload.lastTemplateId);
      }
      if (payload.recentTemplates !== undefined) {
        updates.push('recent_templates = ?');
        binds.push(JSON.stringify(payload.recentTemplates));
      }

      updates.push('updated_at = datetime("now")');
      binds.push(userId);

      if (updates.length > 0) {
        await DB.prepare(`
          UPDATE user_settings 
          SET ${updates.join(', ')}
          WHERE user_id = ?
        `).bind(...binds).run();
      }

      const updated = await DB.prepare(`
        SELECT * FROM user_settings WHERE user_id = ?
      `).bind(userId).first();

      return jsonResponse(updated, corsHeaders);
    }

  } catch (error) {
    console.error('handleUserSettings error:', error);
    return jsonResponse({
      error: 'User settings handler error',
      details: error.message
    }, corsHeaders, 500);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

// ============= SYNC API =============

async function handleSync(request, env, path, corsHeaders) {
  const { DB } = env;
  const segments = path.split('/').filter(Boolean);

  try {
    // POST /api/sync/templates/:templateId - синхронизировать шаблон
    if (request.method === 'POST' && segments.length === 3 && segments[1] === 'sync') {
      const templateId = segments[2];
      const payload = await request.json();
      const { userId, deviceId, elements, settings, currentVersion } = payload;

      // Получить текущее состояние sync
      let syncState = await DB.prepare(`
        SELECT * FROM template_sync_state
        WHERE template_id = ? AND user_id = ? AND device_id = ?
      `).bind(templateId, userId, deviceId).first();

      if (!syncState) {
        const syncId = crypto.randomUUID();
        await DB.prepare(`
          INSERT INTO template_sync_state 
          (id, template_id, user_id, device_id, sync_version, last_synced_at, last_local_change_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(syncId, templateId, userId, deviceId, 1).run();

        syncState = await DB.prepare(`
          SELECT * FROM template_sync_state
          WHERE template_id = ? AND user_id = ? AND device_id = ?
        `).bind(templateId, userId, deviceId).first();
      }

      // Получить последнюю версию на сервере
      const serverTemplate = await DB.prepare(`
        SELECT * FROM templates WHERE id = ?
      `).bind(templateId).first();

      // Проверить конфликты
      let conflictDetected = false;
      if (currentVersion && serverTemplate.version && currentVersion < serverTemplate.version) {
        conflictDetected = true;
      }

      // Сохранить новую версию если есть изменения
      if (elements || settings) {
        const newVersionNumber = (serverTemplate.version || 0) + 1;
        const versionId = crypto.randomUUID();

        await DB.prepare(`
          INSERT INTO template_versions 
          (id, template_id, version_number, name, description, elements, settings, created_by, change_summary)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          versionId,
          templateId,
          newVersionNumber,
          'Synced from ' + deviceId,
          'Synchronized from device',
          JSON.stringify(elements || []),
          JSON.stringify(settings || {}),
          userId,
          'Synced from device ' + deviceId
        ).run();

        // Обновить template
        await DB.prepare(`
          UPDATE templates 
          SET version = ?, current_version_id = ?, elements = ?, settings = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(newVersionNumber, versionId, JSON.stringify(elements || []), JSON.stringify(settings || {}), templateId).run();
      }

      // Обновить sync state
      await DB.prepare(`
        UPDATE template_sync_state
        SET last_synced_at = datetime('now'),
            last_remote_change_at = datetime('now'),
            sync_version = sync_version + 1,
            conflict_detected = ?,
            needs_sync = 0,
            updated_at = datetime('now')
        WHERE template_id = ? AND user_id = ? AND device_id = ?
      `).bind(conflictDetected ? 1 : 0, templateId, userId, deviceId).run();

      const updated = await DB.prepare(`
        SELECT * FROM templates WHERE id = ?
      `).bind(templateId).first();

      return jsonResponse({
        success: true,
        template: updated,
        conflictDetected,
        syncVersion: syncState.sync_version + 1
      }, corsHeaders);
    }

    // GET /api/sync/templates/:templateId/state - получить состояние синхронизации
    if (request.method === 'GET' && segments.length === 4 && segments[3] === 'state') {
      const templateId = segments[2];
      const userId = new URL(request.url).searchParams.get('userId');
      const deviceId = new URL(request.url).searchParams.get('deviceId');

      const syncState = await DB.prepare(`
        SELECT * FROM template_sync_state
        WHERE template_id = ? AND user_id = ? AND device_id = ?
      `).bind(templateId, userId, deviceId).first();

      if (!syncState) {
        return jsonResponse({ error: 'Sync state not found' }, corsHeaders, 404);
      }

      return jsonResponse(syncState, corsHeaders);
    }

  } catch (error) {
    console.error('handleSync error:', error);
    return jsonResponse({
      error: 'Sync handler error',
      details: error.message
    }, corsHeaders, 500);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

// ============= CHANGES API (для real-time) =============

// Простой in-memory store для подписок (в production нужны Durable Objects)
const subscriptions = new Map();

async function handleChanges(request, env, path, corsHeaders) {
  const segments = path.split('/').filter(Boolean);

  try {
    // GET /api/changes/:templateId/subscribe - WebSocket подписка (polling fallback)
    if (request.method === 'GET' && segments.length === 4 && segments[3] === 'subscribe') {
      const templateId = segments[2];
      const clientId = crypto.randomUUID();

      // Для демо используем polling. В production нужны WebSockets через Durable Objects
      // Сейчас возвращаем инструкции для polling
      return jsonResponse({
        message: 'Use polling: GET /api/changes/:templateId/latest with clientId parameter',
        clientId,
        pollInterval: 2000 // ms
      }, corsHeaders);
    }

    // GET /api/changes/:templateId/latest - получить последние изменения
    if (request.method === 'GET' && segments.length === 4 && segments[3] === 'latest') {
      const templateId = segments[2];
      const { DB } = env;

      try {
        const { results } = await DB.prepare(`
          SELECT * FROM change_log
          WHERE template_id = ?
          ORDER BY timestamp DESC
          LIMIT 20
        `).bind(templateId).all();

        return jsonResponse({ changes: results || [] }, corsHeaders);
      } catch (error) {
        // Table doesn't exist yet, return empty array
        if (error.message.includes('no such table')) {
          return jsonResponse({ changes: [] }, corsHeaders);
        }
        throw error;
      }
    }

    // POST /api/changes/:templateId/notify - уведомить об изменении (для internal use)
    if (request.method === 'POST' && segments.length === 4 && segments[3] === 'notify') {
      const templateId = segments[2];
      const payload = await request.json();
      const { DB } = env;

      try {
        // Записать изменение в change_log
        const changeId = crypto.randomUUID();
        await DB.prepare(`
          INSERT INTO change_log 
          (id, template_id, version_number, change_type, affected_element_id, affected_element_name, 
           old_value, new_value, user_id, user_name, device_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          changeId,
          templateId,
          payload.versionNumber || 0,
          payload.changeType || 'unknown',
          payload.affectedElementId || null,
          payload.affectedElementName || null,
          payload.oldValue ? JSON.stringify(payload.oldValue) : null,
          payload.newValue ? JSON.stringify(payload.newValue) : null,
          payload.userId || 'unknown',
          payload.userName || 'Unknown',
          payload.deviceId || null
        ).run();

        return jsonResponse({ changeId }, corsHeaders, 201);
      } catch (error) {
        // Table doesn't exist, silently ignore
        if (error.message.includes('no such table')) {
          return jsonResponse({ changeId: crypto.randomUUID() }, corsHeaders, 201);
        }
        throw error;
      }
    }

  } catch (error) {
    console.error('handleChanges error:', error);
    return jsonResponse({
      error: 'Changes handler error',
      details: error.message
    }, corsHeaders, 500);
  }

  return jsonResponse({ error: 'Method not allowed' }, corsHeaders, 405);
}

/**
 * Handle warehouse receipts API
 */
async function handleWarehouse(request, env, path, corsHeaders) {
  const { DB } = env;
  const method = request.method;
  const segments = path.split('/').filter(Boolean);

  const jsonResponse = (data, headers, status = 200) => 
    new Response(JSON.stringify(data), {
      status,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });

  try {
    // GET /api/warehouse/receipts - list all receipts
    if (method === 'GET' && segments.length === 3 && segments[2] === 'receipts') {
      const { results } = await DB.prepare(`
        SELECT 
          id, receipt_number, status, notes,
          created_by, created_by_name, created_at, completed_at, updated_at
        FROM warehouse_receipts
        ORDER BY created_at DESC
      `).all();

      return jsonResponse({ receipts: results }, corsHeaders);
    }

    // GET /api/warehouse/receipts/:id - get receipt details
    if (method === 'GET' && segments.length === 4) {
      const receiptId = segments[3];
      
      const receipt = await DB.prepare(`
        SELECT * FROM warehouse_receipts WHERE id = ?
      `).bind(receiptId).first();

      if (!receipt) {
        return jsonResponse({ error: 'Receipt not found' }, corsHeaders, 404);
      }

      const { results: items } = await DB.prepare(`
        SELECT * FROM warehouse_receipt_items WHERE receipt_id = ?
        ORDER BY created_at ASC
      `).bind(receiptId).all();

      return jsonResponse({ receipt, items }, corsHeaders);
    }

    // POST /api/warehouse/receipts - create new receipt
    if (method === 'POST' && segments.length === 3 && segments[2] === 'receipts') {
      const payload = await request.json();
      const receiptId = crypto.randomUUID();

      await DB.prepare(`
        INSERT INTO warehouse_receipts 
        (id, receipt_number, status, notes, created_by, created_by_name)
        VALUES (?, ?, 'completed', ?, ?, ?)
      `).bind(
        receiptId,
        payload.receipt_number,
        payload.notes || null,
        payload.created_by || 'system',
        payload.created_by_name || 'Завсклад'
      ).run();

      // Insert items
      const items = Array.isArray(payload.items) ? payload.items : [];
      for (const item of items) {
        const itemId = crypto.randomUUID();
        await DB.prepare(`
          INSERT INTO warehouse_receipt_items
          (id, receipt_id, product_id, product_name, quantity, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          itemId,
          receiptId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.notes || null
        ).run();
      }

      // Log activity
      await logActivity(DB, 'warehouse_receipt_created', 'receipt', receiptId, payload.receipt_number, payload.created_by_name, payload.created_by, {
        items_count: items.length,
        total_quantity: items.reduce((sum, i) => sum + i.quantity, 0)
      });

      const created = await DB.prepare(`
        SELECT * FROM warehouse_receipts WHERE id = ?
      `).bind(receiptId).first();

      return jsonResponse({ receipt: created }, corsHeaders, 201);
    }

    // PUT /api/warehouse/receipts/:id/complete - mark receipt as completed
    if (method === 'PUT' && segments.length === 5 && segments[4] === 'complete') {
      const receiptId = segments[3];

      const receipt = await DB.prepare(`
        SELECT * FROM warehouse_receipts WHERE id = ?
      `).bind(receiptId).first();

      if (!receipt) {
        return jsonResponse({ error: 'Receipt not found' }, corsHeaders, 404);
      }

      await DB.prepare(`
        UPDATE warehouse_receipts
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(receiptId).run();

      const updated = await DB.prepare(`
        SELECT * FROM warehouse_receipts WHERE id = ?
      `).bind(receiptId).first();

      return jsonResponse({ receipt: updated }, corsHeaders);
    }

    return jsonResponse({ error: 'Not found' }, corsHeaders, 404);

  } catch (error) {
    console.error('handleWarehouse error:', error);
    return jsonResponse({
      error: 'Warehouse handler error',
      details: error.message
    }, corsHeaders, 500);
  }
}

// ============= PRODUCTION STAGES API =============

async function handleProductionStages(request, env, path, corsHeaders) {
  const { DB } = env;
  const method = request.method;
  const segments = path.split('/').filter(Boolean);
  // Resolve role: try JWT (Authorization) first; fallback only for read-only endpoints.
  let role = 'guest';
  let jwtChecked = null;
  try {
    jwtChecked = await verifyJWTFromRequest(request, env.JWT_SECRET);
    if (jwtChecked.valid && jwtChecked.payload?.role) {
      role = jwtChecked.payload.role;
    } else {
      role = request.headers.get('X-Role') || request.headers.get('x-role') || 'guest';
    }
  } catch (_) {
    role = request.headers.get('X-Role') || request.headers.get('x-role') || 'guest';
  }
  // Allow only operator / assembler / manager / admin for read; scans restricted below

  // Helper: role priority order
  const ROLE_ORDER = ['assembler','operator','warehouse','manager','admin'];
  const roleAtLeast = (current, required) => ROLE_ORDER.indexOf(current) >= ROLE_ORDER.indexOf(required);

  // Business rule: only operator or assembler (and higher roles manager/admin) may perform scan operations.
  // Warehouse is explicitly excluded from scanning.

  try {
    // GET /api/production/stages - получить все этапы
    if (method === 'GET' && path === '/api/production/stages') {
      const { results } = await DB.prepare(`
        SELECT * FROM production_stages 
        WHERE is_active = 1
        ORDER BY sequence_order ASC
      `).all();

      return jsonResponse({ stages: results || [] }, corsHeaders);
    }

    // GET /api/production/alerts - overdue stages (SLA breach) with persistence and filters + pagination/time filters + CSV export
    if (method === 'GET' && path === '/api/production/alerts') {
      try {
        const urlObj = new URL(request.url);
        const statusFilter = urlObj.searchParams.get('status'); // new|ack|closed
        const stageFilter = urlObj.searchParams.get('stage_id');
        const segmentFilter = urlObj.searchParams.get('segment');
        const workshopFilter = urlObj.searchParams.get('workshop');
        const page = Math.max(1, Number(urlObj.searchParams.get('page') || 1));
        const pageSize = Math.min(Math.max(1, Number(urlObj.searchParams.get('page_size') || urlObj.searchParams.get('limit') || 100)), 500);
        const offset = (page - 1) * pageSize;
        const fromTs = urlObj.searchParams.get('from'); // ISO or sqlite parsable
        const toTs = urlObj.searchParams.get('to');
        const minOverdue = urlObj.searchParams.get('min_overdue');
        const exportCsv = (urlObj.searchParams.get('export') || '').toLowerCase() === 'csv';

        // Recalculate overdue transitions
        const { results: rawOverdue } = await DB.prepare(`
          SELECT st.id as transition_id, st.order_id, ps.id as stage_id, ps.name as stage_name,
                 ps.estimated_duration,
                 st.scan_time as started_at,
                 CAST((strftime('%s','now') - strftime('%s', st.scan_time)) / 60 AS INTEGER) AS elapsed_minutes
          FROM stage_transitions st
          JOIN production_stages ps ON ps.id = st.stage_id
          JOIN orders o ON o.id = st.order_id
          WHERE st.status = 'started'
            AND ps.estimated_duration IS NOT NULL
            AND (strftime('%s','now') - strftime('%s', st.scan_time)) / 60 > ps.estimated_duration
        `).all();

        for (const row of rawOverdue || []) {
          const overdueMinutes = Math.max(0, row.elapsed_minutes - (row.estimated_duration || 0));
          try {
            const existing = await DB.prepare(`SELECT id FROM production_alerts WHERE transition_id = ?`).bind(row.transition_id).first();
            if (existing) {
              await DB.prepare(`UPDATE production_alerts SET overdue_minutes = ?, updated_at = datetime('now') WHERE transition_id = ?`).bind(overdueMinutes, row.transition_id).run();
            } else {
              await DB.prepare(`INSERT INTO production_alerts (id, transition_id, order_id, stage_id, stage_name, started_at, estimated_duration, overdue_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                .bind(crypto.randomUUID(), row.transition_id, row.order_id, row.stage_id, row.stage_name, row.started_at, row.estimated_duration, overdueMinutes).run();
            }
          } catch (_) {}
        }

        // Auto close finished transitions
        await DB.prepare(`UPDATE production_alerts SET status='closed', closed_at=datetime('now'), updated_at=datetime('now') WHERE status!='closed' AND transition_id IN (SELECT id FROM stage_transitions WHERE status='completed')`).run().catch(()=>{});
        // Cleanup closed > 30 days
        await DB.prepare(`DELETE FROM production_alerts WHERE status='closed' AND closed_at < datetime('now','-30 days')`).run().catch(()=>{});

        // Build filtered query
        let baseJoin = ` FROM production_alerts pa 
                 JOIN stage_transitions st ON st.id = pa.transition_id 
                 JOIN production_stages ps ON ps.id = pa.stage_id 
                 JOIN orders o ON o.id = pa.order_id`;
        const wh = [];
        const binds = [];
        if (statusFilter && ['new','ack','closed'].includes(statusFilter)) { wh.push('pa.status = ?'); binds.push(statusFilter); }
        if (stageFilter) { wh.push('pa.stage_id = ?'); binds.push(stageFilter); }
        if (segmentFilter) { wh.push('o.segment = ?'); binds.push(segmentFilter); }
        if (workshopFilter) { wh.push('ps.workshop = ?'); binds.push(workshopFilter); }
        if (fromTs) { wh.push(`pa.detected_at >= datetime(?)`); binds.push(fromTs); }
        if (toTs) { wh.push(`pa.detected_at <= datetime(?)`); binds.push(toTs); }
        if (minOverdue) { wh.push(`pa.overdue_minutes >= ?`); binds.push(Number(minOverdue)); }

        // Count total for pagination
        let countSql = `SELECT COUNT(*) as cnt` + baseJoin;
        if (wh.length) countSql += ' WHERE ' + wh.join(' AND ');
        let total = 0;
        try {
          const row = await DB.prepare(countSql).bind(...binds).first();
          total = row?.cnt || 0;
        } catch (_) {}

        // Data query
        let q = `SELECT pa.*, o.segment, ps.workshop` + baseJoin;
        if (wh.length) q += ' WHERE ' + wh.join(' AND ');
        if (exportCsv) {
          // Ограничим экспорт до 10000 строк на всякий случай
          q += ' ORDER BY pa.detected_at DESC LIMIT 10000';
          const { results: rows } = await DB.prepare(q).bind(...binds).all();
          const headers = ['id','order_id','stage_id','stage_name','started_at','detected_at','estimated_duration','overdue_minutes','status','acknowledged_by','acknowledged_at','closed_at','segment','workshop'];
          const csvRows = [headers.join(',')];
          for (const r of rows || []) {
            const line = [
              r.id,
              r.order_id,
              r.stage_id,
              (r.stage_name || '').replaceAll('"','""'),
              r.started_at,
              r.detected_at,
              r.estimated_duration,
              r.overdue_minutes,
              r.status,
              r.acknowledged_by || '',
              r.acknowledged_at || '',
              r.closed_at || '',
              r.segment || '',
              r.workshop || ''
            ].map(v => typeof v === 'string' ? `"${v}"` : (v ?? '')).join(',');
            csvRows.push(line);
          }
          const body = csvRows.join('\n');
          return new Response(body, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="alerts.csv"' } });
        } else {
          q += ' ORDER BY pa.detected_at DESC LIMIT ? OFFSET ?';
          const dataBinds = [...binds, pageSize, offset];
          const { results: filtered } = await DB.prepare(q).bind(...dataBinds).all();
          let stats = { total: 0, new_count: 0, ack_count: 0, closed_count: 0 };
          try { const row = await DB.prepare(`SELECT * FROM production_alerts_stats`).first(); if (row) stats = row; } catch(_) {}
          return jsonResponse({ overdue: filtered || [], stats, page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) }, corsHeaders);
        }
      } catch (e) {
        return jsonResponse({ overdue: [], error: e.message }, corsHeaders, 500);
      }
    }

    // POST /api/production/path  -> получить маршрутизированный список этапов по segment или workshop
    if (method === 'POST' && path === '/api/production/path') {
      const body = await request.json().catch(() => ({}));
      const { segment, workshop } = body;
      let query = `SELECT * FROM production_stages WHERE is_active = 1`;
      const binds = [];
      if (segment) {
        query += ` AND (segment = ? OR segment IS NULL)`;
        binds.push(segment);
      }
      if (workshop) {
        query += ` AND (workshop = ? OR workshop IS NULL)`;
        binds.push(workshop);
      }
      query += ` ORDER BY sequence_order ASC`;
      const { results } = await DB.prepare(query).bind(...binds).all();
      return jsonResponse({ path: results || [], segment: segment || null, workshop: workshop || null }, corsHeaders);
    }

    // POST /api/production/alerts/:id/ack - acknowledge alert (JWT required)
    if (method === 'POST' && segments[2] === 'production' && segments[3] === 'alerts' && segments[4] && segments[5] === 'ack') {
      // Требуем валидный JWT
      const jwt = await verifyJWTFromRequest(request, env.JWT_SECRET);
      const jwtRole = jwt?.payload?.role;
      if (!jwt.valid || !(jwtRole === 'manager' || jwtRole === 'admin')) {
        return jsonResponse({ error: 'Недостаточно прав' }, corsHeaders, 403);
      }
      const alertId = segments[4];
      const body = await request.json().catch(() => ({}));
      const actor = body.user || jwt.payload?.sub || 'manager';
      await DB.prepare(`
        UPDATE production_alerts
        SET status = 'ack', acknowledged_by = ?, acknowledged_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND status = 'new'
      `).bind(actor, alertId).run();
      const updated = await DB.prepare(`SELECT * FROM production_alerts WHERE id = ?`).bind(alertId).first();
      try { await logActivity(DB, 'alert_ack', 'production_alert', alertId, updated?.stage_name || 'stage', actor, jwtRole, { transition_id: updated?.transition_id }); } catch(_){ }
      return jsonResponse({ alert: updated }, corsHeaders);
    }

    // POST /api/production/alerts/:id/close - close alert (JWT required)
    if (method === 'POST' && segments[2] === 'production' && segments[3] === 'alerts' && segments[4] && segments[5] === 'close') {
      const jwt = await verifyJWTFromRequest(request, env.JWT_SECRET);
      const jwtRole = jwt?.payload?.role;
      if (!jwt.valid || !(jwtRole === 'manager' || jwtRole === 'admin')) {
        return jsonResponse({ error: 'Недостаточно прав' }, corsHeaders, 403);
      }
      const alertId = segments[4];
      await DB.prepare(`
        UPDATE production_alerts
        SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(alertId).run();
      const updated = await DB.prepare(`SELECT * FROM production_alerts WHERE id = ?`).bind(alertId).first();
      try { await logActivity(DB, 'alert_closed', 'production_alert', alertId, updated?.stage_name || 'stage', jwt.payload?.sub || 'system', jwtRole, { transition_id: updated?.transition_id }); } catch(_){ }
      return jsonResponse({ alert: updated }, corsHeaders);
    }

    // GET /api/production/stages/:id - получить один этап
    if (method === 'GET' && segments.length === 4) {
      const stageId = segments[3];
      const stage = await DB.prepare(`
        SELECT * FROM production_stages WHERE id = ?
      `).bind(stageId).first();

      if (!stage) {
        return jsonResponse({ error: 'Stage not found' }, corsHeaders, 404);
      }

      return jsonResponse(stage, corsHeaders);
    }

    // POST /api/production/scan - сканирование QR-кода (старт или финиш этапа)
    if (method === 'POST' && path === '/api/production/scan') {
      // Strict JWT-based permission check for scanning
      const jwt = await verifyJWTFromRequest(request, env.JWT_SECRET);
      const jwtRole = jwt?.payload?.role;
      if (!jwt.valid || !(jwtRole === 'operator' || jwtRole === 'assembler' || jwtRole === 'manager' || jwtRole === 'admin')) {
        return jsonResponse({ error: 'Недостаточно прав для сканирования', role }, corsHeaders, 403);
      }
      const payload = await request.json();
  const { qr_code, stage_id, operator_name, operator_id, scan_type, notes, location } = payload;

      if (!qr_code || !stage_id || !operator_name) {
        return jsonResponse({ 
          error: 'Missing required fields: qr_code, stage_id, operator_name' 
        }, corsHeaders, 400);
      }

  // Найти заказ по QR-коду
      let order = await DB.prepare(`
        SELECT * FROM orders WHERE qr_code = ?
      `).bind(qr_code).first();

      // Если не нашли по прямому QR, попробовать найти по товару
      if (!order) {
        const product = await DB.prepare(`
          SELECT * FROM products WHERE qr_code = ? OR sku = ?
        `).bind(qr_code, qr_code).first();

        if (product) {
          // Найти активный заказ с этим товаром
          const orderItem = await DB.prepare(`
            SELECT oi.*, o.* FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = ? AND o.status != 'completed'
            ORDER BY o.created_at DESC
            LIMIT 1
          `).bind(product.id).first();

          if (orderItem) {
            order = orderItem;
          }
        }
      }

      if (!order) {
        return jsonResponse({ 
          error: 'Order not found for QR code',
          qr_code 
        }, corsHeaders, 404);
      }

      // Получить информацию об этапе
      const stage = await DB.prepare(`
        SELECT * FROM production_stages WHERE id = ?
      `).bind(stage_id).first();

      if (!stage) {
        return jsonResponse({ error: 'Stage not found', stage_id }, corsHeaders, 404);
      }

      // Получить предыдущий завершённый этап для последовательности
      const previousStage = await DB.prepare(`
        SELECT id, sequence_order FROM production_stages 
        WHERE sequence_order = ?
      `).bind(stage.sequence_order - 1).first();

      // Проверить последний переход для этого заказа и этапа
      const lastTransition = await DB.prepare(`
        SELECT * FROM stage_transitions 
        WHERE order_id = ? AND stage_id = ?
        ORDER BY scan_time DESC
        LIMIT 1
      `).bind(order.id, stage_id).first();

      let transitionId;
      let transitionStatus;
      let actualScanType = scan_type || 'start';

      // Дополнительная логика последовательности: нельзя начинать этап, если предыдущий активный не завершён
      if (!lastTransition) {
        // Проверить, что нет другого активного этапа с более высоким порядком
        const activeStarted = await DB.prepare(`
          SELECT st.*, ps.sequence_order FROM stage_transitions st
          JOIN production_stages ps ON st.stage_id = ps.id
          WHERE st.order_id = ? AND st.status = 'started'
          ORDER BY ps.sequence_order DESC
          LIMIT 1
        `).bind(order.id).first();

        if (activeStarted) {
          // Не позволяем стартовать новый пока есть активный
            return jsonResponse({
              error: 'Нельзя начать новый этап пока предыдущий не завершён',
              current_active_stage_id: activeStarted.stage_id,
              current_sequence_order: activeStarted.sequence_order
            }, corsHeaders, 409);
        }

        // Если это не первый по порядку этап, убедиться что предыдущий завершён
        if (previousStage && stage.sequence_order > 1) {
          const prevCompleted = await DB.prepare(`
            SELECT 1 FROM stage_transitions 
            WHERE order_id = ? AND stage_id = ? AND status = 'completed'
            ORDER BY scan_time DESC LIMIT 1
          `).bind(order.id, previousStage.id).first();
          if (!prevCompleted) {
            return jsonResponse({
              error: 'Предыдущий этап не завершён',
              required_previous_stage_id: previousStage.id,
              required_sequence_order: stage.sequence_order - 1
            }, corsHeaders, 409);
          }
        }
      }

      // Логика двойного сканирования
      if (!lastTransition || lastTransition.status === 'completed') {
        // Первое сканирование или предыдущий этап завершён - начать новый
        transitionId = crypto.randomUUID();
        transitionStatus = 'started';
        actualScanType = 'start';

        await DB.prepare(`
          INSERT INTO stage_transitions 
          (id, order_id, stage_id, status, operator_name, operator_id, notes, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          transitionId,
          order.id,
          stage_id,
          transitionStatus,
          operator_name,
          operator_id || null,
          notes || null,
          JSON.stringify({ scan_type: actualScanType })
        ).run();

      } else if (lastTransition.status === 'started') {
        // Второе сканирование - завершить этап
        transitionId = lastTransition.id;
        transitionStatus = 'completed';
        actualScanType = 'finish';

        const duration = Math.round(
          (Date.now() - new Date(lastTransition.scan_time).getTime()) / 1000 / 60
        );

        await DB.prepare(`
          UPDATE stage_transitions
          SET status = ?, scan_time = datetime('now'), duration_minutes = ?, notes = ?
          WHERE id = ?
        `).bind(
          transitionStatus,
          duration,
          notes || lastTransition.notes,
          transitionId
        ).run();
      }

      // Записать скан
      const scanId = crypto.randomUUID();
      await DB.prepare(`
        INSERT INTO stage_scans
        (id, transition_id, qr_code, scan_type, location, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        scanId,
        transitionId,
        qr_code,
        actualScanType,
        location || null,
        null // IP можно получить из request.headers
      ).run();

      // Получить обновлённый переход
      const transition = await DB.prepare(`
        SELECT * FROM stage_transitions WHERE id = ?
      `).bind(transitionId).first();

      // Логировать активность (не критично при ошибке)
      try {
        await logActivity(DB, 'production_stage_scan', 'stage', stage_id, stage.name, operator_name, role, {
          order_id: order.id,
          scan_type: actualScanType,
          status: transitionStatus
        });
      } catch (e) { /* ignore */ }

      return jsonResponse({
        success: true,
        transition,
        stage,
        scan_type: actualScanType,
        message: actualScanType === 'start' 
          ? `Этап "${stage.name}" начат` 
          : `Этап "${stage.name}" завершён`
      }, corsHeaders, 201);
    }

    // GET /api/production/order/:orderId/history - история этапов заказа
    if (method === 'GET' && segments[2] === 'order' && segments[4] === 'history') {
      const orderId = segments[3];

      const { results } = await DB.prepare(`
        SELECT 
          st.*,
          ps.name as stage_name,
          ps.color as stage_color,
          ps.icon as stage_icon,
          ps.sequence_order
        FROM stage_transitions st
        JOIN production_stages ps ON st.stage_id = ps.id
        WHERE st.order_id = ?
        ORDER BY st.scan_time ASC
      `).bind(orderId).all();

      return jsonResponse({ history: results || [] }, corsHeaders);
    }

    // GET /api/production/order/:orderId/current - текущий этап заказа
    if (method === 'GET' && segments[2] === 'order' && segments[4] === 'current') {
      const orderId = segments[3];

      const current = await DB.prepare(`
        SELECT 
          st.*,
          ps.name as stage_name,
          ps.color as stage_color,
          ps.icon as stage_icon,
          ps.sequence_order,
          ps.estimated_duration
        FROM stage_transitions st
        JOIN production_stages ps ON st.stage_id = ps.id
        WHERE st.order_id = ? AND st.status = 'started'
        ORDER BY st.scan_time DESC
        LIMIT 1
      `).bind(orderId).first();

      if (!current) {
        return jsonResponse({ current: null }, corsHeaders);
      }

      // Рассчитать текущую длительность
      const elapsedMinutes = Math.round(
        (Date.now() - new Date(current.scan_time).getTime()) / 1000 / 60
      );

      return jsonResponse({
        current: {
          ...current,
          elapsed_minutes: elapsedMinutes,
          is_overdue: current.estimated_duration && elapsedMinutes > current.estimated_duration
        }
      }, corsHeaders);
    }

    // GET /api/production/dashboard - дашборд для менеджеров
    if (method === 'GET' && path === '/api/production/dashboard') {
      // Получить все заказы с текущими этапами
      const { results: ordersWithStages } = await DB.prepare(`
        SELECT * FROM order_current_stage
        ORDER BY sequence_order ASC, started_at ASC
      `).all();

      // Прогресс по заказам (из view order_progress если существует)
      let orderProgress = [];
      try {
        const { results } = await DB.prepare(`SELECT * FROM order_progress`).all();
        orderProgress = results || [];
      } catch (e) {
        // view отсутствует - игнорируем
      }

      // Статистика по этапам
      const { results: stageStats } = await DB.prepare(`
        SELECT 
          ps.id,
          ps.name,
          ps.sequence_order,
          ps.color,
          COUNT(CASE WHEN st.status = 'started' THEN 1 END) as in_progress,
          COUNT(CASE WHEN st.status = 'completed' THEN 1 END) as completed_today,
          AVG(CASE WHEN st.status = 'completed' THEN st.duration_minutes END) as avg_duration
        FROM production_stages ps
        LEFT JOIN stage_transitions st ON ps.id = st.stage_id 
          AND date(st.scan_time) = date('now')
        WHERE ps.is_active = 1
        GROUP BY ps.id
        ORDER BY ps.sequence_order ASC
      `).all();

      // Alerts quick stats
      let alertStats = null;
      try {
        alertStats = await DB.prepare(`SELECT * FROM production_alerts_stats`).first();
      } catch (_) { /* optional */ }

      return jsonResponse({
        orders: ordersWithStages || [],
        order_progress: orderProgress,
        stage_stats: stageStats || [],
        alerts: alertStats || null,
        timestamp: new Date().toISOString()
      }, corsHeaders);
    }

    return jsonResponse({ error: 'Not found' }, corsHeaders, 404);

  } catch (error) {
    console.error('handleProductionStages error:', error);
    return jsonResponse({
      error: 'Production stages handler error',
      details: error.message
    }, corsHeaders, 500);
  }
}
