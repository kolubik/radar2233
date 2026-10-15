/**
 * Netlify Serverless Function: verify
 * Маршруты: POST /verify, POST /api/bot/verify
 */

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Ожидается POST-запрос' }),
    };
  }

  try {
    let body = {};
    if (event.body) {
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Некорректный JSON в теле запроса' }),
        };
      }
    }

    const token = (body.botToken || body.token || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Токен Telegram бота не передан' }),
      };
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined,
    });

    const data = await response.json();

    if (!data.ok) {
      let desc = data.description || 'Неверный токен бота Telegram';
      if (desc.includes('Unauthorized')) {
        desc = 'Неверный токен бота (401 Unauthorized). Проверьте токен в @BotFather.';
      }
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: desc }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        bot: {
          id: data.result.id,
          username: data.result.username,
          firstName: data.result.first_name,
        },
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'Ошибка сервера при проверке бота' }),
    };
  }
};
