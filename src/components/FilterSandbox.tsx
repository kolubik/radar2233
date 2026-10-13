import React, { useState } from 'react';
import { tacticalAudio } from '../utils/audio.ts';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Send,
  Copy,
  Scissors,
  Layers,
  Flame,
  Shield,
  CreditCard,
  Link,
  MessageSquare,
  Zap,
  Gauge,
  Cpu,
} from 'lucide-react';

interface FilterSandboxProps {
  initialText?: string;
  onSendTestToBot: (cleanedText: string) => Promise<void>;
  hasTelegramBot: boolean;
}

export const FilterSandbox: React.FC<FilterSandboxProps> = ({
  initialText = '',
  onSendTestToBot,
  hasTelegramBot,
}) => {
  const [inputText, setInputText] = useState<string>(
    initialText ||
      `🚨 КИЕВ, ВАСИЛЬКОВ, БЕЛАЯ ЦЕРКОВЬ!\nГруппа вражеских дронов "Шахед-136" движется с юга курсом на Киевскую область!\nПримерное время подлета: 15-20 минут. Находитесь в укрытиях!\n\n👇👇👇 СРОЧНЫЙ СБОР НА ТЕПЛОВИЗОРЫ ДЛЯ ПВО 👇👇👇\nСсылка на монобанку: https://send.monobank.ua/jar/HelpAirDefense2026\nКарта Приват: 4149 4991 8823 1042\nUSDT TRC20: TL2j4pZ8qV1K4s9Yx7uJ9m\n\nШОК ВИДЕО ПЕРВЫХ СБИТИЙ В НАШЕМ ЗАКРЫТОМ VIP КАНАЛЕ:\n👉 t.me/kyiv_secret_defense_vip?join=1092\nПодпишись пока не заблокировали!`
  );

  const [isLoading, setIsLoading] = useState(false);
  const [fastMode, setFastMode] = useState(true);
  const [result, setResult] = useState<{
    cleanedText: string;
    threatType: string;
    severity: string;
    regions: string[];
    vector: string;
    removedElements: Array<{ type: string; content: string }>;
    isPureSpam: boolean;
    spamScore: number;
    processingTimeMs?: number;
    engineUsed?: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [isSendingToTg, setIsSendingToTg] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // Quick Preset Samples
  const presets = [
    {
      label: '🛸 Дроны + Монобанка + VIP канал',
      text: `🚨 КИЕВ, ВАСИЛЬКОВ, БЕЛАЯ ЦЕРКОВЬ!\nГруппа вражеских дронов "Шахед-136" движется с юга курсом на Киевскую область!\nПримерное время подлета: 15-20 минут. Находитесь в укрытиях!\n\n👇👇👇 СРОЧНЫЙ СБОР НА ТЕПЛОВИЗОРЫ ДЛЯ ПВО 👇👇👇\nСсылка на монобанку: https://send.monobank.ua/jar/HelpAirDefense2026\nКарта Приват: 4149 4991 8823 1042\nUSDT TRC20: TL2j4pZ8qV1K4s9Yx7uJ9m\n\nШОК ВИДЕО ПЕРВЫХ СБИТИЙ В НАШЕМ ЗАКРЫТОМ VIP КАНАЛЕ:\n👉 t.me/kyiv_secret_defense_vip?join=1092\nПодпишись пока не заблокировали!`,
    },
    {
      label: '🚀 Ракеты + Карта + Реклама крипты',
      text: `🔴 ХАРЬКОВ и ЧУГУЕВ! Срочно в укрытия!\nЗафиксированы пуски баллистики из Белгородской области! Подлетное время 1-2 минуты!\n\n💳 Сбор админу на генератор: 5375 4141 8892 0019\nСпонсор сводки — криптобиржа BitPro: забирай 50$ бонус по ссылке https://crypto-fast-bonus.io/signup\nПодписывайтесь на @kharkiv_alarm_backup!`,
    },
    {
      label: '✈️ Авиация + Реклама повербанков',
      text: `⚠️ ДНЕПР и ЗАПОРОЖЬЕ!\nВылет 4 бортов Ту-22М3 с аэродрома Шайковка. Вероятны пуски ракет Х-22 в направлении восточных и центральных областей.\n\nРеклама: Супер-скидка на зарядные станции EcoFlow! Успей купить за полцены на сайте www.ecopower-sale.shop/promo\nЖми ссылку прямо сейчас!`,
    },
    {
      label: '⛔ 100% Фейк-кликбейт (без угрозы)',
      text: `‼️ ВСЕМ СМОТРЕТЬ! СРОЧНОЕ ЗАЯВЛЕНИЕ ГЕНШТАБА!\nОпубликован полный список районов, где сегодня отключат тревоги навсегда!\n\nСмотри эксклюзив в закрепе 👉 https://t.me/fake_spy_news?start=alert99\nДонаты: 4441 2299 1100 8821`,
    },
  ];

  const handleTestFilter = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setSendSuccess(null);

    try {
      const res = await fetch('/api/filters/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          useAi: !fastMode,
          ultraFast: fastMode,
        }),
      });

      const data = await res.json();
      setResult(data);
      tacticalAudio.playCleanSound();
    } catch (err) {
      console.error('Test filter failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToTg = async () => {
    if (!result || !result.cleanedText) return;
    setIsSendingToTg(true);
    setSendSuccess(null);
    try {
      await onSendTestToBot(result.cleanedText);
      setSendSuccess('Сводка успешно отправлена в ваш Telegram канал!');
      tacticalAudio.playCleanSound();
    } catch (err: any) {
      setSendSuccess(`Ошибка отправки: ${err.message}`);
    } finally {
      setIsSendingToTg(false);
    }
  };

  const handleCopy = () => {
    if (!result?.cleanedText) return;
    navigator.clipboard.writeText(result.cleanedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 backdrop-blur-md shadow-2xl flex flex-col space-y-6">
      {/* Sandbox Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/70">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold font-mono tracking-wider text-slate-100 uppercase">
              ПЕСОЧНИЦА ФИЛЬТРАЦИИ И АНАЛИЗА СПАМА
            </h2>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-300" /> Сверхбыстрый движок (&lt; 2 мс)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Мгновенное распознавание и удаление рекламы, карт, ссылок и донатов со скоростью вплоть до доли миллисекунды
          </p>
        </div>

        {/* Engine Switch & Action Button */}
        <div className="flex items-center gap-3">
          {/* Mode Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setFastMode(true)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                fastMode
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Скорость 0.3-2 мс на компилированных регулярных выражениях"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Суперскорость (~1 мс)</span>
            </button>
            <button
              onClick={() => setFastMode(false)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                !fastMode
                  ? 'bg-purple-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Глубокий семантический анализ через нейросеть"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Gemini AI</span>
            </button>
          </div>

          <button
            onClick={handleTestFilter}
            disabled={isLoading || !inputText.trim()}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/40 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            {isLoading ? 'Очистка...' : 'Тест скорости'}
          </button>
        </div>
      </div>

      {/* Preset Quick-Buttons */}
      <div>
        <span className="text-xs font-mono text-slate-400 block mb-2 uppercase">
          БЫСТРЫЕ ШАБЛОНЫ ДЛЯ ПРОВЕРКИ ФИЛЬТРА:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(preset.text);
                setResult(null);
                setSendSuccess(null);
              }}
              className="px-3 py-2 text-left text-xs font-mono rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer truncate"
              title={preset.text}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Side-by-Side Playground */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Box: Raw / Dirty Input */}
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-rose-400 font-bold uppercase">
              <Scissors className="w-3.5 h-3.5" /> ВХОДЯЩИЙ ПОСТ (С РЕКЛАМОЙ И СПАМОМ)
            </span>
            <span>{inputText.length} симв.</span>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Вставьте сюда любой текст тревоги с рекламой, ссылками на монобанку, картами или донатами..."
            rows={11}
            className="w-full rounded-xl bg-slate-950/90 border border-slate-800 p-3.5 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all leading-relaxed resize-none"
          />

          <p className="text-[11px] text-slate-500 font-mono">
            💡 Алгоритм автоматически распознает 16-значные карты банков, Monobank-ссылки, USDT/BTC кошельки, кликбейт и каналы
          </p>
        </div>

        {/* Right Box: Cleaned & Extracted Output */}
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase">
              <Shield className="w-3.5 h-3.5" /> ЧИСТЫЙ РЕЗУЛЬТАТ ДЛЯ TELEGRAM
            </span>
            {result && (
              <div className="flex items-center gap-2">
                {result.processingTimeMs !== undefined && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold flex items-center gap-1 text-[11px]">
                    <Zap className="w-3 h-3 text-amber-400" />
                    {result.processingTimeMs} мс
                  </span>
                )}
                <span className="text-emerald-400 font-bold">
                  -{result.spamScore}% мусора
                </span>
              </div>
            )}
          </div>

          <div className="relative w-full h-[250px] rounded-xl bg-slate-950/90 border border-slate-800 p-3.5 text-xs font-mono overflow-y-auto flex flex-col justify-between">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3 text-slate-400">
                <Sparkles className="w-6 h-6 text-amber-400 animate-spin" />
                <span>Идет глубокая очистка и классификация угрозы...</span>
              </div>
            ) : !result ? (
              <div className="h-full flex flex-col items-center justify-center space-y-2 text-slate-500 text-center px-6">
                <Layers className="w-8 h-8 text-slate-600" />
                <p>Нажмите «Очистить и протестировать» для демонстрации работы фильтров</p>
              </div>
            ) : result.isPureSpam ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3 text-center p-4 bg-rose-950/20 rounded-lg border border-rose-900/30">
                <Ban className="w-10 h-10 text-rose-500 animate-bounce" />
                <div>
                  <h4 className="font-bold text-rose-400 text-sm">ПОЛНОСТЬЮ ЗАБЛОКИРОВАНО</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Сообщение идентифицировано как 100% спам/рекламный кликбейт без реальной угрозы безопасности. Такое сообщение не попадает в Telegram канал.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Threat Metadata Tag Row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                    {result.threatType}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                    {result.severity}
                  </span>
                  {result.regions && result.regions.map((reg, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      📍 {reg}
                    </span>
                  ))}
                  {result.vector && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 text-[10px]">
                      🧭 {result.vector}
                    </span>
                  )}
                </div>

                {/* Cleaned Text Body */}
                <p className="text-slate-100 font-sans text-sm whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                  {result.cleanedText}
                </p>
              </div>
            )}

            {/* Bottom Actions for Cleaned Output */}
            {result && !result.isPureSpam && (
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 mt-auto">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1 text-xs font-mono rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Скопировать
                    </>
                  )}
                </button>

                <button
                  onClick={handleSendToTg}
                  disabled={isSendingToTg}
                  className="px-3 py-1 text-xs font-mono font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-900/30 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSendingToTg ? 'Отправка...' : 'Отправить в Telegram'}
                </button>
              </div>
            )}
          </div>

          {sendSuccess && (
            <p className="text-xs font-mono text-emerald-400 bg-emerald-950/40 p-2 rounded-lg border border-emerald-900/40 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> {sendSuccess}
            </p>
          )}
        </div>
      </div>

      {/* Excised Junk Elements Inspection List */}
      {result && result.removedElements && result.removedElements.length > 0 && (
        <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1.5 uppercase">
              <Scissors className="w-4 h-4" /> ВЫРЕЗАННЫЕ ЭЛЕМЕНТЫ СПАМА ({result.removedElements.length}):
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Заблокировано алгоритмами безопасности
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {result.removedElements.map((el, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300"
              >
                {el.type === 'donation' ? (
                  <CreditCard className="w-4 h-4 text-rose-400 shrink-0" />
                ) : el.type === 'url' ? (
                  <Link className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Ban className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    {el.type === 'donation'
                      ? 'Донат / Банковская карта'
                      : el.type === 'url'
                      ? 'Внешняя ссылка'
                      : el.type === 'mention'
                      ? 'Упоминание канала'
                      : 'Кликбейт / Промо'}
                  </span>
                  <span className="text-rose-300 truncate block line-through decoration-rose-500/70">
                    {el.content}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
