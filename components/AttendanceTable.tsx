
import React, { useState, useMemo, useEffect } from 'react';
import { AttendanceRecord, AttendanceStatus } from '../types';
import { MoreVertical, User as UserIcon, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useLanguage } from '../services/i18n';

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
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-full">
      {/* Header with Filters */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="text-slate-200 font-semibold text-sm uppercase tracking-wide">{t('nav.records')}</h3>
        
        <div className="flex gap-3 w-full sm:w-auto">
           {/* Search Input */}
           <div className="relative flex-1 sm:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
             <input 
                type="text"
                placeholder={t('table.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600"
             />
           </div>

           {/* Status Dropdown */}
           <div className="relative">
             <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 appearance-none cursor-pointer hover:bg-slate-900 transition-colors"
             >
               <option value="All">{t('table.allStatus')}</option>
               <option value={AttendanceStatus.PRESENT}>Present</option>
               <option value={AttendanceStatus.LATE}>Late</option>
               <option value={AttendanceStatus.EARLY_LEAVE}>Early Leave</option>
               <option value={AttendanceStatus.ABSENT}>Absent</option>
             </select>
             <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
           </div>
        </div>
      </div>
      
      {/* Table Content */}
      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 font-medium">{t('table.employee')}</th>
              <th className="px-6 py-3 font-medium">{t('table.checkIn')}</th>
              <th className="px-6 py-3 font-medium">{t('table.checkOut')}</th>
              <th className="px-6 py-3 font-medium">{t('table.confidence')}</th>
              <th className="px-6 py-3 font-medium">{t('table.status')}</th>
              <th className="px-6 py-3 font-medium text-right">{t('table.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {paginatedData.length > 0 ? (
                paginatedData.map((record) => (
                <tr key={record.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        {record.userAvatar ? (
                            <img src={record.userAvatar} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-slate-700" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700">
                                <UserIcon size={16} className="text-slate-500"/>
                            </div>
                        )}
                        <div>
                        <p className="font-medium text-slate-200">{record.userName}</p>
                        <p className="text-xs text-slate-500">{record.department}</p>
                        </div>
                    </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">{record.checkIn}</td>
                    <td className="px-6 py-4 font-mono text-slate-400">{record.checkOut || '--:--'}</td>
                    <td className="px-6 py-4">
                    <div className="w-24">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Match</span>
                        <span>{(record.confidenceScore * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${
                                record.confidenceScore > 0.9 ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 
                                record.confidenceScore > 0.7 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${record.confidenceScore * 100}%` }}
                        />
                        </div>
                    </div>
                    </td>
                    <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${
                        record.status === AttendanceStatus.PRESENT 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : record.status === AttendanceStatus.LATE 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : record.status === AttendanceStatus.EARLY_LEAVE
                                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                        {record.status}
                    </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                    <button className="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical size={16} />
                    </button>
                    </td>
                </tr>
                ))
            ) : (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <Search size={24} className="opacity-20" />
                            <p>No records found matching your filters.</p>
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 bg-slate-900">
        <span>
            Showing {filteredData.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} records
        </span>
        <div className="flex gap-2 items-center">
            <button 
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-1.5 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-400 hover:text-white"
            >
                <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-slate-300 font-mono">
                Page {currentPage} / {totalPages || 1}
            </span>
            <button 
                onClick={handleNextPage}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-400 hover:text-white"
            >
                <ChevronRight size={16} />
            </button>
        </div>
      </div>
    </div>
  );
};
