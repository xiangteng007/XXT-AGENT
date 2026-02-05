// Settings store using localStorage

export type DataMode = 'mock' | 'live';

export interface UIPreferences {
    sidebarCollapsed: boolean;
    compactTable: boolean;
}

export interface Settings {
    dataMode: DataMode;
    apiBaseUrl: string;
    uiPreferences: UIPreferences;
}

const STORAGE_KEY = 'dashboard-settings';

const DEFAULT_SETTINGS: Settings = {
    dataMode: 'mock',
    apiBaseUrl: '',
    uiPreferences: {
        sidebarCollapsed: false,
        compactTable: false,
    },
};

export function getSettings(): Settings {
    if (typeof window === 'undefined') {
        return DEFAULT_SETTINGS;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch (error) {
        console.warn('Failed to parse settings from localStorage:', error);
    }

    return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Partial<Settings>): Settings {
    if (typeof window === 'undefined') {
        return DEFAULT_SETTINGS;
    }

    const current = getSettings();
    const updated = {
        ...current,
        ...settings,
        uiPreferences: {
            ...current.uiPreferences,
            ...(settings.uiPreferences || {}),
        },
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.warn('Failed to save settings to localStorage:', error);
    }

    return updated;
}

export function resetSettings(): Settings {
    if (typeof window === 'undefined') {
        return DEFAULT_SETTINGS;
    }

    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to reset settings:', error);
    }

    return DEFAULT_SETTINGS;
}

// React hook for settings (simplified without external dependencies)
import { useState, useEffect, useCallback } from 'react';

export function useSettings() {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

    useEffect(() => {
        setSettings(getSettings());
    }, []);

    const updateSettings = useCallback((newSettings: Partial<Settings>) => {
        const updated = saveSettings(newSettings);
        setSettings(updated);
        return updated;
    }, []);

    const reset = useCallback(() => {
        const defaults = resetSettings();
        setSettings(defaults);
        return defaults;
    }, []);

    return {
        settings,
        updateSettings,
        resetSettings: reset,
    };
}
