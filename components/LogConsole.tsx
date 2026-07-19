import React, { useEffect, useRef, useState } from 'react';
import { Terminal, ChevronDown } from 'lucide-react';
import { vmsEventService, VmsEvent } from '../services/vmsEventService';

interface LogConsoleProps {
  logs?: any; // Kept for backwards compatibility but we will use vmsEventService
}

export const LogConsole: React.FC<LogConsoleProps> = () => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [events, setEvents] = useState<VmsEvent[]>([]);

  useEffect(() => {
    // Load initial history
    setEvents(vmsEventService.getHistory());

    // Subscribe to all new events
    const unsubscribe = vmsEventService.subscribeToAll((event) => {
      setEvents(prev => {
        const newEvents = [event, ...prev];
        if (newEvents.length > 200) newEvents.pop();
        return newEvents;
      });
    });

    return () => unsubscribe();
  }, []);

  // Auto-scroll to bottom when events update
  useEffect(() => {
    if (isExpanded && events.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, isExpanded]);

  // Reverse events to show oldest at top, newest at bottom for terminal feel
  const displayLogs = [...events].reverse();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-status-critical-text';
      case 'WARNING': return 'text-status-warning-text';
      case 'SUCCESS': return 'text-status-safe-text';
      default: return 'text-brand-primary';
    }
  };

  const formatPayload = (payload: any): string => {
    if (!payload) return '';
    if (typeof payload === 'string') return payload;
    if (payload.msg) return payload.msg;
    if (payload.description) return payload.description;
    
    // Fallback for objects
    try {
      const simplified = { ...payload };
      if (simplified.faceEmbedding) delete simplified.faceEmbedding;
      if (simplified.image) delete simplified.image;
      return JSON.stringify(simplified).substring(0, 100);
    } catch {
      return 'Object data';
    }
  };

  return (
    <div className={`bg-app-primary border border-border flex flex-col font-mono text-xs transition-all duration-300 ease-in-out rounded-xl overflow-hidden shadow-inner ${isExpanded ? 'h-48' : 'h-10'}`}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-2.5 bg-app-panel border-b border-border flex items-center gap-2 text-text-secondary select-none cursor-pointer hover:bg-app-surface transition-colors group min-w-0"
      >
        <Terminal size={14} className="group-hover:text-brand-primary transition-colors shrink-0" />
        <span className="font-bold uppercase tracking-wider group-hover:text-text-primary transition-colors truncate text-xs">Live System Logs</span>
        
        <div className="ml-auto flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-status-safe-text">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-safe-text/75 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-status-safe-text"></span>
                </span>
                <span className="text-[10px] font-bold whitespace-nowrap">ONLINE</span>
            </span>
            <span className="text-text-muted text-[10px] whitespace-nowrap">{events.length} events</span>
            <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-0' : 'rotate-180'} shrink-0`} />
        </div>
      </div>
      
      <div className={`flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar ${!isExpanded && 'hidden'}`}>
        {displayLogs.map((log) => (
          <div key={log.id} className="flex items-center gap-3 hover:bg-app-panel/50 p-0.5 rounded px-2 transition-colors min-w-0">
            <span className="text-text-muted min-w-[70px] shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className={`font-bold shrink-0 min-w-[80px] ${getSeverityColor(log.severity)}`}>
                [{log.severity}]
            </span>
            <span className="text-brand-primary min-w-[120px] truncate shrink-0">{log.type}</span>
            <span className="text-text-secondary truncate flex-1 min-w-0">
                <span className="text-text-muted mr-2">[{log.source}]</span>
                {formatPayload(log.payload)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
