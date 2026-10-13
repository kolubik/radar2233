import React, { useState } from 'react';
import { tacticalAudio } from '../utils/audio.ts';
import { X, Radio, Send, Sparkles, AlertTriangle } from 'lucide-react';

interface ManualIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (text: string, channel: string) => Promise<void>;
  onSimulateBurst: () => Promise<void>;
}

export const ManualIngestModal: React.FC<ManualIngestModalProps> = ({
  isOpen,
  onClose,
  onIngest,
  onSimulateBurst,
}) => {
  const [channel, setChannel] = useState('@kyiv_alarm_oper');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      await onIngest(text.trim(), channel.trim() || '@radar_channel');
      tacticalAudio.playCleanSound();
      setText('');
      onClose();
    } catch (err) {
      console.error('Ingest error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      await onSimulateBurst();
      tacticalAudio.playRadarBlip();
      onClose();
    } catch (err) {
      console.error('Simulate burst error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 font-mono">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase text-slate-100">
              РУЧНОЙ ПЕРЕХВАТ И ПАРСИНГ СООБЩЕНИЯ
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 uppercase">
              Источник (Канал / Чат):
            </label>
            <input
              type="text"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="@oper_svodka_live"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5 uppercase">
              Текст сообщения с возможной рекламой, ссылками или донатами:
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Вставьте сюда текст поста..."
              rows={6}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleSimulate}
              disabled={isSimulating}
              className="px-3 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-900/40 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {isSimulating ? 'Генерация...' : 'Симулировать боевой перехват'}
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !text.trim()}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Обработка...' : 'Запустить в радар'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
