export type ThreatType =
  | 'MISSILE'
  | 'BALLISTIC'
  | 'DRONE'
  | 'AVIATION'
  | 'ARTILLERY'
  | 'AIR_RAID'
  | 'ALL_CLEAR'
  | 'INFO';

export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RemovedElement {
  type: 'url' | 'mention' | 'donation' | 'clickbait' | 'keyword' | 'cleaner';
  content: string;
}

export interface ParsedAlert {
  id: string;
  timestamp: number;
  sourceChannel: string;
  originalText: string;
  cleanedText: string;
  threatType: ThreatType;
  severity: ThreatSeverity;
  regions: string[];
  vector: string;
  altitudeSpeed?: string;
  removedElements: RemovedElement[];
  isPureSpam: boolean;
  spamScore: number;
  status: 'PENDING' | 'FORWARDED' | 'BLOCKED' | 'SIMULATED';
  forwardedAt?: number;
  telegramMessageId?: number;
  quoteCommentary?: string; // e.g. "Не фіксується" or custom radar follow-up
  originalTelegramMessageId?: number;
  fromChatId?: string | number;
  threatCause?: string; // Cause discovered across channels
  routeTrajectory?: string; // Computed flight path
  colorThreatLevel?: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  correlationTaskId?: string;
  processingTimeMs?: number; // Latency of recognition in milliseconds (e.g. 1.2ms)
  engineUsed?: 'FAST_REGEX_ENGINE' | 'AI_GEMINI_HYBRID';
}

export type ThreatColorLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface TacticalTask {
  id: string;
  name: string;
  enabled: boolean;
  targetRegion: string; // e.g. "Хмельницкая", "Киевская", "Одесская"
  triggerThreatType: ThreatType | 'ANY';
  searchCauseInChannels: boolean; // Look among channels for cause of alert
  trackRouteAndSeverity: boolean; // Track UAV route with Green -> Red severity
  autoPublishTelegram: boolean;
  customCommentaryTemplate?: string;
  lastTriggeredAt?: number;
  triggerCount: number;
  lastFoundCause?: string;
  lastAssignedLevel?: ThreatColorLevel;
}

export interface TaskExecutionLog {
  id: string;
  taskId: string;
  taskName: string;
  timestamp: number;
  targetRegion: string;
  triggerAlertId: string;
  foundCause: string;
  routePath: string;
  threatLevel: ThreatColorLevel;
  generatedTelegramPost: string;
  publishedToTelegram: boolean;
  telegramMessageId?: number;
}

export interface FilterConfig {
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
  useTelegramBlockquote: boolean; // Telegram <blockquote> citation style like user photo
  quoteHeaderTitle: string; // Header title above blockquote e.g. "Розвідка України"
  defaultFollowupComment: string; // Optional commentary under citation e.g. "Не фіксується" or "В укриття"
  expandableQuote: boolean; // <blockquote expandable> for long texts
  forwardingMode: 'blockquote' | 'template' | 'copy' | 'forward'; // Preferred Telegram forwarding method
  ultraFastMode: boolean; // Millisecond regex-accelerated recognition pipeline (< 2ms)
}

export interface TelegramSubscriber {
  chatId: string;
  username?: string;
  firstName?: string;
  minSeverity: 'ALL' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  subscribedTypes: ThreatType[];
  subscribedRegions: string[];
  active: boolean;
  createdAt: number;
  isDemo?: boolean;
  lastDeliveryError?: string | null;
  lastDeliveredAt?: number | null;
}

export interface TelegramBotConfig {
  botToken: string;
  targetChannelId: string;
  botUsername: string | null;
  botFirstName: string | null;
  isPolling: boolean;
  lastError: string | null;
  webhookUrl: string | null;
}

export interface SystemStats {
  totalParsed: number;
  totalBlocked: number;
  totalCleaned: number;
  totalForwarded: number;
}

export interface RadarTarget {
  id: string;
  alertId: string;
  threatType: ThreatType;
  severity: ThreatSeverity;
  label: string;
  sector: string;
  distanceKm: number; // 50 to 450
  angleDeg: number; // 0 to 360
  speedKmh?: number;
  altitudeM?: number;
  trajectory: string;
  timestamp: number;
}

export type ChannelCategory = 'AIR_FORCE' | 'RADAR' | 'REGIONAL' | 'OFFICIAL' | 'GENERAL';

export interface ParsingChannel {
  id: string;
  username: string; // e.g. '@kpszsu' or 't.me/kpszsu'
  title: string;
  category: ChannelCategory;
  active: boolean;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  parseIntervalSeconds: number;
  autoForward: boolean;
  parsedMessagesCount: number;
  lastParsedAt?: number;
  lastAlertDetected?: string;
  notes?: string;
  avatarUrl?: string;
  description?: string;
  isOnline?: boolean;
  sqlRowId?: number;
}

export interface SqlQueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTimeMs: number;
  query: string;
  error?: string;
}

export interface SqlTableInfo {
  name: string;
  columns: { name: string; type: string; isPrimary?: boolean }[];
  rowCount: number;
}

export interface ErrorTelemetryRecord {
  id: string;
  timestamp: number;
  timeString: string;
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  module: string;
  severity: ThreatSeverity;
  url: string;
  userAgent: string;
  metadata?: Record<string, any>;
  handled: boolean;
}
