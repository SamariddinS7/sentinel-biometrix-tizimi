import React, { useEffect, useState } from 'react';
import { Notification } from '../types';
import { notificationService } from '../services/notificationService';
import { X, Check, Trash2, Bell, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../services/i18n';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    const updateNotifications = (newNotifications: Notification[]) => {
      setNotifications(newNotifications);
    };

    // Initial load
    setNotifications(notificationService.getNotifications());

    // Subscribe to changes
    const unsubscribe = notificationService.subscribe(updateNotifications);
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
  };

  const handleDelete = (id: string) => {
    notificationService.deleteNotification(id);
  };

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead();
  };

  const handleClearAll = () => {
    notificationService.clearAll();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL': return <AlertCircle className="text-rose-500" size={20} />;
      case 'WARNING': return <AlertTriangle className="text-amber-500" size={20} />;
      case 'SUCCESS': return <CheckCircle className="text-emerald-500" size={20} />;
      default: return <Info className="text-cyan-500" size={20} />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'CRITICAL': return 'bg-rose-500/10 border-rose-500/20';
      case 'WARNING': return 'bg-amber-500/10 border-amber-500/20';
      case 'SUCCESS': return 'bg-emerald-500/10 border-emerald-500/20';
      default: return 'bg-app-surface/50 border-border';
    }
  };

  return (
    <div className="absolute top-16 right-4 w-96 bg-app-panel border border-border rounded-xl shadow-2xl z-50 flex flex-col max-h-[calc(100vh-100px)] animate-in slide-in-from-top-2 fade-in duration-200 origin-top-right">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-app-primary rounded-t-xl">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-text-secondary" />
          <h3 className="font-semibold text-text-primary">Xabarnomalar</h3>
          <span className="bg-brand-primary/20 text-brand-primary text-xs px-2 py-0.5 rounded-full font-mono">
            {notifications.filter(n => !n.read).length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleMarkAllRead}
            className="p-1.5 hover:bg-app-surface rounded-lg text-text-secondary hover:text-emerald-400 transition-colors"
            title="Barchasini o'qilgan deb belgilash"
          >
            <Check size={16} />
          </button>
          <button 
            onClick={handleClearAll}
            className="p-1.5 hover:bg-app-surface rounded-lg text-text-secondary hover:text-rose-400 transition-colors"
            title="Tozalash"
          >
            <Trash2 size={16} />
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-app-surface rounded-lg text-text-secondary hover:text-white transition-colors ml-2"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto custom-scrollbar p-2 space-y-2 flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-primary0">
            <Bell size={48} className="opacity-20 mb-4" />
            <p>Xabarnomalar yo'q</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div 
              key={notification.id}
              className={`p-3 rounded-lg border transition-all relative group ${getBgColor(notification.type)} ${!notification.read ? 'border-l-4 border-l-brand-primary' : ''}`}
            >
              <div className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm font-medium ${!notification.read ? 'text-white' : 'text-text-secondary'}`}>
                      {notification.title}
                    </h4>
                    <span className="text-[10px] text-text-primary0 whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed break-words">
                    {notification.message}
                  </p>
                </div>
              </div>
              
              {/* Actions on hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-app-panel/80 backdrop-blur rounded p-0.5 shadow-sm">
                {!notification.read && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notification.id); }}
                    className="p-1 hover:bg-app-surface rounded text-emerald-400"
                    title="O'qilgan deb belgilash"
                  >
                    <Check size={12} />
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(notification.id); }}
                  className="p-1 hover:bg-app-surface rounded text-rose-400"
                  title="O'chirish"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
