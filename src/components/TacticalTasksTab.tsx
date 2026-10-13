import React, { useState, useEffect } from 'react';
import { TacticalTask, TaskExecutionLog, ThreatType, ThreatColorLevel } from '../types.ts';
import { tacticalAudio } from '../utils/audio.ts';
import {
  Crosshair,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Search,
  Compass,
  Send,
  Sparkles,
  RefreshCw,
  Clock,
  ShieldAlert,
  ArrowRight,
  Bot,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TacticalTasksTabProps {
  onNotify?: (message: string, isError?: boolean) => void;
  onRefreshFeed?: () => Promise<void>;
  hasBotToken?: boolean;
}

export const TacticalTasksTab: React.FC<TacticalTasksTabProps> = ({
  onNotify,
  onRefreshFeed,
  hasBotToken = false,
}) => {
  const [tasks, setTasks] = useState<TacticalTask[]>([]);
  const [logs, setLogs] = useState<TaskExecutionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testingTaskId, setTestingTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // New task form state
  const [formName, setFormName] = useState('');
  const [formRegion, setFormRegion] = useState('Хмельницкая');
  const [formThreatType, setFormThreatType] = useState<ThreatType | 'ANY'>('AIR_RAID');
  const [formSearchCause, setFormSearchCause] = useState(true);
  const [formTrackRoute, setFormTrackRoute] = useState(true);
  const [formAutoPublish, setFormAutoPublish] = useState(false);

  const popularRegions = [
    'Хмельницкая',
    'Киевская',
    'Одесская',
    'Винницкая',
    'Харьковская',
    'Днепропетровская',
    'Запорожская',
    'Полтавская',
    'Житомирская',
  ];

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
      if (data.logs) setLogs(data.logs);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggleTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
        tacticalAudio.playRadarBlip();
        if (onNotify) {
          onNotify(data.task.enabled ? `Сценарий "${data.task.name}" активирован` : `Сценарий "${data.task.name}" приостановлен`);
        }
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        tacticalAudio.playCleanSound();
        if (onNotify) onNotify('Тактическая задача удалена');
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRegion.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName || `Мониторинг причин тревог: ${formRegion}`,
          targetRegion: formRegion.trim(),
          triggerThreatType: formThreatType,
          searchCauseInChannels: formSearchCause,
          trackRouteAndSeverity: formTrackRoute,
          autoPublishTelegram: formAutoPublish,
        }),
      });

      const data = await res.json();
      if (data.success && data.task) {
        setTasks((prev) => [data.task, ...prev]);
        setIsCreateModalOpen(false);
        setFormName('');
        tacticalAudio.playCleanSound();
        if (onNotify) onNotify(`Создана задача: ${data.task.name}`);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleRunTest = async (task: TacticalTask) => {
    setTestingTaskId(task.id);
    try {
      tacticalAudio.playThreatAlarm('HIGH');
      const res = await fetch(`/api/tasks/test-run/${task.id}`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка тестового запуска');
      }

      await fetchTasks();
      if (onRefreshFeed) {
        await onRefreshFeed();
      }

      if (onNotify) {
        onNotify(`Сценарий [${task.targetRegion}] выполнен: ${data.alert?.threatCause || 'Причина сопоставлена'}`);
      }
    } catch (err: any) {
      if (onNotify) onNotify(`Ошибка теста: ${err.message}`, true);
    } finally {
      setTestingTaskId(null);
    }
  };

  const getColorLevelBadge = (level: ThreatColorLevel) => {
    switch (level) {
      case 'RED':
        return (
          <span className="text-xs font-mono font-medium text-rose-400 flex items-center gap-1">
            🔴 Критический (в секторе области)
          </span>
        );
      case 'ORANGE':
        return (
          <span className="text-xs font-mono font-medium text-amber-400 flex items-center gap-1">
            🟠 Высокий (подлет 10-20 мин)
          </span>
        );
      case 'YELLOW':
        return (
          <span className="text-xs font-mono font-medium text-yellow-400 flex items-center gap-1">
            🟡 Повышенный (смежная область)
          </span>
        );
      case 'GREEN':
      default:
        return (
          <span className="text-xs font-mono font-medium text-emerald-400 flex items-center gap-1">
            🟢 Умеренный (&gt;150 км)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Overview */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Сценарии и тактические задачи
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Поиск первопричины тревог в смежных каналах, отслеживание маршрута БПЛА и оценка уровня угрозы
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTasks}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Обновить задачи"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Создать задачу
            </button>
          </div>
        </div>

        {/* Tactical Scenario Quick-Presets Banner */}
        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              Готовые сценарии реагирования:
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-2">
              <div>
                <span className="font-semibold text-slate-200 block font-sans">
                  Хмельницкая область (Староконстантинов)
                </span>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans">
                  При тревоге сканирует Винницкие и Житомирские каналы, вычисляет траекторию через Бар/Деражню и определяет степень угрозы.
                </p>
              </div>
              <button
                onClick={() => {
                  const t = tasks.find((item) => item.targetRegion.toLowerCase().includes('хмельниц'));
                  if (t) handleRunTest(t);
                }}
                disabled={Boolean(testingTaskId)}
                className="mt-1 w-full py-1 px-2.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                {testingTaskId === 'task-khmelnytskyi-radar' ? 'Тестирование...' : 'Запустить сценарий'}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-2">
              <div>
                <span className="font-semibold text-slate-200 block font-sans">
                  Киев и область (Васильков/Бровары)
                </span>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans">
                  Ищет первопричину пусков в Черниговских и Сумских каналах, отслеживает курс через Белую Церковь.
                </p>
              </div>
              <button
                onClick={() => {
                  const t = tasks.find((item) => item.targetRegion.toLowerCase().includes('киев'));
                  if (t) handleRunTest(t);
                }}
                disabled={Boolean(testingTaskId)}
                className="mt-1 w-full py-1 px-2.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                Запустить сценарий
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-2">
              <div>
                <span className="font-semibold text-slate-200 block font-sans">
                  Одесса & Черноморск (Пуски с моря)
                </span>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans">
                  Анализирует пуски БПЛА с морского направления через Затоку/Маяки с градацией опасности.
                </p>
              </div>
              <button
                onClick={() => {
                  const t = tasks.find((item) => item.targetRegion.toLowerCase().includes('одесс'));
                  if (t) handleRunTest(t);
                }}
                disabled={Boolean(testingTaskId)}
                className="mt-1 w-full py-1 px-2.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3 text-emerald-400" />
                Запустить сценарий
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Tasks Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            АКТИВНЫЕ ТАКТИЧЕСКИЕ ПРАВИЛА И ЗАДАЧИ ({tasks.length}):
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Выполняются в фоновом режиме при поступлении тревог
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-2xl border p-5 transition-all space-y-4 ${
                task.enabled
                  ? 'bg-slate-900/90 border-cyan-800/50 shadow-xl'
                  : 'bg-slate-950/40 border-slate-800/60 opacity-60'
              }`}
            >
              {/* Task Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                      📍 {task.targetRegion}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      🚨 {task.triggerThreatType}
                    </span>
                    {task.autoPublishTelegram && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        🤖 Авто-TG
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold font-sans text-white">
                    {task.name}
                  </h4>
                </div>

                {/* Enabled Toggle Switch */}
                <div
                  onClick={() => handleToggleTask(task.id)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                    task.enabled ? 'bg-cyan-600' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      task.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>

              {/* Task Capabilities Indicators */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                  <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Поиск первопричины</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                  <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Маршрут БПЛА (🟢➔🔴)</span>
                </div>
              </div>

              {/* Last Discovered Threat & Level Readout */}
              {task.lastFoundCause && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">
                      ПОСЛЕДНЯЯ НАЙДЕННАЯ ПРИЧИНА:
                    </span>
                    {task.lastAssignedLevel && getColorLevelBadge(task.lastAssignedLevel)}
                  </div>
                  <p className="text-slate-200 text-[11px] leading-relaxed">
                    {task.lastFoundCause}
                  </p>
                </div>
              )}

              {/* Bottom stats and action bar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs font-mono">
                <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                  <span>Сработало: <b className="text-white">{task.triggerCount}</b></span>
                  {task.lastTriggeredAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(task.lastTriggeredAt).toLocaleTimeString('ru-RU')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunTest(task)}
                    disabled={testingTaskId === task.id}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-700/60 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {testingTaskId === task.id ? 'Анализ...' : 'Тест'}
                  </button>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-900/50 cursor-pointer transition-colors"
                    title="Удалить задачу"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution Logs & Generated Posts */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 backdrop-blur-md shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              ЖУРНАЛ СРАБАТЫВАНИЯ СЦЕНАРИЕВ И СГЕНЕРИРОВАННЫХ ПОСТОВ ({logs.length}):
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Автоматическая корреляция
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl">
            Сценарии еще не срабатывали. Нажмите кнопку «Тест» на карточке задачи выше, чтобы проверить работу поиска причины!
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3 text-xs font-mono"
                >
                  {/* Log Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold">
                        {log.targetRegion}
                      </span>
                      <span className="text-slate-400 font-sans font-semibold">
                        {log.taskName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {getColorLevelBadge(log.threatLevel)}
                      <span className="text-[11px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString('ru-RU')}
                      </span>
                    </div>
                  </div>

                  {/* Discovered Cause & Trajectory Row */}
                  <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <div className="flex items-start gap-2">
                      <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-slate-200">
                        <b className="text-cyan-300">Причина тревоги:</b> {log.foundCause}
                      </span>
                    </div>

                    <div className="flex items-start gap-2 pt-1 border-t border-slate-800/50">
                      <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-slate-200">
                        <b className="text-amber-300">Маршрут БПЛА:</b> {log.routePath}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Generated Post Preview */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" /> Скрыть пост Telegram
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" /> Показать сгенерированный пост с цитатой
                        </>
                      )}
                    </button>

                    {log.publishedToTelegram && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Опубликовано в TG {log.telegramMessageId ? `(#${log.telegramMessageId})` : ''}
                      </span>
                    )}
                  </div>

                  {/* Expanded Telegram Blockquote Preview */}
                  {isExpanded && (
                    <div className="p-3 rounded-xl bg-[#182533] border border-[#243447] text-white shadow-xl space-y-2 animate-fadeIn">
                      <div className="text-[10px] text-slate-400 font-sans border-b border-[#2b3e55] pb-1 flex items-center gap-1">
                        <Bot className="w-3 h-3 text-cyan-400" />
                        Предпросмотр сообщения для Telegram канала (Blockquote цитирование):
                      </div>
                      <div
                        className="text-xs font-sans whitespace-pre-wrap leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: log.generatedTelegramPost
                            .replace(/\n/g, '<br/>')
                            .replace(/<blockquote>/g, '<div class="border-l-3 border-[#50a8eb] pl-3 py-1 my-1 bg-[#202f42]/70 rounded-r-lg">')
                            .replace(/<\/blockquote>/g, '</div>'),
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create Task Dialog */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold font-mono uppercase text-white">
                  Новая тактическая задача
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
                  Название задачи:
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Например: Хмельницкая: Поиск причины и маршрута Шахедов"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
                  Целевой регион / область:
                </label>
                <input
                  type="text"
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                  placeholder="Хмельницкая область"
                  required
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {popularRegions.map((reg) => (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setFormRegion(reg)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        formRegion === reg
                          ? 'bg-cyan-900/50 text-cyan-300 border-cyan-700'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                      }`}
                    >
                      {reg}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
                  Тип триггера:
                </label>
                <select
                  value={formThreatType}
                  onChange={(e) => setFormThreatType(e.target.value as any)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="AIR_RAID">🚨 Объявление воздушной тревоги (AIR_RAID)</option>
                  <option value="DRONE">🛸 Ударный БПЛА / Шахед (DRONE)</option>
                  <option value="MISSILE">🚀 Крылатая ракета (MISSILE)</option>
                  <option value="BALLISTIC">☄️ Баллистическая угроза (BALLISTIC)</option>
                  <option value="ANY">⚠️ Любая угроза (ANY)</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSearchCause}
                    onChange={(e) => setFormSearchCause(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span>Искать первопричину по соседним каналам и чатам</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formTrackRoute}
                    onChange={(e) => setFormTrackRoute(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span>Рассчитывать маршрут движения БПЛА и шкалу опасности (🟢➔🔴)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoPublish}
                    onChange={(e) => setFormAutoPublish(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span>Автоматически публиковать обогащенный пост в Telegram</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-900/40"
                >
                  <Plus className="w-4 h-4" /> Создать задачу
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
