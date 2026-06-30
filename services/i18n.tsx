
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { settingsService } from './settingsService';
import { enUS, es, uz } from 'date-fns/locale';

type Language = 'en-US' | 'es' | 'uz';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  getDateLocale: () => any;
}

const translations: Record<Language, Record<string, string>> = {
  'en-US': {
    // English fallbacks remain for reference
    'nav.dashboard': 'Dashboard',
    'nav.liveDetector': 'Live Detector',
    'nav.records': 'Records',
    'nav.employees': 'Employees',
    'nav.cameras': 'Cameras',
    'nav.settings': 'Settings',
    'nav.systemOnline': 'System Online',
    'nav.aiChat': 'AI Assistant',
    'nav.areaMap': 'Area Map',
    'dash.totalPresent': 'Total Present',
    'dash.totalAbsent': 'Total Absent',
    'dash.lateArrivals': 'Late Arrivals',
    'dash.totalUsers': 'Total Users',
    'dash.analysis': 'Analysis',
    'dash.registered': 'Registered',
    'dash.quickFilters': 'Quick Filters',
    'dash.today': 'Today',
    'dash.thisWeek': 'This Week',
    'dash.thisMonth': 'This Month',
    'dash.recordsFor': 'Records for',
    'table.employee': 'Employee',
    'table.checkIn': 'Check-In',
    'table.checkOut': 'Check-Out',
    'table.confidence': 'Confidence',
    'table.status': 'Status',
    'table.action': 'Action',
    'table.searchPlaceholder': 'Search name, ID, dept...',
    'table.allStatus': 'All Status',
    'cameras.title': 'Camera Management',
    'cameras.matrix': 'Live Matrix',
    'cameras.config': 'Device Config',
    'cameras.add': 'Add Camera',
    'cameras.generateLink': 'Generate Secure Link',
    'cameras.secureLinkDesc': 'Create a time-limited WebRTC link for remote devices.',
    'cameras.type': 'Source Type',
    'cameras.streamUrl': 'Stream URL',
    'cameras.location': 'Location',
    'cameras.status': 'Status',
    'cameras.online': 'ONLINE',
    'cameras.offline': 'OFFLINE',
    'cameras.connecting': 'CONNECTING',
    'cameras.linkExpiry': 'Link Expiry',
    'settings.title': 'System Config',
    'settings.general': 'General',
    'settings.biometrics': 'Biometrics',
    'settings.liveness': 'Liveness',
    'settings.hardware': 'Hardware',
    'settings.attendance': 'Attendance',
    'settings.security': 'Security',
    'settings.performance': 'Performance',
    'settings.logs': 'Logs & Audit',
    'settings.alerts': 'Alerts',
    'settings.backup': 'Backup',
    'settings.save': 'Save Changes',
    'settings.reset': 'Reset',
    'settings.saved': 'Saved',
    'settings.unsaved': 'You have unsaved changes',
    'config.general.title': 'General Configuration',
    'config.general.desc': 'Basic system identity and localization settings.',
    'config.sysName': 'System Name',
    'config.orgName': 'Organization Name',
    'config.timezone': 'Timezone',
    'config.language': 'Language',
    'config.workStart': 'Work Start Time',
    'config.workEnd': 'Work End Time',
    'config.liveness.title': 'Liveness & Anti-Spoofing',
    'config.liveness.desc': 'Prevent presentation attacks using photos or videos.',
    'config.liveness.enable': 'Enable Liveness Detection',
    'config.liveness.eyeBlink': 'Active Check: Eye Blink',
    'config.liveness.eyeBlinkHelp': 'User must blink to verify presence.',
    'config.liveness.headMove': 'Active Check: Head Movement',
    'config.liveness.headMoveHelp': 'User must turn head slightly.',
    'config.liveness.threshold': 'Spoof Confidence Threshold',
    'config.liveness.maxAttempts': 'Max Attempts',
    'config.liveness.maxAttemptsHelp': 'Number of failed checks allowed before lockout.',
    'config.liveness.lockout': 'Lockout Duration (Minutes)',
    'config.liveness.lockoutHelp': 'Time to block user after max failed attempts.',
    'config.camera.title': 'Camera & Hardware',
    'config.camera.desc': 'Configure video input streams and processing limits.',
    'config.camera.resolution': 'Resolution Profile',
    'config.camera.fps': 'FPS Limit',
    'config.camera.fpsHelp': 'Limit processing frame rate to save CPU.',
    'config.camera.exposure': 'Auto-Exposure Compensation',
    'config.camera.health': 'Health Check Interval (min)',
  },
  'es': {
      // Spanish placeholder
      'nav.dashboard': 'Panel de Control',
      'nav.areaMap': 'Mapa del Área',
  },
  'uz': {
    'nav.dashboard': 'Boshqaruv Paneli',
    'nav.liveDetector': 'Jonli Kuzatuv',
    'nav.records': 'Jurnallar',
    'nav.employees': 'Xodimlar',
    'nav.cameras': 'Kameralar',
    'nav.settings': 'Sozlamalar',
    'nav.systemOnline': 'Tizim Ishlamoqda',
    'nav.aiChat': 'AI Yordamchi',
    'nav.areaMap': 'Hududiy Xarita',

    'dash.totalPresent': 'Jami Hozirlar',
    'dash.totalAbsent': 'Jami Kelmaganlar',
    'dash.lateArrivals': 'Kechikkanlar',
    'dash.totalUsers': 'Jami Foydalanuvchilar',
    'dash.analysis': 'Tahlil',
    'dash.registered': 'Ro\'yxatdan o\'tgan',
    'dash.quickFilters': 'Tezkor Filtrlar',
    'dash.today': 'Bugun',
    'dash.thisWeek': 'Bu Hafta',
    'dash.thisMonth': 'Bu Oy',
    'dash.recordsFor': 'Qaydlar:',

    'table.employee': 'Xodim',
    'table.checkIn': 'Kelish',
    'table.checkOut': 'Ketish',
    'table.confidence': 'Aniqlik',
    'table.status': 'Holat',
    'table.action': 'Amal',
    'table.searchPlaceholder': 'Ism, ID yoki bo\'lim bo\'yicha qidiruv...',
    'table.allStatus': 'Barcha Holatlar',

    'cameras.title': 'Kamerani Boshqarish',
    'cameras.matrix': 'Jonli Matritsa',
    'cameras.config': 'Qurilma Sozlamalari',
    'cameras.add': 'Kamera Qo\'shish',
    'cameras.generateLink': 'Xavfsiz Havola Yaratish',
    'cameras.secureLinkDesc': 'Masofaviy qurilmalar uchun vaqtinchalik WebRTC havolasini yaratish.',
    'cameras.type': 'Manba Turi',
    'cameras.streamUrl': 'Oqim URL (Stream)',
    'cameras.location': 'Joylashuv',
    'cameras.status': 'Holat',
    'cameras.online': 'ALOQADA',
    'cameras.offline': 'ALOQA YO\'Q',
    'cameras.connecting': 'ULANMOQDA',
    'cameras.linkExpiry': 'Havola Muddati',

    'settings.title': 'Tizim Sozlamalari',
    'settings.general': 'Umumiy',
    'settings.biometrics': 'Biometrika',
    'settings.liveness': 'Jonlilikni Tekshirish',
    'settings.hardware': 'Qurilmalar',
    'settings.attendance': 'Davomat Qoidalari',
    'settings.security': 'Xavfsizlik',
    'settings.performance': 'Samaradorlik',
    'settings.logs': 'Jurnallar va Audit',
    'settings.alerts': 'Bildirishnomalar',
    'settings.backup': 'Zaxiralash',
    'settings.save': 'O\'zgarishlarni Saqlash',
    'settings.reset': 'Bekor Qilish',
    'settings.saved': 'Saqlandi',
    'settings.unsaved': 'Saqlanmagan o\'zgarishlar mavjud',

    'config.general.title': 'Umumiy Sozlamalar',
    'config.general.desc': 'Tizimning asosiy identifikatsiya va mahalliylashtirish sozlamalari.',
    'config.sysName': 'Tizim Nomi',
    'config.orgName': 'Tashkilot Nomi',
    'config.timezone': 'Vaqt Mintaqasi',
    'config.language': 'Tizim Tili',
    'config.workStart': 'Ish Boshlanish Vaqti',
    'config.workEnd': 'Ish Tugash Vaqti',

    'config.liveness.title': 'Jonlilik va Anti-Spoofing',
    'config.liveness.desc': 'Rasmlar yoki videolar orqali aldashga urinishlarni oldini olish.',
    'config.liveness.enable': 'Jonlilikni Aniqlashni Yoqish',
    'config.liveness.eyeBlink': 'Faol Tekshiruv: Ko\'z Qishish',
    'config.liveness.eyeBlinkHelp': 'Foydalanuvchi mavjudligini tasdiqlash uchun ko\'zini qisishi kerak.',
    'config.liveness.headMove': 'Faol Tekshiruv: Bosh Harakati',
    'config.liveness.headMoveHelp': 'Foydalanuvchi boshini biroz burishi kerak.',
    'config.liveness.threshold': 'Ishonchlilik Chegarasi',
    'config.liveness.maxAttempts': 'Maksimal Urinishlar',
    'config.liveness.maxAttemptsHelp': 'Bloklanishdan oldin ruxsat etilgan xato urinishlar.',
    'config.liveness.lockout': 'Bloklash Vaqti (Daqiqa)',
    'config.liveness.lockoutHelp': 'Maksimal xato urinishlardan keyin bloklash muddati.',

    'config.camera.title': 'Kamera va Qurilmalar',
    'config.camera.desc': 'Video kirish oqimlari va ishlash limitlarini sozlash.',
    'config.camera.resolution': 'Ruxsat Profili (Resolution)',
    'config.camera.fps': 'FPS Chegarasi',
    'config.camera.fpsHelp': 'CPU yuklamasini kamaytirish uchun kadrlar tezligini cheklash.',
    'config.camera.exposure': 'Avto-Ekspozitsiya Kompensatsiyasi',
    'config.camera.health': 'Holatni Tekshirish Oralig\'i (daq)',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default language set to 'uz' explicitly
  const [language, setLanguage] = useState<Language>('uz');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await settingsService.getSettings();
        if (savedSettings && savedSettings.general && savedSettings.general.language) {
          setLanguage(savedSettings.general.language as Language);
        }
      } catch (e) {
        console.error("Failed to load language settings", e);
      }
    };
    loadSettings();
  }, []);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const getDateLocale = () => {
      switch(language) {
          case 'es': return es;
          case 'uz': return uz;
          default: return enUS; // Fallback to English if needed, but UI is Uzbek
      }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, getDateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
