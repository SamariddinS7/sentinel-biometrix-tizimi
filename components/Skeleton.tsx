import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle' | 'card' | 'table-row';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const baseClasses = 'animate-pulse bg-slate-800/60 rounded';

  switch (variant) {
    case 'text':
      return <div className={`${baseClasses} h-4 w-full ${className}`} />;
    case 'circle':
      return <div className={`${baseClasses} rounded-full ${className}`} />;
    case 'card':
      return (
        <div className={`p-4 border border-slate-800 bg-slate-900/40 rounded-xl space-y-3 ${className}`}>
          <div className="flex items-center space-x-3">
            <div className={`${baseClasses} h-10 w-10 rounded-full`} />
            <div className="space-y-2 flex-1">
              <div className={`${baseClasses} h-4 w-1/3`} />
              <div className={`${baseClasses} h-3 w-1/2`} />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <div className={`${baseClasses} h-3 w-full`} />
            <div className={`${baseClasses} h-3 w-5/6`} />
            <div className={`${baseClasses} h-3 w-2/3`} />
          </div>
        </div>
      );
    case 'table-row':
      return (
        <div className={`flex items-center space-x-4 py-3 px-4 border-b border-slate-800/40 ${className}`}>
          <div className={`${baseClasses} h-8 w-8 rounded`} />
          <div className={`${baseClasses} h-4 flex-1`} />
          <div className={`${baseClasses} h-4 w-24`} />
          <div className={`${baseClasses} h-4 w-16`} />
          <div className={`${baseClasses} h-4 w-12`} />
        </div>
      );
    case 'rect':
    default:
      return <div className={`${baseClasses} ${className}`} />;
  }
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      {/* Upper stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 border border-slate-800 bg-slate-900/40 rounded-xl space-y-3">
            <div className="flex justify-between items-start">
              <Skeleton className="h-4 w-24" />
              <Skeleton variant="circle" className="h-8 w-8" />
            </div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Main body split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle heavy column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-4 border border-slate-800 bg-slate-900/40 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-32" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
          
          <div className="p-4 border border-slate-800 bg-slate-900/40 rounded-xl space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} variant="table-row" />
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar column */}
        <div className="space-y-6">
          <div className="p-4 border border-slate-800 bg-slate-900/40 rounded-xl space-y-4">
            <Skeleton className="h-5 w-40" />
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
