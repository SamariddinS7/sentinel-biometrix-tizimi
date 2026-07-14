import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, CartesianGrid, Tooltip } from 'recharts';
import { Users, UserMinus, Clock, UserCheck, X, TrendingUp, Activity, Maximize2, Loader2, LogOut } from 'lucide-react';
import { userService } from '../services/userService';
import { logService } from '../services/logService';
import { notificationService } from '../services/notificationService';
import { CalendarWidget } from './CalendarWidget';
import { AttendanceTable } from './AttendanceTable';
import { LogConsole } from './LogConsole';
import { GeminiAnomalyCard } from './GeminiAnomalyCard';
import { ActivityHeatmap } from './ActivityHeatmap';
import { useLanguage } from '../services/i18n';
import { generateDashboardInsight } from '../services/geminiService';
import { 
    isToday, 
    format, 
    startOfWeek, 
    endOfWeek, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval,
    isSameDay,
    isWithinInterval,
    subDays,
    subWeeks,
    subMonths
} from 'date-fns';
import { AttendanceStatus, AttendanceRecord, User } from '../types';

// Fallback data
const defaultSparkData = [];

interface MetricCardProps {
    title: string;
    value: number | string;
    subtext: string;
    icon: any;
    colorClass: string;
    trend: 'up' | 'down';
    chartData?: { val: number }[];
    onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtext, icon: Icon, colorClass, trend, chartData, onClick }) => (
  <div 
    onClick={onClick}
    className="bg-app-panel p-5 rounded-xl border border-border relative overflow-hidden group hover:border-brand-primary/50 hover:bg-app-surface/30 transition-all cursor-pointer shadow-md hover:shadow-lg hover:shadow-brand-primary/5 duration-300"
  >
    <div className={`absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity ${colorClass}`}>
        <Icon size={48} />
    </div>
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-text-muted">
        <Maximize2 size={14} />
    </div>
    <div className="flex flex-col h-full justify-between relative z-10">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-text-primary mt-1">{value}</h3>
            </div>
            <div className={`p-2.5 rounded-xl bg-app-surface border border-border flex items-center justify-center`}>
                <Icon size={20} className={colorClass} />
            </div>
        </div>
        
        <div className="mt-4 flex items-end justify-between gap-2">
            <div className="text-xs leading-snug max-w-[60%]">
                <span className={trend === 'up' ? 'text-status-safe-text font-bold' : 'text-status-critical-text font-bold'}>{subtext}</span>
                <span className="text-text-muted ml-1">o'tgan davrga nisbatan</span>
            </div>
            <div className="h-8 w-20 flex items-end justify-end overflow-hidden shrink-0">
                 {/* Sparkline adapts nicely and fits within bounds */}
                 <AreaChart 
                     width={110} 
                     height={32} 
                     data={chartData || []} 
                     margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                 >
                    <Area 
                        type="monotone" 
                        dataKey="val" 
                        stroke="currentColor" 
                        fill="currentColor" 
                        fillOpacity={0.12} 
                        className={colorClass} 
                        strokeWidth={2} 
                        isAnimationActive={false}
                    />
                 </AreaChart>
            </div>
        </div>
    </div>
  </div>
);

