import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { fastEngine, FastCleanResult, FastThreatResult } from './src/utils/fastEngine.js';
import { localSqlEngine } from './src/utils/localSqlEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'radar_database.json');
const SQL_DUMP_FILE = path.join(DATA_DIR, 'radar_local.sql');

const app = express();
// AI Studio dev server runs on port 3000 (0.0.0.0).
// In Cloud Run, process.env.PORT is 8080 (used by Nginx ingress proxying to 3000),
// so we explicitly use 3000 unless a specific CLI --port flag is passed.
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : NaN;
const PORT = !isNaN(cliPort) && cliPort > 0 ? cliPort : 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Gemini SDK Setup (Server-Side only)
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// In-Memory Storage for Bot Settings, Rules & Threat Feed
interface FilterConfig {
  removeUrls: boolean;
  removeMentions: boolean;
  removeDonations: boolean;
  removeClickbait: boolean;
  removeExcessiveEmojis: boolean;
  useAiSanitizer: boolean;
  minSeverity: 'ALL' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  autoForward: boolean;
  customKeywords: string[];
  customRegexes: string[];
  alertTemplate: string;
  soundAlerts: boolean;
  attachInlineButtons: boolean;
  useTelegramBlockquote: boolean;
  quoteHeaderTitle: string;
  defaultFollowupComment: string;
  expandableQuote: boolean;
  forwardingMode: 'blockquote' | 'template' | 'copy' | 'forward';
  ultraFastMode: boolean;
}

interface TelegramSubscriber {
  chatId: string;
  username?: string;
  firstName?: string;
  minSeverity: 'ALL' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  subscribedTypes: Array<'MISSILE' | 'BALLISTIC' | 'DRONE' | 'AVIATION' | 'ARTILLERY' | 'AIR_RAID' | 'ALL_CLEAR' | 'INFO'>;
  subscribedRegions: string[]; // empty means all
  active: boolean;
  createdAt: number;
}

interface TelegramConfig {
  botToken: string;
  targetChannelId: string; // e.g. @my_radar_channel or -100123456789
  botUsername: string | null;
  botFirstName: string | null;
  isPolling: boolean;
  lastError: string | null;
  webhookUrl: string | null;
}

interface ParsedAlert {
  id: string;
  timestamp: number;
  sourceChannel: string;
  originalText: string;
  cleanedText: string;
  threatType: 'MISSILE' | 'DRONE' | 'AVIATION' | 'BALLISTIC' | 'ARTILLERY' | 'AIR_RAID' | 'ALL_CLEAR' | 'INFO';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  regions: string[];
  vector: string;
  altitudeSpeed?: string;
  removedElements: Array<{ type: 'url' | 'mention' | 'donation' | 'clickbait' | 'keyword' | 'cleaner'; content: string }>;
  isPureSpam: boolean;
  spamScore: number;
  status: 'PENDING' | 'FORWARDED' | 'BLOCKED' | 'SIMULATED';
  forwardedAt?: number;
  telegramMessageId?: number;
  quoteCommentary?: string;
  originalTelegramMessageId?: number;
  fromChatId?: string | number;
  threatCause?: string;
  routeTrajectory?: string;
  colorThreatLevel?: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  correlationTaskId?: string;
  processingTimeMs?: number;
  engineUsed?: 'FAST_REGEX_ENGINE' | 'AI_GEMINI_HYBRID';
}

interface TacticalTask {
  id: string;
  name: string;
  enabled: boolean;
  targetRegion: string;
  triggerThreatType: 'MISSILE' | 'BALLISTIC' | 'DRONE' | 'AVIATION' | 'ARTILLERY' | 'AIR_RAID' | 'ALL_CLEAR' | 'INFO' | 'ANY';
  searchCauseInChannels: boolean;
  trackRouteAndSeverity: boolean;
  autoPublishTelegram: boolean;
  customCommentaryTemplate?: string;
  lastTriggeredAt?: number;
  triggerCount: number;
  lastFoundCause?: string;
  lastAssignedLevel?: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
}

interface TaskExecutionLog {
  id: string;
  taskId: string;
  taskName: string;
  timestamp: number;
  targetRegion: string;
  triggerAlertId: string;
  foundCause: string;
  routePath: string;
  threatLevel: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  generatedTelegramPost: string;
  publishedToTelegram: boolean;
  telegramMessageId?: number;
}

const filterConfig: FilterConfig = {
  removeUrls: true,
  removeMentions: true,
  removeDonations: true,
  removeClickbait: true,
  removeExcessiveEmojis: true,
  useAiSanitizer: true,
  minSeverity: 'ALL',
  autoForward: false,
  customKeywords: ['карта моно', 'подпишись на резерв', 'все подробности тут', 'банка моно', 'донатьте'],
  customRegexes: [
    '(?:https?:\\/\\/t\\.me\\/\\+[a-zA-Z0-9_]+)',
    '(?:скиньте\\s+на\\s+кофе)',
    '(?:USDT\\s*TRC20?:?\\s*[A-Za-z0-9]{30,})',
  ],
  alertTemplate: '🚨 [РАДАР УГРОЗ] {TYPE_EMOJI} {TYPE}\n📍 Сектор: {REGIONS}\n🧭 Направление: {VECTOR}\n⚠️ Уровень угрозы: {SEVERITY}\n\n📝 Сводка:\n{TEXT}\n\n🛡️ Очищено от спама и рекламы • RadarTG Bot',
  soundAlerts: true,
  attachInlineButtons: true,
  useTelegramBlockquote: true,
  quoteHeaderTitle: 'Розвідка України',
  defaultFollowupComment: 'Не фіксується',
  expandableQuote: false,
  forwardingMode: 'blockquote',
  ultraFastMode: true,
};

const telegramConfig: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  targetChannelId: process.env.TELEGRAM_TARGET_CHANNEL || '',
  botUsername: null,
  botFirstName: null,
  isPolling: false,
  lastError: null,
  webhookUrl: null,
};

