
import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, CartesianGrid, Tooltip } from 'recharts';
import { Users, UserMinus, Clock, UserCheck, X, TrendingUp, Activity, Maximize2, Loader2, LogOut } from 'lucide-react';
import { userService } from '../services/userService';
import { logService } from '../services/logService';
import { notificationService } from '../services/notificationService';
import { CalendarWidget } from './CalendarWidget';
import { AttendanceTable } from './AttendanceTable';
import { LogConsole } from './LogConsole';
import { useLanguage } from '../services/i18n';
import { generateDashboardInsight } from '../services/geminiService';
import { 
    isToday, 
    format, 
    startOfWeek, 
    endOfWeek, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval
} from 'date-fns';
import { AttendanceStatus, AttendanceRecord, User } from '../types';

// Fallback data
const defaultSparkData = [
  { val: 10 }, { val: 25 }, { val: 15 }, { val: 30 }, { val: 45 }, { val: 35 }, { val: 50 }
];

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
    className="bg-slate-900 p-5 rounded-xl border border-slate-800 relative overflow-hidden group hover:border-slate-600 hover:bg-slate-800/50 transition-all cursor-pointer shadow-lg hover:shadow-cyan-900/10"
  >
    <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
        <Icon size={48} />
    </div>
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500">
        <Maximize2 size={14} />
    </div>
    <div className="flex flex-col h-full justify-between relative z-10">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold text-slate-100 mt-1">{value}</h3>
            </div>
            <div className={`p-2 rounded-lg bg-slate-800 ${colorClass.replace('text-', 'text-')} bg-opacity-20`}>
                <Icon size={20} className={colorClass} />
            </div>
        </div>
        
        <div className="mt-4 flex items-end justify-between">
            <div className="text-xs">
                <span className={trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}>{subtext}</span>
                <span className="text-slate-500 ml-1">o'tgan davrga nisbatan</span>
            </div>
            <div className="h-8 w-16">
                 {/* Fixed dimensions for sparkline to prevent Recharts resize errors */}
                 <AreaChart width={64} height={32} data={chartData || defaultSparkData}>
                    <Area 
                        type="monotone" 
                        dataKey="val" 
                        stroke="currentColor" 
                        fill="currentColor" 
                        fillOpacity={0.1} 
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
const ExpandedMetricModal = ({ isOpen, onClose, data, colorClass, title, icon: Icon, value, filterType, trend }: any) => {
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
    
    // Extract color hex approximation for Recharts
    const strokeColor = colorClass.includes('emerald') ? '#34d399' : 
                       colorClass.includes('rose') ? '#fb7185' : 
                       colorClass.includes('amber') ? '#fbbf24' : 
                       colorClass.includes('orange') ? '#fb923c' : '#22d3ee';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl bg-slate-800 ${colorClass.replace('text-', 'bg-').replace('400', '500')}/10 border border-slate-700`}>
                            <Icon size={24} className={colorClass} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{title} Tahlili</h2>
                            <p className="text-sm text-slate-400">{filterType === 'day' ? 'Kunlik' : filterType === 'week' ? 'Haftalik' : 'Oylik'} batafsil ko'rinish</p>
                        </div>
                    </div>
                    <div className="text-right mr-6">
                        <div className="text-3xl font-bold text-white">{value}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest">Jami Soni</div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Chart Area */}
                    <div className="lg:col-span-2 bg-slate-950 rounded-xl border border-slate-800 p-4 min-h-[300px] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                <Activity size={16} className="text-slate-500" />
                                {filterType === 'day' ? 'Soatlik Trend' : 'Kunlik Trend'}
                            </h3>
                            <div className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400">
                                {filterType === 'day' ? 'Bugun' : filterType === 'week' ? 'So\'nggi 7 kun' : 'Bu Oy'}
                            </div>
                        </div>
                        <div className="flex-1 w-full h-64 min-w-[300px] min-h-[200px]">
                            <ResponsiveContainer width="99%" height="100%">
                                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis 
                                        dataKey="time" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 10 }} 
                                        dy={10}
                                        interval={filterType === 'month' ? 3 : 0} 
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 10 }} 
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                                        itemStyle={{ color: strokeColor }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="val" 
                                        stroke={strokeColor} 
                                        strokeWidth={3}
                                        fill={`url(#gradient-${title})`} 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Insights Panel */}
                    <div className="space-y-4">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Asosiy Ko'rsatkichlar</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                    <span className="text-sm text-slate-400">Eng Yuqori {filterType === 'day' ? 'Vaqt' : 'Sana'}</span>
                                    <span className="text-sm font-mono text-white">
                                        {filterType === 'day' ? '09:00' : filterType === 'week' ? 'Chorshanba' : '15-sana'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                    <span className="text-sm text-slate-400">O'sish Sur'ati</span>
                                    <span className={`text-sm font-bold ${colorClass}`}>
                                        {trend === 'up' ? '+' : '-'}5.2%
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-400">O'rtacha / Kun</span>
                                    <span className="text-sm font-mono text-slate-300">
                                        {Math.floor(value / (filterType === 'day' ? 1 : filterType === 'week' ? 7 : 30))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className={`p-4 rounded-xl border ${colorClass.replace('text-', 'bg-').replace('400', '500')}/10 border-${colorClass.replace('text-', '').replace('400', '500')}/20`}>
                            <div className="flex items-start gap-3">
                                <TrendingUp className={colorClass} size={20} />
                                <div>
                                    <h4 className={`text-sm font-bold ${colorClass} mb-1 flex items-center gap-2`}>
                                        AI Prognozi
                                        {loadingInsight && <Loader2 size={12} className="animate-spin text-slate-500" />}
                                    </h4>
                                    <p className="text-xs text-slate-400 leading-relaxed min-h-[3rem]">
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

  useEffect(() => {
    const updateFilteredLogs = async () => {
        // Here we could fetch logs from firestore based on the date range if using queries.
        // For now, filtering the already loaded liveLogs (all logs).
        const filtered = liveLogs.filter(log => {
             // Basic implementation: just show all.
             // Real implementation would need date filtering from Firestore.
             return true; 
        });
        setCurrentLogs(filtered);
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

  // Generate deterministic data for charts based on filter type
  const metricsData = useMemo(() => {
    const seed = selectedDate.getFullYear() * 1000 + selectedDate.getMonth() * 100 + selectedDate.getDate();
    
    // Generate data points appropriate for the view
    const generateChartData = (offset: number) => {
        let points = 7; // default for sparklines
        let labels: string[] = [];

        if (filterType === 'day') {
             labels = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
             points = labels.length;
        } else if (filterType === 'week') {
             const days = eachDayOfInterval({ start: startOfWeek(selectedDate), end: endOfWeek(selectedDate) });
             labels = days.map(d => format(d, 'EEE', { locale: getDateLocale() })); 
             points = 7;
        } else {
             // Month view - simplified to ~15 points for readability
             points = 15; 
             labels = Array.from({length: 15}, (_, i) => `${(i*2)+1}`);
        }

        return labels.map((label, i) => {
            const x = Math.sin(seed + offset + i + (filterType === 'month' ? i : 0)) * 10000;
            // Base value depends on filter type (month numbers are bigger)
            const multiplier = filterType === 'month' ? 3 : 1; 
            const randomVar = Math.floor((x - Math.floor(x)) * 20 * multiplier);
            const base = (filterType === 'day' ? 20 : filterType === 'week' ? 15 : 10) * multiplier;
            
            return { 
                time: label, 
                val: Math.max(0, base + randomVar) 
            };
        });
    };

    return {
        present: generateChartData(1),
        absent: generateChartData(2),
        late: generateChartData(3),
        earlyLeave: generateChartData(4)
    };
  }, [selectedDate, filterType, getDateLocale]);

  // Helper to get active metric data for modal
  const getActiveMetricData = () => {
      if (!expandedMetric) return null;
      switch(expandedMetric) {
          case 'present': return { 
              data: metricsData.present, 
              title: t('dash.totalPresent'), 
              colorClass: 'text-emerald-400', 
              icon: UserCheck,
              value: stats.present,
              trend: 'up'
          };
          case 'absent': return { 
              data: metricsData.absent, 
              title: t('dash.totalAbsent'), 
              colorClass: 'text-rose-400', 
              icon: UserMinus,
              value: stats.absent,
              trend: 'down'
          };
          case 'late': return { 
              data: metricsData.late, 
              title: t('dash.lateArrivals'), 
              colorClass: 'text-amber-400', 
              icon: Clock,
              value: stats.late,
              trend: 'up'
          };
          case 'earlyLeave': return { 
              data: metricsData.earlyLeave, 
              title: 'Early Departures', 
              colorClass: 'text-orange-400', 
              icon: LogOut,
              value: stats.earlyLeave,
              trend: 'up'
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
    <div className="h-full flex flex-col gap-6 relative">
        {/* Metric Modal */}
        {activeData && (
            <ExpandedMetricModal 
                isOpen={!!expandedMetric}
                onClose={() => setExpandedMetric(null)}
                filterType={filterType}
                {...activeData}
            />
        )}

        {/* Top Section: Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            <MetricCard 
                title={t('dash.totalPresent')} 
                value={stats.present} 
                subtext={isToday(selectedDate) && filterType === 'day' ? "+4.5%" : t('dash.analysis')} 
                icon={UserCheck} 
                colorClass="text-emerald-400" 
                trend="up"
                chartData={metricsData.present}
                onClick={() => setExpandedMetric('present')}
            />
            <MetricCard 
                title={t('dash.totalAbsent')} 
                value={stats.absent} 
                subtext={isToday(selectedDate) && filterType === 'day' ? "-2.1%" : t('dash.analysis')} 
                icon={UserMinus} 
                colorClass="text-rose-400" 
                trend="down"
                chartData={metricsData.absent}
                onClick={() => setExpandedMetric('absent')}
            />
            <MetricCard 
                title={t('dash.lateArrivals')} 
                value={stats.late} 
                subtext={isToday(selectedDate) && filterType === 'day' ? "+12%" : t('dash.analysis')} 
                icon={Clock} 
                colorClass="text-amber-400" 
                trend="up"
                chartData={metricsData.late}
                onClick={() => setExpandedMetric('late')}
            />
             <MetricCard 
                title="Early Departures" 
                value={stats.earlyLeave} 
                subtext="Recent Activity" 
                icon={LogOut} 
                colorClass="text-orange-400" 
                trend="up"
                chartData={metricsData.earlyLeave}
                onClick={() => setExpandedMetric('earlyLeave')}
            />
        </div>

        {/* Middle Section: Calendar & Table */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
            {/* Left Panel: Calendar & Quick Filters */}
            <div className="hidden lg:flex flex-col gap-4 col-span-1">
                <CalendarWidget selectedDate={selectedDate} onDateSelect={handleDateSelect} />
                
                {/* Quick Filters */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-slate-400 text-xs font-bold uppercase mb-3">{t('dash.quickFilters')}</h4>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => handleQuickFilter('day')} 
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterType === 'day' && isToday(selectedDate) ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'text-slate-400 hover:bg-slate-800 border-transparent'}`}
                        >
                            {t('dash.today')}
                        </button>
                        <button 
                            onClick={() => handleQuickFilter('week')}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterType === 'week' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'text-slate-400 hover:bg-slate-800 border-transparent'}`}
                        >
                            {t('dash.thisWeek')}
                        </button>
                        <button 
                            onClick={() => handleQuickFilter('month')}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${filterType === 'month' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'text-slate-400 hover:bg-slate-800 border-transparent'}`}
                        >
                            {t('dash.thisMonth')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Panel: Attendance Table */}
            <div className="col-span-1 lg:col-span-3 min-h-0 flex flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                        {t('dash.recordsFor')} <span className="text-white">{getHeaderTitle()}</span>
                    </h3>
                    <div className="text-xs text-slate-500">
                        {currentLogs.length} Qayd topildi
                    </div>
                </div>
                <AttendanceTable data={currentLogs} externalSearch={globalSearchTerm} />
            </div>
        </div>

        {/* Bottom Section: Logs (Always show live logs, independent of history view) */}
        <div className="shrink-0">
            <LogConsole logs={liveLogs} />
        </div>
    </div>
  );
};
