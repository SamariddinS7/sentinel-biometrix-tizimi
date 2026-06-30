import React, { useEffect, useRef, useState } from 'react';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { Terminal, ChevronDown } from 'lucide-react';

interface LogConsoleProps {
  logs: AttendanceRecord[];
}

export const LogConsole: React.FC<LogConsoleProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (isExpanded && logs.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  // Reverse logs to show oldest at top, newest at bottom for terminal feel
  const displayLogs = [...logs].reverse();

  return (
    <div className={`bg-slate-950 border-t border-slate-800 flex flex-col font-mono text-xs transition-all duration-300 ease-in-out ${isExpanded ? 'h-48' : 'h-10'}`}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2 text-slate-400 select-none cursor-pointer hover:bg-slate-800 transition-colors group"
      >
        <Terminal size={14} className="group-hover:text-cyan-400 transition-colors" />
        <span className="font-semibold uppercase tracking-wider group-hover:text-slate-200 transition-colors">Live System Logs</span>
        
        <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold">ONLINE</span>
            </span>
            <span className="text-slate-600 text-[10px]">{logs.length} events</span>
            <ChevronDown size={14} className={`text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-0' : 'rotate-180'}`} />
        </div>
      </div>
      
      <div className={`flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar ${!isExpanded && 'hidden'}`}>
        {displayLogs.map((log) => (
          <div key={log.id} className="flex gap-3 hover:bg-slate-900/50 p-0.5 rounded px-2 transition-colors">
            <span className="text-slate-500 min-w-[80px]">{log.timestamp}</span>
            <span className={`font-bold ${
                log.status === AttendanceStatus.PRESENT ? 'text-emerald-400' :
                log.status === AttendanceStatus.LATE ? 'text-amber-400' : 
                log.status === AttendanceStatus.EARLY_LEAVE ? 'text-orange-400' : 'text-red-400'
            }`}>
                {log.status === AttendanceStatus.PRESENT ? '[SUCCESS]' : 
                 log.status === AttendanceStatus.LATE ? '[WARN]' : 
                 log.status === AttendanceStatus.EARLY_LEAVE ? '[WARN]' : '[REJECT]'}
            </span>
            <span className="text-slate-300 truncate">
                ID: <span className="text-cyan-400">{log.userId}</span> | 
                User: <span className="text-slate-200">{log.userName}</span> | 
                Node: {log.nodeId} | 
                Conf: {(log.confidenceScore * 100).toFixed(1)}%
            </span>
            {log.status === AttendanceStatus.ABSENT && (
                <span className="text-red-500 ml-auto whitespace-nowrap">⚠ Liveness Failed</span>
            )}
            {log.status === AttendanceStatus.EARLY_LEAVE && (
                <span className="text-orange-500 ml-auto whitespace-nowrap">⚠ Early Departure</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};