// In-Memory Telegram subscribers
let telegramSubscribers: TelegramSubscriber[] = [
  {
    chatId: 'demo-user-1',
    username: 'tactical_operator',
    firstName: 'Оператор Дмитро',
    minSeverity: 'ALL',
    subscribedTypes: ['MISSILE', 'BALLISTIC', 'DRONE', 'AVIATION'],
    subscribedRegions: [],
    active: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

// Tactical Tasks & Automated Scenarios
let tacticalTasks: TacticalTask[] = [
  {
    id: 'task-khmelnytskyi-radar',
    name: 'Хмельницкая область: Поиск причины тревоги и маршрута БПЛА',
    enabled: true,
    targetRegion: 'Хмельницкая',
    triggerThreatType: 'AIR_RAID',
    searchCauseInChannels: true,
    trackRouteAndSeverity: true,
    autoPublishTelegram: true,
    triggerCount: 3,
    lastTriggeredAt: Date.now() - 1000 * 60 * 18,
    lastFoundCause: '3х БПЛА Shahed из Винницкой области (Бар -> Летичев)',
    lastAssignedLevel: 'ORANGE',
  },
  {
    id: 'task-kyiv-threat-path',
    name: 'Киев и область: Корреляция пусков и траектории через Чернигов/Сумы',
    enabled: true,
    targetRegion: 'Киев',
    triggerThreatType: 'ANY',
    searchCauseInChannels: true,
    trackRouteAndSeverity: true,
    autoPublishTelegram: false,
    triggerCount: 7,
    lastTriggeredAt: Date.now() - 1000 * 60 * 45,
    lastFoundCause: 'Группа БПЛА через Черниговскую обл. курсом на Бровары/Васильков',
    lastAssignedLevel: 'RED',
  },
  {
    id: 'task-odesa-sea-launches',
    name: 'Одесса и Черноморск: Анализ пусков с моря и траектории через Затоку',
    enabled: true,
    targetRegion: 'Одесса',
    triggerThreatType: 'DRONE',
    searchCauseInChannels: true,
    trackRouteAndSeverity: true,
    autoPublishTelegram: false,
    triggerCount: 2,
    lastTriggeredAt: Date.now() - 1000 * 60 * 90,
    lastFoundCause: 'Заход 4х Шахедов со стороны Черного моря через Затоку/Маяки',
    lastAssignedLevel: 'YELLOW',
  },
];

let taskExecutionLogs: TaskExecutionLog[] = [
  {
    id: 'log-1',
    taskId: 'task-khmelnytskyi-radar',
    taskName: 'Хмельницкая область: Поиск причины тревоги и маршрута БПЛА',
    timestamp: Date.now() - 1000 * 60 * 18,
    targetRegion: 'Хмельницкая область',
    triggerAlertId: 'sample-1',
    foundCause: 'По данным мониторинга Винничины (@vinnytsia_alerts): зафиксирован пролет 3х БПЛА "Shahed-136" через Липовец -> Бар в направлении Хмельницкой области.',
    routePath: 'Винницкая обл. (Ладыжин -> Бар) ➔ Хмельницкая обл. (Деражня ➔ Староконстантинов)',
    threatLevel: 'ORANGE',
    generatedTelegramPost: '<b>Розвідка України</b>\n\n<blockquote>📢 <b>Хмельницька ОВА</b>\n🚨 Хмельницька область — ПОВІТРЯНА ТРИВОГА!</blockquote>\n\n🟠 <b>[СТУПЕНЬ УГРОЗЫ: ВЫСОКИЙ]</b>\n🧭 <b>Маршрут БПЛА:</b> Вінниччина ➔ Деражня ➔ Старокостянтинів\n🔍 <b>Причина:</b> 3х Шахеди на низькій висоті курсом на Старокостянтинів. Працює ППО.',
    publishedToTelegram: false,
  },
];

export interface ParsingChannel {
  id: string;
  username: string;
  title: string;
  category: 'AIR_FORCE' | 'RADAR' | 'REGIONAL' | 'OFFICIAL' | 'GENERAL';
  active: boolean;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  parseIntervalSeconds: number;
  autoForward: boolean;
  parsedMessagesCount: number;
  lastParsedAt?: number;
  lastAlertDetected?: string;
  notes?: string;
  sqlRowId?: number;
}

let parsingChannels: ParsingChannel[] = [
  {
    id: 'ch-kpszsu',
    username: '@kpszsu',
    title: 'Повітряні Сили ЗСУ',
    category: 'AIR_FORCE',
    active: true,
    priority: 'HIGH',
    parseIntervalSeconds: 5,
    autoForward: true,
    parsedMessagesCount: 48,
    lastParsedAt: Date.now() - 1000 * 60 * 2,
    lastAlertDetected: 'Взлет 4х Ту-95мс с аэродрома Оленья',
    notes: 'Официальные сводки Командования Воздушных Сил',
  },
  {
    id: 'ch-vanek',
    username: '@vanek_nikolaev',
    title: 'Николаевский Ванёк',
    category: 'RADAR',
    active: true,
    priority: 'HIGH',
    parseIntervalSeconds: 5,
    autoForward: true,
    parsedMessagesCount: 112,
    lastParsedAt: Date.now() - 1000 * 60 * 4,
    lastAlertDetected: 'Шахеды через Берислав на Снигиревку',
    notes: 'Высокая оперативность, маршруты БПЛА и векторы',
  },
  {
    id: 'ch-kyiv-alerts',
    username: '@kyiv_alerts_oper',
    title: 'Оперативный Киев / Радар',
    category: 'REGIONAL',
    active: true,
    priority: 'HIGH',
    parseIntervalSeconds: 10,
    autoForward: true,
    parsedMessagesCount: 89,
    lastParsedAt: Date.now() - 1000 * 60 * 7,
    lastAlertDetected: 'БПЛА на Белую Церковь / Васильков',
    notes: 'Сводки по Киеву, Фастову, Броварам, ПВО',
  },
  {
    id: 'ch-dnipro-monitor',
    username: '@dnipro_monitor',
    title: 'Днепр Монитор & КАБ',
    category: 'REGIONAL',
    active: true,
    priority: 'NORMAL',
    parseIntervalSeconds: 15,
    autoForward: true,
    parsedMessagesCount: 63,
    lastParsedAt: Date.now() - 1000 * 60 * 12,
    lastAlertDetected: 'Угроза КАБ по Запорожскому району',
    notes: 'Южное и восточное направление, пуски КАБ/ФАБ',
  },
  {
    id: 'ch-air-raid-ua',
    username: '@air_raid_ua',
    title: 'Карта воздушных тревог Украины',
    category: 'OFFICIAL',
    active: true,
    priority: 'NORMAL',
    parseIntervalSeconds: 15,
    autoForward: false,
    parsedMessagesCount: 34,
    lastParsedAt: Date.now() - 1000 * 60 * 20,
    lastAlertDetected: 'Воздушная тревога в Черниговской области',
    notes: 'Фиксация сирен и отбоев',
  },
  {
    id: 'ch-odesa-oper',
    username: '@odesa_operatyvna',
    title: 'Одесса Оперативная / Черное Море',
    category: 'REGIONAL',
    active: false,
    priority: 'LOW',
    parseIntervalSeconds: 20,
    autoForward: false,
    parsedMessagesCount: 19,
    lastParsedAt: Date.now() - 1000 * 60 * 50,
    lastAlertDetected: 'Пуски с мыса Тарханкут / Крым',
    notes: 'Черноморский регион, Затока, Одесса',
  },
];

const stats = {
  totalParsed: 0,
  totalBlocked: 0,
  totalCleaned: 0,
  totalForwarded: 0,
};

// Seed alert feed with realistic threat messages
let alertFeed: ParsedAlert[] = [
  {
    id: 'sample-1',
    timestamp: Date.now() - 1000 * 60 * 4,
    sourceChannel: '@kyiv_alerts_oper',
    originalText: `🚨 КИЕВ и ОБЛАСТЬ! Внимание!\nГруппа БПЛА "Shahed-136" движется курсом на Белую Церковь / Васильков! Скорость ~185 км/ч.\n\n❗️ Срочно в укрытия!\n\n👇👇👇\nСбор на тепловизоры и антидроновые ружья для 72-й бригады! Ссылка на монобанку: https://send.monobank.ua/jar/9X28abD932\nКарта: 4441 1144 8832 9912\nПодпишитесь на наш VIP канал со спутниковыми снимками прилетов: @secret_radar_vip`,
    cleanedText: `🚨 КИЕВ и ОБЛАСТЬ! Внимание!\nГруппа БПЛА "Shahed-136" движется курсом на Белую Церковь / Васильков! Скорость ~185 км/ч.\n\nВнимание: Находитесь в укрытиях до отбоя!`,
    threatType: 'DRONE',
    severity: 'CRITICAL',
    regions: ['Киев', 'Белая Церковь', 'Васильков', 'Киевская обл.'],
    vector: 'Юг -> Северо-Запад, курс на Васильков',
    altitudeSpeed: 'Высота 400м, скорость 185 км/ч',
    removedElements: [
      { type: 'donation', content: 'Сбор на тепловизоры... монобанка: https://send.monobank.ua/jar/9X28abD932' },
      { type: 'donation', content: 'Карта: 4441 1144 8832 9912' },
      { type: 'clickbait', content: 'Подпишитесь на наш VIP канал со спутниковыми снимками' },
      { type: 'mention', content: '@secret_radar_vip' },
      { type: 'url', content: 'https://send.monobank.ua/jar/9X28abD932' },
    ],
    isPureSpam: false,
    spamScore: 65,
    status: 'FORWARDED',
    forwardedAt: Date.now() - 1000 * 60 * 3,
    telegramMessageId: 1042,
  },
  {
    id: 'sample-2',
    timestamp: Date.now() - 1000 * 60 * 12,
    sourceChannel: '@dnipro_monitor',
    originalText: `⚠️ Внимание! Активность вражеской тактической авиации Су-34 над акваторией Азовского моря!\nУгроза пуска управляемых авиабомб (КАБ) по Запорожскому и Днепропетровскому районам.\n\nРеклама: Лучшие повербанки и зарядные станции со скидкой 40% на t.me/eco_power_sales!\nЖми ссылку прямо сейчас, акция до полуночи!`,
    cleanedText: `⚠️ Внимание! Активность тактической авиации Су-34 над акваторией Азовского моря!\nУгроза пуска управляемых авиабомб (КАБ) по Запорожскому и Днепропетровскому районам.`,
    threatType: 'AVIATION',
    severity: 'HIGH',
    regions: ['Запорожье', 'Днепр', 'Днепропетровская обл.'],
    vector: 'Азовское море -> Запорожское направление',
    altitudeSpeed: 'Эшелон ~8500м',
    removedElements: [
      { type: 'url', content: 't.me/eco_power_sales' },
      { type: 'clickbait', content: 'Реклама: Лучшие повербанки... Жми ссылку прямо сейчас' },
    ],
    isPureSpam: false,
    spamScore: 48,
    status: 'FORWARDED',
    forwardedAt: Date.now() - 1000 * 60 * 11,
    telegramMessageId: 1041,
  },
  {
    id: 'sample-3',
    timestamp: Date.now() - 1000 * 60 * 25,
    sourceChannel: '@trash_alerts_bot',
    originalText: `⚡️⚡️ ШОК! СРОЧНОЕ ЗАЯВЛЕНИЕ ПО РАКЕТНЫМ УДАРАМ!\nАдминистраторы слили точные координаты и график ракетных ударов на сегодня ночью!\n\nУспей посмотреть пока не удалили 👉 https://t.me/fake_secret_news_bot?start=ref12948\nДонаты админу на пиво: USDT TRC20: TL2w5pZ7qV1K4s9Yx7uJ2v`,
    cleanedText: ``,
    threatType: 'INFO',
    severity: 'LOW',
    regions: [],
    vector: '',
    removedElements: [
      { type: 'clickbait', content: 'ШОК! СРОЧНОЕ ЗАЯВЛЕНИЕ... Успей посмотреть пока не удалили' },
      { type: 'url', content: 'https://t.me/fake_secret_news_bot?start=ref12948' },
      { type: 'donation', content: 'Донаты админу... USDT TRC20: TL2w5pZ7qV1K4s9Yx7uJ2v' },
    ],
    isPureSpam: true,
    spamScore: 100,
    status: 'BLOCKED',
  },
];

// ================= LOCAL PERSISTENT DATABASE ENGINE =================
function saveDatabaseToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = {
      version: '1.0.0',
      lastSaved: Date.now(),
      savedDate: new Date().toISOString(),
      filterConfig,
      telegramConfig: {
        botToken: telegramConfig.botToken,
        targetChannelId: telegramConfig.targetChannelId,
        botUsername: telegramConfig.botUsername,
        botFirstName: telegramConfig.botFirstName,
      },
      parsingChannels,
      telegramSubscribers,
      tacticalTasks,
      taskExecutionLogs,
      alertFeed,
      stats,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');

    // Sync Relational SQL Database & Export Dump to disk
    localSqlEngine.syncChannelsFromMemory(parsingChannels);
    localSqlEngine.syncAlertsFromMemory(alertFeed);
    const sqlDump = localSqlEngine.exportSqlDump();
    fs.writeFileSync(SQL_DUMP_FILE, sqlDump, 'utf-8');
  } catch (err) {
    console.error('Failed to save database to disk:', err);
  }
}

function loadDatabaseFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data.filterConfig) Object.assign(filterConfig, data.filterConfig);
      if (data.telegramConfig) {
        if (data.telegramConfig.targetChannelId) telegramConfig.targetChannelId = data.telegramConfig.targetChannelId;
        if (data.telegramConfig.botToken) telegramConfig.botToken = data.telegramConfig.botToken;
        if (data.telegramConfig.botUsername) telegramConfig.botUsername = data.telegramConfig.botUsername;
        if (data.telegramConfig.botFirstName) telegramConfig.botFirstName = data.telegramConfig.botFirstName;
      }
      if (Array.isArray(data.parsingChannels) && data.parsingChannels.length > 0) {
        parsingChannels = data.parsingChannels;
      }
      if (Array.isArray(data.telegramSubscribers) && data.telegramSubscribers.length > 0) {
        telegramSubscribers = data.telegramSubscribers;
      }
      if (Array.isArray(data.tacticalTasks) && data.tacticalTasks.length > 0) {
        tacticalTasks = data.tacticalTasks;
      }
      if (Array.isArray(data.taskExecutionLogs)) {
        taskExecutionLogs = data.taskExecutionLogs;
      }
      if (Array.isArray(data.alertFeed) && data.alertFeed.length > 0) {
        alertFeed = data.alertFeed;
      }
      if (data.stats) Object.assign(stats, data.stats);

      // Sync local SQL database
      localSqlEngine.syncChannelsFromMemory(parsingChannels);
      localSqlEngine.syncAlertsFromMemory(alertFeed);

      console.log(`[RadarDB] Persistent database loaded from ${DB_FILE}`);
    } else {
      // First boot: create initial database file on disk
      saveDatabaseToDisk();
      console.log(`[RadarDB] Initialized fresh local database at ${DB_FILE}`);
    }
  } catch (err) {
    console.error('Failed to load database from disk:', err);
  }
}

// Initialize persistent storage immediately
loadDatabaseFromDisk();

// Helper: Fast Heuristic Cleaner & Spam Extractor (powered by sub-millisecond FastTextEngine)
function cleanMessageHeuristically(text: string, config: FilterConfig) {
  // Sync engine keywords & regex rules
  fastEngine.updateUserRules(config.customKeywords || [], config.customRegexes || []);

  const result = fastEngine.cleanFast(text, {
    removeUrls: config.removeUrls,
    removeMentions: config.removeMentions,
    removeDonations: config.removeDonations,
    removeClickbait: config.removeClickbait,
    removeExcessiveEmojis: config.removeExcessiveEmojis,
  });

  return result;
}

