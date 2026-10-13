/**
 * Netlify Serverless Function: send-test
 * Маршруты: POST /send-test, POST /api/bot/send-test, POST /api/send-test
 */

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // 1. CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  // 2. Метод должен быть POST
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
            error: 'Некорректный формат JSON в теле запроса',
          }),
        };
      }
    }

    const botToken = (body.botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const targetChatId = (body.chatId || body.targetChannelId || body.target || process.env.TELEGRAM_TARGET_CHANNEL || '').trim();
    const customText = body.customText;

    if (!botToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Токен Telegram бота не передан. Сохраните токен в настройках или передайте botToken.',
        }),
      };
    }

    if (!targetChatId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Не указан целевой канал. Укажите ID канала (например -100123456789) или @username_канала.',
        }),
      };
    }

    const messageText =
      customText ||
      `🟢 <b>RadarTG Bot: Тестовое сообщение доставлено!</b>\n\n🛡️ Связь между радаром тревог и каналом установлена успешно.\nФильтры рекламы, донатов и ссылок активны.\n\n⏱️ Время отправки: ${new Date().toLocaleTimeString('ru-RU')}`;

    // Запрос напрямую к Telegram Bot API sendMessage
    const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });

    const data = await response.json();

    if (!data.ok) {
      // Telegram Bot API возвратил ошибку (например, бот не админ или чат не найден)
      let readableError = data.description || 'Неизвестная ошибка Telegram API';

      if (readableError.includes('chat not found')) {
        readableError = `Канал не найден (${targetChatId}). Проверьте правильность @username или числового ID канала (для закрытых каналов ID должен начинаться с -100...).`;
      } else if (
        readableError.includes('kicked') ||
        readableError.includes('bot is not a member') ||
        readableError.includes('have no rights to send a message')
      ) {
        readableError = `Бот не состоит в канале или был удален. Убедитесь, что в администраторы добавлен именно этот бот, и выдайте право «Публикация сообщений».`;
      } else if (readableError.includes('Unauthorized')) {
        readableError = `Неверный токен Telegram бота (401 Unauthorized). Проверьте токен в @BotFather.`;
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: readableError,
          rawError: data.description,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Сообщение успешно отправлено в канал Telegram',
        messageId: data.result?.message_id,
        chat: data.result?.chat,
      }),
    };
  } catch (error) {
    console.error('[send-test.js] Ошибка:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Внутренняя ошибка сервера при отправке сообщения в Telegram',
      }),
    };
  }
};
