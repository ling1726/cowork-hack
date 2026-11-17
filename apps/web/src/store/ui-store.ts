import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_USER_ID = 'U-01';

export interface UiState {
  currentUserId: string;
  theme: 'light' | 'dark';
  density: 'comfortable' | 'compact';
  setCurrentUserId: (id: string) => void;
  setTheme: (theme: UiState['theme']) => void;
  setDensity: (density: UiState['density']) => void;
}

/** Local UI preferences only. Filters and anything shareable live in the URL. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentUserId: DEFAULT_USER_ID,
      theme: 'light',
      density: 'comfortable',
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: 'alerts-demo-ui',
      version: 0,
      partialize: (s) => ({ currentUserId: s.currentUserId, theme: s.theme, density: s.density }),
    },
  ),
);