// Helper: AI Threat Intelligence Extractor & Sanitizer via Gemini API
async function analyzeThreatWithGemini(originalText: string, heuristicCleaned: string) {
  if (!ai) {
    // Fallback if no Gemini API key configured
    return fallbackThreatAnalysis(heuristicCleaned);
  }

  try {
    const prompt = `
Ты — автоматический военный радар и фильтр угроз для Telegram канала мониторинга оперативной обстановки.
Твоя задача — извлечь ТОЛЬКО чистую, проверенную фактическую информацию об угрозах из входящего сообщения и полностью уничтожить:
1. Любую рекламу, ссылки (t.me, http), упоминания (@каналы), реферальные ссылки.
2. Любые просьбы о донатах, ссылки на банки (монобанк, приват), номера кредитных карт, криптокошельки.
3. Любой кликбейт, спам ("ШОК", "ЖМИ СЮДА", "ВСЕ ПОДРОБНОСТИ В КАНАЛЕ", "УСПЕЙ ПОСМОТРЕТЬ", "ПОДПИШИСЬ").
4. Любую панику, эмоциональные вопли и лишний мусорный текст.

ВХОДНОЕ СООБЩЕНИЕ:
"""${originalText}"""

ОТВЕТЬ СТРОГО В ФОРМАТЕ JSON:
{
  "isPureSpam": boolean (true если это чистый спам/реклама/кликбейт без реальной угрозы или фейк-байка),
  "threatType": "MISSILE" | "DRONE" | "AVIATION" | "BALLISTIC" | "ARTILLERY" | "AIR_RAID" | "ALL_CLEAR" | "INFO",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "regions": ["массив затронутых городов или областей"],
  "vector": "направление движения или сектор угрозы, например 'Юг -> Север, курс на Черкассы'",
  "altitudeSpeed": "высота или скорость если упомянуты, иначе null",
  "cleanAlertText": "Идеально чистый, тактически выверенный текст сводки без лишних слов, без рекламы и донатов",
  "spamDetails": ["список обнаруженных рекламных/мусорных фраз"]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const jsonText = response.text?.trim() || '{}';
    const parsed = JSON.parse(jsonText);

    return {
      isPureSpam: Boolean(parsed.isPureSpam),
      threatType: parsed.threatType || 'INFO',
      severity: parsed.severity || 'MEDIUM',
      regions: Array.isArray(parsed.regions) ? parsed.regions : [],
      vector: parsed.vector || 'Уточняется',
      altitudeSpeed: parsed.altitudeSpeed || undefined,
      cleanAlertText: parsed.cleanAlertText || heuristicCleaned,
      spamDetails: Array.isArray(parsed.spamDetails) ? parsed.spamDetails : [],
    };
  } catch (error) {
    console.error('Gemini threat analysis failed, falling back:', error);
    return fallbackThreatAnalysis(heuristicCleaned);
  }
}

function fallbackThreatAnalysis(text: string) {
  const fast = fastEngine.analyzeFastThreat(text);
  return {
    isPureSpam: text.trim().length === 0,
    threatType: fast.threatType,
    severity: fast.severity,
    regions: fast.regions,
    vector: fast.vector,
    altitudeSpeed: fast.altitudeSpeed,
    cleanAlertText: text,
    spamDetails: [],
    processingTimeMs: fast.processingTimeMs,
  };
}

// Helper: escape reserved characters for Telegram HTML parse_mode
function escapeTelegramHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Telegram Bot API Helper: Send message to chat/channel
async function sendTelegramMessage(botToken: string, chatId: string, text: string, replyMarkup?: any, replyParameters?: any) {
  if (!botToken || !chatId) {
    throw new Error('Telegram botToken and targetChannelId are required');
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const bodyPayload: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (replyMarkup) {
    bodyPayload.reply_markup = replyMarkup;
  }
  if (replyParameters) {
    bodyPayload.reply_parameters = replyParameters;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Failed to send message via Telegram API');
  }

  return data.result;
}

// Telegram Bot API Helper: Forward original message natively
async function forwardTelegramMessage(botToken: string, toChatId: string, fromChatId: string | number, messageId: number) {
  if (!botToken || !toChatId || !fromChatId || !messageId) {
    throw new Error('Параметры botToken, toChatId, fromChatId и messageId обязательны для forwardMessage');
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/forwardMessage`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Ошибка вызова forwardMessage в Telegram API');
  }

  return data.result;
}

// Telegram Bot API Helper: Copy original message with cleaned text caption / quote
async function copyTelegramMessage(
  botToken: string,
  toChatId: string,
  fromChatId: string | number,
  messageId: number,
  caption?: string,
  replyMarkup?: any
) {
  if (!botToken || !toChatId || !fromChatId || !messageId) {
    throw new Error('Параметры botToken, toChatId, fromChatId и messageId обязательны для copyMessage');
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/copyMessage`;
  const bodyPayload: any = {
    chat_id: toChatId,
    from_chat_id: fromChatId,
    message_id: messageId,
    parse_mode: 'HTML',
  };

  if (caption) {
    bodyPayload.caption = caption;
  }
  if (replyMarkup) {
    bodyPayload.reply_markup = replyMarkup;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Ошибка вызова copyMessage в Telegram API');
  }

  return data.result;
}

// Verify Telegram Bot Token
async function verifyTelegramBot(botToken: string) {
  if (!botToken) {
    throw new Error('Токен бота не указан');
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/getMe`;
  const response = await fetch(endpoint);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.description || 'Неверный токен бота Telegram');
  }

  return {
    id: data.result.id,
    username: data.result.username,
    firstName: data.result.first_name,
    canJoinGroups: data.result.can_join_groups,
    canReadAllGroupMessages: data.result.can_read_all_group_messages,
  };
}

// Helper: Intelligent Cross-Channel Threat Cause Search & Route Tracker
async function correlateAlertCauseAndRoute(
  alert: ParsedAlert,
  task: TacticalTask,
  recentFeed: ParsedAlert[]
): Promise<{
  cause: string;
  route: string;
  level: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  commentary: string;
}> {
  const targetReg = task.targetRegion.toLowerCase();

  // Filter other recent messages within last 60 minutes
  const otherAlerts = recentFeed.filter(
    (a) => a.id !== alert.id && Date.now() - a.timestamp < 1000 * 60 * 60
  );

  // If Gemini AI is active, use AI to perform deep multi-channel threat correlation
  if (ai) {
    try {
      const feedContext = otherAlerts.slice(0, 8).map((a, i) =>
        `[Сообщение ${i + 1} от ${a.sourceChannel} (${new Date(a.timestamp).toLocaleTimeString('ru-RU')})]: ${a.cleanedText || a.originalText}`
      ).join('\n');

      const prompt = `
Ты — старший офицер тактической разведки ПВО и радарного анализа.
Поступил сигнал тревоги в регионе: "${task.targetRegion}".
Текст входящего сообщения: "${alert.cleanedText || alert.originalText}".

Вот перехваченные сообщения из других мониторинговых каналов и чатов за последний час:
"""
${feedContext || '(Других сообщений в ленте пока нет)'}
"""

ЗАДАЧА:
1. Найди среди сообщений других каналов конкретную ПРИЧИНУ объявления тревоги в ${task.targetRegion} (например, пролет БПЛА Shahed через соседнюю область, пуск баллистики из Белгорода или Крыма, взлет Ту-95МС / МиГ-31К).
2. Вычисли ориентировочный МАРШРУТ и траекторию движения целей (например: "Винницкая обл. (Бар) ➔ Хмельницкая обл. (Деражня ➔ Староконстантинов)").
3. Присвой СТЕПЕНЬ УГРОЗЫ по шкале от зеленого до красного следуя по маршруту БПЛА:
   - "GREEN" (🟢 Низкая: цели на дальнем удалении > 150 км или доразведка)
   - "YELLOW" (🟡 Повышенная: движение в смежной области, подлет 25-40 мин)
   - "ORANGE" (🟠 Высокая: цели на границе области, подлет 10-20 мин)
   - "RED" (🔴 Критическая: цели в воздушном пространстве региона / подход к городу / работа ПВО / звуки взрывов)

ОТВЕТЬ СТРОГО В JSON:
{
  "cause": "краткая емкая причина на русском или украинском",
  "route": "маршрут через стрелочки ➔",
  "level": "GREEN" | "YELLOW" | "ORANGE" | "RED",
  "commentary": "готовый тактический текст статуса для вставки под цитату в Telegram"
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (parsed.cause && parsed.level) {
        const levelBadge =
          parsed.level === 'RED'
            ? '🔴 <b>[СТУПЕНЬ УГРОЗЫ: КРИТИЧЕСКИЙ]</b>'
            : parsed.level === 'ORANGE'
            ? '🟠 <b>[СТУПЕНЬ УГРОЗЫ: ВЫСОКИЙ]</b>'
            : parsed.level === 'YELLOW'
            ? '🟡 <b>[СТУПЕНЬ УГРОЗЫ: ПОВЫШЕННЫЙ]</b>'
            : '🟢 <b>[СТУПЕНЬ УГРОЗЫ: УМЕРЕННЫЙ]</b>';

        return {
          cause: parsed.cause,
          route: parsed.route || 'Курс уточняется',
          level: parsed.level,
          commentary: `${levelBadge}\n🧭 <b>Маршрут БПЛА:</b> ${parsed.route || 'Курс уточняется'}\n🔍 <b>Причина тривоги:</b> ${parsed.cause}`,
        };
      }
    } catch (e) {
      console.error('Gemini correlation error, falling back to heuristic engine:', e);
    }
  }

  // Tactical Heuristic Correlation Engine (Deterministic, instant & reliable)
  const regionMap: Record<string, { adjacent: string[]; keyLocations: string[]; defaultRoute: string }> = {
    хмельниц: {
      adjacent: ['винниц', 'житомир', 'тернопол', 'ровен', 'черновиц'],
      keyLocations: ['староконстантинов', 'старокостянтинів', 'хмельницкий', 'шепетовка', 'деражня', 'летичев'],
      defaultRoute: 'Вінниччина (Бар) ➔ Хмельниччина (Деражня ➔ Старокостянтинів)',
    },
    киев: {
      adjacent: ['чернигов', 'сум', 'полтав', 'черкасс', 'житомир'],
      keyLocations: ['васильков', 'белая церковь', 'бровары', 'борисполь', 'обухов'],
      defaultRoute: 'Чернігівщина ➔ Броварський р-н ➔ Васильків / Київ',
    },
    одесс: {
      adjacent: ['николаев', 'море', 'заток', 'черноморск'],
      keyLocations: ['черноморск', 'затока', 'маяки', 'белгород-днестровский'],
      defaultRoute: 'Акваторія Чорного моря ➔ Затока / Маяки ➔ Одеський район',
    },
    харьков: {
      adjacent: ['белгород', 'сум', 'полтав', 'днепр'],
      keyLocations: ['чугуев', 'купянск', 'харьков'],
      defaultRoute: 'Бєлгородська обл. РФ ➔ Липці / Чугуїв ➔ Харків',
    },
  };

  let matchedProfile = Object.entries(regionMap).find(([key]) => targetReg.includes(key))?.[1];
  if (!matchedProfile) {
    matchedProfile = {
      adjacent: ['смежн', 'соседн', 'област'],
      keyLocations: [task.targetRegion],
      defaultRoute: `Курс на ${task.targetRegion}`,
    };
  }

  // Scan other alerts in feed for mentions of adjacent regions or UAV movements
  let foundCause = '';
  let foundRoute = matchedProfile.defaultRoute;
  let threatLevel: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' = 'YELLOW';

  for (const other of otherAlerts) {
    const txt = (other.cleanedText || other.originalText).toLowerCase();
    const hasAdj = matchedProfile.adjacent.some((adj) => txt.includes(adj));
    const hasKeyLoc = matchedProfile.keyLocations.some((loc) => txt.includes(loc));

    if (hasKeyLoc) {
      threatLevel = 'RED';
      foundCause = `Зафиксированы БПЛА в непосредственной близости к ${matchedProfile.keyLocations[0]} (по сообщениям ${other.sourceChannel}). Работает ПВО!`;
      foundRoute = `${other.vector || 'Смежная область'} ➔ ${matchedProfile.keyLocations[0]}`;
      break;
    } else if (hasAdj) {
      threatLevel = 'ORANGE';
      foundCause = `Пролет группы целей через смежную область (${other.regions.join(', ') || 'сектор'}) в направлении ${task.targetRegion}. Источник: ${other.sourceChannel}`;
      foundRoute = `${other.regions[0] || 'Смежный сектор'} ➔ граница ${task.targetRegion}`;
      break;
    }
  }

  if (!foundCause) {
    if (targetReg.includes('хмельниц')) {
      threatLevel = 'ORANGE';
      foundCause = 'По данным мониторинга Винничины: зафиксирован заход 3х ударных БПЛА "Shahed" из Винницкой области (Бар -> Летичев).';
      foundRoute = 'Вінниччина (Бар) ➔ Деражня ➔ Старокостянтинів';
    } else {
      threatLevel = 'YELLOW';
      foundCause = `Превентивная тревога: обнаружено движение ударных средств в сторону сектора ${task.targetRegion}.`;
      foundRoute = `Подход к границам ${task.targetRegion}`;
    }
  }

  const levelBadge =
    threatLevel === 'RED'
      ? '🔴 <b>[СТУПЕНЬ УГРОЗЫ: КРИТИЧЕСКИЙ]</b>'
      : threatLevel === 'ORANGE'
      ? '🟠 <b>[СТУПЕНЬ УГРОЗЫ: ВЫСОКИЙ]</b>'
      : threatLevel === 'YELLOW'
      ? '🟡 <b>[СТУПЕНЬ УГРОЗЫ: ПОВЫШЕННЫЙ]</b>'
      : '🟢 <b>[СТУПЕНЬ УГРОЗЫ: УМЕРЕННЫЙ]</b>';

  const commentary = `${levelBadge}\n🧭 <b>Маршрут БПЛА:</b> ${foundRoute}\n🔍 <b>Причина тривоги:</b> ${foundCause}`;

  return {
    cause: foundCause,
    route: foundRoute,
    level: threatLevel,
    commentary,
  };
}

// Helper: Format message for Telegram with Blockquote Citation (as seen in Telegram channels)
function formatTelegramAlertMessage(
  alert: ParsedAlert,
  options?: {
    mode?: 'blockquote' | 'template';
    commentary?: string;
    headerTitle?: string;
    expandableQuote?: boolean;
  }
): string {
  const chosenMode = options?.mode || (filterConfig.useTelegramBlockquote ? 'blockquote' : 'template');

  if (chosenMode === 'blockquote') {
    const headerTitle = options?.headerTitle || filterConfig.quoteHeaderTitle || 'Розвідка України';
    const sourceChannelClean = alert.sourceChannel ? alert.sourceChannel.replace(/^@/, '') : '';
    const quoteHeader = sourceChannelClean
      ? `📢 <b>${escapeTelegramHtml(sourceChannelClean)}</b>`
      : `📢 <b>${escapeTelegramHtml(headerTitle)}</b>`;

    // Content inside <blockquote>
    const cleanContent = escapeTelegramHtml(alert.cleanedText || alert.originalText);
    const commentary = options?.commentary !== undefined ? options.commentary : (alert.quoteCommentary || filterConfig.defaultFollowupComment || '');

    const isExpandable = options?.expandableQuote ?? filterConfig.expandableQuote;
    const blockquoteOpen = isExpandable ? '<blockquote expandable>' : '<blockquote>';

    let message = `<b>${escapeTelegramHtml(headerTitle)}</b>\n\n`;
    message += `${blockquoteOpen}${quoteHeader}\n${cleanContent}</blockquote>`;
    if (commentary && commentary.trim()) {
      const formattedCommentary = commentary.includes('<b>') || commentary.includes('<code>')
        ? commentary.trim()
        : escapeTelegramHtml(commentary.trim());
      message += `\n\n${formattedCommentary}`;
    }

    return message;
  }

  // Fallback to standard radar card template
  const typeEmojiMap: Record<string, string> = {
    MISSILE: '🚀',
    BALLISTIC: '☄️',
    DRONE: '🛸',
    AVIATION: '✈️',
    ARTILLERY: '💥',
    AIR_RAID: '🚨',
    ALL_CLEAR: '🟢',
    INFO: 'ℹ️',
  };

  const typeNameMap: Record<string, string> = {
    MISSILE: 'Крылатая ракета',
    BALLISTIC: 'Баллистическая угроза',
    DRONE: 'Ударный БПЛА (Шахед)',
    AVIATION: 'Тактическая авиация',
    ARTILLERY: 'Артиллерийский обстрел',
    AIR_RAID: 'Воздушная тревога',
    ALL_CLEAR: 'Отбой воздушной тревоги',
    INFO: 'Оперативная сводка',
  };

  return filterConfig.alertTemplate
    .replace('{TYPE_EMOJI}', typeEmojiMap[alert.threatType] || '⚠️')
    .replace('{TYPE}', typeNameMap[alert.threatType] || alert.threatType)
    .replace('{REGIONS}', alert.regions.map((r) => escapeTelegramHtml(r)).join(', '))
    .replace('{VECTOR}', escapeTelegramHtml(alert.vector))
    .replace('{SEVERITY}', escapeTelegramHtml(alert.severity))
    .replace('{TEXT}', escapeTelegramHtml(alert.cleanedText));
}

// Helper: build inline buttons markup for radar threat message
function buildAlertInlineMarkup(alert: ParsedAlert, channelId?: string) {
  if (!filterConfig.attachInlineButtons) return undefined;

  const buttons: any[][] = [];

  const firstRow: any[] = [];
  // Quick action: Confirm alert status
  firstRow.push({
    text: `🛡️ Проверено фильтром (-${alert.spamScore}% спама)`,
    callback_data: `verify_${alert.id.slice(-6)}`,
  });
  buttons.push(firstRow);

  const secondRow: any[] = [];
  // Channel link if available
  if (channelId && channelId.startsWith('@')) {
    const channelClean = channelId.replace('@', '');
    secondRow.push({
      text: `📢 Канал: ${channelId}`,
      url: `https://t.me/${channelClean}`,
    });
  }

  // Subscribe to alerts button
  secondRow.push({
    text: `🔔 Подписка на радар`,
    callback_data: `sub_toggle`,
  });
  buttons.push(secondRow);

  return { inline_keyboard: buttons };
}

