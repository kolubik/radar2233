import React, { useState } from 'react';
import { ParsedAlert, ThreatType, FilterConfig } from '../types.ts';
import { tacticalAudio } from '../utils/audio.ts';
import { TelegramBroadcastModal } from './TelegramBroadcastModal.tsx';
import {
  Send,
  ShieldCheck,
  Ban,
  Clock,
  ChevronDown,
  ChevronUp,
  Radio,
  Sparkles,
  ExternalLink,
  Flame,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileCode,
  Quote,
  Zap,
} from 'lucide-react';

interface ThreatFeedProps {
  alerts: ParsedAlert[];
  filterConfig?: FilterConfig;
  targetChannelId?: string;
  hasBotToken?: boolean;
  onBroadcast: (alertId: string) => Promise<void>;
  onTestInSandbox: (text: string) => void;
  selectedAlertId: string | null;
  onSelectAlert: (alert: ParsedAlert) => void;
  isBroadcastingId: string | null;
  onRefreshFeed?: () => Promise<void>;
}

export const ThreatFeed: React.FC<ThreatFeedProps> = ({
  alerts,
  filterConfig,
  targetChannelId = '',
  hasBotToken = false,
  onBroadcast,
  onTestInSandbox,
  selectedAlertId,
  onSelectAlert,
  isBroadcastingId,
  onRefreshFeed,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [selectedForModal, setSelectedForModal] = useState<ParsedAlert | null>(null);

  const toggleDiff = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDiffs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyCleanedText = (alert: ParsedAlert, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(alert.cleanedText);
    setCopiedId(alert.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = (format: 'json' | 'csv') => {
    setIsExporting(format);
    tacticalAudio.playCleanSound();
    window.location.href = `/api/radar/export?format=${format}`;
    setTimeout(() => setIsExporting(null), 1500);
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'BLOCKED') return alert.isPureSpam;
    if (filterType === 'CRITICAL') return alert.severity === 'CRITICAL';
    if (filterType === 'DRONE') return alert.threatType === 'DRONE';
    if (filterType === 'MISSILE') return alert.threatType === 'MISSILE' || alert.threatType === 'BALLISTIC';
    return alert.threatType === filterType;
  });

  const getThreatLabel = (type: ThreatType) => {
    switch (type) {
      case 'MISSILE':
        return 'Ракета';
      case 'BALLISTIC':
        return 'Баллистика';
      case 'DRONE':
        return 'БПЛА / Шахед';
      case 'AVIATION':
        return 'Авиация';
      case 'ARTILLERY':
        return 'Артобстрел';
      case 'AIR_RAID':
        return 'Воздушная тревога';
      case 'ALL_CLEAR':
        return 'Отбой';
      default:
        return 'Сводка';
    }
  };

  const getThreatColorClass = (type: ThreatType) => {
    if (type === 'MISSILE' || type === 'BALLISTIC') return 'text-rose-400';
    if (type === 'DRONE') return 'text-amber-400';
    if (type === 'ALL_CLEAR') return 'text-emerald-400';
    return 'text-slate-300';
  };

  const getCardBorderLeft = (alert: ParsedAlert) => {
    if (alert.isPureSpam) return 'border-l-2 border-l-rose-800/80';
    if (alert.threatType === 'MISSILE' || alert.threatType === 'BALLISTIC' || alert.severity === 'CRITICAL') {
      return 'border-l-2 border-l-rose-500';
    }
    if (alert.threatType === 'DRONE') return 'border-l-2 border-l-amber-500';
    if (alert.threatType === 'ALL_CLEAR') return 'border-l-2 border-l-emerald-500';
    return 'border-l-2 border-l-slate-700';
  };

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 flex flex-col space-y-4">
      {/* Top Feed Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-100">
              Лента сообщений
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              ({filteredAlerts.length})
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Перехваченные публикации, очищенные от ссылок, сборов и рекламы
          </p>
        </div>

        {/* Filter Bar & Export Actions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'ALL', label: 'Все' },
              { id: 'CRITICAL', label: 'Критические' },
              { id: 'DRONE', label: 'БПЛА' },
              { id: 'MISSILE', label: 'Ракеты' },
              { id: 'BLOCKED', label: 'Спам' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setFilterType(pill.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  filterType === pill.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExport('json')}
              disabled={isExporting !== null}
              className="px-2 py-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
              title="Экспорт в JSON"
            >
              {isExporting === 'json' ? '...' : 'JSON'}
            </button>

            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting !== null}
              className="px-2 py-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
              title="Экспорт в CSV"
            >
              {isExporting === 'csv' ? '...' : 'CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Alert Feed List */}
      <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
        {filteredAlerts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm border border-dashed border-slate-800/80 rounded-xl">
            Сообщений по выбранному фильтру не найдено
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isSelected = alert.id === selectedAlertId;
            const isDiffOpen = expandedDiffs[alert.id] || false;
            const isSending = isBroadcastingId === alert.id;

            return (
              <div
                key={alert.id}
                onClick={() => onSelectAlert(alert)}
                className={`group rounded-lg border transition-colors cursor-pointer p-4 ${getCardBorderLeft(alert)} ${
                  alert.isPureSpam
                    ? 'bg-slate-950/40 border-slate-800/80 opacity-70'
                    : isSelected
                    ? 'bg-slate-900 border-slate-700'
                    : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700/80'
                }`}
              >
                {/* Clean unboxed metadata header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs font-mono">
                  <div className="flex flex-wrap items-center gap-2 text-slate-400">
                    <span className="font-semibold text-slate-200">{alert.sourceChannel}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="tabular-nums">
                      {new Date(alert.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className={getThreatColorClass(alert.threatType)}>
                      {getThreatLabel(alert.threatType)}
                    </span>
                    {alert.regions.length > 0 && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-300">{alert.regions.join(', ')}</span>
                      </>
                    )}
                    {alert.vector && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-400">Курс: {alert.vector}</span>
                      </>
                    )}
                    {alert.originalTelegramMessageId && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-400">ID: #{alert.originalTelegramMessageId}</span>
                      </>
                    )}
                    {alert.processingTimeMs !== undefined && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-amber-400 font-medium inline-flex items-center gap-0.5" title="Время распознавания текста и рекламы движком">
                          <Zap className="w-3 h-3 text-amber-400" />
                          {alert.processingTimeMs} мс
                        </span>
                      </>
                    )}
                  </div>

                  {/* Clean status */}
                  <div className="text-xs">
                    {alert.isPureSpam ? (
                      <span className="text-rose-400 font-medium">Спам отклонен</span>
                    ) : alert.status === 'FORWARDED' ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> В канале TG
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        Очищено {alert.spamScore > 0 && `(-${alert.spamScore}%)`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content body */}
                {alert.isPureSpam ? (
                  <div className="p-3 bg-slate-900/50 rounded-md border border-slate-800/60 text-xs text-rose-300/90 font-mono">
                    <p className="italic line-clamp-2">
                      &quot;{alert.originalText}&quot;
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900/40 rounded-md border border-slate-800/60 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {alert.cleanedText}
                  </div>
                )}

                {/* Clean stripped elements note */}
                {alert.removedElements && alert.removedElements.length > 0 && (
                  <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                    <span>Удалено:</span>
                    <span className="text-slate-400">
                      {Array.from(new Set(alert.removedElements.map((e) =>
                        e.type === 'donation' ? 'сбор / карта' : e.type === 'url' ? 'ссылка' : e.type === 'clickbait' ? 'кликбейт' : 'реклама'
                      ))).join(', ')}
                    </span>
                  </div>
                )}

                {/* Expandable Before/After Diff */}
                {isDiffOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-2"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-medium block mb-1">
                          Исходный текст:
                        </span>
                        <p className="text-slate-400 whitespace-pre-wrap text-[11px] leading-relaxed">
                          {alert.originalText}
                        </p>
                      </div>
                      <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800">
                        <span className="text-[10px] text-emerald-400 uppercase font-medium block mb-1">
                          Очищенный результат:
                        </span>
                        <p className="text-slate-200 whitespace-pre-wrap text-[11px] leading-relaxed">
                          {alert.cleanedText || '(Отклонено)'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Actions Bottom Toolbar */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={(e) => toggleDiff(alert.id, e)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {isDiffOpen ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" /> Скрыть сравнение
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" /> Сравнить до/после
                      </>
                    )}
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={(e) => copyCleanedText(alert, e)}
                      className="px-2.5 py-1 text-xs rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Копировать текст"
                    >
                      {copiedId === alert.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Скопировано
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" /> Копировать
                        </>
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTestInSandbox(alert.originalText);
                      }}
                      className="px-2.5 py-1 text-xs rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Песочница</span>
                    </button>

                    {!alert.isPureSpam && (
                      <>
                        {/* Telegram Citation Modal Trigger Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedForModal(alert);
                          }}
                          className="px-3 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Переслать с блоком цитирования <blockquote>"
                        >
                          <Quote className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Цитата в TG</span>
                        </button>

                        {/* Quick Direct Broadcast Button */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await onBroadcast(alert.id);
                          }}
                          disabled={isSending}
                          className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                            alert.status === 'FORWARDED'
                              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSending ? 'Отправка...' : alert.status === 'FORWARDED' ? 'Повторить' : 'В канал'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Telegram Citation Broadcast Modal */}
      {selectedForModal && filterConfig && (
        <TelegramBroadcastModal
          alert={selectedForModal}
          filterConfig={filterConfig}
          targetChannelId={targetChannelId}
          hasBotToken={hasBotToken}
          onClose={() => setSelectedForModal(null)}
          onBroadcastSuccess={async () => {
            if (onRefreshFeed) {
              await onRefreshFeed();
            }
          }}
        />
      )}
    </div>
  );
};
