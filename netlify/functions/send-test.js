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

    let botToken = (body.botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    let targetChatId = (body.chatId || body.targetChannelId || body.target || process.env.TELEGRAM_TARGET_CHANNEL || '').trim();
    const customText = body.customText;

    // Очистка токена
    botToken = botToken.replace(/^["'`]|["'`]$/g, '').trim();
    botToken = botToken.replace(/^https?:\/\/api\.telegram\.org\/bot/i, '');
    if (/^bot\d+:/i.test(botToken)) {
      botToken = botToken.slice(3);
    } else if (/^bot\s+/i.test(botToken)) {
      botToken = botToken.replace(/^bot\s+/i, '');
    }

    // Очистка ID / username канала
    targetChatId = targetChatId.replace(/^["'`]|["'`]$/g, '').trim();
    targetChatId = targetChatId.replace(/^https?:\/\/(?:www\.)?t\.me\//i, '').replace(/^t\.me\//i, '').trim();
    if (/^\d{8,}$/.test(targetChatId)) {
      targetChatId = `-100${targetChatId}`;
    } else if (!targetChatId.startsWith('@') && !targetChatId.startsWith('-') && !/^-?\d+$/.test(targetChatId)) {
      if (targetChatId.length > 0) targetChatId = `@${targetChatId}`;
    }

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
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      if (response.status === 401) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error:
              '❌ Ошибка токена (401 Unauthorized): Telegram отклонил токен бота!\nОбратите внимание: это ошибка САМОГО ТОКЕНА (в @BotFather), а НЕ прав администратора в канале. Проверьте токен в @BotFather.',
          }),
        };
      }
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Telegram API вернул не-JSON ответ (${response.status}): ${rawText.slice(0, 120)}`,
        }),
      };
    }

    if (!data.ok) {
      let readableError = data.description || 'Неизвестная ошибка Telegram API';

      if (readableError.includes('Unauthorized') || readableError.includes('401')) {
        readableError =
          '❌ Ошибка токена (401 Unauthorized): Telegram отклонил токен бота!\nОбратите внимание: это ошибка САМОГО ТОКЕНА (в @BotFather), а НЕ прав администратора в канале.\nПроверьте: скопируйте токен заново из @BotFather целиком без приставки "bot".';
      } else if (readableError.includes('chat not found')) {
        readableError = `🔍 Канал не найден (${targetChatId}). Проверьте правильность @username или числового ID канала (-100...).`;
      } else if (
        readableError.includes('kicked') ||
        readableError.includes('bot is not a member') ||
        readableError.includes('have no rights to send a message')
      ) {
        readableError = `⚠️ Ошибка прав в канале (403 Forbidden): Бот не имеет прав публиковать сообщения в канале (${targetChatId}). Добавьте именно этого бота в администраторы канала и включите право «Публикация сообщений».`;
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