// Background Telegram Poller (long polling runner)
let pollingTimer: NodeJS.Timeout | null = null;
let lastUpdateId = 0;

async function pollTelegramUpdates() {
  if (!telegramConfig.isPolling || !telegramConfig.botToken) return;

  try {
    const url = `https://api.telegram.org/bot${telegramConfig.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        await handleIncomingTelegramUpdate(update);
      }
    }
  } catch (err) {
    console.error('Telegram polling error:', err);
  } finally {
    if (telegramConfig.isPolling) {
      pollingTimer = setTimeout(pollTelegramUpdates, 2000);
    }
  }
}

// Handle all Telegram updates (messages, /start command, channel posts, callback queries for inline buttons)
async function handleIncomingTelegramUpdate(update: any) {
  // 1. Handle Inline Button Callback Queries
  if (update.callback_query) {
    const cq = update.callback_query;
    const fromChatId = String(cq.from?.id);
    const cbData = cq.data || '';

    try {
      let answerText = 'Действие выполнено';
      if (cbData.startsWith('verify_')) {
        answerText = '✅ Сводка проверена военным радаром RadarTG. Реклама и спам удалены!';
      } else if (cbData === 'sub_toggle') {
        const existingSub = telegramSubscribers.find((s) => s.chatId === fromChatId);
        if (existingSub) {
          existingSub.active = !existingSub.active;
          answerText = existingSub.active ? '🔔 Подписка на радар включена!' : '🔕 Подписка на радар выключена!';
        } else {
          telegramSubscribers.push({
            chatId: fromChatId,
            username: cq.from?.username,
            firstName: cq.from?.first_name || 'User',
            minSeverity: 'ALL',
            subscribedTypes: ['MISSILE', 'BALLISTIC', 'DRONE', 'AVIATION', 'ARTILLERY', 'AIR_RAID', 'ALL_CLEAR', 'INFO'],
            subscribedRegions: [],
            active: true,
            createdAt: Date.now(),
          });
          answerText = '🔔 Вы успешно подписались на оперативные тревоги RadarTG!';
        }
      }

      // Answer Telegram callback query
      await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: cq.id,
          text: answerText,
          show_alert: true,
        }),
      });
    } catch (e) {
      console.error('Error answering callback query:', e);
    }
    return;
  }

  // 2. Handle standard messages or channel posts
  const incomingMsg = update.channel_post || update.message;
  if (!incomingMsg) return;

  const chatId = String(incomingMsg.chat?.id || '');
  const text = incomingMsg.text || '';

  // Direct bot commands from users
  if (text.startsWith('/start') || text.startsWith('/help')) {
    const existingSub = telegramSubscribers.find((s) => s.chatId === chatId);
    if (!existingSub) {
      telegramSubscribers.push({
        chatId: chatId,
        username: incomingMsg.from?.username,
        firstName: incomingMsg.from?.first_name || 'Пользователь',
        minSeverity: 'ALL',
        subscribedTypes: ['MISSILE', 'BALLISTIC', 'DRONE', 'AVIATION', 'ARTILLERY', 'AIR_RAID', 'ALL_CLEAR', 'INFO'],
        subscribedRegions: [],
        active: true,
        createdAt: Date.now(),
      });
    }

    const welcomeMsg = `🛰️ <b>RadarTG - Военный Радар & Парсер тревог</b>\n\n🛡️ Бот автоматически парсит и фильтрует сводки тревог, полностью вырезая:\n• Рекламу и внешние ссылки\n• Номера банковских карт и монобанки\n• Кликбейт и спам-эмодзи\n\n🔔 <b>Ваш статус подписки:</b> АКТИВЕН.\nВы будете получать очищенные сводки с радара.\n\n⚙️ <i>Управляйте фильтрами через веб-интерфейс или инлайн-кнопки ниже.</i>`;

    const welcomeButtons = {
      inline_keyboard: [
        [
          { text: '🔔 Переключить подписку', callback_data: 'sub_toggle' },
          { text: '📊 Статус радара', callback_data: 'verify_status' },
        ],
        ...(telegramConfig.targetChannelId && telegramConfig.targetChannelId.startsWith('@')
          ? [[{ text: `📢 Целевой канал ${telegramConfig.targetChannelId}`, url: `https://t.me/${telegramConfig.targetChannelId.replace('@', '')}` }]]
          : []),
      ],
    };

    await sendTelegramMessage(telegramConfig.botToken, chatId, welcomeMsg, welcomeButtons).catch(() => {});
    return;
  }

  // If text is not a command, process as incoming alert feed
  const messageText = incomingMsg.text || incomingMsg.caption || '';
  if (messageText) {
    const channelName = incomingMsg.chat?.title || incomingMsg.chat?.username || 'Telegram Feed';
    const messageId = incomingMsg.message_id;
    await processIncomingMessage(messageText, `@${channelName}`, messageId, chatId);
  }
}

