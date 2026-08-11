import type { Theme } from '../types';

const STORAGE_KEY = 'md_rw_settings';

export interface Settings {
  recentFiles: string[];
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = {
  recentFiles: [],
  theme: 'light',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      recentFiles: Array.isArray(parsed.recentFiles) ? parsed.recentFiles : [],
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (e.g. quota/incognito) — persistence is best-effort
  }
}
