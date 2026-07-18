
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme, ThemeMode, ThemeColors } from './types';
import { DARK_THEME, LIGHT_THEME } from './tokens';

interface ThemeContextType {
    mode: ThemeMode;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
    colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setModeState] = useState<ThemeMode>('dark');

    // 1. Initialize from LocalStorage or System Preference
    useEffect(() => {
        const saved = localStorage.getItem('sentinel_theme') as ThemeMode;
        if (saved) {
            setModeState(saved);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            setModeState('light');
        }
    }, []);

    const colors = mode === 'dark' ? DARK_THEME : LIGHT_THEME;

    // 2. Inject CSS Variables into :root
    useEffect(() => {
        const root = document.documentElement;
        
        // Helper to convert CamelCase to kebab-case variables
        const setVar = (key: string, value: string) => {
            const varName = `--color-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
            root.style.setProperty(varName, value);
        };

        Object.entries(colors).forEach(([key, value]) => {
            setVar(key, value);
        });

        // Set generic data attribute for CSS selectors if needed
        root.setAttribute('data-theme', mode);
        
    }, [mode, colors]);

    const setTheme = (newMode: ThemeMode) => {
        setModeState(newMode);
        localStorage.setItem('sentinel_theme', newMode);
    };

    const toggleTheme = () => {
        setTheme(mode === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme, setTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme must be used within ThemeProvider");
    return context;
};