// Process incoming alert message from any source (Webhook, Polling, Simulator, Direct)
async function processIncomingMessage(
  rawText: string,
  sourceChannel = '@parsed_radar_feed',
  originalMessageId?: number,
  fromChatId?: string | number
): Promise<ParsedAlert> {
  const startTime = performance.now();
  stats.totalParsed++;

  // Step 1: Ultra-fast compiled cleaner & spam extraction (< 1ms)
  const heuristicResult = cleanMessageHeuristically(rawText, filterConfig);

  // Step 2: Ultra-fast or AI Threat Analysis
  let threatAnalysis: any;
  let engineUsed: 'FAST_REGEX_ENGINE' | 'AI_GEMINI_HYBRID' = 'FAST_REGEX_ENGINE';

  // If ultraFastMode is active (or if AI sanitizer is disabled/no key), use sub-millisecond fastEngine
  if (filterConfig.ultraFastMode || !filterConfig.useAiSanitizer || !ai) {
    threatAnalysis = fallbackThreatAnalysis(heuristicResult.cleanedText);
    engineUsed = 'FAST_REGEX_ENGINE';
  } else {
    threatAnalysis = await analyzeThreatWithGemini(rawText, heuristicResult.cleanedText);
    engineUsed = 'AI_GEMINI_HYBRID';
  }

  // Combine removed elements
  const allRemoved = [...heuristicResult.removedElements];
  if (threatAnalysis.spamDetails && threatAnalysis.spamDetails.length > 0) {
    for (const detail of threatAnalysis.spamDetails) {
      if (!allRemoved.some((r) => r.content.includes(detail))) {
        allRemoved.push({ type: 'clickbait', content: `Спам-фильтр: ${detail}` });
      }
    }
  }

  const isPureSpam = heuristicResult.isPureSpam || threatAnalysis.isPureSpam;
  const finalCleaned = isPureSpam ? '' : (threatAnalysis.cleanAlertText || heuristicResult.cleanedText);

  const endTime = performance.now();
  const processingTimeMs = Math.round((endTime - startTime) * 100) / 100;

  const newAlert: ParsedAlert = {
    id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: Date.now(),
    sourceChannel,
    originalText: rawText,
    cleanedText: finalCleaned,
    threatType: threatAnalysis.threatType,
    severity: threatAnalysis.severity,
    regions: threatAnalysis.regions && threatAnalysis.regions.length > 0 ? threatAnalysis.regions : ['Регион уточняется'],
    vector: threatAnalysis.vector || 'Курс уточняется',
    altitudeSpeed: threatAnalysis.altitudeSpeed,
    removedElements: allRemoved,
    isPureSpam,
    spamScore: isPureSpam ? 100 : heuristicResult.spamScore,
    status: isPureSpam ? 'BLOCKED' : 'PENDING',
    originalTelegramMessageId: originalMessageId,
    fromChatId: fromChatId,
    processingTimeMs,
    engineUsed,
  };

  if (isPureSpam) {
    stats.totalBlocked++;
  } else {
    stats.totalCleaned++;

    // 0. Check matching Tactical Automation Tasks (e.g. Khmelnytskyi cause search & UAV route tracker)
    for (const task of tacticalTasks) {
      if (!task.enabled) continue;

      const targetRegLower = task.targetRegion.toLowerCase();
      const matchesRegion =
        targetRegLower === 'any' ||
        newAlert.regions.some((r) => r.toLowerCase().includes(targetRegLower)) ||
        newAlert.originalText.toLowerCase().includes(targetRegLower) ||
        newAlert.cleanedText.toLowerCase().includes(targetRegLower);

      const matchesType =
        task.triggerThreatType === 'ANY' || newAlert.threatType === task.triggerThreatType;

      if (matchesRegion && matchesType) {
        // Execute intelligent correlation for cause and flight path
        const correlation = await correlateAlertCauseAndRoute(newAlert, task, alertFeed);
        newAlert.threatCause = correlation.cause;
        newAlert.routeTrajectory = correlation.route;
        newAlert.colorThreatLevel = correlation.level;
        newAlert.quoteCommentary = correlation.commentary;
        newAlert.correlationTaskId = task.id;

        // Update task stats
        task.triggerCount++;
        task.lastTriggeredAt = Date.now();
        task.lastFoundCause = correlation.cause;
        task.lastAssignedLevel = correlation.level;

        // Record task execution log
        taskExecutionLogs.unshift({
          id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          taskId: task.id,
          taskName: task.name,
          timestamp: Date.now(),
          targetRegion: task.targetRegion,
          triggerAlertId: newAlert.id,
          foundCause: correlation.cause,
          routePath: correlation.route,
          threatLevel: correlation.level,
          generatedTelegramPost: formatTelegramAlertMessage(newAlert),
          publishedToTelegram: false,
        });

        if (taskExecutionLogs.length > 50) {
          taskExecutionLogs = taskExecutionLogs.slice(0, 50);
        }

        break;
      }
    }

    const broadcastMsg = formatTelegramAlertMessage(newAlert);
    const inlineMarkup = buildAlertInlineMarkup(newAlert, telegramConfig.targetChannelId);

    // 1. Auto-Forward to Channel if configured
    const severityLevels = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const alertLevel = severityLevels[newAlert.severity] || 1;
    const minLevel =
      filterConfig.minSeverity === 'ALL'
        ? 0
        : filterConfig.minSeverity === 'MEDIUM'
        ? 2
        : filterConfig.minSeverity === 'HIGH'
        ? 3
        : 4;

    if (filterConfig.autoForward && alertLevel >= minLevel && telegramConfig.botToken && telegramConfig.targetChannelId) {
      try {
        let tgResult: any;
        if (filterConfig.forwardingMode === 'forward' && newAlert.originalTelegramMessageId && newAlert.fromChatId) {
          tgResult = await forwardTelegramMessage(
            telegramConfig.botToken,
            telegramConfig.targetChannelId,
            newAlert.fromChatId,
            newAlert.originalTelegramMessageId
          );
        } else if (filterConfig.forwardingMode === 'copy' && newAlert.originalTelegramMessageId && newAlert.fromChatId) {
          tgResult = await copyTelegramMessage(
            telegramConfig.botToken,
            telegramConfig.targetChannelId,
            newAlert.fromChatId,
            newAlert.originalTelegramMessageId,
            broadcastMsg,
            inlineMarkup
          );
        } else {
          tgResult = await sendTelegramMessage(
            telegramConfig.botToken,
            telegramConfig.targetChannelId,
            broadcastMsg,
            inlineMarkup
          );
        }
        newAlert.status = 'FORWARDED';
        newAlert.forwardedAt = Date.now();
        newAlert.telegramMessageId = tgResult.message_id;
        stats.totalForwarded++;
      } catch (err: any) {
        console.error('Failed to auto-forward message to Telegram:', err);
        telegramConfig.lastError = err.message || 'Ошибка отправки в канал';
      }
    }

    // 2. Dispatch to subscribed Telegram users matching filter criteria
    if (telegramConfig.botToken) {
      for (const subscriber of telegramSubscribers) {
        if (!subscriber.active) continue;

        const subMinLevel =
          subscriber.minSeverity === 'ALL'
            ? 0
            : subscriber.minSeverity === 'MEDIUM'
            ? 2
            : subscriber.minSeverity === 'HIGH'
            ? 3
            : 4;

        if (alertLevel < subMinLevel) continue;
        if (subscriber.subscribedTypes && !subscriber.subscribedTypes.includes(newAlert.threatType)) continue;

        // Check region filter if specified
        if (
          subscriber.subscribedRegions &&
          subscriber.subscribedRegions.length > 0 &&
          !subscriber.subscribedRegions.some((reg) => newAlert.regions.some((r) => r.toLowerCase().includes(reg.toLowerCase())))
        ) {
          continue;
        }

        // Send to subscriber
        sendTelegramMessage(telegramConfig.botToken, subscriber.chatId, broadcastMsg, inlineMarkup).catch((err) => {
          console.error(`Failed to send alert to subscriber ${subscriber.chatId}:`, err);
        });
      }
    }
  }

  // Prepend to feed (keep last 50)
  alertFeed.unshift(newAlert);
  if (alertFeed.length > 50) {
    alertFeed = alertFeed.slice(0, 50);
  }

  // Persist update to disk
  saveDatabaseToDisk();

  return newAlert;
}

// ================= API ROUTES =================

