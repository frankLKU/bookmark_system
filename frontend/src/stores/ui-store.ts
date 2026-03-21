import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface UIStore {
  theme: Theme;
  collapsedCategories: string[];
  keyboardNavIndex: number;
  proxyBaseUrl: string;
  useProxy: boolean;

  setTheme: (theme: Theme) => void;
  toggleCategory: (categoryName: string) => void;
  setKeyboardNavIndex: (index: number) => void;
  setProxyBaseUrl: (url: string) => void;
  setUseProxy: (enabled: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'system',
      collapsedCategories: [],
      keyboardNavIndex: -1,
      proxyBaseUrl: 'http://localhost:8000',
      useProxy: true,

      setTheme: (theme) => set({ theme }),
      setProxyBaseUrl: (url) => set({ proxyBaseUrl: url }),
      setUseProxy: (enabled) => set({ useProxy: enabled }),

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
