import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface UIStore {
  theme: Theme;
  collapsedCategories: string[];
  keyboardNavIndex: number;

  setTheme: (theme: Theme) => void;
  toggleCategory: (categoryName: string) => void;
  setKeyboardNavIndex: (index: number) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'system',
      collapsedCategories: [],
      keyboardNavIndex: -1,

      setTheme: (theme) => set({ theme }),

      toggleCategory: (categoryName) =>
        set((state) => ({
          collapsedCategories: state.collapsedCategories.includes(categoryName)
            ? state.collapsedCategories.filter((c) => c !== categoryName)
            : [...state.collapsedCategories, categoryName],
        })),

      setKeyboardNavIndex: (index) => set({ keyboardNavIndex: index }),
    }),
    {
      name: 'tibdp-ui',
    }
  )
);
