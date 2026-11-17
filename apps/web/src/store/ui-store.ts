import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_USER_ID = 'U-01';

export interface UiState {
  currentUserId: string;
  theme: 'light' | 'dark';
  setCurrentUserId: (id: string) => void;
  setTheme: (theme: UiState['theme']) => void;
}

/** Local UI preferences only. Filters and anything shareable live in the URL. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentUserId: DEFAULT_USER_ID,
      theme: 'light',
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'alerts-demo-ui',
      version: 0,
      partialize: (s) => ({ currentUserId: s.currentUserId, theme: s.theme }),
    },
  ),
);
