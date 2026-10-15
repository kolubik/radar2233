import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  Clock,
  AlertTriangle,
  Flame,
  ShieldAlert,
  MapPin,
  TrendingUp,
  Zap,
  Filter,
  Layers,
  Activity,
  CheckCircle2,
  Calendar,
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Trash2,
  Bug,
  Radio,
  Terminal,
} from 'lucide-react';
import { ParsedAlert, ThreatType, ThreatSeverity } from '../types.ts';
import { tacticalAudio } from '../utils/audio.ts';
import { useErrorLogger } from '../services/errorLoggingService.ts';

interface AnalyticsTabProps {
  alerts: ParsedAlert[];
  onSimulateBurst?: () => Promise<void>;
}

// Color palette matching the tactical radar UI
const SEVERITY_COLORS: Record<ThreatSeverity, string> = {
  CRITICAL: '#ef4444', // Red-500
  HIGH: '#f97316',     // Orange-500
  MEDIUM: '#eab308',   // Yellow-500
  LOW: '#10b981',      // Emerald-500
};

const SEVERITY_NAMES: Record<ThreatSeverity, string> = {
  CRITICAL: 'Критическая',
  HIGH: 'Высокая',
  MEDIUM: 'Средняя',
  LOW: 'Низкая',
};

const THREAT_TYPE_CONFIG: Record<ThreatType, { label: string; color: string }> = {
  MISSILE: { label: 'Ракета', color: '#f43f5e' },
  BALLISTIC: { label: 'Баллистика', color: '#e11d48' },
  DRONE: { label: 'БПЛА / Шахед', color: '#f59e0b' },
  AVIATION: { label: 'Авиация', color: '#8b5cf6' },
  ARTILLERY: { label: 'Артобстрел', color: '#ea580c' },
  AIR_RAID: { label: 'Воздушная тревога', color: '#ef4444' },
  ALL_CLEAR: { label: 'Отбой', color: '#10b981' },
  INFO: { label: 'Сводка', color: '#38bdf8' },
};

