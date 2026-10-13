import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Terminal,
  FileCode,
  Copy,
  Check,
  RotateCcw,
  X,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { tacticalAudio } from '../utils/audio.ts';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatabaseImported: () => Promise<void>;
}

interface DatabaseStatus {
  exists: boolean;
  dbPath: string;
  sizeBytes: number;
  lastSaved: number | null;
  counts: {
    alerts: number;
    tasks: number;
    subscribers: number;
    logs: number;
    keywords: number;
    regexes: number;
  };
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
  isOpen,
  onClose,
  onDatabaseImported,
}) => {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'backup' | 'guide'>('backup');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/database/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch database status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportDatabase = () => {
    tacticalAudio.playCleanSound();
    window.location.href = '/api/database/export';
    setStatusMsg({ type: 'success', text: 'Файл полной резервной копии базы данных скачивается на ваш ПК.' });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.json')) {
      setStatusMsg({ type: 'error', text: 'Пожалуйста, выберите файл в формате .json' });
      return;
    }

    setIsImporting(true);
    setStatusMsg(null);

    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Файл не является корректным JSON');
      }

      const res = await fetch('/api/database/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка импорта базы данных');
      }

      tacticalAudio.playCleanSound();
      setStatusMsg({
        type: 'success',
        text: `База данных успешно импортирована! Сообщений: ${data.counts?.alerts || 0}, Сценариев: ${data.counts?.tasks || 0}.`,
      });

      await fetchStatus();
      await onDatabaseImported();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Ошибка импорта базы данных' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('Вы уверены, что хотите сбросить статистику базы данных? Все настройки фильтров останутся.')) {
      return;
    }

    try {
      const res = await fetch('/api/database/reset', { method: 'POST' });
      if (res.ok) {
        tacticalAudio.playCleanSound();
        setStatusMsg({ type: 'success', text: 'Статистика базы данных сброшена.' });
        await fetchStatus();
        await onDatabaseImported();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Локальная база данных &amp; Запуск на ПК
              </h2>
              <p className="text-xs text-slate-400">
                Автономное хранение на диске, резервные копии и перенос данных
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-slate-800/80 text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'backup'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Управление базой &amp; Бэкапы</span>
          </button>

          <button
            onClick={() => setActiveSubTab('guide')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'guide'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-cyan-400" />
            <span>Инструкция по запуску на ПК</span>
          </button>
        </div>

        {/* Status Message alert */}
        {statusMsg && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-mono flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tab 1: Database & Backups */}
        {activeSubTab === 'backup' && (
          <div className="space-y-5 pt-4">
            {/* Status card */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-200 font-mono">
                    Локальное файловое хранилище (JSON DB)
                  </span>
                </div>
                <button
                  onClick={fetchStatus}
                  disabled={isLoading}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  title="Обновить состояние"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Обновить</span>
                </button>
              </div>

              {status ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Сообщений в базе:</span>
                    <span className="text-emerald-400 font-bold text-sm">{status.counts.alerts}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Сценариев / Задач:</span>
                    <span className="text-cyan-400 font-bold text-sm">{status.counts.tasks}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Стоп-слов &amp; Regex:</span>
                    <span className="text-amber-400 font-bold text-sm">
                      {status.counts.keywords + status.counts.regexes}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Размер файла на диске:</span>
                    <span className="text-slate-200 font-bold text-sm">{formatBytes(status.sizeBytes)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-mono">Загрузка информации о базе...</div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                💾 Все перехваченные сообщения, настройки Telegram-бота, фильтры и сценарии автоматически
                сохраняются в файл <code className="text-emerald-400">./data/radar_database.json</code> при каждом изменении.
              </p>
            </div>

            {/* Actions: Export and Import */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export Box */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-200">Скачать базу данных на ПК</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Экспортирует полный снимок базы (сообщения, правила, задачи, настройки) в один .json файл.
                  </p>
                </div>

                <button
                  onClick={handleExportDatabase}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать полную базу (.json)</span>
                </button>
              </div>

              {/* Import Box */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-slate-200">Импортировать базу с ПК</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Восстановите базу из ранее сохраненного файла .json на этом или любом другом компьютере.
                  </p>
                </div>

                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".json,application/json"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isImporting ? 'Импортирование...' : 'Выбрать файл базы (.json)'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Reset */}
            <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Сброс счетчиков статистики</span>
              <button
                onClick={handleResetDatabase}
                className="text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Сбросить счетчики</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: PC Launch Guide */}
        {activeSubTab === 'guide' && (
          <div className="space-y-4 pt-4 text-xs font-sans">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-cyan-400" />
                Инструкция: Запуск RadarTG на вашем компьютере (ПК / Сервер)
              </h3>
              <p className="text-slate-400 leading-relaxed">
                Вы можете запустить этот проект локально на своем ПК (Windows, macOS или Linux). База данных и все настройки сохраняются локально.
              </p>
            </div>

            <div className="space-y-3 font-mono">
              {/* Windows 1-click */}
              <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 space-y-1.5 font-sans">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold text-xs">⚡ Самый простой запуск на Windows (в 1 клик):</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Просто дважды кликните файл <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded font-mono font-bold">start.bat</code> в папке проекта.
                  Он сам установит пакеты и запустит сервер на <code className="text-cyan-300 font-mono">http://localhost:3000</code>.
                </p>
              </div>

              {/* Step 1 */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">1. Установите Node.js (если еще не установлен)</span>
                  <span className="text-[11px] text-slate-500">v18+</span>
                </div>
                <p className="text-slate-400 text-[11px] font-sans">
                  Скачайте LTS версию с <code className="text-cyan-400">nodejs.org</code> (при установке оставьте галочки по умолчанию).
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">2. Установка зависимостей вручную через терминал</span>
                  <button
                    onClick={() => copyToClipboard('npm install', 'step2')}
                    className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCmd === 'step2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd === 'step2' ? 'Скопировано' : 'Копировать'}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-emerald-300 text-xs">
                  npm install
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">3. Запуск сервера</span>
                  <button
                    onClick={() => copyToClipboard('npm run dev', 'step4')}
                    className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCmd === 'step4' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd === 'step4' ? 'Скопировано' : 'Копировать'}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-emerald-300 text-xs">
                  npm run dev
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Откройте браузер по адресу: <code className="text-cyan-400">http://localhost:3000</code>
                </p>
              </div>

              {/* Step 5: Persistent DB explanation */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-200">5. Где сохраняются данные на ПК?</span>
                <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                  Все данные хранятся в файле <code className="text-emerald-400">data/radar_database.json</code> в папке проекта.
                  При перезапуске ПК или сервера все сообщения, настройки и задачи мгновенно загружаются.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
