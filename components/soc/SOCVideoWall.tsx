import React, { useState } from 'react';
import { Camera, Maximize2, Play, Pause, Settings, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';

interface CameraFeed {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'ALERT';
  fps: number;
  resolution: string;
  location: string;
  color: string;
}

export const SOCVideoWall: React.FC = () => {
  const [selectedCam, setSelectedCam] = useState<string | null>(null);

  const cameras: CameraFeed[] = [
    { id: 'cam-01', name: 'Asosiy Kirish', status: 'ONLINE', fps: 30, resolution: '1920x1080', location: 'Blok A, Kirish eshigi', color: 'bg-emerald-500/10' },
    { id: 'cam-02', name: 'Avtoturargoh A', status: 'ONLINE', fps: 25, resolution: '1920x1080', location: 'Ochiq parkovka', color: 'bg-emerald-500/10' },
    { id: 'cam-03', name: 'Server Xonasi', status: 'ONLINE', fps: 30, resolution: '1920x1080', location: 'Texnologiya binosi', color: 'bg-indigo-500/10' },
    { id: 'cam-04', name: 'Xavfli Hudud B', status: 'ALERT', fps: 30, resolution: '1920x1080', location: 'Omborxona perimetri', color: 'bg-rose-500/10' },
    { id: 'cam-05', name: 'Qabulxona (Lobby)', status: 'ONLINE', fps: 25, resolution: '1280x720', location: 'Markaziy ofis', color: 'bg-emerald-500/10' },
    { id: 'cam-06', name: 'Orqa Chiqish', status: 'ONLINE', fps: 15, resolution: '1280x720', location: 'Ombor darvozasi', color: 'bg-emerald-500/10' },
  ];

  return (
    <div id="soc-video-wall" className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-sans tracking-tight">Kamera va Video Devor</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Barcha datchik va kameralarni to'g'ridan-to'g'ri monitoring qilish</p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm">
            Tizim yangiligi
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cameras.map((cam) => (
          <div
            key={cam.id}
            onClick={() => setSelectedCam(cam.id)}
            className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col group cursor-pointer hover:shadow-md hover:border-blue-500/50 dark:hover:border-blue-500/50 transition duration-200"
          >
            {/* Header / Info bar */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-1.5">
                  <Camera className="w-4 h-4 text-gray-500" />
                  <span>{cam.name}</span>
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{cam.location}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                cam.status === 'ONLINE' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' :
                cam.status === 'ALERT' ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 animate-pulse' :
                'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}>
                {cam.status}
              </span>
            </div>

            {/* Simulated Stream Viewport */}
            <div className="relative aspect-video bg-gray-950 flex flex-col items-center justify-center overflow-hidden">
              {/* Animated scanlines and overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30 pointer-events-none z-10"></div>
              
              {/* Static camera icon / backdrop */}
              <div className="flex flex-col items-center space-y-2 z-10">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition duration-300">
                  <Play className="w-5 h-5 text-white fill-white/80" />
                </div>
                <span className="text-xs text-gray-400 font-medium">Kamera tasvirini ochish</span>
              </div>

              {/* LIVE indicator overlay */}
              <div className="absolute top-3 left-3 flex items-center space-x-1.5 bg-black/60 px-2 py-1 rounded-md border border-white/10 z-10">
                <span className={`w-1.5 h-1.5 rounded-full ${cam.status === 'ALERT' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></span>
                <span className="text-[10px] text-white font-bold font-mono">LIVE</span>
              </div>

              {/* Technical details overlay */}
              <div className="absolute bottom-3 right-3 bg-black/60 px-2 py-1 rounded-md border border-white/10 text-[9px] text-gray-400 font-mono z-10 flex space-x-2">
                <span>FPS: {cam.fps}</span>
                <span>{cam.resolution}</span>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 flex justify-between items-center text-xs border-t border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 font-medium">Biometrik datchik: FAOL</span>
              <div className="flex space-x-2">
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition text-gray-500 hover:text-gray-700">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition text-gray-500 hover:text-gray-700">
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