// Custom dark radar tooltip
const CustomDarkTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-lg p-2.5 shadow-xl text-xs backdrop-blur-md">
        {label && <p className="font-semibold text-slate-200 mb-1.5">{label}</p>}
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-slate-300 py-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span>{entry.name || 'Значение'}:</span>
            </span>
            <span className="font-mono font-semibold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ alerts, onSimulateBurst }) => {
  const [timeRange, setTimeRange] = useState<'ALL' | '24H' | '7D'>('ALL');
  const [threatFilter, setThreatFilter] = useState<string>('ALL');

  // Централизованное логирование ошибок и телеметрия
  const { recentErrors, errorCount, clearErrors, exportErrors, logError } = useErrorLogger('Вкладка «Аналитика»');
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [copiedErrorId, setCopiedErrorId] = useState<string | null>(null);
  const [copiedAllLogs, setCopiedAllLogs] = useState(false);

  const handleTriggerTestError = () => {
    try {
      tacticalAudio.playCleanSound();
    } catch {}
    logError(
      new Error(`[Тестовый сбой] Проверка системы Error Boundary и централизованного логирования (время: ${new Date().toLocaleTimeString('ru-RU')})`),
      { componentStack: '\n    at TestSimulator (src/components/AnalyticsTab.tsx)\n    at AnalyticsTab (src/components/AnalyticsTab.tsx)' },
      {
        module: 'Модуль тестирования телеметрии',
        severity: 'MEDIUM',
        handled: true,
        metadata: {
          triggeredBy: 'Оператор радара (кнопка тестирования)',
          alertsCount: alerts.length,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        },
      }
    );
  };

  const handleCopySingleError = (err: any) => {
    const report = [
      `=== ОТЧЕТ ОБ ОШИБКЕ RADARTG ERROR BOUNDARY ===`,
      `ID инцидента: ${err.id}`,
      `Время фиксации: ${err.timeString} (${new Date(err.timestamp).toISOString()})`,
      `Модуль: ${err.module}`,
      `Степень критичности: ${err.severity}`,
      `Исключение: ${err.name}: ${err.message}`,
      `URL: ${err.url}`,
      `User Agent: ${err.userAgent}`,
      ``,
      `--- СТЕК ВЫЗОВОВ ---`,
      err.stack || 'Стек недоступен',
      ``,
      `--- ИЕРАРХИЯ КОМПОНЕНТОВ ---`,
      err.componentStack || 'Стек компонентов недоступен',
    ].join('\n');

    try {
      navigator.clipboard.writeText(report);
      setCopiedErrorId(err.id);
      setTimeout(() => setCopiedErrorId(null), 2000);
      try {
        tacticalAudio.playCleanSound();
      } catch {}
    } catch (e) {
      console.warn('Не удалось скопировать:', e);
    }
  };

  const handleExportAll = () => {
    try {
      const data = exportErrors();
      navigator.clipboard.writeText(data);
      setCopiedAllLogs(true);
      setTimeout(() => setCopiedAllLogs(false), 2000);
      try {
        tacticalAudio.playCleanSound();
      } catch {}
    } catch (e) {
      console.warn('Не удалось экспортировать логи:', e);
    }
  };

  // Filter alerts by time range
  const filteredAlerts = useMemo(() => {
    const now = Date.now();
    return alerts.filter((alert) => {
      if (timeRange === '24H' && now - alert.timestamp > 24 * 60 * 60 * 1000) {
        return false;
      }
      if (timeRange === '7D' && now - alert.timestamp > 7 * 24 * 60 * 60 * 1000) {
        return false;
      }
      if (threatFilter !== 'ALL' && alert.threatType !== threatFilter) {
        return false;
      }
      return true;
    });
  }, [alerts, timeRange, threatFilter]);

  // 1. Threat Frequency Data (Bar chart & ranking)
  const threatFrequencyData = useMemo(() => {
    const counts: Record<ThreatType, number> = {
      MISSILE: 0,
      BALLISTIC: 0,
      DRONE: 0,
      AVIATION: 0,
      ARTILLERY: 0,
      AIR_RAID: 0,
      ALL_CLEAR: 0,
      INFO: 0,
    };

    filteredAlerts.forEach((alert) => {
      if (counts[alert.threatType] !== undefined) {
        counts[alert.threatType]++;
      }
    });

    return Object.entries(counts)
      .map(([type, count]) => {
        const conf = THREAT_TYPE_CONFIG[type as ThreatType];
        return {
          type: type as ThreatType,
          label: conf?.label || type,
          count,
          fill: conf?.color || '#94a3b8',
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredAlerts]);

  // 2. Alert Severity Distribution (Pie / Donut chart)
  const severityDistributionData = useMemo(() => {
    const counts: Record<ThreatSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    filteredAlerts.forEach((alert) => {
      if (counts[alert.severity] !== undefined) {
        counts[alert.severity]++;
      }
    });

    const total = filteredAlerts.length || 1;

    return (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as ThreatSeverity[]).map((severity) => ({
      name: SEVERITY_NAMES[severity],
      severity,
      value: counts[severity],
      percentage: Math.round((counts[severity] / total) * 100),
      fill: SEVERITY_COLORS[severity],
    }));
  }, [filteredAlerts]);

  // 3. Peak Activity Times (Hourly 00:00 - 23:00)
  const peakActivityHourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      hourNum: i,
      count: 0,
      critical: 0,
      drones: 0,
      missiles: 0,
    }));

    filteredAlerts.forEach((alert) => {
      const date = new Date(alert.timestamp);
      const h = date.getHours();
      if (h >= 0 && h < 24) {
        hours[h].count++;
        if (alert.severity === 'CRITICAL') hours[h].critical++;
        if (alert.threatType === 'DRONE') hours[h].drones++;
        if (alert.threatType === 'MISSILE' || alert.threatType === 'BALLISTIC') hours[h].missiles++;
      }
    });

    return hours;
  }, [filteredAlerts]);

  // Find peak hour details
  const peakHourStats = useMemo(() => {
    if (filteredAlerts.length === 0) return { hour: '—', count: 0, isNight: false };
    let max = peakActivityHourlyData[0];
    for (const h of peakActivityHourlyData) {
      if (h.count > max.count) max = h;
    }
    const isNight = max.hourNum >= 22 || max.hourNum <= 6;
    return {
      hour: `${max.hour} - ${((max.hourNum + 1) % 24).toString().padStart(2, '0')}:00`,
      count: max.count,
      isNight,
    };
  }, [peakActivityHourlyData, filteredAlerts]);

  // 4. Regional Distribution (Top 6 sectors)
  const topRegionsData = useMemo(() => {
    const regionMap: Record<string, number> = {};

    filteredAlerts.forEach((alert) => {
      if (alert.regions && alert.regions.length > 0) {
        alert.regions.forEach((reg) => {
          const clean = reg.trim();
          if (clean) regionMap[clean] = (regionMap[clean] || 0) + 1;
        });
      }
    });

    return Object.entries(regionMap)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredAlerts]);

  // Overall KPIs
  const kpiStats = useMemo(() => {
    const total = filteredAlerts.length;
    const critical = filteredAlerts.filter((a) => a.severity === 'CRITICAL').length;
    const spamBlocked = filteredAlerts.filter((a) => a.isPureSpam).length;
    const forwarded = filteredAlerts.filter((a) => a.status === 'FORWARDED').length;

    // Most common threat type
    const topThreat = threatFrequencyData[0]?.count > 0 ? threatFrequencyData[0] : null;

    return {
      total,
      critical,
      criticalPercentage: total > 0 ? Math.round((critical / total) * 100) : 0,
      topThreatLabel: topThreat ? topThreat.label : 'Нет данных',
      topThreatCount: topThreat ? topThreat.count : 0,
      spamBlocked,
      forwarded,
    };
  }, [filteredAlerts, threatFrequencyData]);

  // Export Menu State and Handlers
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStatus, setExportStatus] = useState<'JSON' | 'CSV' | 'COPIED' | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  // Compile unified analytics report
  const compileAnalyticsReport = () => {
    const totalInDb = alerts.length;
    const analyzedCount = filteredAlerts.length;
    const total = analyzedCount || 1;

    const timeRangeLabel =
      timeRange === '24H'
        ? 'Последние 24 часа'
        : timeRange === '7D'
        ? 'Последние 7 дней'
        : 'Все время';

    const threatFilterLabel =
      threatFilter === 'ALL'
        ? 'Все типы угроз'
        : THREAT_TYPE_CONFIG[threatFilter as ThreatType]?.label || threatFilter;

    const nightHoursCount = peakActivityHourlyData
      .filter((h) => h.hourNum >= 22 || h.hourNum <= 6)
      .reduce((acc, curr) => acc + curr.count, 0);

    const dayHoursCount = peakActivityHourlyData
      .filter((h) => h.hourNum >= 7 && h.hourNum <= 21)
      .reduce((acc, curr) => acc + curr.count, 0);

    return {
      meta: {
        reportTitle: 'RadarTG - Сводный аналитический отчет по угрозам',
        generatedAt: new Date().toISOString(),
        generatedAtFormatted: new Date().toLocaleString('ru-RU'),
        filters: {
          timeRange,
          timeRangeLabel,
          threatFilter,
          threatFilterLabel,
          analyzedAlertsCount: analyzedCount,
          totalDatabaseAlertsCount: totalInDb,
        },
      },
      kpis: {
        totalAlerts: kpiStats.total,
        forwardedAlerts: kpiStats.forwarded,
        forwardedPercentage: Math.round((kpiStats.forwarded / total) * 100),
        criticalAlerts: kpiStats.critical,
        criticalPercentage: kpiStats.criticalPercentage,
        spamBlocked: kpiStats.spamBlocked,
        spamBlockedPercentage: Math.round((kpiStats.spamBlocked / total) * 100),
        cleanAlerts: kpiStats.total - kpiStats.spamBlocked,
        cleanPercentage: Math.round(((kpiStats.total - kpiStats.spamBlocked) / total) * 100),
        dominantThreat: {
          label: kpiStats.topThreatLabel,
          count: kpiStats.topThreatCount,
          percentage: Math.round((kpiStats.topThreatCount / total) * 100),
        },
        peakActivity: {
          window: peakHourStats.hour,
          count: peakHourStats.count,
          isNight: peakHourStats.isNight,
          description: peakHourStats.isNight
            ? 'Ночной налет (22:00 - 06:00)'
            : 'Дневная активность (07:00 - 21:00)',
        },
        intervalComparison: {
          nightAlerts: nightHoursCount,
          nightPercentage: Math.round((nightHoursCount / total) * 100),
          dayAlerts: dayHoursCount,
          dayPercentage: Math.round((dayHoursCount / total) * 100),
        },
      },
      threatTypeDistribution: threatFrequencyData.map((t) => ({
        type: t.type,
        label: t.label,
        count: t.count,
        percentage: total > 0 ? Number(((t.count / total) * 100).toFixed(1)) : 0,
      })),
      severityDistribution: severityDistributionData.map((s) => ({
        severity: s.severity,
        name: s.name,
        count: s.value,
        percentage: s.percentage,
      })),
      hourlyActivity: peakActivityHourlyData.map((h) => ({
        hour: h.hour,
        hourNum: h.hourNum,
        totalCount: h.count,
        criticalCount: h.critical,
        dronesCount: h.drones,
        missilesCount: h.missiles,
      })),
      topRegions: topRegionsData.map((r) => ({
        region: r.region,
        count: r.count,
        percentage: total > 0 ? Number(((r.count / total) * 100).toFixed(1)) : 0,
      })),
    };
  };

  const generateCsvReport = (report: ReturnType<typeof compileAnalyticsReport>): string => {
    const lines: string[] = [];

    const escape = (val: any) => {
      if (val === undefined || val === null) return '""';
      const s = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
      return `"${s}"`;
    };

    lines.push(`${escape('=== СВОДНЫЙ АНАЛИТИЧЕСКИЙ ОТЧЕТ ПО УГРОЗАМ RADARTG ===')}`);
    lines.push(`${escape('Дата формирования')},${escape(report.meta.generatedAtFormatted)}`);
    lines.push(`${escape('Временной интервал')},${escape(report.meta.filters.timeRangeLabel)}`);
    lines.push(`${escape('Фильтр категории')},${escape(report.meta.filters.threatFilterLabel)}`);
    lines.push(`${escape('Проанализировано тревог')},${report.meta.filters.analyzedAlertsCount}`);
    lines.push(`${escape('Всего событий в базе')},${report.meta.filters.totalDatabaseAlertsCount}`);
    lines.push('');

    lines.push(`${escape('=== КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ (KPI) ===')}`);
    lines.push(`${escape('Показатель')},${escape('Значение')},${escape('Доля / Детали')}`);
    lines.push(`${escape('Всего тревог в выборке')},${report.kpis.totalAlerts},${escape('100%')}`);
    lines.push(`${escape('Отправлено в канал Telegram')},${report.kpis.forwardedAlerts},${escape(report.kpis.forwardedPercentage + '%')}`);
    lines.push(`${escape('Критических угроз')},${report.kpis.criticalAlerts},${escape(report.kpis.criticalPercentage + '% от общего числа')}`);
    lines.push(`${escape('Заблокировано спама и рекламы')},${report.kpis.spamBlocked},${escape(report.kpis.spamBlockedPercentage + '%')}`);
    lines.push(`${escape('Очищено полезных сводок')},${report.kpis.cleanAlerts},${escape(report.kpis.cleanPercentage + '%')}`);
    lines.push(`${escape('Главная доминирующая угроза')},${escape(report.kpis.dominantThreat.label)},${escape(report.kpis.dominantThreat.count + ' случаев (' + report.kpis.dominantThreat.percentage + '%)')}`);
    lines.push(`${escape('Пик активности (окно 1 ч)')},${escape(report.kpis.peakActivity.window)},${escape(report.kpis.peakActivity.count + ' событий (' + report.kpis.peakActivity.description + ')')}`);
    lines.push(`${escape('Ночной интервал (22:00 - 06:00)')},${report.kpis.intervalComparison.nightAlerts},${escape(report.kpis.intervalComparison.nightPercentage + '% от тревог')}`);
    lines.push(`${escape('Дневной интервал (07:00 - 21:00)')},${report.kpis.intervalComparison.dayAlerts},${escape(report.kpis.intervalComparison.dayPercentage + '% от тревог')}`);
    lines.push('');

    lines.push(`${escape('=== РАСПРЕДЕЛЕНИЕ ПО ТИПАМ УГРОЗ ===')}`);
    lines.push(`${escape('Код типа')},${escape('Категория угрозы')},${escape('Количество инцидентов')},${escape('Доля (%)')}`);
    for (const t of report.threatTypeDistribution) {
      lines.push(`${escape(t.type)},${escape(t.label)},${t.count},${escape(t.percentage + '%')}`);
    }
    lines.push('');

    lines.push(`${escape('=== РАСПРЕДЕЛЕНИЕ ПО УРОВНЯМ ОПАСНОСТИ ===')}`);
    lines.push(`${escape('Уровень опасности')},${escape('Обозначение')},${escape('Количество тревог')},${escape('Доля (%)')}`);
    for (const s of report.severityDistribution) {
      lines.push(`${escape(s.severity)},${escape(s.name)},${s.count},${escape(s.percentage + '%')}`);
    }
    lines.push('');

    lines.push(`${escape('=== ТОП НАПРАВЛЕНИЙ И ОБЛАСТЕЙ ===')}`);
    lines.push(`${escape('Регион / Направление')},${escape('Количество упоминаний')},${escape('Доля среди регионов (%)')}`);
    if (report.topRegions.length > 0) {
      for (const r of report.topRegions) {
        lines.push(`${escape(r.region)},${r.count},${escape(r.percentage + '%')}`);
      }
    } else {
      lines.push(`${escape('Нет региональных данных')},0,${escape('0%')}`);
    }
    lines.push('');

    lines.push(`${escape('=== ПОЧАСОВАЯ ДИНАМИКА ТРЕВОГ (00:00 — 23:00) ===')}`);
    lines.push(`${escape('Час суток')},${escape('Всего событий')},${escape('Критических')},${escape('БПЛА / Шахеды')},${escape('Ракеты и баллистика')}`);
    for (const h of report.hourlyActivity) {
      lines.push(`${escape(h.hour)},${h.totalCount},${h.criticalCount},${h.dronesCount},${h.missilesCount}`);
    }

    return '\uFEFF' + lines.join('\r\n');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    tacticalAudio.playCleanSound();
    const report = compileAnalyticsReport();
    const jsonStr = JSON.stringify(report, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filterSlug = timeRange.toLowerCase();
    downloadFile(jsonStr, `radar_analytics_${filterSlug}_${dateStr}.json`, 'application/json;charset=utf-8');
    setExportStatus('JSON');
    setShowExportMenu(false);
    setTimeout(() => setExportStatus(null), 2500);
  };

  const handleExportCsv = () => {
    tacticalAudio.playCleanSound();
    const report = compileAnalyticsReport();
    const csvStr = generateCsvReport(report);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filterSlug = timeRange.toLowerCase();
    downloadFile(csvStr, `radar_analytics_${filterSlug}_${dateStr}.csv`, 'text/csv;charset=utf-8');
    setExportStatus('CSV');
    setShowExportMenu(false);
    setTimeout(() => setExportStatus(null), 2500);
  };

  const handleCopyJson = () => {
    tacticalAudio.playCleanSound();
    const report = compileAnalyticsReport();
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setExportStatus('COPIED');
    setShowExportMenu(false);
    setTimeout(() => setExportStatus(null), 2500);
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-8 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
          <BarChart3 className="w-7 h-7" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-base font-semibold text-slate-100">Нет данных для аналитики</h3>
          <p className="text-xs text-slate-400">
            В базе пока нет перехваченных тревог. Сгенерируйте тестовые сообщения или перейдите в «Песочницу», чтобы наполнить радар данными.
          </p>
        </div>
        {onSimulateBurst && (
          <button
            onClick={onSimulateBurst}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Сгенерировать тестовые тревоги</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Аналитика и статистика угроз</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">
              ({filteredAlerts.length} из {alerts.length} событий)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Визуализация частоты тревог, распределения уровней опасности и пиковых часов активности
          </p>
        </div>

        {/* Time and Category Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time range buttons */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setTimeRange('ALL')}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                timeRange === 'ALL'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Все время
            </button>
            <button
              onClick={() => setTimeRange('7D')}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                timeRange === '7D'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7 дней
            </button>
            <button
              onClick={() => setTimeRange('24H')}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                timeRange === '24H'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24 часа
            </button>
          </div>

          {/* Threat Type Filter */}
          <select
            value={threatFilter}
            onChange={(e) => setThreatFilter(e.target.value)}
            className="bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-slate-700 cursor-pointer"
          >
            <option value="ALL">Все типы угроз</option>
            <option value="MISSILE">Ракеты</option>
            <option value="BALLISTIC">Баллистика</option>
            <option value="DRONE">БПЛА / Шахеды</option>
            <option value="AVIATION">Авиация</option>
            <option value="ARTILLERY">Артобстрел</option>
            <option value="AIR_RAID">Воздушная тревога</option>
            <option value="ALL_CLEAR">Отбой</option>
          </select>

          {/* Threat Analysis Report Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                exportStatus
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/10'
                  : showExportMenu
                  ? 'bg-slate-800 border-slate-600 text-white shadow-sm'
                  : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200'
              }`}
              title="Экспорт аналитики и статистики угроз в JSON или CSV"
            >
              {exportStatus ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-emerald-300">
                    {exportStatus === 'JSON' ? 'JSON сохранен!' : exportStatus === 'CSV' ? 'CSV сохранен!' : 'Скопировано!'}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Экспорт отчета</span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {/* Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl p-2 z-50 backdrop-blur-xl">
                <div className="px-2.5 py-2 border-b border-slate-800/80 mb-1">
                  <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Отчет аналитики угроз</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {filteredAlerts.length} соб.
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    Период: {timeRange === '24H' ? '24 часа' : timeRange === '7D' ? '7 дней' : 'Все время'} • {threatFilter === 'ALL' ? 'Все типы' : threatFilter}
                  </div>
                </div>

                <div className="space-y-1">
                  {/* JSON Option */}
                  <button
                    onClick={handleExportJson}
                    className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-800/80 text-slate-200 cursor-pointer transition-colors group"
                  >
                    <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 mt-0.5 group-hover:bg-amber-500/20">
                      <FileJson className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-100 flex items-center justify-between">
                        <span>Экспорт JSON (.json)</span>
                        <span className="text-[10px] font-mono text-amber-400/90 font-medium bg-amber-500/10 px-1 rounded">JSON</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Полная иерархическая структура: сводные KPI, почасовые счетчики, типы угроз и секторы
                      </div>
                    </div>
                  </button>

                  {/* CSV Option */}
                  <button
                    onClick={handleExportCsv}
                    className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-800/80 text-slate-200 cursor-pointer transition-colors group"
                  >
                    <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mt-0.5 group-hover:bg-emerald-500/20">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-100 flex items-center justify-between">
                        <span>Экспорт CSV (.csv)</span>
                        <span className="text-[10px] font-mono text-emerald-400/90 font-medium bg-emerald-500/10 px-1 rounded">EXCEL/CSV</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Сводные таблицы с UTF-8 BOM для безупречного открытия в Microsoft Excel и Google Таблицах
                      </div>
                    </div>
                  </button>

                  {/* Copy JSON Option */}
                  <button
                    onClick={handleCopyJson}
                    className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-800/80 text-slate-200 cursor-pointer transition-colors group"
                  >
                    <div className="p-1.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 mt-0.5 group-hover:bg-sky-500/20">
                      <Copy className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-100 flex items-center justify-between">
                        <span>Копировать в буфер</span>
                        <span className="text-[10px] text-slate-400 font-mono">CLIPBOARD</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Скопировать структурированный JSON-отчет в буфер обмена
                      </div>
                    </div>
                  </button>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80 px-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>API: /api/radar/analytics-export</span>
                  <a
                    href={`/api/radar/analytics-export?format=json&timeRange=${timeRange}&threatFilter=${threatFilter}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline"
                  >
                    Открыть эндпоинт
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Alerts */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Всего тревог</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {kpiStats.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-400 font-medium">{kpiStats.forwarded}</span>
            <span>отправлено в канал</span>
          </div>
        </div>

        {/* KPI 2: Critical Threats */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Критических</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {kpiStats.critical}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-rose-400 font-medium">{kpiStats.criticalPercentage}%</span>
            <span>от общего объема</span>
          </div>
        </div>

        {/* KPI 3: Dominant Threat */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Главная угроза</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-white truncate" title={kpiStats.topThreatLabel}>
            {kpiStats.topThreatLabel}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-amber-400 font-medium font-mono">{kpiStats.topThreatCount}</span>
            <span>зафиксированных случаев</span>
          </div>
        </div>

        {/* KPI 4: Peak Activity Window */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Пик активности</span>
            <Clock className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-lg font-bold font-mono text-white truncate">
            {peakHourStats.hour}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className={peakHourStats.isNight ? 'text-rose-400' : 'text-slate-300'}>
              {peakHourStats.isNight ? '🌙 Ночной налет' : '☀️ Дневная сводка'}
            </span>
            <span className="font-mono">({peakHourStats.count} соб.)</span>
          </div>
        </div>
      </div>

      {/* Row 1: Threat Frequency & Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Threat Frequency (Bar Chart) - 7 cols */}
        <div className="lg:col-span-7 bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Частота угроз по типам</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Количество инцидентов по категориям вооружения и тревог
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={threatFrequencyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={11}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  tick={{ fill: '#94a3b8' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  allowDecimals={false}
                  tick={{ fill: '#94a3b8' }}
                />
                <Tooltip content={<CustomDarkTooltip />} />
                <Bar dataKey="count" name="Количество" radius={[4, 4, 0, 0]}>
                  {threatFrequencyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick legend pill list */}
          <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {threatFrequencyData.slice(0, 4).map((item) => (
              <div key={item.type} className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.fill }} />
                <span className="truncate">{item.label}:</span>
                <span className="font-mono font-medium text-white ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alert Severity Distribution (Donut Chart) - 5 cols */}
        <div className="lg:col-span-5 bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-rose-400" />
                <span>Распределение по уровню опасности</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Соотношение критических и средних угроз
              </p>
            </div>
          </div>

          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {severityDistributionData.map((entry, index) => (
                    <Cell key={`sev-cell-${index}`} fill={entry.fill} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomDarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Central Donut Total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold font-mono text-white">
                {kpiStats.total}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                Всего
              </span>
            </div>
          </div>

          {/* Severity Breakdown Legend */}
          <div className="mt-auto space-y-2 pt-2 border-t border-slate-800/60">
            {severityDistributionData.map((sev) => (
              <div
                key={sev.severity}
                className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/40"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: sev.fill }}
                  />
                  <span className="text-slate-300 font-medium">{sev.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-400">{sev.percentage}%</span>
                  <span className="text-white font-semibold">({sev.value})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Peak Activity Times (Hourly Timeline Area Chart) */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" />
              <span>Суточная активность и пиковые часы (00:00 — 23:00)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              График распределения времени пусков и объявлений тревог в течение 24 часов
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1.5 bg-violet-400 rounded-sm" />
              <span>Всего тревог</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1.5 bg-rose-400 rounded-sm" />
              <span>Критические</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1.5 bg-amber-400 rounded-sm" />
              <span>Шахеды</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={peakActivityHourlyData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke="#64748b"
                fontSize={10}
                tick={{ fill: '#94a3b8' }}
                interval={1}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                allowDecimals={false}
                tick={{ fill: '#94a3b8' }}
              />
              <Tooltip content={<CustomDarkTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                name="Всего тревог"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#totalGradient)"
              />
              <Area
                type="monotone"
                dataKey="critical"
                name="Критические"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#criticalGradient)"
              />
              <Area
                type="monotone"
                dataKey="drones"
                name="БПЛА / Шахед"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Night vs Day Activity Summary */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/40 flex items-center justify-between">
            <span className="text-slate-400">🌙 Ночной интервал (22:00 — 06:00):</span>
            <span className="font-mono font-semibold text-rose-400">
              {peakActivityHourlyData
                .filter((h) => h.hourNum >= 22 || h.hourNum <= 6)
                .reduce((acc, curr) => acc + curr.count, 0)}{' '}
              тревог
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/40 flex items-center justify-between">
            <span className="text-slate-400">☀️ Дневной интервал (07:00 — 21:00):</span>
            <span className="font-mono font-semibold text-emerald-400">
              {peakActivityHourlyData
                .filter((h) => h.hourNum >= 7 && h.hourNum <= 21)
                .reduce((acc, curr) => acc + curr.count, 0)}{' '}
              тревог
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Regional Targeting & Filter Shield Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Targeted Regions */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-5">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Топ целевых направлений / областей</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Регионы, чаще всего упоминаемые в траекториях угроз
          </p>

          {topRegionsData.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topRegionsData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 35, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    fontSize={10}
                    allowDecimals={false}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis
                    dataKey="region"
                    type="category"
                    stroke="#64748b"
                    fontSize={11}
                    tick={{ fill: '#e2e8f0' }}
                  />
                  <Tooltip content={<CustomDarkTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Упоминаний"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-slate-500">
              Нет данных по регионам
            </div>
          )}
        </div>

        {/* Spam Filtering & Processing Efficiency */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>Эффективность фильтрации спама</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Статистика очистки рекламы, сборов и мусорного контента
            </p>

            <div className="space-y-3">
              {/* Clean Rate Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300">Очищено полезных сводок:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {kpiStats.total - kpiStats.spamBlocked} из {kpiStats.total}
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        kpiStats.total > 0
                          ? Math.round(((kpiStats.total - kpiStats.spamBlocked) / kpiStats.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Blocked Spam Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300">Заблокировано чистого спама / рекламы:</span>
                  <span className="font-mono text-rose-400 font-semibold">
                    {kpiStats.spamBlocked} (
                    {kpiStats.total > 0
                      ? Math.round((kpiStats.spamBlocked / kpiStats.total) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-rose-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        kpiStats.total > 0
                          ? Math.round((kpiStats.spamBlocked / kpiStats.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Telegram Auto/Manual Forwarded */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300">Опубликовано в канал Telegram:</span>
                  <span className="font-mono text-sky-400 font-semibold">
                    {kpiStats.forwarded} (
                    {kpiStats.total > 0
                      ? Math.round((kpiStats.forwarded / kpiStats.total) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-sky-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        kpiStats.total > 0
                          ? Math.round((kpiStats.forwarded / kpiStats.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Алгоритм очистки активен</span>
            </span>
            <span className="font-mono text-slate-500">
              Аналитика обновляется в реальном времени
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Central Error Telemetry & ErrorBoundary Diagnostic Hub */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-5 mt-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl border mt-0.5 relative ${
              errorCount > 0
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}>
              {errorCount > 0 ? (
                <>
                  <Bug className="w-5 h-5 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-950 animate-ping" />
                </>
              ) : (
                <Radio className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-400">
                  ТЕЛЕМЕТРИЯ СБОЕВ • CENTRAL_ERROR_LOGS
                </span>
                {errorCount === 0 ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    СИСТЕМА СТАБИЛЬНА
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-500/40 animate-pulse">
                    ФИКСИРУЮТСЯ ИНЦИДЕНТЫ ({errorCount})
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-slate-100">
                Централизованный журнал ошибок Error Boundary
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Изолирует сбои компонентов, фиксирует стек вызовов, передает данные на центральный endpoint аналитики и в консоль
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTriggerTestError}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 cursor-pointer transition-colors"
              title="Сгенерировать тестовый сбой для проверки логирования"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" />
              <span>Тестовый сбой</span>
            </button>

            {errorCount > 0 && (
              <>
                <button
                  onClick={handleExportAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 cursor-pointer transition-colors"
                  title="Экспорт всех ошибок в JSON"
                >
                  {copiedAllLogs ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Скопировано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Экспорт JSON</span>
                    </>
                  )}
                </button>

                <button
                  onClick={clearErrors}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 cursor-pointer transition-colors"
                  title="Очистить локальный и серверный журнал ошибок"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Очистить журнал</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content: List of recorded errors */}
        <div className="mt-4">
          {recentErrors.length === 0 ? (
            <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/40 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
              <p className="text-sm font-medium text-slate-300">
                Журнал чист — сбоев в работе компонентов не обнаружено
              </p>
              <p className="text-xs text-slate-500 max-w-md">
                При возникновении исключения в любом модуле (ThreatFeed, Sandbox, BotSetup, Tasks), предохранитель изолирует сбой и передаст телеметрию в этот журнал и на сервер.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentErrors.map((err) => {
                const isExpanded = expandedErrorId === err.id;
                const isCopied = copiedErrorId === err.id;

                return (
                  <div
                    key={err.id}
                    className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-3.5 transition-all text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2 font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300 font-bold text-[11px]">
                          {err.id}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[11px]">
                          {err.module}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          err.severity === 'CRITICAL'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                            : err.severity === 'HIGH'
                            ? 'bg-orange-950/80 text-orange-300 border-orange-700/60'
                            : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                        }`}>
                          {err.severity}
                        </span>
                        {err.handled ? (
                          <span className="text-[10px] text-emerald-400/90 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                            Изолировано ErrorBoundary
                          </span>
                        ) : (
                          <span className="text-[10px] text-rose-400/90 bg-rose-950/60 border border-rose-800/50 px-1.5 py-0.5 rounded">
                            Глобальный перехват
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-400">
                          {err.timeString}
                        </span>
                        <button
                          onClick={() => handleCopySingleError(err)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                            isCopied
                              ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                          }`}
                          title="Скопировать отчет об этой ошибке"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Скопировано</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Отчет</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Error message */}
                    <div className="font-mono text-rose-300 bg-rose-950/20 border border-rose-900/30 rounded-lg p-2.5 break-words select-all">
                      <strong className="text-rose-400">{err.name}:</strong> {err.message}
                    </div>

                    {/* Expandable stack trace & component stack */}
                    {(err.stack || err.componentStack) && (
                      <div className="mt-2 pt-2 border-t border-slate-800/60">
                        <button
                          onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 cursor-pointer font-mono text-[11px]"
                        >
                          <Terminal className="w-3 h-3 text-emerald-400" />
                          <span>{isExpanded ? 'Скрыть стек вызовов' : 'Показать стек вызовов и компонентную иерархию'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 ml-0.5" />
                          ) : (
                            <ChevronDown className="w-3 h-3 ml-0.5" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 animate-in fade-in duration-150">
                            {err.stack && (
                              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                                <div className="text-slate-500 font-semibold mb-1">// JavaScript Call Stack:</div>
                                {err.stack}
                              </div>
                            )}
                            {err.componentStack && (
                              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 font-mono text-[10px] text-amber-300/90 overflow-x-auto whitespace-pre leading-relaxed select-all">
                                <div className="text-amber-500/80 font-semibold mb-1">// React Component Hierarchy:</div>
                                {err.componentStack}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
