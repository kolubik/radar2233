import { ErrorInfo, useState, useEffect, useCallback } from 'react';
import { ErrorTelemetryRecord, ThreatSeverity } from '../types.ts';

const MAX_STORED_ERRORS = 100;
const STORAGE_KEY = 'radartg_error_telemetry_logs';
const QUEUE_STORAGE_KEY = 'radartg_pending_error_queue';

type ErrorSubscriber = (error: ErrorTelemetryRecord) => void;

class ErrorLoggingService {
  private inMemoryErrors: ErrorTelemetryRecord[] = [];
  private subscribers: Set<ErrorSubscriber> = new Set();
  private isInitialized = false;
  private isFlushingQueue = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Загрузка сохраненных ошибок из localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.inMemoryErrors = parsed.slice(0, MAX_STORED_ERRORS);
        }
      }
    } catch (e) {
      console.warn('[RadarTG Error Telemetry] Не удалось прочитать локальный кэш ошибок:', e);
    }

    // Регистрация глобальных перехватчиков (один раз)
    if (!this.isInitialized) {
      this.isInitialized = true;

      window.addEventListener('error', (event) => {
        // Игнорируем сетевые сбои скриптов сторонних расширений браузера
        if (event.filename && event.filename.includes('chrome-extension')) return;

        this.logError(
          event.error || new Error(event.message || 'Глобальная ошибка скрипта'),
          null,
          {
            module: 'Window Global Unhandled',
            severity: 'CRITICAL',
            handled: false,
            metadata: {
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
            },
          }
        );
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const err = reason instanceof Error ? reason : new Error(String(reason || 'Необработанное отклонение Promise'));
        this.logError(err, null, {
          module: 'Window Async Promise',
          severity: 'HIGH',
          handled: false,
        });
      });

      // Попытка сбросить накопившуюся очередь оффлайн-ошибок на сервер
      setTimeout(() => this.flushPendingQueue(), 3000);
    }
  }

  /**
   * Централизованная регистрация ошибки
   */
  public logError(
    error: Error | string,
    errorInfo?: ErrorInfo | null,
    options?: {
      module?: string;
      severity?: ThreatSeverity;
      handled?: boolean;
      metadata?: Record<string, any>;
    }
  ): ErrorTelemetryRecord {
    const now = new Date();
    const actualError = typeof error === 'string' ? new Error(error) : error;

    const recordId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const record: ErrorTelemetryRecord = {
      id: recordId,
      timestamp: Date.now(),
      timeString: now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      name: actualError?.name || 'Error',
      message: actualError?.message || 'Неизвестное исключение',
      stack: actualError?.stack || undefined,
      componentStack: errorInfo?.componentStack?.trim() || undefined,
      module: options?.module || 'Корневой компонент',
      severity: options?.severity || 'HIGH',
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      metadata: options?.metadata,
      handled: options?.handled ?? true,
    };

    // 1. Форматированный консольный вывод для разработчиков и оператора
    this.printTacticalConsole(record);

    // 2. Добавление в память и локальное хранилище
    this.inMemoryErrors.unshift(record);
    if (this.inMemoryErrors.length > MAX_STORED_ERRORS) {
      this.inMemoryErrors = this.inMemoryErrors.slice(0, MAX_STORED_ERRORS);
    }
    this.persistToLocalStorage();

    // 3. Отправка на центральный сервер телеметрии / эндпоинт аналитики
    this.sendToServer(record);

    // 4. Оповещение подписчиков и компонентов UI
    this.notifySubscribers(record);

    // 5. Диспатч системного DOM события
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('radartg:error-logged', { detail: record }));
      } catch {}
    }

    return record;
  }

  /**
   * Стильный консольный вывод с тактической индикацией
   */
  private printTacticalConsole(record: ErrorTelemetryRecord) {
    if (typeof console === 'undefined') return;

    const badgeStyle = 'background: #881337; color: #fecdd3; font-weight: bold; padding: 2px 6px; border-radius: 4px;';
    const tagStyle = 'background: #1e293b; color: #38bdf8; font-weight: bold; padding: 2px 5px; border-radius: 3px;';
    const timeStyle = 'color: #94a3b8; font-family: monospace;';

    console.groupCollapsed(
      `%c[RadarTG Telemetry]%c [${record.module}]%c ${record.timeString} — ${record.name}: ${record.message}`,
      badgeStyle,
      tagStyle,
      timeStyle
    );
    console.error('ID инцидента:', record.id);
    console.error('Степень критичности:', record.severity);
    console.error('Обработано ErrorBoundary:', record.handled ? 'ДА' : 'НЕТ (Глобальный перехват)');
    if (record.stack) {
      console.groupCollapsed('Стек вызовов JavaScript:');
      console.error(record.stack);
      console.groupEnd();
    }
    if (record.componentStack) {
      console.groupCollapsed('Иерархия компонентов React:');
      console.warn(record.componentStack);
      console.groupEnd();
    }
    if (record.metadata) {
      console.log('Дополнительные метаданные:', record.metadata);
    }
    console.groupEnd();
  }

  /**
   * Отправка на центральный endpoint аналитики
   */
  private async sendToServer(record: ErrorTelemetryRecord) {
    if (typeof window === 'undefined') return;

    const payload = JSON.stringify(record);

    // Первоочередная попытка через fetch на /api/analytics/errors
    try {
      const response = await fetch('/api/analytics/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
        keepalive: true,
      });

      if (!response.ok) {
        // Если вернулся 404 (например, Netlify Functions rewrite не настроен), пробуем netlify endpoint
        if (response.status === 404) {
          await fetch('/.netlify/functions/analytics-errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          }).catch(() => {});
        } else {
          this.enqueueOfflineError(record);
        }
      }
    } catch {
      // Сетевая ошибка или оффлайн: помещаем в очередь отложенной отправки
      this.enqueueOfflineError(record);
    }
  }

  /**
   * Очередь для отправки при восстановлении связи
   */
  private enqueueOfflineError(record: ErrorTelemetryRecord) {
    try {
      const queueRaw = localStorage.getItem(QUEUE_STORAGE_KEY);
      const queue: ErrorTelemetryRecord[] = queueRaw ? JSON.parse(queueRaw) : [];
      queue.push(record);
      if (queue.length > 50) queue.shift();
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch {}
  }

  /**
   * Сброс накопившихся оффлайн-ошибок
   */
  public async flushPendingQueue() {
    if (this.isFlushingQueue || typeof window === 'undefined') return;
    this.isFlushingQueue = true;

    try {
      const queueRaw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (!queueRaw) return;

      const queue: ErrorTelemetryRecord[] = JSON.parse(queueRaw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const remaining: ErrorTelemetryRecord[] = [];

      for (const item of queue) {
        try {
          const res = await fetch('/api/analytics/errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
          if (!res.ok) {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
          break; // Соединение всё ещё недоступно
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(QUEUE_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[RadarTG Error Telemetry] Сбой сброса очереди телеметрии:', e);
    } finally {
      this.isFlushingQueue = false;
    }
  }

  private persistToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.inMemoryErrors));
    } catch (e) {
      console.warn('[RadarTG Error Telemetry] Не удалось сохранить ошибки в localStorage:', e);
    }
  }

  private notifySubscribers(record: ErrorTelemetryRecord) {
    for (const sub of this.subscribers) {
      try {
        sub(record);
      } catch (err) {
        console.error('[RadarTG Error Telemetry] Ошибка в подписчике телеметрии:', err);
      }
    }
  }

  /**
   * Подписка на новые зарегистрированные ошибки
   */
  public subscribe(listener: ErrorSubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /**
   * Получить список последних зафиксированных ошибок
   */
  public getErrors(): ErrorTelemetryRecord[] {
    return [...this.inMemoryErrors];
  }

  /**
   * Очистить журнал ошибок как локально, так и на сервере
   */
  public async clearErrors(): Promise<void> {
    this.inMemoryErrors = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    } catch {}

    // Уведомляем сервер
    try {
      await fetch('/api/analytics/errors/clear', { method: 'POST' });
    } catch {}

    // Оповещаем подписчиков пустым обновлением
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radartg:error-cleared'));
    }
  }

  /**
   * Экспорт журнала ошибок в JSON для отправки разработчикам
   */
  public exportErrorsAsJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalErrors: this.inMemoryErrors.length,
        system: {
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        },
        errors: this.inMemoryErrors,
      },
      null,
      2
    );
  }
}

