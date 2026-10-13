import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Terminal,
  ShieldAlert,
  Home,
  FileCode,
} from 'lucide-react';
import { tacticalAudio } from '../utils/audio.ts';

interface ErrorBoundaryProps {
  children: ReactNode;
  moduleName?: string;
  fallbackTitle?: string;
  isRoot?: boolean;
  onReset?: () => void;
  onNavigateHome?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
  errorTimestamp: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false,
    errorTimestamp: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorTimestamp: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Воспроизводим звуковое предупреждение радара при сбое
    try {
      tacticalAudio.playThreatAlarm('HIGH');
    } catch {
      // Игнорируем ограничения автовоспроизведения звука браузером
    }

    console.error('[RadarTG ErrorBoundary] Перехвачено исключение в компоненте:', {
      module: this.props.moduleName || 'Неизвестный модуль',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReset = () => {
    try {
      tacticalAudio.playCleanSound();
    } catch {}

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReloadPage = () => {
    window.location.reload();
  };

  private handleNavigateHome = () => {
    this.handleReset();
    if (this.props.onNavigateHome) {
      this.props.onNavigateHome();
    }
  };

  private handleCopyDiagnostic = () => {
    const { error, errorInfo, errorTimestamp } = this.state;
    const { moduleName } = this.props;

    const diagnosticReport = [
      `=== ОТЧЕТ ОБ ОШИБКЕ RADARTG ERROR BOUNDARY ===`,
      `Время фиксации: ${new Date().toISOString()} (${errorTimestamp || 'Н/Д'})`,
      `Модуль: ${moduleName || 'Корневой компонент UI'}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      ``,
      `--- СООБЩЕНИЕ ОБ ОШИБКЕ ---`,
      error ? `${error.name}: ${error.message}` : 'Неизвестная ошибка',
      ``,
      `--- СТЕК ВЫЗОВОВ (ERROR STACK) ---`,
      error?.stack || 'Стек недоступен',
      ``,
      `--- ИЕРАРХИЯ КОМПОНЕНТОВ (COMPONENT STACK) ---`,
      errorInfo?.componentStack || 'Стек компонентов недоступен',
    ].join('\n');

    try {
      navigator.clipboard.writeText(diagnosticReport);
      tacticalAudio.playCleanSound();
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch (err) {
      console.warn('Не удалось скопировать в буфер:', err);
    }
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    const { hasError, error, errorInfo, showDetails, copied, errorTimestamp } = this.state;
    const { children, moduleName, fallbackTitle, isRoot, onNavigateHome } = this.props;

    if (!hasError) {
      return children;
    }

    return (
      <div className={`w-full flex items-center justify-center p-4 sm:p-6 ${isRoot ? 'min-h-screen bg-slate-950' : 'min-h-[420px]'}`}>
        <div className="w-full max-w-3xl bg-slate-900/90 border border-rose-500/40 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-rose-950/20 relative overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
          {/* Верхняя неоновая полоса предупреждения */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 animate-pulse" />

          {/* Заголовок панели с бейджами и индикатором сбоя */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800/80">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mt-0.5 relative shadow-inner">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-950 animate-ping" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-rose-950/80 text-rose-300 border border-rose-700/60">
                    СИСТЕМНЫЙ СБОЙ • FAULT_TRAPPED
                  </span>
                  {moduleName && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 bg-slate-800/80 border border-slate-700/60">
                      МОДУЛЬ: {moduleName}
                    </span>
                  )}
                  {errorTimestamp && (
                    <span className="text-[11px] font-mono text-slate-400 ml-auto">
                      {errorTimestamp}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {fallbackTitle || 'Аварийный перехват ошибки интерфейса'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Предохранитель Error Boundary изолировал сбой компонента и защитил приложение от полного падения.
                </p>
              </div>
            </div>
          </div>

          {/* Содержимое ошибки */}
          <div className="my-5 space-y-3">
            <div className="bg-slate-950/80 border border-rose-900/40 rounded-xl p-3.5 relative overflow-hidden group">
              <div className="flex items-center justify-between text-xs text-rose-400 font-mono font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Исключение:</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {error?.name || 'Error'}
                </span>
              </div>
              <div className="font-mono text-xs text-rose-200/90 break-words leading-relaxed select-all">
                {error?.message || 'Неизвестная ошибка рендеринга компонента'}
              </div>
            </div>

            {/* Раскрывающийся стек вызовов для разработчиков */}
            <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40">
              <button
                onClick={this.toggleDetails}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Диагностический стек вызовов (Component Trace)</span>
                </span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showDetails && (
                <div className="p-3 border-t border-slate-800/80 space-y-2 bg-slate-950">
                  {error?.stack && (
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                        <FileCode className="w-3 h-3" />
                        <span>JavaScript Stack:</span>
                      </div>
                      <pre className="text-[11px] font-mono text-slate-400 bg-slate-900/80 p-2.5 rounded-lg overflow-x-auto max-h-40 leading-snug whitespace-pre-wrap select-all">
                        {error.stack}
                      </pre>
                    </div>
                  )}

                  {errorInfo?.componentStack && (
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                        <Terminal className="w-3 h-3" />
                        <span>React Component Hierarchy:</span>
                      </div>
                      <pre className="text-[11px] font-mono text-emerald-400/80 bg-slate-900/80 p-2.5 rounded-lg overflow-x-auto max-h-36 leading-snug whitespace-pre-wrap select-all">
                        {errorInfo.componentStack.trim()}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Панель тактических действий */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Кнопка 1: Сброс и перезапуск модуля */}
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-md shadow-emerald-950/40 active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Сбросить и восстановить модуль</span>
              </button>

              {/* Кнопка 2: Переход в ленту радара (если доступно) */}
              {onNavigateHome && (
                <button
                  onClick={this.handleNavigateHome}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium cursor-pointer transition-colors border border-slate-700"
                >
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  <span>В главное меню</span>
                </button>
              )}

              {/* Кнопка 3: Полная перезагрузка страницы */}
              <button
                onClick={this.handleReloadPage}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer transition-colors border border-slate-800"
                title="Перезагрузить страницу приложения"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Обновить страницу</span>
              </button>
            </div>

            {/* Кнопка 4: Копирование отчета */}
            <button
              onClick={this.handleCopyDiagnostic}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                copied
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Отчет скопирован!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Скопировать лог ошибки</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
