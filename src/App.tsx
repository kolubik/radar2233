import React, { useState, useEffect, useCallback } from 'react';
import { ParsedAlert, FilterConfig, TelegramBotConfig, SystemStats } from './types.ts';
import { ThreatFeed } from './components/ThreatFeed.tsx';
import { FilterSandbox } from './components/FilterSandbox.tsx';
import { FilterConfigTab } from './components/FilterConfigTab.tsx';
import { BotSetupTab } from './components/BotSetupTab.tsx';
import { TacticalTasksTab } from './components/TacticalTasksTab.tsx';
import { AnalyticsTab } from './components/AnalyticsTab.tsx';
import { ChannelsTab } from './components/ChannelsTab.tsx';
import { ManualIngestModal } from './components/ManualIngestModal.tsx';
import { DatabaseModal } from './components/DatabaseModal.tsx';
import { tacticalAudio } from './utils/audio.ts';
import {
  Radio,
  Sliders,
  Bot,
  Volume2,
  VolumeX,
  Plus,
  Zap,
  CheckCircle2,
  Send,
  FileCode,
  FileSpreadsheet,
  Database,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'feed' | 'sandbox' | 'bot' | 'channels' | 'analytics' | 'filters' | 'tasks'>('feed');
  const [alerts, setAlerts] = useState<ParsedAlert[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalParsed: 0,
    totalBlocked: 0,
    totalCleaned: 0,
    totalForwarded: 0,
  });
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
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
  });
  const [telegramConfig, setTelegramConfig] = useState<TelegramBotConfig>({
    botToken: '',
    targetChannelId: '',
    botUsername: null,
    botFirstName: null,
    isPolling: false,
    lastError: null,
    webhookUrl: null,
  });

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [isBroadcastingId, setIsBroadcastingId] = useState<string | null>(null);
  const [sandboxPresetText, setSandboxPresetText] = useState<string>('');
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isSimulatingBurst, setIsSimulatingBurst] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  // Sync sound settings
  useEffect(() => {
    tacticalAudio.enabled = soundEnabled;
  }, [soundEnabled]);

  // Fetch feed & stats
  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/radar/feed');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.feed || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch radar feed:', err);
    }
  }, []);

  // Fetch bot status & filter config on load
  const fetchInitialData = useCallback(async () => {
    try {
      const [botRes, filterRes] = await Promise.all([
        fetch('/api/bot/status'),
        fetch('/api/filters/config'),
      ]);

      if (botRes.ok) {
        const botData = await botRes.json();
        if (botData.config) setTelegramConfig(botData.config);
        if (botData.stats) setStats(botData.stats);
      }

      if (filterRes.ok) {
        const filterData = await filterRes.json();
        if (filterData.config) {
          setFilterConfig(filterData.config);
          setSoundEnabled(filterData.config.soundAlerts);
        }
      }

      await fetchFeed();
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }, [fetchFeed]);

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(fetchFeed, 4000);
    return () => clearInterval(interval);
  }, [fetchInitialData, fetchFeed]);

  // Handle manual broadcast to Telegram
  const handleBroadcastAlert = async (alertId: string) => {
    setIsBroadcastingId(alertId);
    try {
      const res = await fetch(`/api/radar/broadcast/${alertId}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка отправки в канал');
      }

      tacticalAudio.playCleanSound();
      showToast('Сводка отправлена в Telegram канал');
      await fetchFeed();
    } catch (err: any) {
      showToast(`Ошибка: ${err.message}`, true);
    } finally {
      setIsBroadcastingId(null);
    }
  };

  // Handle simulation burst
  const handleSimulateBurst = async () => {
    setIsSimulatingBurst(true);
    try {
      const res = await fetch('/api/radar/simulate-burst', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.alert) {
        tacticalAudio.playThreatAlarm(data.alert.severity);
        showToast(`Новое сообщение: ${data.alert.regions.join(', ') || 'Тревога'}`);
      }
      await fetchFeed();
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulatingBurst(false);
    }
  };

  // Handle manual message ingest
  const handleManualIngest = async (text: string, sourceChannel: string) => {
    try {
      const res = await fetch('/api/radar/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceChannel }),
      });
      const data = await res.json();
      if (data.alert) {
        tacticalAudio.playThreatAlarm(data.alert.severity);
        showToast('Сообщение очищено и добавлено в ленту');
      }
      await fetchFeed();
    } catch (err) {
      console.error('Ingest error:', err);
    }
  };

  // Update Bot Token and target channel
  const handleUpdateBotConfig = async (botToken: string, targetChannelId: string) => {
    const res = await fetch('/api/bot/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, targetChannelId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка настройки бота');
    setTelegramConfig(data.config);
  };

  // Verify Telegram Bot
  const handleVerifyBot = async (botToken: string) => {
    const res = await fetch('/api/bot/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Неверный токен бота');
    setTelegramConfig((prev) => ({
      ...prev,
      botUsername: data.bot.username,
      botFirstName: data.bot.firstName,
      lastError: null,
    }));
    return data.bot;
  };

  // Toggle Background Polling
  const handleTogglePolling = async (enable: boolean) => {
    const res = await fetch('/api/bot/toggle-polling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка переключения поллинга');
    setTelegramConfig((prev) => ({ ...prev, isPolling: data.isPolling }));
    showToast(data.isPolling ? 'Фоновый перехват включен' : 'Фоновый перехват выключен');
  };

  // Send Test message to Telegram channel
  const handleSendTestToChannel = async (channelId: string) => {
    const res = await fetch('/api/bot/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: channelId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка тестовой отправки');
  };

  // Save filter configuration
  const handleSaveFilterConfig = async (updated: Partial<FilterConfig>) => {
    const res = await fetch('/api/filters/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    const data = await res.json();
    if (data.config) {
      setFilterConfig(data.config);
      if (data.config.soundAlerts !== undefined) {
        setSoundEnabled(data.config.soundAlerts);
      }
    }
  };

  const showToast = (msg: string, isError = false) => {
    setLastNotification(msg);
    setTimeout(() => setLastNotification(null), 3000);
  };

  interface TabItem {
    id: 'feed' | 'sandbox' | 'bot' | 'channels' | 'analytics' | 'filters' | 'tasks';
    label: string;
    count?: number;
  }

  const tabs: TabItem[] = [
    { id: 'feed', label: 'Радар тревог', count: alerts.length },
    { id: 'sandbox', label: 'Песочница теста' },
    { id: 'bot', label: 'Подключение бота' },
    { id: 'channels', label: 'Каналы для парсинга (База SQL)' },
    { id: 'analytics', label: 'Аналитика' },
    { id: 'filters', label: 'Фильтры и правила' },
    { id: 'tasks', label: 'Сценарии тревог' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Minimalist Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-tight text-white flex items-center gap-1.5">
              <span>Radar<span className="text-emerald-400">TG</span></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Мониторинг каналов и пересылка в Telegram
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* Bot status */}
            <button
              onClick={() => setActiveTab('bot')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                telegramConfig.botUsername
                  ? 'bg-slate-900 border-emerald-500/40 text-emerald-400 hover:bg-slate-800'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>
                {telegramConfig.botUsername ? `@${telegramConfig.botUsername}` : 'Бот не настроен'}
              </span>
              {telegramConfig.isPolling && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
              )}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                handleSaveFilterConfig({ soundAlerts: !soundEnabled });
              }}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {/* Local Database & PC Run */}
            <button
              onClick={() => setIsDbModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Локальная база данных, экспорт/импорт и запуск на ПК"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">База &amp; ПК</span>
            </button>

            {/* Quick Action: Ingest & Simulate */}
            <button
              onClick={handleSimulateBurst}
              disabled={isSimulatingBurst}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Сгенерировать тестовое сообщение"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Тест</span>
            </button>

            <button
              onClick={() => setIsIngestModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить пост</span>
            </button>
          </div>
        </div>
      </header>

      {/* Real-time Notification Banner */}
      {lastNotification && (
        <div className="bg-slate-900 border-b border-emerald-500/40 px-4 py-2 text-center text-xs font-medium text-emerald-300 flex items-center justify-center gap-2 animate-fadeIn z-30">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{lastNotification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1 border-b border-slate-800 pb-2 text-xs sm:text-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white border border-slate-700/80 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[11px] text-slate-400 font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab 1: Live Feed (Clean, minimal, direct) */}
        {activeTab === 'feed' && (
          <ThreatFeed
            alerts={alerts}
            filterConfig={filterConfig}
            targetChannelId={telegramConfig.targetChannelId}
            hasBotToken={Boolean(telegramConfig.botToken)}
            onBroadcast={handleBroadcastAlert}
            onTestInSandbox={(text) => {
              setSandboxPresetText(text);
              setActiveTab('sandbox');
            }}
            selectedAlertId={selectedAlertId}
            onSelectAlert={(alert) => setSelectedAlertId(alert.id)}
            isBroadcastingId={isBroadcastingId}
            onRefreshFeed={fetchFeed}
          />
        )}

        {/* Tab: Analytics & Threat Metrics */}
        {activeTab === 'analytics' && (
          <AnalyticsTab alerts={alerts} onSimulateBurst={handleSimulateBurst} />
        )}

        {/* Tab 2: Tactical Tasks & Scenarios Engine */}
        {activeTab === 'tasks' && (
          <TacticalTasksTab
            onNotify={(msg, isErr) => showToast(msg, isErr)}
            onRefreshFeed={fetchFeed}
            hasBotToken={Boolean(telegramConfig.botToken)}
          />
        )}

        {/* Tab 3: Filter & Template Settings */}
        {activeTab === 'filters' && (
          <FilterConfigTab
            config={filterConfig}
            onSaveConfig={handleSaveFilterConfig}
          />
        )}

        {/* Tab 4: Filter Sandbox */}
        {activeTab === 'sandbox' && (
          <FilterSandbox
            initialText={sandboxPresetText}
            onSendTestToBot={async (cleanedText) => {
              if (!telegramConfig.botToken || !telegramConfig.targetChannelId) {
                throw new Error('Telegram бот не настроен! Перейдите во вкладку «Telegram бот».');
              }
              const res = await fetch('/api/bot/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customText: cleanedText }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Ошибка отправки');
            }}
            hasTelegramBot={Boolean(telegramConfig.botToken && telegramConfig.targetChannelId)}
          />
        )}

        {/* Tab 5: Telegram Bot Integration */}
        {activeTab === 'bot' && (
          <BotSetupTab
            config={telegramConfig}
            stats={stats}
            onUpdateConfig={handleUpdateBotConfig}
            onVerifyBot={handleVerifyBot}
            onTogglePolling={handleTogglePolling}
            onSendTest={handleSendTestToChannel}
          />
        )}

        {/* Tab 6: Channels for Parsing & Local SQL Database */}
        {activeTab === 'channels' && (
          <ChannelsTab
            onRefreshFeed={fetchFeed}
            onToast={(msg, isErr) => showToast(msg, isErr)}
          />
        )}
      </main>

      {/* Manual Ingest Modal */}
      <ManualIngestModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onIngest={handleManualIngest}
        onSimulateBurst={handleSimulateBurst}
      />

      {/* Local Database & PC Run Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onDatabaseImported={fetchInitialData}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-4 py-4 text-center text-xs text-slate-500">
        <p>RadarTG • Мониторинг каналов и очистка от рекламы</p>
      </footer>
    </div>
  );
}