// Экспортируем единственный экземпляр службы (Singleton)
export const errorLoggingService = new ErrorLoggingService();

/**
 * React-хук для работы с центральной системой логирования ошибок в компонентах
 */
export function useErrorLogger(defaultModule?: string) {
  const [recentErrors, setRecentErrors] = useState<ErrorTelemetryRecord[]>(() =>
    errorLoggingService.getErrors()
  );

  useEffect(() => {
    // Подписка на новые ошибки
    const unsubscribe = errorLoggingService.subscribe(() => {
      setRecentErrors(errorLoggingService.getErrors());
    });

    const handleClear = () => {
      setRecentErrors([]);
    };

    window.addEventListener('radartg:error-cleared', handleClear);

    return () => {
      unsubscribe();
      window.removeEventListener('radartg:error-cleared', handleClear);
    };
  }, []);

  const logError = useCallback(
    (
      error: Error | string,
      errorInfo?: ErrorInfo | null,
      options?: {
        module?: string;
        severity?: ThreatSeverity;
        metadata?: Record<string, any>;
        handled?: boolean;
      }
    ) => {
      return errorLoggingService.logError(error, errorInfo, {
        module: options?.module || defaultModule,
        ...options,
      });
    },
    [defaultModule]
  );

  const clearErrors = useCallback(async () => {
    await errorLoggingService.clearErrors();
    setRecentErrors([]);
  }, []);

  const exportErrors = useCallback(() => {
    return errorLoggingService.exportErrorsAsJson();
  }, []);

  return {
    recentErrors,
    errorCount: recentErrors.length,
    logError,
    clearErrors,
    exportErrors,
    getErrors: () => errorLoggingService.getErrors(),
  };
}
