/**
 * Netlify Serverless Function: analytics-errors
 * Маршруты: POST /api/analytics/errors, GET /api/analytics/errors
 */

// In-memory cache for serverless invocation container lifecycle
let inMemoryErrors = [];

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'POST') {
      // Check if this is a clear request
      const path = event.path || '';
      if (path.endsWith('/clear')) {
        inMemoryErrors = [];
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: true, message: 'Ошибки телеметрии очищены', count: 0 }),
        };
      }

      let body = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ ok: false, error: 'Неверный формат JSON в запросе' }),
        };
      }

      const record = {
        id: body.id || `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        timestamp: Number(body.timestamp) || Date.now(),
        timeString: body.timeString || new Date().toLocaleTimeString('ru-RU'),
        name: String(body.name || 'Error'),
        message: String(body.message || 'Unknown exception'),
        stack: body.stack,
        componentStack: body.componentStack,
        module: String(body.module || 'Клиентский UI'),
        severity: String(body.severity || 'HIGH'),
        url: String(body.url || ''),
        userAgent: String(body.userAgent || event.headers['user-agent'] || ''),
        metadata: body.metadata,
        handled: Boolean(body.handled !== false),
      };

      inMemoryErrors.unshift(record);
      if (inMemoryErrors.length > 100) {
        inMemoryErrors = inMemoryErrors.slice(0, 100);
      }

      console.error(`[RadarTG Netlify Telemetry] ${record.module} [${record.severity}]: ${record.name} - ${record.message}`);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          ok: true,
          id: record.id,
          totalLogged: inMemoryErrors.length,
        }),
      };
    }

    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          errors: inMemoryErrors,
          count: inMemoryErrors.length,
        }),
      };
    }

    if (event.httpMethod === 'DELETE') {
      inMemoryErrors = [];
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, message: 'Ошибки телеметрии очищены', count: 0 }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: 'Метод не поддерживается' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message || 'Внутренняя ошибка сервера' }),
    };
  }
};
