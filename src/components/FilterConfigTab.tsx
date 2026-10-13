import React, { useState } from 'react';
import { FilterConfig } from '../types.ts';
import { tacticalAudio } from '../utils/audio.ts';
import {
  Sliders,
  Check,
  Plus,
  Trash2,
  Save,
  MessageSquare,
  Volume2,
  VolumeX,
  Bot,
  ShieldAlert,
  Sparkles,
  Link,
  CreditCard,
  Smile,
  AlertTriangle,
  Quote,
  Layers,
  Send,
  HelpCircle,
  Zap,
} from 'lucide-react';

interface FilterConfigTabProps {
  config: FilterConfig;
  onSaveConfig: (updated: Partial<FilterConfig>) => Promise<void>;
}

export const FilterConfigTab: React.FC<FilterConfigTabProps> = ({ config, onSaveConfig }) => {
  const [formConfig, setFormConfig] = useState<FilterConfig>({
    ...config,
    customKeywords: config.customKeywords || [],
    customRegexes: config.customRegexes || [],
    attachInlineButtons: config.attachInlineButtons ?? true,
    useTelegramBlockquote: config.useTelegramBlockquote ?? true,
    quoteHeaderTitle: config.quoteHeaderTitle || 'Розвідка України',
    defaultFollowupComment: config.defaultFollowupComment || 'Не фіксується',
    expandableQuote: config.expandableQuote ?? false,
    forwardingMode: config.forwardingMode || 'blockquote',
    ultraFastMode: config.ultraFastMode ?? true,
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [newRegex, setNewRegex] = useState('');
  const [regexError, setRegexError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activePreviewMode, setActivePreviewMode] = useState<'blockquote' | 'template'>('blockquote');

  const handleToggle = (key: keyof FilterConfig) => {
    setFormConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const kw = newKeyword.trim().toLowerCase();
    if (!formConfig.customKeywords.includes(kw)) {
      setFormConfig((prev) => ({
        ...prev,
        customKeywords: [...prev.customKeywords, kw],
      }));
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    setFormConfig((prev) => ({
      ...prev,
      customKeywords: prev.customKeywords.filter((k) => k !== kwToRemove),
    }));
  };

  const handleAddRegex = () => {
    if (!newRegex.trim()) return;
    setRegexError(null);
    try {
      new RegExp(newRegex.trim(), 'gi');
      if (!formConfig.customRegexes.includes(newRegex.trim())) {
        setFormConfig((prev) => ({
          ...prev,
          customRegexes: [...prev.customRegexes, newRegex.trim()],
        }));
      }
      setNewRegex('');
    } catch (err: any) {
      setRegexError(`Ошибка в синтаксисе регулярного выражения: ${err.message}`);
    }
  };

  const handleRemoveRegex = (regexToRemove: string) => {
    setFormConfig((prev) => ({
      ...prev,
      customRegexes: prev.customRegexes.filter((r) => r !== regexToRemove),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await onSaveConfig(formConfig);
      tacticalAudio.playCleanSound();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Preview generated text based on template
  const previewTemplateText = formConfig.alertTemplate
    .replace('{TYPE_EMOJI}', '🚀')
    .replace('{TYPE}', 'Крылатая ракета')
    .replace('{REGIONS}', 'Киевская область, Васильков')
    .replace('{VECTOR}', 'Юг -> Север, курс на Васильков')
    .replace('{SEVERITY}', 'CRITICAL')
    .replace('{TEXT}', 'Зафиксирована ракета на низкой высоте. Находитесь в укрытиях!');

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-100">
              Настройки фильтров и шаблонов
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Правила очистки от спама, режим цитирования Telegram (Blockquote) и шаблон публикации
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-medium text-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" /> Сохранено!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
            </>
          )}
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Filter Toggles & Severity */}
        <div className="lg:col-span-7 space-y-5">
          <h3 className="text-xs font-medium text-slate-300">
            Правила очистки текста и режим пересылки:
          </h3>

          <div className="space-y-3">
            {[
              {
                id: 'ultraFastMode',
                title: '⚡ Сверхбыстрое распознавание (< 2 мс)',
                desc: 'Компилированный RegEx-движок: мгновенно вырезает рекламу, карты, монобанки и ссылки за 0.5–2 миллисекунды без задержек сети',
                icon: Zap,
                color: 'text-amber-300',
              },
              {
                id: 'useTelegramBlockquote',
                title: 'Цитирование Telegram Blockquote (как на фото)',
                desc: 'Пересылает сообщение с аутентичной вертикальной плашкой цитаты <blockquote>, заголовком канала и статусом',
                icon: Quote,
                color: 'text-cyan-400',
              },
              {
                id: 'expandableQuote',
                title: 'Сворачиваемая цитата (<blockquote expandable>)',
                desc: 'Позволяет Telegram-клиентам компактно сворачивать длинные тексты тревог с кнопкой «Развернуть»',
                icon: Layers,
                color: 'text-indigo-400',
              },
              {
                id: 'removeUrls',
                title: 'Вырезать внешние ссылки',
                desc: 'Удаляет http://, https://, ссылки t.me, короткие URL и реферальные ссылки',
                icon: Link,
                color: 'text-amber-400',
              },
              {
                id: 'removeMentions',
                title: 'Вырезать упоминания @каналов',
                desc: 'Удаляет @username_канала и промо-ссылки на сторонние паблики',
                icon: MessageSquare,
                color: 'text-blue-400',
              },
              {
                id: 'removeDonations',
                title: 'Блокировать сборы, карты и Monobank',
                desc: 'Вырезает 16-значные номера банковских карт, ссылки send.monobank.ua, криптокошельки (USDT, BTC) и фразы сборов',
                icon: CreditCard,
                color: 'text-rose-400',
              },
              {
                id: 'removeClickbait',
                title: 'Вырезать кликбейт и шок-заголовки',
                desc: 'Удаляет "ШОК ВИДЕО", "ЖМИ СЮДА", "ВСЕ ПОДРОБНОСТИ В КАНАЛЕ", "УСПЕЙ ПОСМОТРЕТЬ", "РЕЗЕРВНЫЙ КАНАЛ"',
                icon: AlertTriangle,
                color: 'text-amber-400',
              },
              {
                id: 'removeExcessiveEmojis',
                title: 'Очищать спам-эмодзи и восклицания',
                desc: 'Сжимает бесконечные ряды 👇👇👇, ‼️‼️‼️, 🔥🔥🔥 до нормального читаемого текста',
                icon: Smile,
                color: 'text-emerald-400',
              },
              {
                id: 'useAiSanitizer',
                title: 'AI Санитайзер (Gemini 3.8 Flash)',
                desc: 'Глубокий анализ контекста: оставляет только боевую суть (тип угрозы, вектор, сектор) и уничтожает мусор',
                icon: Sparkles,
                color: 'text-purple-400',
              },
              {
                id: 'attachInlineButtons',
                title: 'Инлайн-кнопки в Telegram сообщениях',
                desc: 'Прикреплять интерактивные инлайн-кнопки проверки сводки, быстрой подписки и перехода в целевой канал',
                icon: Bot,
                color: 'text-blue-400',
              },
              {
                id: 'autoForward',
                title: 'Автоматическая ретрансляция в Telegram',
                desc: 'Мгновенно публиковать очищенные сообщения в подключенный канал без ручного подтверждения',
                icon: Send,
                color: 'text-emerald-400',
              },
              {
                id: 'soundAlerts',
                title: 'Звуковые оповещения радара',
                desc: 'Воспроизводить тактический аудио-сигнал при обнаружении воздушных угроз',
                icon: formConfig.soundAlerts ? Volume2 : VolumeX,
                color: 'text-emerald-400',
              },
            ].map((rule) => {
              const Icon = rule.icon;
              const isChecked = Boolean(formConfig[rule.id as keyof FilterConfig]);

              return (
                <div
                  key={rule.id}
                  onClick={() => handleToggle(rule.id as keyof FilterConfig)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isChecked
                      ? 'bg-slate-950/80 border-slate-700/80 hover:border-emerald-500/60'
                      : 'bg-slate-950/30 border-slate-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800 ${rule.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-bold text-slate-200">
                        {rule.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {rule.desc}
                      </p>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <div
                    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 mt-1 ${
                      isChecked ? 'bg-emerald-600' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.75 ${
                        isChecked ? 'translate-x-5.5' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Forwarding Method Selector */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
              ОСНОВНОЙ МЕТОД TELEGRAM BOT API:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {[
                { id: 'blockquote', label: '🌟 Цитата (Blockquote)' },
                { id: 'template', label: '📋 Тактический радар' },
                { id: 'copy', label: '📑 copyMessage API' },
                { id: 'forward', label: '🔁 forwardMessage API' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFormConfig((prev) => ({ ...prev, forwardingMode: m.id as any }))}
                  className={`px-3 py-2 rounded-lg transition-all cursor-pointer text-center ${
                    formConfig.forwardingMode === m.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Threshold */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
              ПОРОГ ВАЖНОСТИ ДЛЯ АВТО-ПЕРЕСЫЛКИ В КАНАЛ:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {[
                { id: 'ALL', label: 'Все сводки' },
                { id: 'MEDIUM', label: 'Средний +' },
                { id: 'HIGH', label: 'Высокий +' },
                { id: 'CRITICAL', label: 'Только КРИТИЧ.' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setFormConfig((prev) => ({ ...prev, minSeverity: lvl.id as any }))}
                  className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                    formConfig.minSeverity === lvl.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Keywords Blacklist */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
              ПОЛЬЗОВАТЕЛЬСКИЙ ЧЕРНЫЙ СПИСОК СТОП-СЛОВ:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                placeholder="Добавить стоп-слово или фразу (нажмите Enter)..."
                className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handleAddKeyword}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Добавить
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {formConfig.customKeywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 text-rose-300 border border-rose-900/50 text-xs font-mono flex items-center gap-1.5"
                >
                  {kw}
                  <button
                    onClick={() => handleRemoveKeyword(kw)}
                    className="hover:text-white cursor-pointer text-slate-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Custom Regular Expressions (RegEx) Section */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-slate-300 uppercase block">
                РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ ДЛЯ ГЛУБОКОЙ ФИЛЬТРАЦИИ (REGEX):
              </label>
              <span className="text-[10px] text-slate-500 font-mono">JavaScript RegExp</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newRegex}
                onChange={(e) => {
                  setNewRegex(e.target.value);
                  setRegexError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRegex()}
                placeholder="Например: (?:https?:\/\/t\.me\/\+[a-zA-Z0-9_]+)..."
                className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={handleAddRegex}
                className="px-4 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 font-mono text-xs font-bold border border-purple-700/50 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Добавить RegEx
              </button>
            </div>

            {regexError && (
              <p className="text-xs font-mono text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-900/50">
                {regexError}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5 pt-1">
              {formConfig.customRegexes && formConfig.customRegexes.map((regStr, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 text-purple-300 border border-purple-900/50 text-xs font-mono flex items-center gap-1.5"
                >
                  <code className="text-[11px]">{regStr}</code>
                  <button
                    onClick={() => handleRemoveRegex(regStr)}
                    className="hover:text-white cursor-pointer text-slate-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Citation Customization & Live Telegram Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3">
            <div className="flex items-center gap-2">
              <Quote className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                ПАРАМЕТРЫ ЦИТИРОВАНИЯ В TELEGRAM:
              </h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400 block">
                Заголовок канала над цитатой:
              </label>
              <input
                type="text"
                value={formConfig.quoteHeaderTitle}
                onChange={(e) => setFormConfig((prev) => ({ ...prev, quoteHeaderTitle: e.target.value }))}
                placeholder="Розвідка України"
                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400 block">
                Комментарий под цитатой по умолчанию:
              </label>
              <input
                type="text"
                value={formConfig.defaultFollowupComment}
                onChange={(e) => setFormConfig((prev) => ({ ...prev, defaultFollowupComment: e.target.value }))}
                placeholder="Не фіксується"
                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {['Не фіксується', '⚠️ Увага, в укриття!', 'Курс на Васильків', '🟢 Чисто / Відбій', 'Локаційно втрачено'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormConfig((prev) => ({ ...prev, defaultFollowupComment: p }))}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Format Switcher */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-mono text-slate-300 uppercase font-bold">
              ПРЕДПРОСМОТР В TELEGRAM:
            </span>
            <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setActivePreviewMode('blockquote')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activePreviewMode === 'blockquote'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Цитата (Blockquote)
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewMode('template')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activePreviewMode === 'template'
                    ? 'bg-emerald-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Карточка Радара
              </button>
            </div>
          </div>

          {/* Telegram Bubble Live Preview (Authentic UI) */}
          <div className="bg-[#182533] rounded-2xl p-4 border border-[#243447] text-white shadow-2xl max-w-sm">
            {/* Header info */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2b3e55]">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white font-sans">
                {formConfig.quoteHeaderTitle || 'RadarTG Bot'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono ml-auto">
                {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Bubble Content: Mode 1: Blockquote citation */}
            {activePreviewMode === 'blockquote' ? (
              <div className="space-y-2.5 text-xs font-sans text-slate-100">
                <div className="font-bold text-[13px] text-white tracking-wide">
                  {formConfig.quoteHeaderTitle || 'Розвідка України'}
                </div>

                {/* Authentic Telegram blockquote styled bar */}
                <div className="border-l-3 border-[#50a8eb] pl-3 py-1.5 bg-[#202f42]/70 rounded-r-lg space-y-1">
                  <div className="text-[11px] font-bold text-[#64b5f6] flex items-center gap-1">
                    📢 @kyiv_alerts_oper
                  </div>
                  <div className="text-[11px] leading-relaxed text-slate-200">
                    🚨 КИЕВ и ОБЛАСТЬ! Внимание!
                    <br />
                    Группа БПЛА &quot;Shahed-136&quot; движется курсом на Белую Церковь / Васильков! Скорость ~185 км/ч.
                  </div>
                </div>

                {/* Commentary */}
                {formConfig.defaultFollowupComment && (
                  <div className="text-xs text-slate-100 font-medium pt-0.5">
                    {formConfig.defaultFollowupComment}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs font-sans whitespace-pre-wrap leading-relaxed text-slate-100">
                {previewTemplateText}
              </div>
            )}

            {/* Inline Buttons Mock in Preview */}
            {formConfig.attachInlineButtons && (
              <div className="mt-3 pt-2 border-t border-[#2b3e55] space-y-1.5">
                <div className="w-full py-1.5 px-2 rounded-lg bg-[#243447] hover:bg-[#2e425a] text-center text-[11px] font-sans font-medium text-emerald-400 border border-[#344860]">
                  🛡️ Проверено фильтром (-65% спама)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="py-1 px-2 rounded-lg bg-[#243447] text-center text-[10px] font-sans text-slate-300 border border-[#344860]">
                    📢 Целевой канал
                  </div>
                  <div className="py-1 px-2 rounded-lg bg-[#243447] text-center text-[10px] font-sans text-emerald-300 border border-[#344860]">
                    🔔 Подписка на радар
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Template text raw editor (collapsed or accessible for template mode) */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-bold block">
              Текстовый шаблон для режима карточки:
            </span>
            <textarea
              value={formConfig.alertTemplate}
              onChange={(e) => setFormConfig((prev) => ({ ...prev, alertTemplate: e.target.value }))}
              rows={4}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

