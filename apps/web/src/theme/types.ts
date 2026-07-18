
export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
    // Backgrounds
    bgApp: string;
    bgPanel: string;
    bgSurface: string;
    bgOverlay: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textInverted: string;

    // Borders
    borderNormal: string;
    borderFocus: string;

    // Brand
    brandPrimary: string;
    brandSecondary: string;

    // Security Semantics (Backgrounds/Text pairs)
    statusSafeBg: string;
    statusSafeText: string;
    statusWarningBg: string;
    statusWarningText: string;
    statusCriticalBg: string;
    statusCriticalText: string;
    statusUnknownBg: string;
    statusUnknownText: string;

    // 3D Scene Specifics
    sceneBg: string;
    sceneGrid: string;
    sceneMist: string;
}

export interface Theme {
    mode: ThemeMode;
    colors: ThemeColors;
}
