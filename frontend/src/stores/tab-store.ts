import { create } from 'zustand';
import type { TabState } from '../lib/types';

interface TabStore {
  tabs: TabState[];
  activeTabId: string | null;

  openTab: (url: string, title: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  openCombinedTab: (url1: string, url2: string, title1: string, title2: string) => void;
  exitCombinedView: (tabId: string) => void;
}

export const useTabStore = create<TabStore>()((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (url, title) => {
    const { tabs } = get();
    const existing = tabs.find(
      (t) => t.urls.length === 1 && t.urls[0] === url
    );
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const id = crypto.randomUUID();
    set((state) => ({
      tabs: [
        ...state.tabs.map((t) => ({ ...t, active: false })),
        { id, type: 'single' as const, urls: [url], titles: [title], active: true },
      ],
      activeTabId: id,
    }));
  },

  closeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === id) {
        const closedIndex = state.tabs.findIndex((t) => t.id === id);
        const nextTab = newTabs[Math.min(closedIndex, newTabs.length - 1)];
        newActiveId = nextTab?.id ?? null;
      }
      return {
        tabs: newTabs.map((t) => ({
          ...t,
          active: t.id === newActiveId,
        })),
        activeTabId: newActiveId,
      };
    }),

  setActiveTab: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, active: t.id === id })),
      activeTabId: id,
    })),

  openCombinedTab: (url1, url2, title1, title2) =>
    set((state) => {
      // Close any existing single tab with url1
      const filtered = state.tabs.filter(
        (t) => !(t.type === 'single' && t.urls[0] === url1)
      );
      const id = crypto.randomUUID();
      return {
        tabs: [
          ...filtered.map((t) => ({ ...t, active: false })),
          {
            id,
            type: 'split' as const,
            urls: [url1, url2],
            titles: [title1, title2],
            active: true,
          },
        ],
        activeTabId: id,
      };
    }),

  exitCombinedView: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? { ...t, type: 'single' as const, urls: [t.urls[0]], titles: [t.titles[0]] }
          : t
      ),
    })),
}));
