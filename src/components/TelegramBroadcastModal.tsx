import React, { useState } from 'react';
import { ParsedAlert, FilterConfig } from '../types.ts';
import { tacticalAudio } from '../utils/audio.ts';
import { safeFetchJson, formatTelegramApiError } from '../utils/api.ts';
import {
  Send,
  X,
  Bot,
  Quote,
  Layers,
  CheckCircle2,
  AlertCircle,
  Copy,
  Forward,
  Sliders,
  ShieldCheck,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

interface TelegramBroadcastModalProps {
  alert: ParsedAlert;
  filterConfig: FilterConfig;
  targetChannelId: string;
  hasBotToken: boolean;
  onClose: () => void;
  onBroadcastSuccess: (alertId: string, telegramMessageId: number) => void;
}

export const TelegramBroadcastModal: React.FC<TelegramBroadcastModalProps> = ({
  alert,
  filterConfig,
  targetChannelId,
  hasBotToken,
  onClose,
  onBroadcastSuccess,
}) => {
  const [mode, setMode] = useState<'blockquote' | 'template' | 'copy' | 'forward'>(
    filterConfig.forwardingMode || 'blockquote'
  );
  const [headerTitle, setHeaderTitle] = useState(
    filterConfig.quoteHeaderTitle || 'Розвідка України'
  );
  const [commentary, setCommentary] = useState(
    alert.quoteCommentary || filterConfig.defaultFollowupComment || 'Не фіксується'
  );
  const [expandableQuote, setExpandableQuote] = useState(
    filterConfig.expandableQuote || false
  );
  const [attachInlineButtons, setAttachInlineButtons] = useState(
    filterConfig.attachInlineButtons ?? true
  );
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const commentaryPresets = [
    'Не фіксується',
    '⚠️ Увага, в укриття!',
    'Курс на Васильків',
    '🟢 Чисто / Відбій',
    'Локаційно втрачено',
    '⚠️ Загроза балістики',
    'Працює ППО',
  ];

  const handleSend = async () => {
    if (!hasBotToken) {
      setErrorMsg('Токен Telegram бота не настроен. Перейдите во вкладку «Telegram Бот»');
      return;
    }
    if (!targetChannelId) {
      setErrorMsg('Целевой канал не указан. Укажите @канал во вкладке «Telegram Бот»');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await safeFetchJson(`/api/radar/broadcast/${alert.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          headerTitle,
          commentary,
          expandableQuote,
        }),
      });

      if (!res.ok) {
        throw new Error(
          formatTelegramApiError(res.error, { channel: targetChannelId })
        );
      }

      tacticalAudio.playCleanSound();
      const msgId = res.data?.telegramMessageId || '';
      setSuccessMsg(`✅ Успешно отправлено в Telegram! ID сообщения: #${msgId}`);
      onBroadcastSuccess(alert.id, msgId);

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка отправки через Telegram API');
    } finally {
      setIsSending(false);
    }
  };

  const cleanText = alert.cleanedText || alert.originalText;
  const sourceChannelClean = alert.sourceChannel ? alert.sourceChannel.replace(/^@/, '') : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
              <Quote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono tracking-wide text-white uppercase flex items-center gap-2">
                РЕТРАНСЛЯЦИЯ В TELEGRAM С ЦИТИРОВАНИЕМ
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Использует Telegram Bot API для отправки сообщений с блоком <code>&lt;blockquote&gt;</code>, как на фото
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-5">
          {/* Left Column: Controls & Presets */}
          <div className="lg:col-span-6 space-y-4">
            {/* Mode selection tabs */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
                РЕЖИМ ПЕРЕСЫЛКИ ЧЕРЕЗ API:
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setMode('blockquote')}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    mode === 'blockquote'
                      ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200 font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="block font-bold text-[11px] text-cyan-400">🌟 Цитата (Blockquote)</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Стиль мониторинговых каналов</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('template')}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    mode === 'template'
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="block font-bold text-[11px] text-emerald-400">📋 Карточка Радара</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Сводка: сектор, вектор, тип</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('copy')}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    mode === 'copy'
                      ? 'bg-purple-950/70 border-purple-500 text-purple-200 font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="block font-bold text-[11px] text-purple-400">📑 copyMessage API</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Копирование с чистым текстом</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('forward')}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    mode === 'forward'
                      ? 'bg-blue-950/70 border-blue-500 text-blue-200 font-bold'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="block font-bold text-[11px] text-blue-400">🔁 forwardMessage API</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Нативный форвардинг</span>
                </button>
              </div>
            </div>

            {/* Header Title */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
                ЗАГОЛОВОК КАНАЛА НАД ЦИТАТОЙ:
              </label>
              <input
                type="text"
                value={headerTitle}
                onChange={(e) => setHeaderTitle(e.target.value)}
                placeholder="Розвідка України"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Commentary Input & Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
                  КОММЕНТАРИЙ ПОД ЦИТАТОЙ:
                </label>
                <span className="text-[10px] font-mono text-slate-500">Статус цели</span>
              </div>

              <input
                type="text"
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                placeholder="Не фіксується"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {commentaryPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCommentary(preset)}
                    className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      commentary === preset
                        ? 'bg-cyan-900/40 text-cyan-300 border-cyan-700 font-semibold'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Options Toggles */}
            <div className="pt-2 border-t border-slate-800/60 space-y-2">
              <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expandableQuote}
                  onChange={(e) => setExpandableQuote(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Сворачиваемая цитата (<code>&lt;blockquote expandable&gt;</code>)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachInlineButtons}
                  onChange={(e) => setAttachInlineButtons(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Прикрепить инлайн-кнопки проверки и подписки</span>
              </label>
            </div>

            {/* Target Channel Destination Indicator */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Bot className="w-4 h-4 text-emerald-400" />
                <span>Канал:</span>
                <span className="font-bold text-white">
                  {targetChannelId || '(Канал не задан)'}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/50">
                API v7.0
              </span>
            </div>
          </div>

          {/* Right Column: Live Telegram Channel Message Preview */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-cyan-400" />
                ТОЧНЫЙ ПРЕДПРОСМОТР В TELEGRAM:
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Стиль мониторингового канала
              </span>
            </div>

            {/* Telegram Channel Message Bubble (Authentic dark theme) */}
            <div className="bg-[#182533] rounded-2xl p-4 border border-[#243447] text-white shadow-2xl space-y-3">
              {/* Channel header inside telegram client */}
              <div className="flex items-center gap-2 pb-2 border-b border-[#2b3e55]">
                <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center font-bold text-xs">
                  {headerTitle ? headerTitle[0].toUpperCase() : 'R'}
                </div>
                <div>
                  <div className="text-xs font-bold text-white font-sans leading-tight">
                    {headerTitle || 'RadarTG Bot'}
                  </div>
                  <div className="text-[10px] text-[#50a8eb] font-sans">
                    {targetChannelId || '@radar_channel'}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono ml-auto">
                  {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Message body based on mode */}
              {mode === 'blockquote' || mode === 'copy' ? (
                <div className="space-y-2.5 text-xs font-sans text-slate-100">
                  <div className="font-bold text-[13px] text-white tracking-wide">
                    {headerTitle}
                  </div>

                  {/* Authentic Telegram blockquote styled bar (as seen in photo) */}
                  <div className="border-l-3 border-[#50a8eb] pl-3 py-1.5 bg-[#202f42]/70 rounded-r-lg space-y-1">
                    <div className="text-[11px] font-bold text-[#64b5f6] flex items-center gap-1">
                      📢 {sourceChannelClean || headerTitle}
                    </div>
                    <div className="text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap font-sans">
                      {cleanText}
                    </div>
                  </div>

                  {/* Followup commentary */}
                  {commentary && (
                    <div className="text-xs text-slate-100 font-medium pt-0.5 font-sans">
                      {commentary}
                    </div>
                  )}
                </div>
              ) : mode === 'forward' ? (
                <div className="space-y-2 text-xs font-sans text-slate-100">
                  <div className="text-[11px] text-cyan-400 font-sans italic border-l-2 border-cyan-400 pl-2">
                    Переслано из {alert.sourceChannel}
                  </div>
                  <div className="text-xs leading-relaxed text-slate-200 whitespace-pre-wrap font-sans">
                    {alert.originalText}
                  </div>
                </div>
              ) : (
                <div className="text-xs font-sans whitespace-pre-wrap leading-relaxed text-slate-100 space-y-1">
                  <div className="font-bold text-amber-400">
                    🚨 [РАДАР УГРОЗ] {alert.threatType}
                  </div>
                  <div>📍 Сектор: <b>{alert.regions.join(', ')}</b></div>
                  <div>🧭 Направление: <b>{alert.vector}</b></div>
                  <div>⚠️ Уровень: <code>{alert.severity}</code></div>
                  <div className="pt-1">{cleanText}</div>
                </div>
              )}

              {/* Inline Buttons Mock */}
              {attachInlineButtons && (
                <div className="pt-2 border-t border-[#2b3e55] space-y-1.5">
                  <div className="w-full py-1.5 px-2 rounded-lg bg-[#243447] text-center text-[11px] font-sans font-medium text-emerald-400 border border-[#344860]">
                    🛡️ Проверено фильтром (-{alert.spamScore}% спама)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="py-1 px-2 rounded-lg bg-[#243447] text-center text-[10px] font-sans text-slate-300 border border-[#344860]">
                      📢 {targetChannelId || 'Целевой канал'}
                    </div>
                    <div className="py-1 px-2 rounded-lg bg-[#243447] text-center text-[10px] font-sans text-emerald-300 border border-[#344860]">
                      🔔 Подписка на радар
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Error or Success banners */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-900/60 text-xs font-mono text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-900/60 text-xs font-mono text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs cursor-pointer transition-colors"
          >
            Отмена
          </button>

          <button
            onClick={handleSend}
            disabled={isSending}
            className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-cyan-900/40 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {isSending ? 'Отправка через API...' : '🚀 Отправить через Telegram API'}
          </button>
        </div>
      </div>
    </div>
  );
};
