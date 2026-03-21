import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from '../../../frontend/src/stores/tab-store';

function resetStore() {
  useTabStore.setState({
    tabs: [],
    activeTabId: null,
  });
}

describe('useTabStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('openTab', () => {
    it('should open a new tab and set it active', () => {
      useTabStore.getState().openTab('https://spark-f18.tsmc.com', 'Spark F18');

      const { tabs, activeTabId } = useTabStore.getState();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].type).toBe('single');
      expect(tabs[0].urls).toEqual(['https://spark-f18.tsmc.com']);
      expect(tabs[0].titles).toEqual(['Spark F18']);
      expect(tabs[0].active).toBe(true);
      expect(activeTabId).toBe(tabs[0].id);
    });

    it('should NOT create duplicate tab for same URL', () => {
      const store = useTabStore.getState();
      store.openTab('https://spark-f18.tsmc.com', 'Spark F18');
      store.openTab('https://spark-f18.tsmc.com', 'Spark F18');

      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('should focus existing tab when opening duplicate URL', () => {
      const store = useTabStore.getState();
      store.openTab('https://spark-f18.tsmc.com', 'Spark F18');
      store.openTab('https://airflow-f12.tsmc.com', 'Airflow F12');

      // Now re-open the first URL
      useTabStore.getState().openTab('https://spark-f18.tsmc.com', 'Spark F18');

      const { tabs, activeTabId } = useTabStore.getState();
      expect(tabs).toHaveLength(2);
      // Active tab should be the first one (Spark F18)
      const sparkTab = tabs.find(t => t.urls[0] === 'https://spark-f18.tsmc.com');
      expect(activeTabId).toBe(sparkTab!.id);
    });

    it('should allow different URLs to open separate tabs', () => {
      const store = useTabStore.getState();
      store.openTab('https://a.com', 'A');
      store.openTab('https://b.com', 'B');
      store.openTab('https://c.com', 'C');

      expect(useTabStore.getState().tabs).toHaveLength(3);
    });

    it('should deactivate previous tabs when opening new one', () => {
      const store = useTabStore.getState();
      store.openTab('https://a.com', 'A');
      store.openTab('https://b.com', 'B');

      const { tabs } = useTabStore.getState();
      const tabA = tabs.find(t => t.urls[0] === 'https://a.com');
      const tabB = tabs.find(t => t.urls[0] === 'https://b.com');
      expect(tabA!.active).toBe(false);
      expect(tabB!.active).toBe(true);
    });
  });

  describe('closeTab', () => {
    it('should remove the closed tab', () => {
      useTabStore.getState().openTab('https://a.com', 'A');
      const id = useTabStore.getState().tabs[0].id;

      useTabStore.getState().closeTab(id);

      expect(useTabStore.getState().tabs).toHaveLength(0);
      expect(useTabStore.getState().activeTabId).toBeNull();
    });

    it('should activate adjacent tab when closing active tab', () => {
      const store = useTabStore.getState();
      store.openTab('https://a.com', 'A');
      store.openTab('https://b.com', 'B');
      store.openTab('https://c.com', 'C');

      // Close active (C)
      const activeId = useTabStore.getState().activeTabId;
      useTabStore.getState().closeTab(activeId!);

      const { tabs, activeTabId } = useTabStore.getState();
      expect(tabs).toHaveLength(2);
      expect(activeTabId).toBeDefined();
      expect(activeTabId).not.toBeNull();
    });

    it('should not affect other tabs when closing non-active tab', () => {
      const store = useTabStore.getState();
      store.openTab('https://a.com', 'A');
      store.openTab('https://b.com', 'B');

      // Close first (non-active) tab
      const tabAId = useTabStore.getState().tabs.find(t => t.urls[0] === 'https://a.com')!.id;
      useTabStore.getState().closeTab(tabAId);

      const { tabs, activeTabId } = useTabStore.getState();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].urls[0]).toBe('https://b.com');
      expect(activeTabId).toBe(tabs[0].id);
    });
  });

  describe('setActiveTab', () => {
    it('should switch active tab', () => {
      const store = useTabStore.getState();
      store.openTab('https://a.com', 'A');
      store.openTab('https://b.com', 'B');

      const tabA = useTabStore.getState().tabs.find(t => t.urls[0] === 'https://a.com')!;
      useTabStore.getState().setActiveTab(tabA.id);

      const { tabs, activeTabId } = useTabStore.getState();
      expect(activeTabId).toBe(tabA.id);
      expect(tabs.find(t => t.id === tabA.id)!.active).toBe(true);
      expect(tabs.find(t => t.id !== tabA.id)!.active).toBe(false);
    });
  });

  describe('openCombinedTab (split view)', () => {
    it('should create a split tab with two URLs', () => {
      useTabStore.getState().openCombinedTab(
        'https://spark-f18.tsmc.com',
        'https://airflow-f18.tsmc.com',
        'Spark F18',
        'Airflow F18'
      );

      const { tabs } = useTabStore.getState();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].type).toBe('split');
      expect(tabs[0].urls).toEqual([
        'https://spark-f18.tsmc.com',
        'https://airflow-f18.tsmc.com',
      ]);
      expect(tabs[0].titles).toEqual(['Spark F18', 'Airflow F18']);
    });

    it('should replace existing single tab with same primary URL', () => {
      useTabStore.getState().openTab('https://spark-f18.tsmc.com', 'Spark F18');
      expect(useTabStore.getState().tabs).toHaveLength(1);

      useTabStore.getState().openCombinedTab(
        'https://spark-f18.tsmc.com',
        'https://airflow-f18.tsmc.com',
        'Spark F18',
        'Airflow F18'
      );

      const { tabs } = useTabStore.getState();
      // The single tab should be replaced by the split tab
      expect(tabs).toHaveLength(1);
      expect(tabs[0].type).toBe('split');
    });
  });

  describe('exitCombinedView', () => {
    it('should convert split tab back to single with first URL', () => {
      useTabStore.getState().openCombinedTab(
        'https://spark-f18.tsmc.com',
        'https://airflow-f18.tsmc.com',
        'Spark F18',
        'Airflow F18'
      );
      const tabId = useTabStore.getState().tabs[0].id;

      useTabStore.getState().exitCombinedView(tabId);

      const tab = useTabStore.getState().tabs[0];
      expect(tab.type).toBe('single');
      expect(tab.urls).toEqual(['https://spark-f18.tsmc.com']);
      expect(tab.titles).toEqual(['Spark F18']);
    });
  });
});
