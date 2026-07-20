import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AttendanceRecord, AttendanceStatus } from '../types';

export const ActivityHeatmap: React.FC<{ logs: AttendanceRecord[] }> = ({ logs }) => {
    // Generate heatmap data
    const data = useMemo(() => {
        const hours = ['07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        
        // Initialize data matrix
        const matrix: Record<string, Record<string, number>> = {};
        days.forEach(d => {
            matrix[d] = {};
            hours.forEach(h => {
                matrix[d][h] = 0;
            });
        });

        // Add actual logs
        logs.forEach(log => {
            const date = new Date(log.timestamp);
            const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
            const hourStr = date.getHours().toString().padStart(2, '0');
            
            if (matrix[dayStr] && matrix[dayStr][hourStr] !== undefined) {
                matrix[dayStr][hourStr] += 1;
            }
        });

        const flatData = [];
        let maxVal = 1;

        days.forEach(day => {
            hours.forEach(hour => {
                const val = matrix[day][hour] || 0;
                if (val > maxVal) maxVal = val;
                flatData.push({
                    day,
                    hour: `${hour}:00`,
                    value: val
                });
            });
        });

        return { flatData, maxVal };
    }, [logs]);

    const getColor = (value: number, max: number) => {
        if (value === 0) return 'rgba(99, 102, 241, 0.05)';
        const ratio = value / max;
        // From very light indigo to bright brand primary
        if (ratio < 0.2) return 'rgba(99, 102, 241, 0.2)';
        if (ratio < 0.4) return 'rgba(99, 102, 241, 0.4)';
        if (ratio < 0.6) return 'rgba(99, 102, 241, 0.6)';
        if (ratio < 0.8) return 'rgba(99, 102, 241, 0.8)';
        return 'rgba(99, 102, 241, 1)'; // Solid brand primary
    };

    const CustomShape = (props: any) => {
        const { cx, cy, payload } = props;
        if (!cx || !cy) return null;
        const color = getColor(payload.value, data.maxVal);
        
        // Calculate cell size based on assumed chart dimensions, or just use a fixed safe size
        // Alternatively, use percentage or viewBox if passed, but typically Scatter doesn't give us width/height directly.
        // We'll use a fixed size that looks good in most responsive layouts.
        const size = 28;
        return (
            <rect 
                x={cx - size/2} 
                y={cy - size/2} 
                width={size} 
                height={size} 
                rx={4} 
                fill={color} 
                className="transition-all duration-300 hover:opacity-80"
            />
        );
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-app-panel border border-border p-2 rounded-lg shadow-lg text-xs">
                    <p className="font-bold text-text-primary mb-1">{data.day} at {data.hour}</p>
                    <p className="text-text-secondary">Activity: <span className="text-brand-primary font-bold">{data.value}</span> events</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-full min-h-[250px] bg-app-surface/50 rounded-xl p-4 border border-border flex flex-col">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Peak Activity Heatmap</h3>
            <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 30 }}>
                        <XAxis 
                            type="category" 
                            dataKey="hour" 
                            name="Hour" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} 
                            dy={10}
                        />
                        <YAxis 
                            type="category" 
                            dataKey="day" 
                            name="Day" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} 
                            dx={-10}
                        />
                        <ZAxis type="number" dataKey="value" range={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--color-border-normal)' }} />
                        <Scatter data={data.flatData} shape={<CustomShape />} />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-end items-center mt-2 gap-2 text-[10px] text-text-muted">
                <span>Low</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-sm bg-indigo-500/5"></div>
                    <div className="w-3 h-3 rounded-sm bg-indigo-500/20"></div>
                    <div className="w-3 h-3 rounded-sm bg-indigo-500/40"></div>
                    <div className="w-3 h-3 rounded-sm bg-indigo-500/60"></div>
                    <div className="w-3 h-3 rounded-sm bg-indigo-500/80"></div>
                    <div className="w-3 h-3 rounded-sm bg-indigo-500"></div>
                </div>
                <span>High</span>
            </div>
        </div>
    );
};
