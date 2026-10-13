import React, { useState } from 'react';
import { TelegramBotConfig, SystemStats } from '../types.ts';
import { tacticalAudio } from '../utils/audio.ts';
import {
  Bot,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Radio,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { NotificationSubscribers } from './NotificationSubscribers.tsx';

interface BotSetupTabProps {
  config: TelegramBotConfig;
  stats: SystemStats;
  onUpdateConfig: (botToken: string, targetChannelId: string) => Promise<void>;
  onVerifyBot: (botToken: string) => Promise<{ username: string; firstName: string }>;
  onTogglePolling: (enable: boolean) => Promise<void>;
  onSendTest: (channelId: string) => Promise<void>;
}

export const BotSetupTab: React.FC<BotSetupTabProps> = ({
  config,
  stats,
  onUpdateConfig,
  onVerifyBot,
  onTogglePolling,
  onSendTest,
}) => {
  const [tokenInput, setTokenInput] = useState(config.botToken || '');
  const [channelInput, setChannelInput] = useState(config.targetChannelId || '');
  const [showToken, setShowToken] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isTogglingPolling, setIsTogglingPolling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveAndVerify = async () => {
    if (!tokenInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Пожалуйста, введите токен бота' });
      return;
    }

    setIsVerifying(true);
    setStatusMessage(null);

    try {
      await onUpdateConfig(tokenInput.trim(), channelInput.trim());
      const botInfo = await onVerifyBot(tokenInput.trim());
      setStatusMessage({
        type: 'success',
        text: `Бот @${botInfo.username} (${botInfo.firstName}) успешно авторизован!`,
      });
      tacticalAudio.playCleanSound();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Ошибка проверки токена' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTestBroadcast = async () => {
    if (!channelInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Укажите ID целевого канала или @имя_канала' });
      return;
    }

    setIsSendingTest(true);
    setStatusMessage(null);

    try {
      await onSendTest(channelInput.trim());
      setStatusMessage({
        type: 'success',
        text: 'Тестовое оповещение успешно доставлено в Telegram канал!',
      });
      tacticalAudio.playCleanSound();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Ошибка отправки в канал: ${err.message}. Убедитесь, что бот добавлен администратором канала с правом публикации!`,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleTogglePolling = async () => {
    setIsTogglingPolling(true);
    try {
      await onTogglePolling(!config.isPolling);
      tacticalAudio.playRadarBlip();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsTogglingPolling(false);
    }
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 backdrop-blur-md shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/70">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold font-mono tracking-wider text-slate-100 uppercase">
              ИНТЕГРАЦИЯ TELEGRAM БОТА И КАНАЛА РАДАРА
            </h2>
            <span
              className={`px-2 py-0.5 text-xs font-mono font-semibold rounded ${
                config.botUsername
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {config.botUsername ? `@${config.botUsername}` : 'Не настроен'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Управление авторизацией бота, правами администратора в канале и автоматическим перехватом
          </p>
        </div>

        {/* Polling Switch Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTogglePolling}
            disabled={isTogglingPolling || !config.botToken}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              config.isPolling
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${config.isPolling ? 'animate-pulse' : ''}`} />
            {config.isPolling ? 'Фоновый перехват: ВКЛЮЧЕН' : 'Включить фоновый перехват'}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs font-mono ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Bot Configuration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          {/* Bot Token Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center justify-between">
              <span>TELEGRAM BOT TOKEN</span>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-normal"
              >
                Получить в @BotFather <ExternalLink className="w-3 h-3" />
              </a>
            </label>

            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 pr-20 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Токен надежно сохраняется на сервере и используется для проверки и отправки очищенных сводок.
            </p>
          </div>

          {/* Target Channel Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
              ЦЕЛЕВОЙ КАНАЛ / ГРУППА ДЛЯ ОПОВЕЩЕНИЙ
            </label>
            <input
              type="text"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="@my_alarm_radar или -100192837465"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 font-mono">
              Укажите @username вашего публичного канала или числовой ID приватного канала (начинается с -100).
            </p>
          </div>

          {/* Buttons row */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveAndVerify}
              disabled={isVerifying || !tokenInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/40 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              {isVerifying ? 'Проверка связи с Telegram...' : 'Сохранить и проверить бота'}
            </button>

            <button
              onClick={handleTestBroadcast}
              disabled={isSendingTest || !tokenInput.trim() || !channelInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-slate-200 font-mono font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4 text-emerald-400" />
              {isSendingTest ? 'Отправка теста...' : 'Тестовая отправка в канал'}
            </button>
          </div>
        </div>

        {/* Right Column: Step-by-Step Telegram Setup Guide */}
        <div className="lg:col-span-5 bg-slate-950/80 rounded-xl border border-slate-800 p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-mono font-bold text-slate-200 uppercase">
              ИНСТРУКЦИЯ ПО НАСТРОЙКЕ ЗА 2 МИНУТЫ
            </h3>
          </div>

          <ol className="space-y-3 text-xs font-mono text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-[10px] shrink-0">
                1
              </span>
              <span>
                Откройте бота <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-emerald-400 underline">@BotFather</a> в Telegram и отправьте команду <code className="text-rose-300 bg-slate-900 px-1 py-0.5 rounded">/newbot</code>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-[10px] shrink-0">
                2
              </span>
              <span>
                Задайте имя и юзернейм для вашего радара (например: <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">ThreatRadarBot</code>).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-[10px] shrink-0">
                3
              </span>
              <span>
                Скопируйте полученный <b>HTTP API Token</b> и вставьте в поле слева.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-[10px] shrink-0">
                4
              </span>
              <span>
                Добавьте вашего бота в администраторы целевого канала с правом <b>«Публикация сообщений»</b>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-[10px] shrink-0">
                5
              </span>
              <span>
                Нажмите <b>«Тестовая отправка в канал»</b> — бот пришлет подтверждение связи!
              </span>
            </li>
          </ol>

          {/* Webhook info block */}
          <div className="pt-3 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
              WEBHOOK URL ДЛЯ ПАРСИНГА ВХОДЯЩИХ:
            </span>
            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
              <span className="truncate">{typeof window !== 'undefined' ? `${window.location.origin}/api/bot/webhook` : '/api/bot/webhook'}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/bot/webhook`);
                  setStatusMessage({ type: 'success', text: 'Webhook URL скопирован!' });
                }}
                className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                title="Скопировать Webhook"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Telegram Subscribers Notifications Section */}
      <NotificationSubscribers hasBotToken={Boolean(config.botToken)} />

      {/* System Stats Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80 font-mono">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">ОБРАБОТАНО СВОДОК</span>
          <span className="text-lg font-bold text-slate-100">{stats.totalParsed}</span>
        </div>
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">ОЧИЩЕНО ОТ СПАМА</span>
          <span className="text-lg font-bold text-emerald-400">{stats.totalCleaned}</span>
        </div>
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">ЗАБЛОКИРОВАНО БОТОВ</span>
          <span className="text-lg font-bold text-rose-400">{stats.totalBlocked}</span>
        </div>
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">РЕТРАНСЛИРОВАНО В TG</span>
          <span className="text-lg font-bold text-blue-400">{stats.totalForwarded}</span>
        </div>
      </div>
    </div>
  );
};
