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

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ParsingChannel | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    title: '',
    category: 'REGIONAL' as ChannelCategory,
    priority: 'NORMAL' as 'HIGH' | 'NORMAL' | 'LOW',
    parseIntervalSeconds: 10,
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
    setIsLoading(true);
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    } finally {
      setIsLoading(false);
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
    fetchChannels();
    fetchSqlSchema();
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

  // Test parse channel
  const handleTestParseChannel = async (channel: ParsingChannel) => {
    setParsingChannelId(channel.id);
    try {
      const res = await fetch(`/api/channels/${channel.id}/test-parse`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка парсинга');

      tacticalAudio.playThreatAlarm(data.alert.severity);
      onToast(`Спарсен пост из ${channel.username}: ${data.alert.threatType} (${data.alert.processingTimeMs || 0.8} мс)`);

      await fetchChannels();
      if (onRefreshFeed) await onRefreshFeed();
    } catch (err: any) {
      onToast(`Ошибка: ${err.message}`, true);
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
    if (!formData.username.trim()) {
      onToast('Укажите имя канала', true);
      return;
    }

    try {
      if (editingChannel) {
        const res = await fetch(`/api/channels/${editingChannel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error('Ошибка обновления');
        onToast('Канал успешно обновлен');
      } else {
        const res = await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка добавления');
        onToast('Канал добавлен в базу мониторинга');
      }

      setIsModalOpen(false);
      setEditingChannel(null);
      await fetchChannels();
    } catch (err: any) {
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
          {/* Controls Bar: Search, Category Filter & Add Button */}
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
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить канал</span>
              </button>
            </div>
          </div>

          {/* Channels Grid / List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredChannels.map((channel) => (
              <div
                key={channel.id}
                className={`bg-slate-900/80 rounded-xl border p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between gap-3 ${
                  channel.active
                    ? 'border-slate-800/90 shadow-md shadow-slate-950/60'
                    : 'border-slate-900/60 opacity-60 bg-slate-950/40'
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-slate-100 truncate block">
                          {channel.title}
                        </span>
                        {renderCategoryBadge(channel.category)}
                      </div>
                      <a
                        href={`https://t.me/${channel.username.replace('@', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono text-emerald-400 hover:underline inline-block mt-0.5"
                      >
                        {channel.username}
                      </a>
                    </div>

                    {/* Active toggle button */}
                    <button
                      onClick={() => handleToggleChannel(channel.id)}
                      className={`p-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
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
                      <span>Последний перехват:</span>
                    </div>
                    <p className="text-slate-300 font-medium truncate mt-0.5">
                      {channel.lastAlertDetected}
                    </p>
                  </div>
                )}

                {/* Footer Metrics & Actions */}
                <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                    <span title="Количество спарсенных сообщений">
                      📊 {channel.parsedMessagesCount} постов
                    </span>
                    <span title="Интервал проверки">
                      ⏱ {channel.parseIntervalSeconds}с
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Instant Parse Button */}
                    <button
                      onClick={() => handleTestParseChannel(channel)}
                      disabled={parsingChannelId === channel.id}
                      className="px-2.5 py-1 rounded-md bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 text-[11px] font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Выполнить тестовый перехват сообщения прямо сейчас"
                    >
                      <Zap className={`w-3 h-3 ${parsingChannelId === channel.id ? 'animate-bounce' : ''}`} />
                      <span>{parsingChannelId === channel.id ? '...' : 'Тест'}</span>
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

          {filteredChannels.length === 0 && (
            <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-8 text-center text-slate-400 space-y-2">
              <Radio className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="font-medium text-slate-300">Каналы не найдены</p>
              <p className="text-xs text-slate-500">Попробуйте изменить параметры поиска или добавить новый канал.</p>
            </div>
          )}
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
                  Username или ссылка канала <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="@kyiv_alerts_oper или t.me/kyiv_alerts_oper"
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
