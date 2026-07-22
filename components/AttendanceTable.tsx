import React, { useState, useMemo, useEffect } from 'react';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { MoreVertical, User as UserIcon, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { PersonNameLink } from '../context/PersonProfileContext';

interface AttendanceTableProps {
  data: AttendanceRecord[];
  externalSearch?: string;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({ data, externalSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const { t } = useLanguage();

  // Sync external search
  useEffect(() => {
    if (typeof externalSearch === 'string') {
        setSearchQuery(externalSearch);
    }
  }, [externalSearch]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Filter Logic
  const filteredData = useMemo(() => {
    return data.filter(record => {
      const matchesSearch = 
        record.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.userId.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || record.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, searchQuery, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  return (
    <div className="bg-app-panel border border-border rounded-xl overflow-hidden shadow-md flex flex-col h-full">
      {/* Header with Filters */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4 bg-app-panel">
        <h3 className="text-text-primary font-bold text-sm uppercase tracking-wide">{t('nav.records')}</h3>
        
        <div className="flex gap-3 w-full sm:w-auto">
           {/* Search Input */}
           <div className="relative flex-1 sm:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
             <input 
                type="text"
                placeholder={t('table.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-app-primary border border-border text-text-secondary text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 transition-all placeholder:text-text-muted/60"
             />
           </div>

           {/* Status Dropdown */}
           <div className="relative">
             <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-app-primary border border-border text-text-secondary text-xs rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 appearance-none cursor-pointer hover:bg-app-surface transition-colors"
             >
                <option value="All">{t('table.allStatus')}</option>
                <option value={AttendanceStatus.PRESENT}>Present</option>
                <option value={AttendanceStatus.LATE}>Late</option>
                <option value={AttendanceStatus.EARLY_LEAVE}>Early Leave</option>
                <option value={AttendanceStatus.ABSENT}>Absent</option>
             </select>
             <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
           </div>
        </div>
      </div>
      
      {/* Table Content */}
      <div className="overflow-auto flex-1 custom-scrollbar bg-app-panel">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-app-primary text-text-muted text-xs uppercase tracking-wider sticky top-0 z-10 border-b border-border shadow-sm">
            <tr>
              <th className="px-6 py-3 font-semibold">{t('table.employee')}</th>
              <th className="px-6 py-3 font-semibold">{t('table.checkIn')}</th>
              <th className="px-6 py-3 font-semibold">{t('table.checkOut')}</th>
              <th className="px-6 py-3 font-semibold">{t('table.confidence')}</th>
              <th className="px-6 py-3 font-semibold">{t('table.status')}</th>
              <th className="px-6 py-3 font-semibold text-right">{t('table.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {paginatedData.length > 0 ? (
                paginatedData.map((record) => (
                <tr key={record.id} className="hover:bg-app-surface/40 transition-colors group">
                    <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        {record.userAvatar ? (
                            <img src={record.userAvatar} alt="" className="w-9 h-9 rounded-full object-cover border border-border" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-app-surface flex items-center justify-center border border-border">
                                <UserIcon size={16} className="text-text-muted"/>
                            </div>
                        )}
                        <div>
                        <PersonNameLink personId={record.userId} name={record.userName} className="font-semibold text-text-primary block" />
                        <p className="text-xs text-text-muted">{record.department}</p>
                        </div>
                    </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-text-secondary">{record.checkIn}</td>
                    <td className="px-6 py-4 font-mono text-text-secondary">{record.checkOut || '--:--'}</td>
                    <td className="px-6 py-4">
                    <div className="w-24">
                        <div className="flex justify-between text-[10px] text-text-muted mb-1 font-medium">
                        <span>Match</span>
                        <span>{(record.confidenceScore * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-app-surface rounded-full overflow-hidden border border-border/10">
                        <div 
                            className={`h-full rounded-full ${
                                record.confidenceScore > 0.9 ? 'bg-brand-primary shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 
                                record.confidenceScore > 0.7 ? 'bg-status-warning-text' : 'bg-status-critical-text'
                            }`}
                            style={{ width: `${record.confidenceScore * 100}%` }}
                        />
                        </div>
                    </div>
                    </td>
                    <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${
                        record.status === AttendanceStatus.PRESENT 
                            ? 'bg-status-safe-bg text-status-safe-text border-status-safe-text/10' 
                            : record.status === AttendanceStatus.LATE 
                                ? 'bg-status-warning-bg text-status-warning-text border-status-warning-text/10'
                                : record.status === AttendanceStatus.EARLY_LEAVE
                                    ? 'bg-status-warning-bg/50 text-orange-500 border-orange-500/10'
                                    : 'bg-status-critical-bg text-status-critical-text border-status-critical-text/10'
                    }`}>
                        {record.status}
                    </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                    <button className="text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <MoreVertical size={16} />
                    </button>
                    </td>
                </tr>
                ))
            ) : (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-text-muted bg-app-panel">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <Search size={24} className="opacity-40 text-text-muted" />
                            <p className="font-medium text-xs">No records found matching your filters.</p>
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="p-3 border-t border-border flex justify-between items-center text-xs text-text-muted bg-app-panel">
        <span>
            Showing {filteredData.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} records
        </span>
        <div className="flex gap-2 items-center">
            <button 
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-1.5 hover:bg-app-surface rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-text-secondary hover:text-text-primary cursor-pointer"
            >
                <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-text-secondary font-mono">
                Page {currentPage} / {totalPages || 1}
            </span>
            <button 
                onClick={handleNextPage}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 hover:bg-app-surface rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-text-secondary hover:text-text-primary cursor-pointer"
            >
                <ChevronRight size={16} />
            </button>
        </div>
      </div>
    </div>
  );
};
