import type { Theme, FileSortKind } from '../types';

const STORAGE_KEY = 'pilcrow_settings';

export interface Settings {
  recentFiles: string[];
  theme: Theme;
  fileSort: FileSortKind;
}

export const DEFAULT_SETTINGS: Settings = {
  recentFiles: [],
  theme: 'light',
  fileSort: 'name',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      recentFiles: Array.isArray(parsed.recentFiles) ? parsed.recentFiles : [],
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      fileSort: parsed.fileSort === 'mtime' || parsed.fileSort === 'none' ? parsed.fileSort : 'name',
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
