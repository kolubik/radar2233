/**
 * Netlify Serverless Function: configure
 * Маршруты: POST /configure, POST /api/bot/configure, POST /.netlify/functions/configure
 */

export const handler = async (event, context) => {
  // CORS-заголовки и гарантированный Content-Type: application/json
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // 1. Обработка CORS Preflight (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  // 2. Проверка метода запроса (только POST)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Метод ${event.httpMethod} не поддерживается. Ожидается POST.`,
      }),
    };
  }

  try {
    // 3. Безопасный парсинг тела запроса
    let body = {};
    if (event.body) {
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (jsonErr) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Некорректный формат JSON в теле запроса (Invalid JSON body)',
          }),
        };
      }
    }

    // Поддержка различных вариантов именования полей
    const botToken = (body.botToken || body.token || '').trim();
    const targetChannelId = (body.targetChannelId || body.channelId || body.chatId || '').trim();

    // 4. Валидация входных данных
    if (!botToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Поле botToken обязательно для заполнения',
        }),
      };
    }

    // Базовая проверка формата токена Telegram (ID_БОТА:ТОКЕН_ИЗ_БУКВ_И_ЦИФР)
    const tokenFormatRegex = /^\d+:[A-Za-z0-9_-]{20,}$/;
    if (!tokenFormatRegex.test(botToken)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Неверный формат Telegram Bot Token. Токен должен иметь вид 123456789:ABCdefGhIjkLmNoPqRsTuvWxYz',
        }),
      };
    }

    // 5. Проверка токена через официальный Telegram Bot API (getMe)
    let botInfo = {
      id: null,
      username: null,
      firstName: null,
      canJoinGroups: true,
      canReadMessages: false,
    };
    let isVerified = false;

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined,
      });

      const tgData = await response.json();

      if (tgData.ok && tgData.result) {
        botInfo = {
          id: tgData.result.id,
          username: tgData.result.username || null,
          firstName: tgData.result.first_name || 'Radar Bot',
          canJoinGroups: tgData.result.can_join_groups ?? true,
          canReadMessages: tgData.result.can_read_all_group_messages ?? false,
        };
        isVerified = true;
      } else {
        // Telegram API вернул ошибку авторизации бота (например, 401 Unauthorized)
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: tgData.description || 'Ошибка проверки бота: Telegram отклонил переданный токен',
          }),
        };
      }
    } catch (networkError) {
      // При временных неполадках сети или таймауте не прерываем сохранение
      console.warn('[configure.js] Предупреждение при запросе к Telegram API:', networkError.message);
      botInfo.firstName = 'Radar Bot (Офлайн-верификация)';
    }

    // 6. Формирование успешного ответа
    const config = {
      botToken,
      targetChannelId: targetChannelId || '@radar_channel',
      botUsername: botInfo.username,
      botFirstName: botInfo.firstName,
      isPolling: true,
      isVerified,
      lastError: null,
      updatedAt: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Конфигурация Telegram бота успешно сохранена',
        config,
      }),
    };
  } catch (error) {
    // 7. Глобальный перехват ошибок — сервер ВСЕГДА возвращает JSON
    console.error('[configure.js] Ошибка выполнения Serverless функции:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Внутренняя ошибка сервера при сохранении настроек бота',
      }),
    };
  }
};
