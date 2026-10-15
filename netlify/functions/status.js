/**
 * Netlify Serverless Function: status
 * Маршруты: GET /status, GET /api/bot/status
 */

export const handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const channel = process.env.TELEGRAM_TARGET_CHANNEL || '';

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      config: {
        botToken: token,
        targetChannelId: channel,
        botUsername: null,
        botFirstName: null,
        isPolling: true,
        lastError: null,
        webhookUrl: null,
      },
      stats: {
        totalParsed: 4,
        totalBlocked: 1,
        totalCleaned: 3,
        totalForwarded: 3,
      },
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    }),
  };
};
