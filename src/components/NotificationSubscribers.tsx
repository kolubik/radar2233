import React, { useState, useEffect } from 'react';
import { TelegramSubscriber, ThreatType } from '../types.ts';
import { tacticalAudio } from '../utils/audio.ts';
import {
  Bell,
  BellOff,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  ShieldAlert,
  Send,
  CheckCircle2,
  AlertCircle,
  Filter,
  Users,
} from 'lucide-react';

interface NotificationSubscribersProps {
  hasBotToken: boolean;
}

export const NotificationSubscribers: React.FC<NotificationSubscribersProps> = ({ hasBotToken }) => {
  const [subscribers, setSubscribers] = useState<TelegramSubscriber[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newChatId, setNewChatId] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newSeverity, setNewSeverity] = useState<'ALL' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('ALL');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSubscribers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/subscribers');
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data.subscribers || []);
      }
    } catch (e) {
      console.error('Failed to load subscribers:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const handleToggleSubscriber = async (chatId: string) => {
    try {
      const res = await fetch(`/api/subscribers/toggle/${chatId}`, { method: 'POST' });
      if (res.ok) {
        tacticalAudio.playCleanSound();
        await fetchSubscribers();
      }
    } catch (err: any) {
      console.error('Toggle subscriber error:', err);
    }
  };

  const handleDeleteSubscriber = async (chatId: string) => {
    try {
      const res = await fetch(`/api/subscribers/${chatId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchSubscribers();
        setStatusMsg({ type: 'success', text: 'Подписчик удален из базы оповещений' });
        setTimeout(() => setStatusMsg(null), 2500);
      }
    } catch (err: any) {
      console.error('Delete subscriber error:', err);
    }
  };

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatId.trim()) return;

    try {
      const res = await fetch('/api/subscribers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: newChatId.trim(),
          username: newUsername.trim() || undefined,
          firstName: newFirstName.trim() || 'Оператор',
          minSeverity: newSeverity,
          subscribedTypes: ['MISSILE', 'BALLISTIC', 'DRONE', 'AVIATION', 'ARTILLERY', 'AIR_RAID', 'ALL_CLEAR', 'INFO'],
          subscribedRegions: [],
        }),
      });

      if (res.ok) {
        tacticalAudio.playCleanSound();
        setNewChatId('');
        setNewUsername('');
        setNewFirstName('');
        setStatusMsg({ type: 'success', text: 'Подписчик успешно добавлен в систему тревог!' });
        setTimeout(() => setStatusMsg(null), 2500);
        await fetchSubscribers();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Ошибка добавления' });
    }
  };

  return (
    <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-100">
              СИСТЕМА ТАРГЕТИРОВАННЫХ УВЕДОМЛЕНИЙ В TELEGRAM
            </h3>
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              {subscribers.filter((s) => s.active).length} акт.
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Пользователи подписываются через команду <code className="text-rose-300 bg-slate-900 px-1 py-0.5 rounded">/start</code> или инлайн-кнопку «🔔 Подписка на радар»
          </p>
        </div>

        {!hasBotToken && (
          <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-amber-950/40 text-amber-300 border border-amber-900/50 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Сначала укажите токен бота
          </span>
        )}
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Add Subscriber Mini-Form */}
      <form onSubmit={handleAddSubscriber} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-mono">
        <div className="sm:col-span-3">
          <label className="text-[10px] text-slate-400 uppercase block mb-1">Telegram Chat ID / User ID*</label>
          <input
            type="text"
            required
            value={newChatId}
            onChange={(e) => setNewChatId(e.target.value)}
            placeholder="123456789"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="text-[10px] text-slate-400 uppercase block mb-1">Имя / Позывной</label>
          <input
            type="text"
            value={newFirstName}
            onChange={(e) => setNewFirstName(e.target.value)}
            placeholder="Дежурный офицер"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-[10px] text-slate-400 uppercase block mb-1">Юзернейм</label>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="@operator"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-[10px] text-slate-400 uppercase block mb-1">Порог угроз</label>
          <select
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value as any)}
            className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Все уровни</option>
            <option value="MEDIUM">Средний +</option>
            <option value="HIGH">Высокий +</option>
            <option value="CRITICAL">Только КРИТИЧ.</option>
          </select>
        </div>

        <div className="sm:col-span-2 flex items-end">
          <button
            type="submit"
            disabled={!newChatId.trim()}
            className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-900/40"
          >
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
        </div>
      </form>

      {/* Subscriber List Table */}
      <div className="space-y-2">
        <span className="text-xs font-mono text-slate-400 uppercase block">
          АКТИВНЫЕ ПОДПИСЧИКИ ОПОВЕЩЕНИЙ ({subscribers.length}):
        </span>

        {subscribers.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl">
            Подписчиков пока нет. Пользователи могут написать боту /start или нажать инлайн-кнопку в канале.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {subscribers.map((sub) => (
              <div
                key={sub.chatId}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 font-mono text-xs transition-all ${
                  sub.active
                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      sub.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {sub.active ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-200 truncate">
                        {sub.firstName || 'Оператор'}
                      </span>
                      {sub.username && (
                        <span className="text-[11px] text-slate-400">@{sub.username}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span>ID: {sub.chatId}</span>
                      <span>•</span>
                      <span className="text-amber-400">{sub.minSeverity}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleToggleSubscriber(sub.chatId)}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      sub.active
                        ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300 hover:bg-emerald-900/50'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    }`}
                    title={sub.active ? 'Приостановить уведомления' : 'Возобновить уведомления'}
                  >
                    {sub.active ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleDeleteSubscriber(sub.chatId)}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-900 transition-colors cursor-pointer"
                    title="Удалить из подписчиков"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
