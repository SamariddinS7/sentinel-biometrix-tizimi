
import React, { useMemo } from 'react';

interface GridCell {
    val: number; // Confidence
    lit: number; // Lighting
    qual: number; // Quality
}

interface HeatmapOverlayProps {
    data: {
        rows: number;
        cols: number;
        grid: (GridCell | null)[][];
    } | null;
    mode: 'confidence' | 'lighting' | 'quality';
    visible: boolean;
}

export const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({ data, mode, visible }) => {
    if (!visible || !data || !data.grid) return null;

    // Helper to map value (0-1) to color (Red -> Yellow -> Green)
    // Mode specific color tweaks
    const getColor = (value: number) => {
        // Clamp
        const v = Math.max(0, Math.min(1, value));
        
        // HSL Hue: 0 (Red) -> 60 (Yellow) -> 120 (Green)
        // We compress the range slightly so low values are distinct red
        const hue = Math.pow(v, 1.5) * 120; 
        
        return `hsla(${hue}, 100%, 50%, 0.4)`;
    };

    return (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col w-full h-full animate-in fade-in duration-500">
            {data.grid.map((row, rIdx) => (
                <div key={rIdx} className="flex flex-1 w-full">
                    {row.map((cell, cIdx) => {
                        if (!cell) {
                            return <div key={cIdx} className="flex-1 border-r border-b border-white/5" />;
                        }

                        let metric = 0;
                        if (mode === 'confidence') metric = cell.val;
                        else if (mode === 'lighting') metric = cell.lit;
                        else if (mode === 'quality') metric = cell.qual;

                        return (
                            <div 
                                key={cIdx} 
                                className="flex-1 border-r border-b border-white/5 transition-colors duration-500 backdrop-blur-[1px]"
                                style={{ backgroundColor: getColor(metric) }}
                                title={`${mode}: ${(metric * 100).toFixed(0)}%`}
                            />
                        );
                    })}
                </div>
            ))}
            
            {/* Legend Overlay - Matches Screenshot (Bottom Right, Dark Box) */}
            <div className="absolute bottom-4 right-4 bg-app-primary/90 border border-border p-3 rounded-lg shadow-2xl pointer-events-auto min-w-[140px]">
                <div className="font-bold text-[10px] uppercase text-text-secondary mb-2 tracking-widest">{mode} Heatmap</div>
                <div className="h-2 w-full rounded bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 mb-1"></div>
                <div className="flex justify-between text-[9px] text-text-primary0 font-mono">
                    <span>Poor</span>
                    <span>Optimal</span>
                </div>
            </div>
        </div>
    );
};
