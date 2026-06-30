
import { ThemeColors } from './types';

export const DARK_THEME: ThemeColors = {
    // Slate 950 base
    bgApp: '#020617', 
    bgPanel: '#0f172a',
    bgSurface: '#1e293b',
    bgOverlay: 'rgba(2, 6, 23, 0.8)',

    textPrimary: '#f8fafc', // Slate 50
    textSecondary: '#94a3b8', // Slate 400
    textMuted: '#64748b', // Slate 500
    textInverted: '#020617',

    borderNormal: '#1e293b', // Slate 800
    borderFocus: '#06b6d4', // Cyan 500

    brandPrimary: '#06b6d4', // Cyan 500
    brandSecondary: '#4f46e5', // Indigo 600

    // Security: High contrast against dark backgrounds
    statusSafeBg: 'rgba(16, 185, 129, 0.1)', // Emerald 500/10
    statusSafeText: '#34d399', // Emerald 400
    statusWarningBg: 'rgba(245, 158, 11, 0.1)', // Amber 500/10
    statusWarningText: '#fbbf24', // Amber 400
    statusCriticalBg: 'rgba(244, 63, 94, 0.1)', // Rose 500/10
    statusCriticalText: '#fb7185', // Rose 400
    statusUnknownBg: 'rgba(100, 116, 139, 0.2)', // Slate 500/20
    statusUnknownText: '#94a3b8', // Slate 400

    // 3D Scene
    sceneBg: '#020617',
    sceneGrid: '#334155',
    sceneMist: '#020617',
};

export const LIGHT_THEME: ThemeColors = {
    // Slate 50 base
    bgApp: '#f8fafc',
    bgPanel: '#ffffff',
    bgSurface: '#f1f5f9', // Slate 100
    bgOverlay: 'rgba(255, 255, 255, 0.8)',

    textPrimary: '#0f172a', // Slate 900
    textSecondary: '#475569', // Slate 600
    textMuted: '#94a3b8', // Slate 400
    textInverted: '#ffffff',

    borderNormal: '#e2e8f0', // Slate 200
    borderFocus: '#0891b2', // Cyan 600

    brandPrimary: '#0891b2', // Cyan 600 (Darker for light mode contrast)
    brandSecondary: '#4338ca', // Indigo 700

    // Security: Darker text on light backgrounds for readability
    statusSafeBg: '#d1fae5', // Emerald 100
    statusSafeText: '#047857', // Emerald 700
    statusWarningBg: '#fef3c7', // Amber 100
    statusWarningText: '#b45309', // Amber 700
    statusCriticalBg: '#ffe4e6', // Rose 100
    statusCriticalText: '#be123c', // Rose 700
    statusUnknownBg: '#e2e8f0', // Slate 200
    statusUnknownText: '#475569', // Slate 600

    // 3D Scene
    sceneBg: '#f1f5f9',
    sceneGrid: '#cbd5e1', // Slate 300
    sceneMist: '#f1f5f9',
};
