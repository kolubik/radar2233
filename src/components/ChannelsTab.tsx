import React, { useState, useEffect } from 'react';
import { ParsingChannel, SqlQueryResult, SqlTableInfo, ChannelCategory } from '../types.ts';
import { tacticalAudio } from '../utils/audio.ts';
import {
  Radio,
  Database,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  Zap,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  RefreshCw,
  Search,
  Terminal,
  Table,
  Code2,
  Copy,
  Check,
  HardDrive,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
  Flame,
  Clock,
  Sparkles,
  X,
  AtSign,
} from 'lucide-react';

interface ChannelsTabProps {
  onRefreshFeed?: () => Promise<void>;
  onToast: (msg: string, isError?: boolean) => void;
}

export const ChannelsTab: React.FC<ChannelsTabProps> = ({ onRefreshFeed, onToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'channels' | 'sql'>('channels');

  // Channels state
  const [channels, setChannels] = useState<ParsingChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [parsingChannelId, setParsingChannelId] = useState<string | null>(null);

  // Quick Add By Username State with Validation
  const [quickUsername, setQuickUsername] = useState('');
  const [isAddingQuick, setIsAddingQuick] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isParsingAll, setIsParsingAll] = useState(false);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ParsingChannel | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    title: '',
    category: 'REGIONAL' as ChannelCategory,
    priority: 'HIGH' as 'HIGH' | 'NORMAL' | 'LOW',
    parseIntervalSeconds: 2,
    autoForward: true,
    notes: '',
  });

  // SQL Console state
  const [sqlQuery, setSqlQuery] = useState<string>(
    'SELECT id, username, title, category, active, parsed_count FROM channels ORDER BY priority DESC;'
  );
  const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  const [tablesInfo, setTablesInfo] = useState<SqlTableInfo[]>([]);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Quick preset queries
  const sqlPresets = [
    {
      title: 'Все активные каналы',
      query: "SELECT id, username, title, category, priority FROM channels WHERE active = 1;",
    },
    {
      title: 'Статистика по категориям',
      query: "SELECT category, COUNT(*) as count FROM channels GROUP BY category;",
    },
    {
      title: 'Последние тревоги из базы',
      query: "SELECT id, source_channel, threat_type, severity, regions, processing_time_ms FROM alerts LIMIT 10;",
    },
    {
      title: 'Таблицы в локальной базе',
      query: "SHOW TABLES;",
    },
    {
      title: 'Структура таблицы channels',
      query: "DESCRIBE channels;",
    },
  ];

  // Fetch channels list
  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  };

  // Fetch SQL Schema
  const fetchSqlSchema = async () => {
    try {
      const res = await fetch('/api/sql/schema');
      if (res.ok) {
        const data = await res.json();
        setTablesInfo(data.tables || []);
      }
    } catch (err) {
      console.error('Failed to fetch SQL schema:', err);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchChannels().finally(() => setIsLoading(false));
    fetchSqlSchema();

    // Fast frequent polling (2.5s) to reflect online parsed messages in real-time
    const interval = setInterval(fetchChannels, 2500);
    return () => clearInterval(interval);
  }, []);

  // Execute SQL Query
  const handleExecuteSql = async (overrideQuery?: string) => {
    const q = overrideQuery || sqlQuery;
    if (!q.trim()) return;

    setIsExecutingSql(true);
    setSqlError(null);

    try {
      const res = await fetch('/api/sql/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data: SqlQueryResult = await res.json();

      if (data.error) {
        setSqlError(data.error);
        tacticalAudio.playThreatAlarm('MEDIUM');
      } else {
        setQueryResult(data);
        tacticalAudio.playCleanSound();
        // If modified channels, refresh channels list
        if (q.toUpperCase().includes('CHANNELS')) {
          fetchChannels();
        }
      }
    } catch (err: any) {
      setSqlError(err.message || 'Ошибка выполнения SQL');
    } finally {
      setIsExecutingSql(false);
    }
  };

  // Toggle active state
  const handleToggleChannel = async (id: string) => {
    try {
      const res = await fetch(`/api/channels/${id}/toggle`, { method: 'POST' });
      if (res.ok) {
        tacticalAudio.playRadarBlip();
        await fetchChannels();
        onToast('Статус канала обновлен');
      }
    } catch (err: any) {
      onToast(`Ошибка: ${err.message}`, true);
    }
  };

  // Telegram Username Validator (Strict validation: must start with '@' and contain valid Telegram username characters)
  const validateTelegramUsername = (
    raw: string,
    excludeChannelId?: string
  ): { isValid: boolean; error?: string; cleanUsername?: string; usernameWithAt?: string } => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return {
        isValid: false,
        error: 'Пожалуйста, укажите Telegram-никнейм канала (например: @channelname)',
      };
    }

    // 1. Проверка: начинается ли никнейм с '@'
    if (!trimmed.startsWith('@')) {
      const suggestion = trimmed
        .replace(/^https?:\/\/t\.me\/(s\/)?/i, '')
        .replace(/^t\.me\/(s\/)?/i, '')
        .replace(/^[^\w]+/, '');
      return {
        isValid: false,
        error: `Никнейм должен обязательно начинаться с символа '@' (например: @${suggestion || 'channelname'}).`,
      };
    }

    // Защита от дублирующихся @@ в начале
    if (trimmed.startsWith('@@')) {
      return {
        isValid: false,
        error: "Никнейм должен содержать только один символ '@' в начале (например: @channelname).",
      };
    }

    const usernamePart = trimmed.slice(1);

    // 2. Проверка: наличие имени после '@'
    if (!usernamePart) {
      return {
        isValid: false,
        error: "Укажите имя канала после символа '@' (например: @channelname).",
      };
    }

    // 3. Проверка корректности символов Telegram-юзернейма
    // Никаких пробелов
    if (/\s/.test(usernamePart)) {
      return {
        isValid: false,
        error: 'Никнейм не должен содержать пробелов.',
      };
    }

    // Никакой кириллицы
    if (/[а-яА-ЯёЁіІїЇєЄґҐ]/.test(usernamePart)) {
      return {
        isValid: false,
        error: 'Никнейм не должен содержать кириллицу. Разрешены только латинские буквы (a-z, A-Z), цифры (0-9) и знак подчеркивания (_).',
      };
    }

    // Проверка допустимых символов: только латиница, цифры и знак подчеркивания
    if (!/^[a-zA-Z0-9_]+$/.test(usernamePart)) {
      return {
        isValid: false,
        error: 'Никнейм содержит недопустимые символы. Telegram-юзернейм может содержать только латинские буквы (a-z, A-Z), цифры (0-9) и знак подчеркивания (_).',
      };
    }

    // 4. Проверка длины юзернейма (стандарт Telegram: от 4 до 32 символов)
    if (usernamePart.length < 4 || usernamePart.length > 32) {
      return {
        isValid: false,
        error: `Длина юзернейма должна быть от 4 до 32 символов (введено: ${usernamePart.length}).`,
      };
    }

    // 5. Проверка на дубликат среди существующих каналов
    const isDuplicate = channels.some(
      (c) =>
        c.id !== excludeChannelId &&
        c.username.replace(/^@/, '').toLowerCase() === usernamePart.toLowerCase()
    );
    if (isDuplicate) {
      return {
        isValid: false,
        error: `Канал @${usernamePart} уже добавлен в систему онлайн-парсинга.`,
      };
    }

    return {
      isValid: true,
      cleanUsername: usernamePart,
      usernameWithAt: `@${usernamePart}`,
    };
  };

  // Add Channel by Telegram Nickname Only (Strict manual registration for online parsing)
  const handleAddQuickByUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const validation = validateTelegramUsername(quickUsername);
    if (!validation.isValid || !validation.cleanUsername) {
      const err = validation.error || 'Ошибка валидации никнейма';
      setFormError(err);
      tacticalAudio.playThreatAlarm('MEDIUM');
      onToast(err, true);
      return;
    }

    setIsAddingQuick(true);
    try {
      const res = await fetch('/api/channels/add-by-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: validation.cleanUsername,
          priority: 'HIGH',
          parseIntervalSeconds: 2,
          autoForward: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка регистрации канала в системе онлайн-парсинга');
      }

      tacticalAudio.playCleanSound();
      const channelTitle = data.channel?.title || `@${validation.cleanUsername}`;
      const successMsg = `Канал ${channelTitle} (@${validation.cleanUsername}) успешно зарегистрирован для онлайн-парсинга!`;
      setFormSuccess(successMsg);
      onToast(data.message || successMsg);
      setQuickUsername('');
      await fetchChannels();
      if (onRefreshFeed) await onRefreshFeed();

      // Auto clear success notice after 6 seconds
      setTimeout(() => setFormSuccess(null), 6000);
    } catch (err: any) {
      tacticalAudio.playThreatAlarm('MEDIUM');
      const errText = err.message || 'Сбой подключения к каналу в Telegram';
      setFormError(errText);
      onToast(errText, true);
    } finally {
      setIsAddingQuick(false);
    }
  };

  // Immediate Online Parse of all channels
  const handleParseAllNow = async () => {
    setIsParsingAll(true);
    try {
      const res = await fetch('/api/channels/parse-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка онлайн парсинга');

      tacticalAudio.playRadarBlip();
      onToast('Все каналы успешно спарсены онлайн!');
      await fetchChannels();
      if (onRefreshFeed) await onRefreshFeed();
    } catch (err: any) {
      onToast(`Ошибка: ${err.message}`, true);
    } finally {
      setIsParsingAll(false);
    }
  };

  // Real Online Parse single channel
  const handleTestParseChannel = async (channel: ParsingChannel) => {
    setParsingChannelId(channel.id);
    try {
      const res = await fetch(`/api/channels/${channel.id}/test-parse`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка онлайн парсинга');

      if (data.alert) {
        tacticalAudio.playThreatAlarm(data.alert.severity);
        onToast(`Спарсен пост онлайн (${channel.username}): ${data.alert.threatType} — ${data.alert.regions.join(', ')}`);
      } else {
        tacticalAudio.playCleanSound();
        onToast(data.message || `Канал ${channel.username} проверен онлайн (новых постов нет)`);
      }

      await fetchChannels();
      if (onRefreshFeed) await onRefreshFeed();
    } catch (err: any) {
      onToast(`Ошибка парсинга онлайн: ${err.message}`, true);
    } finally {
      setParsingChannelId(null);
    }
  };

  // Delete channel
  const handleDeleteChannel = async (id: string, name: string) => {
    if (!window.confirm(`Удалить канал ${name} из списка мониторинга?`)) return;
    try {
      const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onToast('Канал удален из базы');
        await fetchChannels();
      }
    } catch (err: any) {
      onToast(`Ошибка: ${err.message}`, true);
    }
  };

  // Save Channel (Add or Edit)
  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateTelegramUsername(formData.username, editingChannel?.id);
    if (!validation.isValid || !validation.cleanUsername) {
      tacticalAudio.playThreatAlarm('MEDIUM');
      onToast(validation.error || 'Ошибка валидации никнейма', true);
      return;
    }

    const payload = {
      ...formData,
      username: `@${validation.cleanUsername}`,
    };

    try {
      if (editingChannel) {
        const res = await fetch(`/api/channels/${editingChannel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Ошибка обновления');
        tacticalAudio.playCleanSound();
        onToast('Канал успешно обновлен');
      } else {
        const res = await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка добавления');
        tacticalAudio.playCleanSound();
        onToast('Канал добавлен в базу мониторинга');
      }

      setIsModalOpen(false);
      setEditingChannel(null);
      await fetchChannels();
    } catch (err: any) {
      tacticalAudio.playThreatAlarm('MEDIUM');
      onToast(`Ошибка: ${err.message}`, true);
    }
  };

  // Open Edit
  const openEditModal = (ch: ParsingChannel) => {
    setEditingChannel(ch);
    setFormData({
      username: ch.username,
      title: ch.title,
      category: ch.category,
      priority: ch.priority,
      parseIntervalSeconds: ch.parseIntervalSeconds,
      autoForward: ch.autoForward,
      notes: ch.notes || '',
    });
    setIsModalOpen(true);
  };

  // Open Create
  const openCreateModal = () => {
    setEditingChannel(null);
    setFormData({
      username: '',
      title: '',
      category: 'REGIONAL',
      priority: 'NORMAL',
      parseIntervalSeconds: 10,
      autoForward: true,
      notes: '',
    });
    setIsModalOpen(true);
  };

  // Download SQL dump
  const handleDownloadSqlDump = () => {
    tacticalAudio.playCleanSound();
    window.location.href = '/api/sql/export';
    onToast('SQL Дамп базы данных скачивается на ваш ПК');
  };

  // Copy helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Category badges helper
  const renderCategoryBadge = (category: ChannelCategory) => {
    switch (category) {
      case 'AIR_FORCE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-950/80 text-sky-400 border border-sky-800/60">ВПС / Авиация</span>;
      case 'RADAR':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-800/60">Радар БПЛА</span>;
      case 'REGIONAL':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">Региональный</span>;
      case 'OFFICIAL':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">Официальный</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">Общий</span>;
    }
  };

  // Filter channels
  const filteredChannels = channels.filter((c) => {
    const matchesSearch =
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = filterCategory === 'ALL' || c.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Navigation & Status Bar */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 sm:p-5 backdrop-blur-md shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider font-mono">
              СПИСОК КАНАЛОВ ПАРСИНГА И ЛОКАЛЬНАЯ БАЗА SQL
            </h2>
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 text-xs font-mono font-bold">
              HOST &amp; PC READY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Парсинг оперативных Telegram каналов без спама. Встроенная реляционная SQL база данных прямо на хосте сайта или локальном ПК.
          </p>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('channels')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              activeSubTab === 'channels'
                ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/60 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Каналы ({channels.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveSubTab('sql');
              handleExecuteSql();
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
              activeSubTab === 'sql'
                ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/60 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL Консоль &amp; База</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: CHANNELS LIST */}
      {activeSubTab === 'channels' && (
        <div className="space-y-4">
          {/* Dedicated Form for Adding Channel by Telegram Nickname Only */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-slate-900/90 rounded-2xl border border-emerald-500/30 p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider font-mono">
                    ДОБАВЛЕНИЕ КАНАЛА ПО TELEGRAM-НИКНЕЙМУ
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono">
                    Онлайн-парсинг • Live
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Ручная регистрация канала: укажите только никнейм (например, <span className="font-mono text-emerald-400">@channelname</span>). Название, аватар и оперативные сообщения будут проверены и спарсены онлайн напрямую из Telegram.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleParseAllNow}
                  disabled={isParsingAll || channels.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold font-mono flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  title="Запустить немедленный онлайн-парсинг всех активных каналов"
                >
                  <Zap className={`w-4 h-4 text-amber-400 ${isParsingAll ? 'animate-spin' : ''}`} />
                  <span>{isParsingAll ? 'Парсинг...' : 'Спарсить все каналы онлайн'}</span>
                </button>
              </div>
            </div>

            {/* Validation Error Alert Banner */}
            {formError && (
              <div className="bg-rose-950/80 border border-rose-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-200 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block font-mono">Ошибка валидации никнейма:</span>
                  <span className="text-rose-300">{formError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-rose-400 hover:text-rose-200 cursor-pointer p-0.5"
                  title="Закрыть"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Success Alert Banner */}
            {formSuccess && (
              <div className="bg-emerald-950/80 border border-emerald-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-200 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block font-mono">Канал успешно зарегистрирован:</span>
                  <span className="text-emerald-300">{formSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormSuccess(null)}
                  className="text-emerald-400 hover:text-emerald-200 cursor-pointer p-0.5"
                  title="Закрыть"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Form for adding channel only by Telegram nickname */}
            {(() => {
              const trimmedInput = quickUsername.trim();
              const liveCheck = trimmedInput ? validateTelegramUsername(quickUsername) : null;
              return (
                <form onSubmit={handleAddQuickByUsername} className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-2.5 text-emerald-400 select-none">
                        <AtSign className="w-4 h-4 text-emerald-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Введите никнейм канала (обязательно с '@', например: @zahid_informue)"
                        value={quickUsername}
                        onChange={(e) => {
                          setQuickUsername(e.target.value);
                          if (formError) setFormError(null);
                        }}
                        disabled={isAddingQuick}
                        className={`w-full bg-slate-950/90 border rounded-xl pl-9 pr-9 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none shadow-inner transition-colors ${
                          !trimmedInput
                            ? 'border-slate-700/80 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50'
                            : liveCheck?.isValid
                            ? 'border-emerald-500/80 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50'
                            : 'border-rose-500/80 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/50'
                        }`}
                      />
                      {quickUsername && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickUsername('');
                            setFormError(null);
                          }}
                          className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                          title="Очистить"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isAddingQuick || !quickUsername.trim()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono uppercase tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {isAddingQuick ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Подключение онлайн...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Добавить канал</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Real-time Validation Feedback Hint */}
                  {trimmedInput && (
                    <div className="text-[11px] font-mono px-1">
                      {!trimmedInput.startsWith('@') ? (
                        <div className="flex items-center gap-1.5 text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Никнейм должен обязательно начинаться с символа '@'</span>
                          <button
                            type="button"
                            onClick={() => {
                              const autoFixed =
                                '@' +
                                trimmedInput
                                  .replace(/^https?:\/\/t\.me\/(s\/)?/i, '')
                                  .replace(/^t\.me\/(s\/)?/i, '');
                              setQuickUsername(autoFixed);
                              if (formError) setFormError(null);
                            }}
                            className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] cursor-pointer transition-colors"
                          >
                            Добавить @ в начало
                          </button>
                        </div>
                      ) : !liveCheck?.isValid ? (
                        <div className="flex items-center gap-1.5 text-rose-400">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{liveCheck?.error}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Корректный Telegram-никнейм: @{liveCheck.cleanUsername} (готов к онлайн-парсингу)</span>
                        </div>
                      )}
                    </div>
                  )}

              {/* Quick Suggestion Chips */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400 font-mono">
                <span className="text-slate-500 select-none">Быстрый выбор:</span>
                {[
                  { tag: '@kpszsu', name: 'ВПС ЗСУ' },
                  { tag: '@zahid_informue', name: 'Захід Інформує' },
                  { tag: '@UkraineAlarmSignal', name: 'єТривога' },
                  { tag: '@vanek_nikolaev', name: 'Ванёк' },
                ].map((s) => (
                  <button
                    key={s.tag}
                    type="button"
                    onClick={() => {
                      setQuickUsername(s.tag);
                      setFormError(null);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-emerald-300 border border-slate-700/60 transition-colors cursor-pointer"
                    title={`Вставить ${s.tag} (${s.name})`}
                  >
                    {s.tag} <span className="text-slate-500 text-[10px]">({s.name})</span>
                  </button>
                ))}
              </div>
            </form>
          );
        })()}
      </div>

          {/* Controls Bar: Search, Category Filter & Manual Form */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Поиск по имени, @username или тегам..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
              >
                <option value="ALL">Все категории</option>
                <option value="AIR_FORCE">ВПС / Авиация</option>
                <option value="RADAR">Радар БПЛА</option>
                <option value="REGIONAL">Региональные</option>
                <option value="OFFICIAL">Официальные</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchChannels}
                disabled={isLoading}
                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
                title="Обновить список"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={openCreateModal}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Расширенные настройки</span>
              </button>
            </div>
          </div>

          {/* Channels Grid / List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredChannels.length === 0 && (
              <div className="col-span-full bg-slate-900/60 rounded-2xl border border-dashed border-slate-800 p-8 text-center">
                <Radio className="w-10 h-10 text-slate-600 mx-auto mb-3 animate-pulse" />
                <h4 className="text-sm font-bold text-slate-300 font-mono uppercase">
                  {channels.length === 0 ? 'НЕТ ПОДКЛЮЧЕННЫХ КАНАЛОВ' : 'КАНАЛЫ НЕ НАЙДЕНЫ'}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  {channels.length === 0
                    ? 'Автоматические предустановки отключены. Введите никнейм любого публичного Telegram-канала в поле выше (например: @zahid_informue или UkraineAlarmSignal) для запуска прямого онлайн-парсинга.'
                    : 'По текущему фильтру или поисковому запросу ничего не найдено.'}
                </p>
              </div>
            )}

            {filteredChannels.map((channel) => (
              <div
                key={channel.id}
                className={`bg-slate-900/80 rounded-xl border p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between gap-3 ${
                  channel.active
                    ? 'border-slate-800/90 shadow-md shadow-slate-950/60'
                    : 'border-slate-900/60 opacity-60 bg-slate-950/40'
                }`}
              >
                {/* Header with Avatar & Details */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {channel.avatarUrl ? (
                        <img
                          src={channel.avatarUrl}
                          alt={channel.title}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-700/80 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-emerald-400 font-bold font-mono text-xs">
                          {channel.title.slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-slate-100 truncate block">
                            {channel.title}
                          </span>
                          {renderCategoryBadge(channel.category)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <a
                            href={`https://t.me/${channel.username.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-mono text-emerald-400 hover:underline inline-block"
                          >
                            {channel.username}
                          </a>
                          {channel.active && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Онлайн
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Active toggle button */}
                    <button
                      onClick={() => handleToggleChannel(channel.id)}
                      className={`p-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                        channel.active
                          ? 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800/40'
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 border border-slate-700/40'
                      }`}
                      title={channel.active ? 'Нажмите, чтобы приостановить парсинг' : 'Нажмите, чтобы включить парсинг'}
                    >
                      {channel.active ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {channel.notes && (
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {channel.notes}
                    </p>
                  )}
                </div>

                {/* Last Detected Alert Info */}
                {channel.lastAlertDetected && (
                  <div className="bg-slate-950/70 border border-slate-800/60 rounded-lg p-2 text-[11px]">
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] uppercase font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Последний перехват онлайн:</span>
                    </div>
                    <p className="text-slate-300 font-medium truncate mt-0.5">
                      {channel.lastAlertDetected}
                    </p>
                  </div>
                )}

                {/* Footer Metrics & Actions */}
                <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                    <span title="Количество спарсенных сообщений онлайн">
                      📊 {channel.parsedMessagesCount} постов
                    </span>
                    <span title="Интервал проверки онлайн">
                      ⏱ {channel.parseIntervalSeconds}с
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Instant Parse Button */}
                    <button
                      onClick={() => handleTestParseChannel(channel)}
                      disabled={parsingChannelId === channel.id}
                      className="px-2.5 py-1 rounded-md bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 text-[11px] font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Выполнить перехват сообщений онлайн прямо сейчас"
                    >
                      <Zap className={`w-3 h-3 ${parsingChannelId === channel.id ? 'animate-bounce' : ''}`} />
                      <span>{parsingChannelId === channel.id ? 'Парсинг...' : 'Спарсить'}</span>
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEditModal(channel)}
                      className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                      title="Редактировать канал"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteChannel(channel.id, channel.title)}
                      className="p-1 rounded-md bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 text-xs transition-colors cursor-pointer"
                      title="Удалить из мониторинга"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LOCAL SQL DATABASE ENGINE & QUERY CONSOLE */}
      {activeSubTab === 'sql' && (
        <div className="space-y-5">
          {/* SQL Engine Info Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm text-slate-100 font-mono">
                  ЛОКАЛЬНАЯ РЕЛЯЦИОННАЯ SQL БАЗА ДАННЫХ
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  SQLITE / SQL ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                Хранит таблицы <code className="text-emerald-300 font-mono">channels</code>, <code className="text-emerald-300 font-mono">alerts</code>, <code className="text-emerald-300 font-mono">parsing_rules</code> и <code className="text-emerald-300 font-mono">system_stats</code> локально в файле на диске хоста или вашего ПК.
              </p>
            </div>

            {/* Quick Export / Download Dump */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadSqlDump}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold font-mono flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Скачать SQL Дамп (.sql)</span>
              </button>
            </div>
          </div>

          {/* Quick Query Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold block">
              Быстрые шаблоны SQL запросов:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {sqlPresets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSqlQuery(preset.query);
                    handleExecuteSql(preset.query);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Terminal className="w-3 h-3 text-emerald-400" />
                  <span>{preset.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive SQL Editor Console */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">SQL Query Console</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExecuteSql()}
                  disabled={isExecutingSql}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${isExecutingSql ? 'animate-spin' : ''}`} />
                  <span>{isExecutingSql ? 'Выполняется...' : 'Выполнить SQL'}</span>
                </button>
              </div>
            </div>

            <div className="p-3">
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 font-mono text-xs text-emerald-300 p-3 rounded-lg border border-slate-800/80 focus:outline-none focus:border-emerald-500/60 leading-relaxed resize-none"
                placeholder="Введите SQL запрос (SELECT, INSERT, UPDATE, DELETE, SHOW TABLES, DESCRIBE...)"
              />
            </div>

            {/* Error Banner */}
            {sqlError && (
              <div className="bg-rose-950/70 border-t border-rose-800/80 px-4 py-2 text-xs font-mono text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{sqlError}</span>
              </div>
            )}

            {/* Results Grid Table */}
            {queryResult && !sqlError && (
              <div className="border-t border-slate-800 bg-slate-900/40">
                <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">
                      Строк: {queryResult.rowCount}
                    </span>
                    <span>·</span>
                    <span>Время выполнения: {queryResult.executionTimeMs} мс</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(queryResult.rows, null, 2), 'sql-json')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedText === 'sql-json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Копировать JSON</span>
                  </button>
                </div>

                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400">
                        {queryResult.columns.map((col, idx) => (
                          <th key={idx} className="px-3.5 py-2 font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {queryResult.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                          {row.map((val, cIdx) => (
                            <td key={cIdx} className="px-3.5 py-2 text-slate-200 truncate max-w-xs">
                              {val === null || val === undefined ? (
                                <span className="text-slate-600 italic">NULL</span>
                              ) : typeof val === 'boolean' ? (
                                val ? 'TRUE' : 'FALSE'
                              ) : (
                                String(val)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Local PC Guide & Architecture */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold font-mono text-slate-200 uppercase">
                КАК ЗАПУСТИТЬ ПАРСЕР И SQL БАЗУ ЛОКАЛЬНО НА ВАШЕМ ПК
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 space-y-1">
                <span className="text-emerald-400 font-mono font-bold block">1. Клонирование / Распаковка</span>
                <p className="text-[11px] leading-relaxed">
                  Скачайте проект в любую папку на ПК (например <code className="text-slate-300 font-mono">C:\RadarTG</code>)
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 space-y-1">
                <span className="text-emerald-400 font-mono font-bold block">2. Установка зависимостей</span>
                <p className="text-[11px] leading-relaxed font-mono text-slate-300">
                  npm install
                </p>
                <p className="text-[10px] text-slate-500">Без сложных С++ библиотек, ставится за пару секунд.</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 space-y-1">
                <span className="text-emerald-400 font-mono font-bold block">3. Запуск одной командой</span>
                <p className="text-[11px] leading-relaxed font-mono text-emerald-300">
                  npm run dev
                </p>
                <p className="text-[10px] text-slate-500">
                  База SQL автоматически пишется в <code className="text-slate-400">data/radar_database.json</code> и <code className="text-slate-400">data/radar_local.sql</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Channel Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold font-mono text-slate-100 uppercase flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>{editingChannel ? 'Редактировать канал' : 'Добавить Telegram канал'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300 font-semibold">
                  Telegram-никнейм канала (обязательно с '@') <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="@kyiv_alerts_oper (только латинские буквы, цифры и _)"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300 font-semibold">
                  Понятное название
                </label>
                <input
                  type="text"
                  placeholder="Оперативный Киев / Радар"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300 font-semibold">
                    Категория
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ChannelCategory })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                  >
                    <option value="AIR_FORCE">ВПС / Авиация</option>
                    <option value="RADAR">Радар БПЛА</option>
                    <option value="REGIONAL">Региональный радар</option>
                    <option value="OFFICIAL">Официальный канал</option>
                    <option value="GENERAL">Общий мониторинг</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300 font-semibold">
                    Приоритет парсинга
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'HIGH' | 'NORMAL' | 'LOW' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 cursor-pointer"
                  >
                    <option value="HIGH">Высокий (High)</option>
                    <option value="NORMAL">Стандартный (Normal)</option>
                    <option value="LOW">Низкий (Low)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300 font-semibold">
                    Интервал опроса (сек)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={300}
                    value={formData.parseIntervalSeconds}
                    onChange={(e) => setFormData({ ...formData, parseIntervalSeconds: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoForward}
                      onChange={(e) => setFormData({ ...formData, autoForward: e.target.checked })}
                      className="rounded accent-emerald-500"
                    />
                    <span className="text-xs text-slate-300 select-none">Авто-пересылка в канал</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300 font-semibold">
                  Заметки / Описание источника
                </label>
                <textarea
                  rows={2}
                  placeholder="Отслеживать пуски баллистики и Шахедов на юге..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-emerald-950/50"
                >
                  {editingChannel ? 'Сохранить изменения' : 'Добавить канал'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
