import React from 'react';
import { Shield, Activity, Bell, AlertTriangle, Users, Camera, MapPin, CheckCircle } from 'lucide-react';

interface SOCOverviewProps {
  onNavigate: (id: string) => void;
}

export const SOCOverview: React.FC<SOCOverviewProps> = ({ onNavigate }) => {
  const stats = [
    { label: 'Faol kameralar', value: '18 / 18', change: '100% Onlayn', icon: Camera, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Tizim xavfsizligi', value: 'OK', change: 'Muammolar yo\'q', icon: Shield, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Faol signallar', value: '2 ta', change: 'O\'rtacha og\'irlikda', icon: Bell, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Hodisalar (Bugun)', value: '12 ta', change: 'Hammasi nazoratda', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  const quickLinks = [
    { title: 'Video Devor', desc: 'Kameralardan jonli translyatsiyani ko\'rish', id: 'video_wall', icon: Camera },
    { title: 'Hodisalar Markazi', desc: 'Xavfsizlik hodisalarini boshqarish', id: 'incidents', icon: AlertTriangle },
    { title: 'Raqamli Egizak', desc: '3D makonda kameralarni monitoring qilish', id: 'digital_twin', icon: Shield },
  ];

  const recentAlerts = [
    { time: '10:42', type: 'Xavf aniqlandi', cam: 'KAM-04 (Ombor)', desc: 'Taqiqlangan hududga kirish aniqlandi', status: 'Ochiq' },
    { time: '09:15', type: 'PPE buzilishi', cam: 'KAM-12 (Kirish)', desc: 'Kaskasiz xodim aniqlandi', status: 'Yopildi' },
    { time: '08:30', type: 'Tizim xabari', cam: 'Markaziy Server', desc: 'Kamerani qayta yuklash yakunlandi', status: 'Yopildi' },
  ];

  return (
    <div id="soc-overview" className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-sans tracking-tight">Xavfsizlik Boshqaruv Markazi</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sentinel VMS tizimining real vaqt rejimida umumiy holati</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center space-x-4">
              <div className={`${stat.bg} p-3 rounded-lg`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stat.change}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Navigation Links */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tezkor O'tish</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickLinks.map((link, idx) => {
                const Icon = link.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => onNavigate(link.id)}
                    className="flex flex-col items-start p-4 rounded-xl border border-gray-150 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/10 dark:hover:bg-blue-900/10 transition text-left group"
                  >
                    <Icon className="w-5 h-5 text-blue-500 mb-2 group-hover:scale-110 transition" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{link.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{link.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Alerts list */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Oxirgi Signallar</h2>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentAlerts.map((alert, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono text-gray-400">{alert.time}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>{alert.type}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{alert.cam} — {alert.desc}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    alert.status === 'Ochiq'
                      ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {alert.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Active System Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tizim Ma'lumotlari</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Versiya:</span>
                <span className="font-semibold text-gray-900 dark:text-white">v3.0.4 Enterprise</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Ishlash Vaqti:</span>
                <span className="font-semibold text-gray-900 dark:text-white">99.98%</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">AI Platformasi:</span>
                <span className="font-semibold text-gray-900 dark:text-white">Gemini API faol</span>
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Sentinel VMS aqlli video monitoring va biometrik tahlil qilish uchun eng ilg'or texnologiyalardan foydalanadi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
