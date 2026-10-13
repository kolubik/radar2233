/**
 * Netlify Serverless Function: feed
 * Маршруты: GET /feed, GET /api/radar/feed, GET /.netlify/functions/feed
 */

// Образцовая база очищенных тревог и сводок
const MOCK_ALERT_FEED = [
  {
    id: 'alert-kiev-1',
    timestamp: Date.now() - 1000 * 60 * 3,
    sourceChannel: '@kyiv_alerts_oper',
    originalText: '🚨 КИЕВ и ОБЛАСТЬ! Внимание!\nГруппа БПЛА "Shahed-136" движется курсом на Белую Церковь / Васильков! Скорость ~185 км/ч.\n\n❗️ Срочно в укрытия!\n\n👇👇👇\nСбор на тепловизоры: https://send.monobank.ua/jar/test\nПодпишитесь на резервный канал: @test_channel',
    cleanedText: '🚨 КИЕВ и ОБЛАСТЬ! Внимание!\nГруппа БПЛА "Shahed-136" движется курсом на Белую Церковь / Васильков! Скорость ~185 км/ч.\n\nВнимание: Находитесь в укрытиях до отбоя!',
    threatType: 'DRONE',
    severity: 'CRITICAL',
    regions: ['Киев', 'Белая Церковь', 'Васильков', 'Киевская обл.'],
    vector: 'Юг -> Северо-Запад, курс на Васильков',
    altitudeSpeed: 'Высота 400м, скорость 185 км/ч',
    removedElements: [
      { type: 'donation', content: 'Сбор на тепловизоры: https://send.monobank.ua/jar/test' },
      { type: 'mention', content: '@test_channel' },
      { type: 'url', content: 'https://send.monobank.ua/jar/test' },
    ],
    isPureSpam: false,
    spamScore: 55,
    status: 'FORWARDED',
    forwardedAt: Date.now() - 1000 * 60 * 2,
    telegramMessageId: 1042,
  },
  {
    id: 'alert-dnipro-2',
    timestamp: Date.now() - 1000 * 60 * 14,
    sourceChannel: '@dnipro_monitor',
    originalText: '⚠️ Внимание! Активность вражеской тактической авиации Су-34 над акваторией Азовского моря!\nУгроза пуска управляемых авиабомб (КАБ) по Запорожскому району.\n\nРеклама: Скидки на пауэрбанки до 50% на сайте power-ua.shop!',
    cleanedText: '⚠️ Внимание! Активность тактической авиации Су-34 над акваторией Азовского моря!\nУгроза пуска управляемых авиабомб (КАБ) по Запорожскому району.',
    threatType: 'AVIATION',
    severity: 'HIGH',
    regions: ['Запорожье', 'Днепр', 'Днепропетровская обл.'],
    vector: 'Азовское море -> Запорожское направление',
    altitudeSpeed: 'Эшелон ~8500м',
    removedElements: [
      { type: 'clickbait', content: 'Реклама: Скидки на пауэрбанки до 50%' },
      { type: 'url', content: 'power-ua.shop' },
    ],
    isPureSpam: false,
    spamScore: 40,
    status: 'FORWARDED',
    forwardedAt: Date.now() - 1000 * 60 * 12,
    telegramMessageId: 1041,
  },
  {
    id: 'alert-kharkiv-3',
    timestamp: Date.now() - 1000 * 60 * 30,
    sourceChannel: '@kharkiv_operational',
    originalText: '🚀 ВНИМАНИЕ! Угроза применения баллистического вооружения с востока (Белгородская обл.)!\nХарьков и пригород — в укрытия!',
    cleanedText: '🚀 ВНИМАНИЕ! Угроза применения баллистического вооружения с востока!\nХарьков и пригород — срочно в укрытия!',
    threatType: 'BALLISTIC',
    severity: 'CRITICAL',
    regions: ['Харьков', 'Харьковская обл.'],
    vector: 'Восток -> Харьков',
    removedElements: [],
    isPureSpam: false,
    spamScore: 0,
    status: 'FORWARDED',
    forwardedAt: Date.now() - 1000 * 60 * 29,
    telegramMessageId: 1040,
  },
  {
    id: 'alert-spam-4',
    timestamp: Date.now() - 1000 * 60 * 45,
    sourceChannel: '@trash_alerts_bot',
    originalText: 'ШОК! Точные координаты прилетов на эту ночь слили тут 👉 https://t.me/fake_link?start=123',
    cleanedText: '',
    threatType: 'INFO',
    severity: 'LOW',
    regions: [],
    vector: 'Не определен',
    removedElements: [
      { type: 'clickbait', content: 'ШОК! Точные координаты прилетов' },
      { type: 'url', content: 'https://t.me/fake_link?start=123' },
    ],
    isPureSpam: true,
    spamScore: 100,
    status: 'BLOCKED',
  },
];

export const handler = async (event, context) => {
  // CORS-заголовки и Content-Type
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  // 1. CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  // 2. Проверка метода (GET или POST)
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Метод ${event.httpMethod} не поддерживается. Ожидается GET.`,
      }),
    };
  }

  try {
    // 3. Фильтрация по query-параметрам (если переданы)
    const query = event.queryStringParameters || {};
    let filteredFeed = [...MOCK_ALERT_FEED];

    if (query.type && query.type !== 'ALL') {
      filteredFeed = filteredFeed.filter((item) => item.threatType === query.type.toUpperCase());
    }

    if (query.severity && query.severity !== 'ALL') {
      filteredFeed = filteredFeed.filter((item) => item.severity === query.severity.toUpperCase());
    }

    if (query.hideSpam === 'true') {
      filteredFeed = filteredFeed.filter((item) => !item.isPureSpam);
    }

    // 4. Сводная статистика
    const stats = {
      totalParsed: MOCK_ALERT_FEED.length,
      totalBlocked: MOCK_ALERT_FEED.filter((a) => a.isPureSpam).length,
      totalCleaned: MOCK_ALERT_FEED.filter((a) => !a.isPureSpam).length,
      totalForwarded: MOCK_ALERT_FEED.filter((a) => a.status === 'FORWARDED').length,
    };

    // 5. Успешный ответ (возвращает feed и stats, удовлетворяющие как { feed: [...] }, так и массиву)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: filteredFeed.length,
        feed: filteredFeed,
        stats,
      }),
    };
  } catch (error) {
    // 6. Защита от сбоев — гарантированный возврат JSON со статусом 500
    console.error('[feed.js] Ошибка выполнения Serverless функции:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Ошибка сервера при получении ленты угроз',
        feed: [],
      }),
    };
  }
};
