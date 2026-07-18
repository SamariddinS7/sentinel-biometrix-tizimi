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
    <div className="bg-app-panel border border-border rounded-xl p-4 shadow-md h-auto flex flex-col min-h-fit">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-text-primary font-bold select-none text-sm">{format(currentMonth, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-app-surface rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-app-surface rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-text-muted mb-2 select-none">
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
                aspect-square flex items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer
                ${isSelected 
                  ? 'bg-brand-primary text-text-inverted font-bold shadow-md ring-1 ring-brand-primary/50' 
                  : isCurrentDay
                    ? 'bg-app-surface text-brand-primary border border-brand-primary/30 font-bold'
                    : 'text-text-secondary hover:bg-app-surface hover:text-text-primary'}
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Selected:</span>
            <span className="text-brand-primary font-mono font-semibold">{format(selectedDate, 'yyyy-MM-dd')}</span>
        </div>
      </div>
    </div>
  );
};
