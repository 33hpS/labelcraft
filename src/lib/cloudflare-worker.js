/**
 * Cloudflare Worker для ProductLabelerPro API
 * Развернуть в Cloudflare Workers
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Маршрутизация API
      if (path.startsWith('/api/templates')) {
        return await handleTemplates(request, env, path);
      } else if (path.startsWith('/api/upload')) {
        return await handleUpload(request, env);
      } else if (path.startsWith('/api/ai')) {
        return await handleAI(request, env);
      } else if (path.startsWith('/api/cloud')) {
        return await handleCloudSync(request, env);
      } else if (path.startsWith('/api/print')) {
        return await handlePrint(request, env);
      } else {
        return new Response('Not Found', { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  },
};

/**
 * Обработка операций с шаблонами
 */
async function handleTemplates(request, env, path) {
  const { DB } = env;
  
  if (request.method === 'GET') {
    if (path === '/api/templates') {
      // Получить все шаблоны
      const { results } = await DB.prepare(`
        SELECT * FROM templates ORDER BY created_at DESC
      `).all();
      return jsonResponse(results);
    } else {
      // Получить конкретный шаблон
      const id = path.split('/').pop();
      const template = await DB.prepare(`
        SELECT * FROM templates WHERE id = ?
      `).bind(id).first();
      
      if (!template) {
        return new Response('Template not found', { status: 404 });
      }
      
      return jsonResponse(template);
    }
  }
  
  if (request.method === 'POST') {
    const data = await request.json();
    
    if (path.endsWith('/export')) {
      // Экспорт шаблона
      const id = path.split('/')[3];
      return handleExport(id, data.format, env);
    }
    
    // Создание нового шаблона
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
    
    return jsonResponse({ id, message: 'Template created' });
  }
  
  if (request.method === 'PUT') {
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
    
    return jsonResponse({ message: 'Template updated' });
  }
  
  if (request.method === 'DELETE') {
    const id = path.split('/').pop();
    await DB.prepare('DELETE FROM templates WHERE id = ?').bind(id).run();
    return jsonResponse({ message: 'Template deleted' });
  }
  
  return new Response('Method not allowed', { status: 405 });
}

/**
 * Обработка загрузки файлов в R2
 */
async function handleUpload(request, env) {
  const { R2_BUCKET } = env;
  const formData = await request.formData();
  const file = formData.get('file');
  const templateId = formData.get('templateId');
  
  if (!file) {
    return new Response('No file provided', { status: 400 });
  }
  
  const fileKey = `templates/${templateId}/${Date.now()}-${file.name}`;
  await R2_BUCKET.put(fileKey, file);
  
  const fileUrl = `https://704015f3ab3baf13d815b254aee29972.r2.cloudflarestorage.com/productlabelerpro/${fileKey}`;
  
  return jsonResponse({ 
    url: fileUrl, 
    key: fileKey,
    message: 'File uploaded successfully'
  });
}

/**
 * Обработка AI запросов
 */
async function handleAI(request, env) {
  const data = await request.json();
  
  // Интеграция с OpenAI API (требует настройки в Cloudflare Workers)
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a label design assistant. Generate label content and layout suggestions.'
        },
        {
          role: 'user', 
          content: data.prompt
        }
      ],
      max_tokens: 500
    })
  });
  
  const result = await openaiResponse.json();
  return jsonResponse({ content: result.choices[0].message.content });
}

/**
 * Облачная синхронизация
 */
async function handleCloudSync(request, env) {
  const data = await request.json();
  
  // Интеграция с Google Drive/Dropbox API
  // Реализация зависит от выбранного провайдера
  return jsonResponse({ 
    message: `Sync with ${data.provider} ${data.action} initiated`,
    status: 'pending'
  });
}

/**
 * Обработка печати
 */
async function handlePrint(request, env) {
  const data = await request.json();
  
  // Интеграция с сервисами печати
  // Может использовать специализированные библиотеки для термопринтеров
  return jsonResponse({
    message: 'Print job queued',
    jobId: crypto.randomUUID(),
    status: 'queued'
  });
}

/**
 * Экспорт шаблонов
 */
async function handleExport(templateId, format, env) {
  // Генерация PDF/PNG на основе шаблона
  // Можно использовать библиотеки типа jsPDF или Canvas
  return jsonResponse({
    message: `Export to ${format} completed`,
    downloadUrl: `/api/download/${templateId}.${format}`,
    format
  });
}

/**
 * Вспомогательная функция для JSON ответов
 */
function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