// Expanded Modal Component
const ExpandedMetricModal = ({ isOpen, onClose, data, colorClass, title, icon: Icon, value, filterType, trend, trendValue }: any) => {
    const [insight, setInsight] = useState<string | null>(null);
    const [loadingInsight, setLoadingInsight] = useState(false);
    const { language } = useLanguage();

    useEffect(() => {
        if (isOpen && data) {
            setLoadingInsight(true);
            generateDashboardInsight(title, data, value, trend, language)
                .then(setInsight)
                .finally(() => setLoadingInsight(false));
        } else {
            setInsight(null);
        }
    }, [isOpen, data, title, value, trend, language]);

    if (!isOpen) return null;
    
    // Extract color CSS Variable for Recharts dynamic scaling
    const strokeColor = colorClass.includes('safe') || colorClass.includes('emerald') 
                        ? 'var(--color-status-safe-text)' 
                        : colorClass.includes('critical') || colorClass.includes('rose') 
                        ? 'var(--color-status-critical-text)' 
                        : colorClass.includes('warning') || colorClass.includes('amber') || colorClass.includes('orange') 
                        ? 'var(--color-status-warning-text)' 
                        : 'var(--color-brand-primary)';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-app-overlay/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="bg-app-panel border border-border w-full max-w-4xl max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200 flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-app-surface/40 shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                        <div className="p-2.5 sm:p-3 rounded-xl bg-app-surface border border-border shrink-0">
                            <Icon size={20} className={`${colorClass} sm:w-6 sm:h-6`} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-text-primary truncate">{title} Tahlili</h2>
                            <p className="text-xs sm:text-sm text-text-muted truncate">{filterType === 'day' ? 'Kunlik' : filterType === 'week' ? 'Haftalik' : 'Oylik'} batafsil ko'rinish</p>
                        </div>
                    </div>
                    <div className="hidden sm:block text-right mr-6">
                        <div className="text-2xl sm:text-3xl font-extrabold text-text-primary">{value}</div>
                        <div className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Jami Soni</div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-app-surface rounded-full text-text-muted hover:text-text-primary transition-colors shrink-0">
                        <X size={20} className="sm:w-6 sm:h-6" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar flex-1">
                    {/* Main Chart Area */}
                    <div className="lg:col-span-2 bg-app-primary rounded-xl border border-border p-4 min-h-[300px] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                                <Activity size={16} className="text-text-muted" />
                                {filterType === 'day' ? 'Soatlik Trend' : 'Kunlik Trend'}
                            </h3>
                            <div className="px-2 py-1 bg-app-panel border border-border rounded text-[10px] sm:text-xs text-text-muted font-mono">
                                {filterType === 'day' ? 'Bugun' : filterType === 'week' ? 'So\'nggi 7 kun' : 'Bu Oy'}
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-[200px] sm:h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.25}/>
                                            <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-normal)" vertical={false} />
                                    <XAxis 
                                        dataKey="time" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} 
                                        dy={10}
                                        interval={filterType === 'month' ? 3 : 'preserveStartEnd'} 
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} 
                                        width={25}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'var(--color-bg-panel)', borderColor: 'var(--color-border-normal)', borderRadius: '8px', color: 'var(--color-text-primary)', fontSize: '12px' }}
                                        itemStyle={{ color: strokeColor }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="val" 
                                        stroke={strokeColor} 
                                        strokeWidth={3}
                                        fill={`url(#gradient-${title})`} 
                                        isAnimationActive={true}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Insights Panel */}
                    <div className="space-y-4">
                        <div className="bg-app-primary p-4 rounded-xl border border-border">
                            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Asosiy Ko'rsatkichlar</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-border">
                                    <span className="text-sm text-text-secondary">Eng Yuqori {filterType === 'day' ? 'Vaqt' : 'Sana'}</span>
                                    <span className="text-sm font-mono text-text-primary">
                                        {data && data.length > 0 ? data.reduce((max: any, p: any) => p.val > max.val ? p : max, data[0]).time : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-border">
                                    <span className="text-sm text-text-secondary">O'sish Sur'ati</span>
                                    <span className={`text-sm font-bold ${trendValue >= 0 ? 'text-status-safe-text' : 'text-status-critical-text'}`}>
                                        {trendValue > 0 ? '+' : ''}{trendValue}%
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-text-secondary">O'rtacha / {filterType === 'day' ? 'Soat' : 'Kun'}</span>
                                    <span className="text-sm font-mono text-text-primary">
                                        {data && data.length > 0 ? (data.reduce((sum: number, p: any) => sum + p.val, 0) / data.length).toFixed(1) : '0'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-border bg-app-surface/50">
                            <div className="flex items-start gap-3">
                                <TrendingUp className={colorClass} size={20} />
                                <div className="min-w-0 flex-1">
                                    <h4 className={`text-sm font-bold ${colorClass} mb-1 flex items-center gap-2`}>
                                        AI Prognozi
                                        {loadingInsight && <Loader2 size={12} className="animate-spin text-text-muted" />}
                                    </h4>
                                    <p className="text-xs text-text-secondary leading-relaxed">
                                        {loadingInsight ? "Gemini tahlil qilmoqda..." : insight || "Prognoz mavjud emas."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<{ globalSearchTerm?: string }> = ({ globalSearchTerm }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'day' | 'week' | 'month'>('day');
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const { t, getDateLocale } = useLanguage();
  
  useEffect(() => {
    const initData = async () => {
        try {
            const [logs, u] = await Promise.all([logService.getAttendanceLogs(), userService.getAllUsers()]);
            setLiveLogs(logs || []);
            setUsers(u || []);
        } catch (e) {
            console.error("Failed to initialize dashboard data:", e);
        }
    };
    initData();
  }, []);

  const handleDateSelect = (date: Date) => {
      setSelectedDate(date);
      setFilterType('day'); // Reset to day view when manually picking a date
  };

  const handleQuickFilter = (type: 'day' | 'week' | 'month') => {
      setFilterType(type);
      if (type === 'day') setSelectedDate(new Date());
  };

  const [currentLogs, setCurrentLogs] = useState<AttendanceRecord[]>([]);
  const [previousLogs, setPreviousLogs] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const updateFilteredLogs = () => {
        let currentInterval: { start: Date; end: Date };
        let previousInterval: { start: Date; end: Date };

        if (filterType === 'day') {
            currentInterval = { start: new Date(selectedDate.setHours(0,0,0,0)), end: new Date(selectedDate.setHours(23,59,59,999)) };
            const prevDay = subDays(selectedDate, 1);
            previousInterval = { start: new Date(prevDay.setHours(0,0,0,0)), end: new Date(prevDay.setHours(23,59,59,999)) };
        } else if (filterType === 'week') {
            currentInterval = { start: startOfWeek(selectedDate), end: endOfWeek(selectedDate) };
            const prevWeek = subWeeks(selectedDate, 1);
            previousInterval = { start: startOfWeek(prevWeek), end: endOfWeek(prevWeek) };
        } else {
            currentInterval = { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
            const prevMonth = subMonths(selectedDate, 1);
            previousInterval = { start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
        }

        const current = liveLogs.filter(log => {
             const logDate = new Date(log.timestamp);
             return isWithinInterval(logDate, currentInterval);
        });
        const prev = liveLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            return isWithinInterval(logDate, previousInterval);
       });
        
        setCurrentLogs(current);
        setPreviousLogs(prev);
    };
    updateFilteredLogs();
  }, [selectedDate, filterType, liveLogs]);

  // Dynamic Stats Calculation based on the visible logs
  const stats = useMemo(() => {
      return {
          present: currentLogs.filter(l => l.status === AttendanceStatus.PRESENT).length,
          late: currentLogs.filter(l => l.status === AttendanceStatus.LATE).length,
          absent: currentLogs.filter(l => l.status === AttendanceStatus.ABSENT).length,
          earlyLeave: currentLogs.filter(l => l.status === AttendanceStatus.EARLY_LEAVE).length,
      }
  }, [currentLogs]);

  const prevStats = useMemo(() => {
    return {
        present: previousLogs.filter(l => l.status === AttendanceStatus.PRESENT).length,
        late: previousLogs.filter(l => l.status === AttendanceStatus.LATE).length,
        absent: previousLogs.filter(l => l.status === AttendanceStatus.ABSENT).length,
        earlyLeave: previousLogs.filter(l => l.status === AttendanceStatus.EARLY_LEAVE).length,
    }
  }, [previousLogs]);

  const calcTrend = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prev) / prev) * 100);
  };

  const trends = useMemo(() => {
      return {
          present: calcTrend(stats.present, prevStats.present),
          late: calcTrend(stats.late, prevStats.late),
          absent: calcTrend(stats.absent, prevStats.absent),
          earlyLeave: calcTrend(stats.earlyLeave, prevStats.earlyLeave),
      }
  }, [stats, prevStats]);

  // Generate data from real logs
  const metricsData = useMemo(() => {
    const processData = (status: AttendanceStatus) => {
        // Group logs by time segment for the current view
        const segments: Record<string, number> = {};
        
        currentLogs.filter(l => l.status === status).forEach(log => {
            const date = new Date(log.timestamp);
            let key = '';
            if (filterType === 'day') {
                key = `${date.getHours().toString().padStart(2, '0')}:00`;
            } else if (filterType === 'week') {
                key = format(date, 'EEE', { locale: getDateLocale() });
            } else {
                key = date.getDate().toString();
            }
            segments[key] = (segments[key] || 0) + 1;
        });

        // Ensure we have a sorted array for the chart
        return Object.entries(segments)
            .map(([time, val]) => ({ time, val }))
            .sort((a, b) => a.time.localeCompare(b.time));
    };

    return {
        present: processData(AttendanceStatus.PRESENT),
        absent: processData(AttendanceStatus.ABSENT),
        late: processData(AttendanceStatus.LATE),
        earlyLeave: processData(AttendanceStatus.EARLY_LEAVE)
    };
  }, [currentLogs, filterType, getDateLocale]);

  // Helper to get active metric data for modal
  const getActiveMetricData = () => {
      if (!expandedMetric) return null;
      switch(expandedMetric) {
          case 'present': return { 
              data: metricsData.present, 
              title: t('dash.totalPresent'), 
              colorClass: 'text-status-safe-text', 
              icon: UserCheck,
              value: stats.present,
              trend: trends.present >= 0 ? 'up' : 'down',
              trendValue: trends.present
          };
          case 'absent': return { 
              data: metricsData.absent, 
              title: t('dash.totalAbsent'), 
              colorClass: 'text-status-critical-text', 
              icon: UserMinus,
              value: stats.absent,
              trend: trends.absent <= 0 ? 'up' : 'down',
              trendValue: trends.absent
          };
          case 'late': return { 
              data: metricsData.late, 
              title: t('dash.lateArrivals'), 
              colorClass: 'text-status-warning-text', 
              icon: Clock,
              value: stats.late,
              trend: trends.late <= 0 ? 'up' : 'down',
              trendValue: trends.late
          };
          case 'earlyLeave': return { 
              data: metricsData.earlyLeave, 
              title: 'Early Departures', 
              colorClass: 'text-orange-500', 
              icon: LogOut,
              value: stats.earlyLeave,
              trend: trends.earlyLeave <= 0 ? 'up' : 'down',
              trendValue: trends.earlyLeave
          };
          default: return null;
      }
  };

  const activeData = getActiveMetricData();

  // Header Title Logic
  const getHeaderTitle = () => {
      const locale = getDateLocale();
      if (filterType === 'day') return format(selectedDate, 'do MMMM, yyyy', { locale });
      if (filterType === 'week') {
          return `${format(startOfWeek(selectedDate), 'd MMM', { locale })} - ${format(endOfWeek(selectedDate), 'd MMM, yyyy', { locale })}`;
      }
      return format(selectedDate, 'MMMM yyyy', { locale });
  };

  return (
    <div className="h-full overflow-y-auto pr-px custom-scrollbar pb-10 flex flex-col gap-6 relative max-w-full">
        {/* Metric Modal */}
        {activeData && (
            <ExpandedMetricModal 
                isOpen={!!expandedMetric}
                onClose={() => setExpandedMetric(null)}
                filterType={filterType}
                {...activeData}
            />
        )}

        {/* Top Section: Metrics - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 px-1 sm:px-0">
            <MetricCard 
                title={t('dash.totalPresent')} 
                value={stats.present} 
                subtext={`${trends.present > 0 ? '+' : ''}${trends.present}%`} 
                icon={UserCheck} 
                colorClass="text-status-safe-text" 
                trend={trends.present >= 0 ? 'up' : 'down'}
                chartData={metricsData.present}
                onClick={() => setExpandedMetric('present')}
            />
            <MetricCard 
                title={t('dash.totalAbsent')} 
                value={stats.absent} 
                subtext={`${trends.absent > 0 ? '+' : ''}${trends.absent}%`} 
                icon={UserMinus} 
                colorClass="text-status-critical-text" 
                trend={trends.absent <= 0 ? 'up' : 'down'}
                chartData={metricsData.absent}
                onClick={() => setExpandedMetric('absent')}
            />
            <MetricCard 
                title={t('dash.lateArrivals')} 
                value={stats.late} 
                subtext={`${trends.late > 0 ? '+' : ''}${trends.late}%`} 
                icon={Clock} 
                colorClass="text-status-warning-text" 
                trend={trends.late <= 0 ? 'up' : 'down'}
                chartData={metricsData.late}
                onClick={() => setExpandedMetric('late')}
            />
             <MetricCard 
                title="Early Departures" 
                value={stats.earlyLeave} 
                subtext={`${trends.earlyLeave > 0 ? '+' : ''}${trends.earlyLeave}%`} 
                icon={LogOut} 
                colorClass="text-orange-500" 
                trend={trends.earlyLeave <= 0 ? 'up' : 'down'}
                chartData={metricsData.earlyLeave}
                onClick={() => setExpandedMetric('earlyLeave')}
            />
        </div>

        {/* Gemini AI Anomaly Scan & Security Audit Summary */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 px-1 sm:px-0 shrink-0">
            <GeminiAnomalyCard logs={liveLogs} />
            <ActivityHeatmap logs={liveLogs} />
        </div>

        {/* Middle Section: Calendar & Table */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0 px-1 sm:px-0">
            {/* Left Panel: Calendar & Quick Filters (Mobile: Hidden or Accordion) */}
            <div className="hidden lg:flex flex-col gap-4 col-span-1">
                <CalendarWidget selectedDate={selectedDate} onDateSelect={handleDateSelect} />
                
                {/* Quick Filters */}
                <div className="bg-app-panel border border-border rounded-xl p-4 shadow-sm">
                    <h4 className="text-text-muted text-xs font-bold uppercase mb-3">{t('dash.quickFilters')}</h4>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => handleQuickFilter('day')} 
                            className={`text-left px-3 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${filterType === 'day' && isToday(selectedDate) ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 shadow-sm' : 'text-text-secondary hover:bg-app-surface hover:text-text-primary border-transparent'}`}
                        >
                            {t('dash.today')}
                        </button>
                        <button 
                            onClick={() => handleQuickFilter('week')}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${filterType === 'week' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 shadow-sm' : 'text-text-secondary hover:bg-app-surface hover:text-text-primary border-transparent'}`}
                        >
                            {t('dash.thisWeek')}
                        </button>
                        <button 
                            onClick={() => handleQuickFilter('month')}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${filterType === 'month' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 shadow-sm' : 'text-text-secondary hover:bg-app-surface hover:text-text-primary border-transparent'}`}
                        >
                            {t('dash.thisMonth')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Panel: Attendance Table */}
            <div className="col-span-1 lg:col-span-3 min-h-0 flex flex-col overflow-hidden">
                <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-widest truncate max-w-[70%]">
                        {t('dash.recordsFor')} <span className="text-text-primary font-semibold">{getHeaderTitle()}</span>
                    </h3>
                    <div className="text-[10px] sm:text-xs text-text-muted whitespace-nowrap ml-2">
                        {currentLogs.length} Qaydlar
                    </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-border">
                    <AttendanceTable data={currentLogs} externalSearch={globalSearchTerm} />
                </div>
            </div>
        </div>

        {/* Bottom Section: Logs - Collapsible on Mobile */}
        <div className="shrink-0 sticky bottom-0 z-40 mt-auto pt-2 pb-2 bg-app-bg/95 backdrop-blur-sm -mx-1 px-1">
            <LogConsole logs={liveLogs} />
        </div>
    </div>
  );
};
export default Dashboard;
