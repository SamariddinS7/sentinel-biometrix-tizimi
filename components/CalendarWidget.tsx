import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  getDay, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday 
} from 'date-fns';

interface CalendarWidgetProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ selectedDate, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const startingDayIndex = getDay(startOfMonth(currentMonth)); // 0 = Sunday

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-200 font-semibold select-none">{format(currentMonth, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <button 
            onClick={handlePrevMonth}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNextMonth}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2 select-none">
        <div>S</div>
        <div>M</div>
        <div>T</div>
        <div>W</div>
        <div>T</div>
        <div>F</div>
        <div>S</div>
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1">
        {/* Empty cells for previous month */}
        {Array.from({ length: startingDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {daysInMonth.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isToday(day);
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-sm transition-all
                ${isSelected 
                  ? 'bg-cyan-600 text-white font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400' 
                  : isCurrentDay
                    ? 'bg-slate-800 text-cyan-400 border border-cyan-900'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Selected:</span>
            <span className="text-cyan-400 font-mono">{format(selectedDate, 'yyyy-MM-dd')}</span>
        </div>
      </div>
    </div>
  );
};