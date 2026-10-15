/**
 * Безопасный HTTP-клиент и утилиты Telegram API.
 * Предотвращает ошибки:
 * - "JSON.parse: unexpected character at line 1 column 1"
 * - Неверную интерпретацию "401 Unauthorized" как отсутствие прав в канале
 */

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

/**
 * Очистка и нормализация токена Telegram бота.
 * Убирает случайные кавычки, пробелы, приставку "bot", ссылки вида https://api.telegram.org/bot...
 */
export function cleanTelegramBotToken(raw: string | null | undefined): string {
  if (!raw) return '';
  let token = String(raw).trim();
  // Убираем внешние кавычки
  token = token.replace(/^["'`]|["'`]$/g, '').trim();
  // Убираем URL Telegram API, если пользователь вставил ссылку целиком
  token = token.replace(/^https?:\/\/api\.telegram\.org\/bot/i, '');
  // Убираем префикс "bot", если скопировали с ним (например bot123456789:AA...)
  if (/^bot\d+:/i.test(token)) {
    token = token.slice(3);
  } else if (/^bot\s+/i.test(token)) {
    token = token.replace(/^bot\s+/i, '');
  }
  return token.trim();
}

/**
 * Очистка и нормализация ID целевого канала или @username.
 * Убирает ссылки t.me/, добавляет @ для юзернеймов, форматирует числовые ID.
 */
export function cleanTelegramChatId(raw: string | null | undefined): string {
  if (!raw) return '';
  let chat = String(raw).trim();
  // Убираем внешние кавычки
  chat = chat.replace(/^["'`]|["'`]$/g, '').trim();
  // Убираем ссылку t.me/ или https://t.me/
  chat = chat.replace(/^https?:\/\/(?:www\.)?t\.me\//i, '').replace(/^t\.me\//i, '').trim();

  // Если чисто числовое значение без минуса (например 1001234567890 для супергруппы/канала)
  if (/^\d{8,}$/.test(chat)) {
    chat = `-100${chat}`;
  } else if (!chat.startsWith('@') && !chat.startsWith('-') && !/^-?\d+$/.test(chat)) {
    // Если это текстовое имя канала без @ (например radar_alerts -> @radar_alerts)
    if (chat.length > 0) {
      chat = `@${chat}`;
    }
  }
  return chat;
}

/**
 * Понятное и точное разъяснение ошибок Telegram Bot API на русском языке.
 * Разделяет ошибки неверного токена бота от отсутствия прав администратора в канале.
 */
export function formatTelegramApiError(
  rawError: string | null | undefined,
  context?: { token?: string; channel?: string }
): string {
  const err = (rawError || '').trim();

  if (!err) {
    return 'Неизвестная ошибка Telegram API. Проверьте настройки бота и канала.';
  }

  // 1. Ошибка 401 Unauthorized — ТОКЕН БОТА НЕ ПРИНЯТ TELEGRAM
  if (err.includes('Unauthorized') || err.includes('401')) {
    return (
      '❌ Ошибка токена (401 Unauthorized): Telegram отклонил токен бота!\n' +
      'Обратите внимание: это ошибка САМОГО ТОКЕНА (в @BotFather), а НЕ прав администратора в канале.\n' +
      'Что проверить:\n' +
      '1. Перейдите в @BotFather в Telegram и скопируйте токен бота заново (вид: 123456789:ABCdef-GHI...).\n' +
      '2. Убедитесь, что токен не содержит приставки "bot" в начале.\n' +
      '3. Токен не был отозван командой /revoke в BotFather.'
    );
  }

  // 2. Ошибка 403 Forbidden — ПРАВА В КАНАЛЕ (бот не админ или нет права публикации)
  if (
    err.includes('bot is not a member') ||
    err.includes('have no rights to send a message') ||
    err.includes('not enough rights') ||
    err.includes('need administrator rights') ||
    err.includes('kicked') ||
    err.includes('Forbidden')
  ) {
    const channelName = context?.channel ? ` «${context.channel}»` : '';
    return (
      `⚠️ Ошибка прав в канале (403 Forbidden): Бот не имеет права публиковать сообщения в канале${channelName}!\n` +
      'Инструкция:\n' +
      '1. Откройте ваш канал в Telegram → Настройки канала (Управление каналом).\n' +
      '2. Перейдите в раздел «Администраторы» → «Добавить администратора».\n' +
      '3. Найдите именно вашего бота по его @username.\n' +
      '4. Включите разрешение «Публикация сообщений» (Post Messages) и сохраните.'
    );
  }

  // 3. Ошибка 400 chat not found — КАНАЛ НЕ НАЙДЕН
  if (err.includes('chat not found')) {
    const channelName = context?.channel ? ` (${context.channel})` : '';
    return (
      `🔍 Канал не найден${channelName}.\n` +
      'Для публичных каналов укажите юзернейм с символом @ (например, @my_channel).\n' +
      'Для закрытых каналов укажите числовой ID со знаком минус (-100xxxxxxxxxx).\n' +
      'Бот обязательно должен быть предварительно добавлен в канал!'
    );
  }

  // 4. Ошибки парсинга HTML страницы / JSON.parse
  if (
    err.includes('JSON.parse') ||
    err.includes('unexpected character') ||
    err.includes('<!doctype') ||
    err.includes('<html') ||
    err.includes('HTML-страницу')
  ) {
    return (
      '🌐 Сервер вернул HTML-страницу вместо JSON ответа.\n' +
      'Проверьте, что сервер разработки запущен или в Netlify настроены Serverless Functions.'
    );
  }

  // 5. Ошибки сущностей Telegram (bad HTML tags)
  if (err.includes("can't parse entities") || err.includes('entity')) {
    return '⚠️ Ошибка форматирования текста (HTML-теги сообщения не соответствуют требованиям Telegram).';
  }

  return err;
}

/**
 * Безопасный fetch с защитой от SyntaxError в response.json()
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });

    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();

    if (!rawText || !rawText.trim()) {
      return {
        ok: res.ok,
        status: res.status,
        data: null,
        error: res.ok ? null : `Сервер вернул пустой ответ (${res.status} ${res.statusText})`,
      };
    }

    const trimmed = rawText.trim();

    // Если ответ начинается с HTML тега '<' (например <!doctype html> или <html>), не пытаемся парсить его как JSON
    if (trimmed.startsWith('<') || (!contentType.includes('application/json') && trimmed.includes('<html'))) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Сервер вернул HTML-страницу вместо JSON (${res.status} ${res.statusText}).`,
      };
    }

    try {
      const parsed = JSON.parse(trimmed) as T;
      return {
        ok: res.ok,
        status: res.status,
        data: parsed,
        error: res.ok
          ? null
          : (parsed as any)?.error || (parsed as any)?.description || (parsed as any)?.message || `Ошибка запроса (${res.status})`,
      };
    } catch (parseError: any) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Некорректный JSON в ответе сервера: ${parseError.message}`,
      };
    }
  } catch (networkError: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: networkError.message || 'Сетевой сбой при обращении к серверу',
    };
  }
}