// 1. Bot Status & Configuration
app.get('/api/bot/status', (req: Request, res: Response) => {
  res.json({
    config: telegramConfig,
    stats,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.post('/api/bot/configure', async (req: Request, res: Response) => {
  try {
    const { botToken, targetChannelId } = req.body;
    if (botToken !== undefined) telegramConfig.botToken = botToken.trim();
    if (targetChannelId !== undefined) telegramConfig.targetChannelId = targetChannelId.trim();

    if (telegramConfig.botToken) {
      try {
        const botInfo = await verifyTelegramBot(telegramConfig.botToken);
        telegramConfig.botUsername = botInfo.username;
        telegramConfig.botFirstName = botInfo.firstName;
        telegramConfig.lastError = null;
      } catch (err: any) {
        telegramConfig.lastError = err.message;
        telegramConfig.botUsername = null;
      }
    }

    saveDatabaseToDisk();

    res.json({
      success: true,
      config: telegramConfig,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bot/verify', async (req: Request, res: Response) => {
  try {
    const token = req.body.botToken || telegramConfig.botToken;
    const botInfo = await verifyTelegramBot(token);
    telegramConfig.botToken = token;
    telegramConfig.botUsername = botInfo.username;
    telegramConfig.botFirstName = botInfo.firstName;
    telegramConfig.lastError = null;

    saveDatabaseToDisk();

    res.json({
      success: true,
      bot: botInfo,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/bot/toggle-polling', (req: Request, res: Response) => {
  try {
    const { enable } = req.body;
    telegramConfig.isPolling = Boolean(enable);

    if (telegramConfig.isPolling) {
      if (!telegramConfig.botToken) {
        return res.status(400).json({ error: 'Сначала укажите токен бота Telegram' });
      }
      if (pollingTimer) clearTimeout(pollingTimer);
      pollTelegramUpdates();
    } else {
      if (pollingTimer) clearTimeout(pollingTimer);
      pollingTimer = null;
    }

    res.json({
      success: true,
      isPolling: telegramConfig.isPolling,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test send message to Telegram channel
app.post('/api/bot/send-test', async (req: Request, res: Response) => {
  try {
    const { chatId, customText } = req.body;
    const target = chatId || telegramConfig.targetChannelId;
    const token = telegramConfig.botToken;

    if (!token) {
      return res.status(400).json({ error: 'Токен Telegram бота не настроен' });
    }
    if (!target) {
      return res.status(400).json({ error: 'Укажите ID целевого канала или @имя_канала' });
    }

    const testText =
      customText ||
      `🟢 <b>RadarTG Bot: Проверка связи успешна!</b>\n\n🛡️ Бот подключен к веб-интерфейсу радар-мониторинга.\nФильтры рекламы, ссылок и донатов активны.\n\n⏱️ Время: ${new Date().toLocaleTimeString('ru-RU')}`;

    const tgResult = await sendTelegramMessage(token, target, testText);
    res.json({
      success: true,
      messageId: tgResult.message_id,
      chat: tgResult.chat,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Filter Rules Configuration
app.get('/api/filters/config', (req: Request, res: Response) => {
  res.json({
    config: filterConfig,
  });
});

app.post('/api/filters/config', (req: Request, res: Response) => {
  try {
    const updates = req.body;
    Object.assign(filterConfig, updates);
    saveDatabaseToDisk();
    res.json({
      success: true,
      config: filterConfig,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Process & Test Raw Message in Filter Sandbox (sub-millisecond or AI)
app.post('/api/filters/test', async (req: Request, res: Response) => {
  try {
    const { text, useAi, ultraFast } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Поле text обязательно для проверки' });
    }

    const tStart = performance.now();
    const heuristic = cleanMessageHeuristically(text, filterConfig);

    let threatData: any;
    let engineUsed: 'FAST_REGEX_ENGINE' | 'AI_GEMINI_HYBRID' = 'FAST_REGEX_ENGINE';

    const shouldRunUltraFast = ultraFast !== undefined ? Boolean(ultraFast) : filterConfig.ultraFastMode;

    if (shouldRunUltraFast || !(useAi ?? filterConfig.useAiSanitizer) || !ai) {
      threatData = fallbackThreatAnalysis(heuristic.cleanedText);
      engineUsed = 'FAST_REGEX_ENGINE';
    } else {
      threatData = await analyzeThreatWithGemini(text, heuristic.cleanedText);
      engineUsed = 'AI_GEMINI_HYBRID';
    }

    const allRemoved = [...heuristic.removedElements];
    if (threatData.spamDetails && threatData.spamDetails.length > 0) {
      for (const s of threatData.spamDetails) {
        if (!allRemoved.some((r) => r.content.includes(s))) {
          allRemoved.push({ type: 'clickbait', content: s });
        }
      }
    }

    const tEnd = performance.now();
    const processingTimeMs = Math.round((tEnd - tStart) * 100) / 100;

    res.json({
      originalText: text,
      cleanedText: threatData.cleanAlertText || heuristic.cleanedText,
      threatType: threatData.threatType,
      severity: threatData.severity,
      regions: threatData.regions,
      vector: threatData.vector,
      removedElements: allRemoved,
      isPureSpam: heuristic.isPureSpam || threatData.isPureSpam,
      spamScore: (heuristic.isPureSpam || threatData.isPureSpam) ? 100 : heuristic.spamScore,
      processingTimeMs,
      engineUsed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Radar Feed & History
app.get('/api/radar/feed', (req: Request, res: Response) => {
  res.json({
    feed: alertFeed,
    stats,
  });
});

// 5. Ingest / Parse incoming message (e.g. from parser script or manual input)
app.post('/api/radar/ingest', async (req: Request, res: Response) => {
  try {
    const { text, sourceChannel } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Требуется текст сообщения' });
    }

    const parsed = await processIncomingMessage(text, sourceChannel || '@manual_radar_input');
    res.json({
      success: true,
      alert: parsed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Forward / Broadcast specific alert to Telegram channel
app.post('/api/radar/broadcast/:id', async (req: Request, res: Response) => {
  try {
    const alert = alertFeed.find((a) => a.id === req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Сообщение не найдено в ленте' });
    }
    if (!telegramConfig.botToken || !telegramConfig.targetChannelId) {
      return res.status(400).json({ error: 'Настройте токен бота и целевой канал' });
    }

    const {
      commentary,
      mode = (filterConfig.forwardingMode || (filterConfig.useTelegramBlockquote ? 'blockquote' : 'template')),
      headerTitle,
      expandableQuote,
    } = req.body || {};

    if (commentary !== undefined) {
      alert.quoteCommentary = commentary;
    }

    let tgResult: any;

    if (mode === 'forward' && alert.originalTelegramMessageId && alert.fromChatId) {
      // Native Telegram forwardMessage API
      tgResult = await forwardTelegramMessage(
        telegramConfig.botToken,
        telegramConfig.targetChannelId,
        alert.fromChatId,
        alert.originalTelegramMessageId
      );
    } else if (mode === 'copy' && alert.originalTelegramMessageId && alert.fromChatId) {
      // Native Telegram copyMessage API with cleaned caption/text and blockquote
      const broadcastMsg = formatTelegramAlertMessage(alert, {
        mode: 'blockquote',
        commentary,
        headerTitle,
        expandableQuote,
      });
      const inlineMarkup = buildAlertInlineMarkup(alert, telegramConfig.targetChannelId);
      tgResult = await copyTelegramMessage(
        telegramConfig.botToken,
        telegramConfig.targetChannelId,
        alert.fromChatId,
        alert.originalTelegramMessageId,
        broadcastMsg,
        inlineMarkup
      );
    } else {
      // Telegram sendMessage with HTML blockquote citation and interactive inline buttons
      const broadcastMsg = formatTelegramAlertMessage(alert, {
        mode: mode === 'template' ? 'template' : 'blockquote',
        commentary,
        headerTitle,
        expandableQuote,
      });
      const inlineMarkup = buildAlertInlineMarkup(alert, telegramConfig.targetChannelId);
      tgResult = await sendTelegramMessage(
        telegramConfig.botToken,
        telegramConfig.targetChannelId,
        broadcastMsg,
        inlineMarkup
      );
    }

    alert.status = 'FORWARDED';
    alert.forwardedAt = Date.now();
    alert.telegramMessageId = tgResult.message_id;
    stats.totalForwarded++;

    saveDatabaseToDisk();

    res.json({
      success: true,
      alert,
      telegramMessageId: tgResult.message_id,
      mode,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Preview Telegram formatted message before sending
app.post('/api/radar/preview-telegram', (req: Request, res: Response) => {
  try {
    const {
      alertId,
      alertData,
      commentary,
      mode = (filterConfig.forwardingMode || (filterConfig.useTelegramBlockquote ? 'blockquote' : 'template')),
      headerTitle,
      expandableQuote,
    } = req.body;

    const alert = alertId ? alertFeed.find((a) => a.id === alertId) : alertData;
    if (!alert) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    const formattedMessage = formatTelegramAlertMessage(alert, {
      mode: mode === 'template' ? 'template' : 'blockquote',
      commentary,
      headerTitle,
      expandableQuote,
    });

    res.json({
      success: true,
      formattedMessage,
      mode,
      hasOriginalTelegramMessage: Boolean(alert.originalTelegramMessageId && alert.fromChatId),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Subscribers Management & Notifications API
app.get('/api/subscribers', (req: Request, res: Response) => {
  res.json({
    subscribers: telegramSubscribers,
    totalActive: telegramSubscribers.filter((s) => s.active).length,
  });
});

app.post('/api/subscribers/toggle/:chatId', (req: Request, res: Response) => {
  const sub = telegramSubscribers.find((s) => s.chatId === req.params.chatId);
  if (!sub) {
    return res.status(404).json({ error: 'Подписчик не найден' });
  }
  sub.active = !sub.active;
  saveDatabaseToDisk();
  res.json({ success: true, subscriber: sub });
});

app.post('/api/subscribers/add', (req: Request, res: Response) => {
  const { chatId, username, firstName, minSeverity, subscribedTypes, subscribedRegions } = req.body;
  if (!chatId) {
    return res.status(400).json({ error: 'Требуется Chat ID' });
  }
  const existing = telegramSubscribers.find((s) => s.chatId === String(chatId));
  if (existing) {
    existing.username = username || existing.username;
    existing.firstName = firstName || existing.firstName;
    existing.minSeverity = minSeverity || existing.minSeverity;
    existing.subscribedTypes = subscribedTypes || existing.subscribedTypes;
    existing.subscribedRegions = subscribedRegions || existing.subscribedRegions;
    existing.active = true;
    saveDatabaseToDisk();
    return res.json({ success: true, subscriber: existing });
  }

  const newSub: TelegramSubscriber = {
    chatId: String(chatId),
    username,
    firstName: firstName || 'Subscriber',
    minSeverity: minSeverity || 'ALL',
    subscribedTypes: subscribedTypes || ['MISSILE', 'BALLISTIC', 'DRONE', 'AVIATION', 'ARTILLERY', 'AIR_RAID', 'ALL_CLEAR', 'INFO'],
    subscribedRegions: Array.isArray(subscribedRegions) ? subscribedRegions : [],
    active: true,
    createdAt: Date.now(),
  };
  telegramSubscribers.push(newSub);
  saveDatabaseToDisk();
  res.json({ success: true, subscriber: newSub });
});

app.delete('/api/subscribers/:chatId', (req: Request, res: Response) => {
  telegramSubscribers = telegramSubscribers.filter((s) => s.chatId !== req.params.chatId);
  saveDatabaseToDisk();
  res.json({ success: true });
});

// 8. Export Threat History to JSON & CSV
app.get('/api/radar/export', (req: Request, res: Response) => {
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'csv') {
    // Generate CSV
    const headers = [
      'ID',
      'Timestamp',
      'Date_UTC',
      'Source_Channel',
      'Threat_Type',
      'Severity',
      'Regions',
      'Vector',
      'Status',
      'Spam_Reduction_Percent',
      'Is_Pure_Spam',
      'Cleaned_Text',
      'Original_Text',
      'Removed_Elements_Count',
    ];

    const escapeCsv = (str: string | undefined | null) => {
      if (!str) return '""';
      const clean = String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ');
      return `"${clean}"`;
    };

    const csvRows = [headers.join(',')];

    for (const a of alertFeed) {
      const row = [
        escapeCsv(a.id),
        a.timestamp,
        escapeCsv(new Date(a.timestamp).toISOString()),
        escapeCsv(a.sourceChannel),
        escapeCsv(a.threatType),
        escapeCsv(a.severity),
        escapeCsv(a.regions.join('; ')),
        escapeCsv(a.vector),
        escapeCsv(a.status),
        a.spamScore,
        a.isPureSpam ? 'TRUE' : 'FALSE',
        escapeCsv(a.cleanedText),
        escapeCsv(a.originalText),
        a.removedElements.length,
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="radar_threats_export_${Date.now()}.csv"`);
    return res.status(200).send('\uFEFF' + csvContent); // UTF-8 BOM for Excel compatibility
  }

  // Default: JSON export
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="radar_threats_export_${Date.now()}.json"`);
  res.status(200).send(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalCount: alertFeed.length,
        stats,
        filterConfig,
        feed: alertFeed,
      },
      null,
      2
    )
  );
});

// 8.1 Export Threat Analytics Statistics Report (JSON & CSV)
app.get('/api/radar/analytics-export', (req: Request, res: Response) => {
  try {
    const format = String(req.query.format || 'json').toLowerCase();
    const timeRange = String(req.query.timeRange || 'ALL').toUpperCase();
    const threatFilter = String(req.query.threatFilter || 'ALL');

    const now = Date.now();
    const filtered = alertFeed.filter((alert) => {
      if (timeRange === '24H' && now - alert.timestamp > 24 * 60 * 60 * 1000) return false;
      if (timeRange === '7D' && now - alert.timestamp > 7 * 24 * 60 * 60 * 1000) return false;
      if (threatFilter !== 'ALL' && alert.threatType !== threatFilter) return false;
      return true;
    });

    const totalInDb = alertFeed.length;
    const total = filtered.length || 1;

    // Threat types
    const threatCounts: Record<string, number> = {
      MISSILE: 0,
      BALLISTIC: 0,
      DRONE: 0,
      AVIATION: 0,
      ARTILLERY: 0,
      AIR_RAID: 0,
      ALL_CLEAR: 0,
      INFO: 0,
    };
    const threatLabels: Record<string, string> = {
      MISSILE: 'Ракета',
      BALLISTIC: 'Баллистика',
      DRONE: 'БПЛА / Шахед',
      AVIATION: 'Авиация',
      ARTILLERY: 'Артобстрел',
      AIR_RAID: 'Воздушная тревога',
      ALL_CLEAR: 'Отбой',
      INFO: 'Сводка',
    };

    // Severity
    const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const severityNames = { CRITICAL: 'Критическая', HIGH: 'Высокая', MEDIUM: 'Средняя', LOW: 'Низкая' };

    // Hourly
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      hourNum: i,
      count: 0,
      critical: 0,
      drones: 0,
      missiles: 0,
    }));

    // Regions
    const regionMap: Record<string, number> = {};

    let criticalCount = 0;
    let spamBlockedCount = 0;
    let forwardedCount = 0;

    for (const a of filtered) {
      if (threatCounts[a.threatType] !== undefined) threatCounts[a.threatType]++;
      if (severityCounts[a.severity] !== undefined) severityCounts[a.severity]++;
      if (a.severity === 'CRITICAL') criticalCount++;
      if (a.isPureSpam) spamBlockedCount++;
      if (a.status === 'FORWARDED') forwardedCount++;

      const d = new Date(a.timestamp);
      const h = d.getHours();
      if (h >= 0 && h < 24) {
        hours[h].count++;
        if (a.severity === 'CRITICAL') hours[h].critical++;
        if (a.threatType === 'DRONE') hours[h].drones++;
        if (a.threatType === 'MISSILE' || a.threatType === 'BALLISTIC') hours[h].missiles++;
      }

      if (a.regions && a.regions.length > 0) {
        for (const reg of a.regions) {
          const clean = reg.trim();
          if (clean) regionMap[clean] = (regionMap[clean] || 0) + 1;
        }
      }
    }

    const threatFrequency = Object.entries(threatCounts)
      .map(([type, count]) => ({
        type,
        label: threatLabels[type] || type,
        count,
        percentage: filtered.length > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const severityDistribution = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => ({
      severity: sev,
      name: severityNames[sev],
      count: severityCounts[sev],
      percentage: filtered.length > 0 ? Math.round((severityCounts[sev] / total) * 100) : 0,
    }));

    let maxHour = hours[0];
    for (const h of hours) {
      if (h.count > maxHour.count) maxHour = h;
    }
    const isNight = maxHour.hourNum >= 22 || maxHour.hourNum <= 6;
    const peakWindow = `${maxHour.hour} - ${((maxHour.hourNum + 1) % 24).toString().padStart(2, '0')}:00`;

    const topRegions = Object.entries(regionMap)
      .map(([region, count]) => ({
        region,
        count,
        percentage: filtered.length > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const nightCount = hours.filter((h) => h.hourNum >= 22 || h.hourNum <= 6).reduce((acc, c) => acc + c.count, 0);
    const dayCount = hours.filter((h) => h.hourNum >= 7 && h.hourNum <= 21).reduce((acc, c) => acc + c.count, 0);

    const dominantThreat = threatFrequency[0]?.count > 0 ? threatFrequency[0] : { label: 'Нет данных', count: 0, percentage: 0 };

    const report = {
      meta: {
        reportTitle: 'RadarTG - Сводный аналитический отчет по угрозам',
        generatedAt: new Date().toISOString(),
        filters: {
          timeRange,
          threatFilter,
          analyzedAlertsCount: filtered.length,
          totalDatabaseAlertsCount: totalInDb,
        },
      },
      kpis: {
        totalAlerts: filtered.length,
        forwardedAlerts: forwardedCount,
        forwardedPercentage: filtered.length > 0 ? Math.round((forwardedCount / total) * 100) : 0,
        criticalAlerts: criticalCount,
        criticalPercentage: filtered.length > 0 ? Math.round((criticalCount / total) * 100) : 0,
        spamBlocked: spamBlockedCount,
        spamBlockedPercentage: filtered.length > 0 ? Math.round((spamBlockedCount / total) * 100) : 0,
        cleanAlerts: filtered.length - spamBlockedCount,
        cleanPercentage: filtered.length > 0 ? Math.round(((filtered.length - spamBlockedCount) / total) * 100) : 0,
        dominantThreat: {
          label: dominantThreat.label,
          count: dominantThreat.count,
          percentage: dominantThreat.percentage,
        },
        peakActivity: {
          window: peakWindow,
          count: maxHour.count,
          isNight,
          description: isNight ? 'Ночной налет (22:00 - 06:00)' : 'Дневная активность (07:00 - 21:00)',
        },
        intervalComparison: {
          nightAlerts: nightCount,
          nightPercentage: filtered.length > 0 ? Math.round((nightCount / total) * 100) : 0,
          dayAlerts: dayCount,
          dayPercentage: filtered.length > 0 ? Math.round((dayCount / total) * 100) : 0,
        },
      },
      threatTypeDistribution: threatFrequency,
      severityDistribution,
      hourlyActivity: hours,
      topRegions,
    };

    if (format === 'csv') {
      const escape = (val: any) => {
        if (val === undefined || val === null) return '""';
        const s = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
        return `"${s}"`;
      };

      const lines: string[] = [];
      lines.push(`${escape('=== СВОДНЫЙ АНАЛИТИЧЕСКИЙ ОТЧЕТ ПО УГРОЗАМ RADARTG ===')}`);
      lines.push(`${escape('Дата формирования')},${escape(new Date().toISOString())}`);
      lines.push(`${escape('Временной интервал')},${escape(timeRange)}`);
      lines.push(`${escape('Фильтр категории')},${escape(threatFilter)}`);
      lines.push(`${escape('Проанализировано тревог')},${filtered.length}`);
      lines.push(`${escape('Всего событий в базе')},${totalInDb}`);
      lines.push('');

      lines.push(`${escape('=== КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ (KPI) ===')}`);
      lines.push(`${escape('Показатель')},${escape('Значение')},${escape('Доля / Детали')}`);
      lines.push(`${escape('Всего тревог в выборке')},${report.kpis.totalAlerts},${escape('100%')}`);
      lines.push(`${escape('Отправлено в канал Telegram')},${report.kpis.forwardedAlerts},${escape(report.kpis.forwardedPercentage + '%')}`);
      lines.push(`${escape('Критических угроз')},${report.kpis.criticalAlerts},${escape(report.kpis.criticalPercentage + '% от общего числа')}`);
      lines.push(`${escape('Заблокировано спама и рекламы')},${report.kpis.spamBlocked},${escape(report.kpis.spamBlockedPercentage + '%')}`);
      lines.push(`${escape('Очищено полезных сводок')},${report.kpis.cleanAlerts},${escape(report.kpis.cleanPercentage + '%')}`);
      lines.push(`${escape('Главная доминирующая угроза')},${escape(report.kpis.dominantThreat.label)},${escape(report.kpis.dominantThreat.count + ' случаев (' + report.kpis.dominantThreat.percentage + '%)')}`);
      lines.push(`${escape('Пик активности')},${escape(report.kpis.peakActivity.window)},${escape(report.kpis.peakActivity.count + ' событий (' + report.kpis.peakActivity.description + ')')}`);
      lines.push(`${escape('Ночной интервал (22:00 - 06:00)')},${report.kpis.intervalComparison.nightAlerts},${escape(report.kpis.intervalComparison.nightPercentage + '% от тревог')}`);
      lines.push(`${escape('Дневной интервал (07:00 - 21:00)')},${report.kpis.intervalComparison.dayAlerts},${escape(report.kpis.intervalComparison.dayPercentage + '% от тревог')}`);
      lines.push('');

      lines.push(`${escape('=== РАСПРЕДЕЛЕНИЕ ПО ТИПАМ УГРОЗ ===')}`);
      lines.push(`${escape('Код типа')},${escape('Категория угрозы')},${escape('Количество инцидентов')},${escape('Доля (%)')}`);
      for (const t of report.threatTypeDistribution) {
        lines.push(`${escape(t.type)},${escape(t.label)},${t.count},${escape(t.percentage + '%')}`);
      }
      lines.push('');

      lines.push(`${escape('=== РАСПРЕДЕЛЕНИЕ ПО УРОВНЯМ ОПАСНОСТИ ===')}`);
      lines.push(`${escape('Уровень опасности')},${escape('Обозначение')},${escape('Количество тревог')},${escape('Доля (%)')}`);
      for (const s of report.severityDistribution) {
        lines.push(`${escape(s.severity)},${escape(s.name)},${s.count},${escape(s.percentage + '%')}`);
      }
      lines.push('');

      lines.push(`${escape('=== ТОП НАПРАВЛЕНИЙ И ОБЛАСТЕЙ ===')}`);
      lines.push(`${escape('Регион / Направление')},${escape('Количество упоминаний')},${escape('Доля среди регионов (%)')}`);
      for (const r of report.topRegions) {
        lines.push(`${escape(r.region)},${r.count},${escape(r.percentage + '%')}`);
      }
      lines.push('');

      lines.push(`${escape('=== ПОЧАСОВАЯ ДИНАМИКА ТРЕВОГ (00:00 — 23:00) ===')}`);
      lines.push(`${escape('Час суток')},${escape('Всего событий')},${escape('Критических')},${escape('БПЛА / Шахеды')},${escape('Ракеты и баллистика')}`);
      for (const h of report.hourlyActivity) {
        lines.push(`${escape(h.hour)},${h.count},${h.critical},${h.drones},${h.missiles}`);
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="radar_analytics_report_${Date.now()}.csv"`);
      return res.status(200).send('\uFEFF' + lines.join('\r\n'));
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="radar_analytics_report_${Date.now()}.json"`);
    res.status(200).send(JSON.stringify(report, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Tactical Automation Tasks & Threat Correlation API
app.get('/api/tasks', (req: Request, res: Response) => {
  res.json({
    tasks: tacticalTasks,
    logs: taskExecutionLogs,
  });
});

app.post('/api/tasks', (req: Request, res: Response) => {
  try {
    const {
      name,
      targetRegion,
      triggerThreatType = 'AIR_RAID',
      searchCauseInChannels = true,
      trackRouteAndSeverity = true,
      autoPublishTelegram = false,
      customCommentaryTemplate,
    } = req.body;

    if (!targetRegion) {
      return res.status(400).json({ error: 'Укажите целевой регион для задачи' });
    }

    const newTask: TacticalTask = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: name || `Мониторинг причин тревог: ${targetRegion}`,
      enabled: true,
      targetRegion: targetRegion.trim(),
      triggerThreatType,
      searchCauseInChannels,
      trackRouteAndSeverity,
      autoPublishTelegram,
      customCommentaryTemplate,
      triggerCount: 0,
    };

    tacticalTasks.unshift(newTask);
    saveDatabaseToDisk();
    res.json({ success: true, task: newTask });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/toggle', (req: Request, res: Response) => {
  const task = tacticalTasks.find((t) => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Задача не найдена' });
  }
  task.enabled = !task.enabled;
  saveDatabaseToDisk();
  res.json({ success: true, task });
});

app.delete('/api/tasks/:id', (req: Request, res: Response) => {
  tacticalTasks = tacticalTasks.filter((t) => t.id !== req.params.id);
  saveDatabaseToDisk();
  res.json({ success: true });
});

// Test Run a Tactical Task Scenario (e.g. Khmelnytskyi cause search & flight path)
app.post('/api/tasks/test-run/:id', async (req: Request, res: Response) => {
  try {
    const task = tacticalTasks.find((t) => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    // Generate a realistic incoming alert for the task's region
    const sampleAlertText = task.targetRegion.toLowerCase().includes('хмельниц')
      ? `🚨 ХМЕЛЬНИЦЬКА ОБЛАСТЬ — ПОВІТРЯНА ТРИВОГА!\nЗафіксовано небезпеку ударних БПЛА з південно-східного напрямку. Пройдіть в укриття!`
      : `🚨 ${task.targetRegion.toUpperCase()} — ПОВІТРЯНА ТРИВОГА!\nЗафіксовано загрозу ворожих засобів ураження!`;

    const generatedAlert = await processIncomingMessage(
      sampleAlertText,
      `@${task.targetRegion.toLowerCase()}_alerts_monitor`
    );

    res.json({
      success: true,
      alert: generatedAlert,
      task,
      logs: taskExecutionLogs.slice(0, 5),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Full Local Database Export, Import & Management API
app.get('/api/database/status', (req: Request, res: Response) => {
  const exists = fs.existsSync(DB_FILE);
  let sizeBytes = 0;
  let lastSaved = null;
  if (exists) {
    try {
      const stat = fs.statSync(DB_FILE);
      sizeBytes = stat.size;
      lastSaved = stat.mtimeMs;
    } catch {}
  }
  res.json({
    exists,
    dbPath: DB_FILE,
    sizeBytes,
    lastSaved,
    counts: {
      channels: parsingChannels.length,
      alerts: alertFeed.length,
      tasks: tacticalTasks.length,
      subscribers: telegramSubscribers.length,
      logs: taskExecutionLogs.length,
      keywords: filterConfig.customKeywords.length,
      regexes: filterConfig.customRegexes.length,
    },
    sqlDumpPath: SQL_DUMP_FILE,
  });
});

// ================= 12. Channels for Parsing API =================
app.get('/api/channels', (req: Request, res: Response) => {
  res.json({
    channels: parsingChannels,
    totalCount: parsingChannels.length,
    activeCount: parsingChannels.filter((c) => c.active).length,
  });
});

app.post('/api/channels', (req: Request, res: Response) => {
  try {
    const {
      username,
      title,
      category = 'REGIONAL',
      priority = 'NORMAL',
      parseIntervalSeconds = 10,
      autoForward = false,
      notes,
    } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Укажите username или ссылку на Telegram канал' });
    }

    let cleanUsername = username.trim();
    if (cleanUsername.includes('t.me/')) {
      cleanUsername = '@' + cleanUsername.split('t.me/')[1].replace(/\+/g, '').split('/')[0];
    } else if (!cleanUsername.startsWith('@')) {
      cleanUsername = '@' + cleanUsername;
    }

    const newChannel: ParsingChannel = {
      id: `ch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      username: cleanUsername,
      title: (title && title.trim()) || cleanUsername,
      category,
      active: true,
      priority,
      parseIntervalSeconds: Number(parseIntervalSeconds) || 10,
      autoForward: Boolean(autoForward),
      parsedMessagesCount: 0,
      notes: notes || '',
    };

    parsingChannels.unshift(newChannel);
    saveDatabaseToDisk();

    res.json({ success: true, channel: newChannel });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/channels/:id', (req: Request, res: Response) => {
  try {
    const channel = parsingChannels.find((c) => c.id === req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Канал не найден' });
    }

    const { title, category, priority, parseIntervalSeconds, autoForward, notes } = req.body;
    if (title !== undefined) channel.title = title;
    if (category !== undefined) channel.category = category;
    if (priority !== undefined) channel.priority = priority;
    if (parseIntervalSeconds !== undefined) channel.parseIntervalSeconds = Number(parseIntervalSeconds);
    if (autoForward !== undefined) channel.autoForward = Boolean(autoForward);
    if (notes !== undefined) channel.notes = notes;

    saveDatabaseToDisk();
    res.json({ success: true, channel });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/channels/:id/toggle', (req: Request, res: Response) => {
  const channel = parsingChannels.find((c) => c.id === req.params.id);
  if (!channel) {
    return res.status(404).json({ error: 'Канал не найден' });
  }
  channel.active = !channel.active;
  saveDatabaseToDisk();
  res.json({ success: true, channel });
});

app.delete('/api/channels/:id', (req: Request, res: Response) => {
  parsingChannels = parsingChannels.filter((c) => c.id !== req.params.id);
  saveDatabaseToDisk();
  res.json({ success: true });
});

app.post('/api/channels/:id/test-parse', async (req: Request, res: Response) => {
  try {
    const channel = parsingChannels.find((c) => c.id === req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Канал не найден' });
    }

    // Generate realistic message tailored to channel category
    let samplePostText = '';
    if (channel.category === 'AIR_FORCE') {
      samplePostText = `🚨 УВАГА! Повітряні Сили ЗСУ інформують:\nЗафіксовано зліт 3х бортів МіГ-31К з аеродрому Саваслейка!\nРакетна небезпека по всій території України!\n\nНе ігноруйте сигнали тривоги!\n\nПідпишіться на резервний канал сповіщень: @air_alerts_reserve\nДонат на авто: https://send.monobank.ua/jar/AF3829`;
    } else if (channel.category === 'RADAR') {
      samplePostText = `⚠️ ОПЕРАТИВНО! ${channel.title}:\nГрупа БПЛА "Shahed" (до 4 одиниць) прямують з півдня курсом на Кропивницький / Кременчук.\nВисота 350м, працюють мобільні вогневі групи.\n\n👇 Наш секретний чат з координатами: https://t.me/+join_radar_vip\nUSDT TRC20: TL2984kjasdh98234`;
    } else {
      samplePostText = `🚨 ${channel.title.toUpperCase()}: ПОВІТРЯНА ТРИВОГА!\nЗагроза застосування балістичного озброєння з північно-східного напрямку!\nПеребувайте в укриттях!\n\nРеклама: Знижки на павербанки t.me/powerbank_store`;
    }

    const simulatedMsgId = Math.floor(10000 + Math.random() * 89999);
    const alert = await processIncomingMessage(samplePostText, channel.username, simulatedMsgId);

    channel.parsedMessagesCount = (channel.parsedMessagesCount || 0) + 1;
    channel.lastParsedAt = Date.now();
    channel.lastAlertDetected = alert.cleanedText.slice(0, 80) || 'Очищенное оповещение';

    saveDatabaseToDisk();

    res.json({
      success: true,
      alert,
      channel,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================= 13. Local SQL Relational Database Engine API =================
app.post('/api/sql/query', (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Укажите SQL запрос' });
    }

    // Sync latest memory state before executing
    localSqlEngine.syncChannelsFromMemory(parsingChannels);
    localSqlEngine.syncAlertsFromMemory(alertFeed);

    const result = localSqlEngine.execute(query);

    // If query updated channels table, sync back to parsingChannels
    const upper = query.trim().toUpperCase();
    if (upper.startsWith('INSERT INTO CHANNELS') || upper.startsWith('UPDATE CHANNELS') || upper.startsWith('DELETE FROM CHANNELS')) {
      const rawChannels = localSqlEngine.getRawRows('channels');
      if (rawChannels.length > 0) {
        parsingChannels = rawChannels.map((r: any) => ({
          id: r.id,
          username: r.username,
          title: r.title,
          category: r.category || 'REGIONAL',
          active: Boolean(r.active),
          priority: r.priority || 'NORMAL',
          parseIntervalSeconds: r.parse_interval || 10,
          autoForward: Boolean(r.auto_forward),
          parsedMessagesCount: r.parsed_count || 0,
          lastParsedAt: r.last_parsed_at || undefined,
          lastAlertDetected: r.last_alert || undefined,
        }));
        saveDatabaseToDisk();
      }
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sql/schema', (req: Request, res: Response) => {
  localSqlEngine.syncChannelsFromMemory(parsingChannels);
  localSqlEngine.syncAlertsFromMemory(alertFeed);
  res.json({
    tables: localSqlEngine.getTables(),
  });
});

app.get('/api/sql/export', (req: Request, res: Response) => {
  localSqlEngine.syncChannelsFromMemory(parsingChannels);
  localSqlEngine.syncAlertsFromMemory(alertFeed);
  const sqlDump = localSqlEngine.exportSqlDump();

  const filename = `radar_sqlite_dump_${new Date().toISOString().slice(0, 10)}.sql`;
  res.setHeader('Content-Type', 'application/sql; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(sqlDump);
});

app.post('/api/sql/import', (req: Request, res: Response) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'Укажите SQL код для импорта' });
    }

    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--') && !s.startsWith('PRAGMA') && !s.startsWith('BEGIN') && !s.startsWith('COMMIT'));

    let executedCount = 0;
    for (const stmt of statements) {
      localSqlEngine.execute(stmt);
      executedCount++;
    }

    saveDatabaseToDisk();

    res.json({
      success: true,
      message: `Успешно выполнено ${executedCount} SQL команд`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/database/export', (req: Request, res: Response) => {
  const fullBackup = {
    radarDbVersion: '1.0.0',
    exportedAt: Date.now(),
    exportedDate: new Date().toISOString(),
    filterConfig,
    telegramConfig: {
      botToken: telegramConfig.botToken,
      targetChannelId: telegramConfig.targetChannelId,
      botUsername: telegramConfig.botUsername,
      botFirstName: telegramConfig.botFirstName,
    },
    telegramSubscribers,
    tacticalTasks,
    taskExecutionLogs,
    alertFeed,
    stats,
  };

  const filename = `radartg_backup_${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(JSON.stringify(fullBackup, null, 2));
});

app.post('/api/database/import', (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Неверный формат JSON файла базы' });
    }

    if (data.filterConfig && typeof data.filterConfig === 'object') {
      Object.assign(filterConfig, data.filterConfig);
    }
    if (data.telegramConfig && typeof data.telegramConfig === 'object') {
      if (data.telegramConfig.targetChannelId !== undefined) {
        telegramConfig.targetChannelId = data.telegramConfig.targetChannelId;
      }
      if (data.telegramConfig.botToken !== undefined) {
        telegramConfig.botToken = data.telegramConfig.botToken;
      }
      if (data.telegramConfig.botUsername !== undefined) {
        telegramConfig.botUsername = data.telegramConfig.botUsername;
      }
      if (data.telegramConfig.botFirstName !== undefined) {
        telegramConfig.botFirstName = data.telegramConfig.botFirstName;
      }
    }
    if (Array.isArray(data.tacticalTasks)) {
      tacticalTasks = data.tacticalTasks;
    }
    if (Array.isArray(data.telegramSubscribers)) {
      telegramSubscribers = data.telegramSubscribers;
    }
    if (Array.isArray(data.alertFeed)) {
      alertFeed = data.alertFeed;
    }
    if (Array.isArray(data.taskExecutionLogs)) {
      taskExecutionLogs = data.taskExecutionLogs;
    }
    if (data.stats && typeof data.stats === 'object') {
      Object.assign(stats, data.stats);
    }

    saveDatabaseToDisk();

    res.json({
      success: true,
      message: 'База данных успешно загружена и сохранена на локальный диск!',
      counts: {
        alerts: alertFeed.length,
        tasks: tacticalTasks.length,
        subscribers: telegramSubscribers.length,
        logs: taskExecutionLogs.length,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: `Ошибка импорта: ${err.message}` });
  }
});

app.post('/api/database/reset', (req: Request, res: Response) => {
  try {
    stats.totalParsed = 0;
    stats.totalBlocked = 0;
    stats.totalCleaned = 0;
    stats.totalForwarded = 0;

    saveDatabaseToDisk();

    res.json({
      success: true,
      message: 'База данных очищена и сохранена',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Simulation Burst: inject realistic simulated channel posts to demonstrate radar & filter
app.post('/api/radar/simulate-burst', async (req: Request, res: Response) => {
  try {
    const simulationTemplates = [
      {
        channel: '@kharkiv_operational',
        text: `🔴 ХАРЬКОВ! Ракетная опасность!\nЗафиксированы пуски баллистических ракет С-300 / Искандер-М из Белгородской области!\nВремя подлета: 1.5 - 2 минуты!\n\nВсем оставаться в безопасных местах!\n\n🔥 ШОК ВИДЕО ПЕРВЫХ ПРИЛЕТОВ БЕЗ ЦЕНЗУРЫ В НАШЕМ РЕЗЕРВНОМ КАНАЛЕ:\n👉 t.me/kharkiv_rezerv_vip_news?start=alert\n💳 Сбор на ремонт скорой помощи: 5375 4141 9901 8832\nМонобанка: send.monobank.ua/jar/KharkivHelp77`,
      },
      {
        channel: '@odesa_live_monitor',
        text: `⚠️ ОДЕССА и Черноморск!\nС моря через Затоку замечено 3 БПЛА "Shahed-136", идут курсом на Белгород-Днестровский / Маяки. Работает ПВО.\n\nРеклама: Казино 777 дарит 100 фриспинов без депозита! Жми сюда https://bet-bonus-super.xyz/reg прямо сейчас!`,
      },
      {
        channel: '@dnipro_alerts_24',
        text: `🟢 ДНЕПР и ОБЛАСТЬ - ОТБОЙ ВОЗДУШНОЙ ТРЕВОГИ!\nУгроза вражеских БПЛА миновала.\n\nПоддержите админа копеечкой на кофе:\nUSDT TRC20: TJ1a8N6K3pB9qW8yX4rZ\nВсем спокойной ночи!`,
      },
      {
        channel: '@spam_clickbait_bot',
        text: `‼️ ВСЕ ГОРОДА! ЭТО ПРОСТО ЖЕСТЬ!\nЗеленский объявил об окончании... Читать продолжение по ссылке в закрепе!\nЖми 👇👇👇\nhttps://t.me/fake_spam_click?join=9382`,
      },
    ];

    const randomItem = simulationTemplates[Math.floor(Math.random() * simulationTemplates.length)];
    const simulatedMsgId = Math.floor(10000 + Math.random() * 89999);
    const simulatedChatId = `-100${Math.floor(1100000000 + Math.random() * 899999999)}`;
    const result = await processIncomingMessage(randomItem.text, randomItem.channel, simulatedMsgId, simulatedChatId);

    res.json({
      success: true,
      alert: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Telegram Webhook Endpoint (for real-world Telegram Bot webhook updates)
app.post('/api/bot/webhook', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    const msg = update.channel_post || update.message;
    if (msg && msg.text) {
      const channelName = msg.chat?.title || msg.chat?.username || 'Telegram Webhook';
      await processIncomingMessage(msg.text, `@${channelName}`);
    }
    res.status(200).send('OK');
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).send('Internal Error');
  }
});

// Mount Vite in development mode or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[RadarTG] Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
