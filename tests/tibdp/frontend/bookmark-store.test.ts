import { describe, it, expect, beforeEach } from 'vitest';
import { useBookmarkStore } from '../../../frontend/src/stores/bookmark-store';

function resetStore() {
  useBookmarkStore.setState({
    bookmarks: [],
    categories: [],
    activeWorkspace: null,
    searchQuery: '',
  });
}

describe('useBookmarkStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addBookmark', () => {
    it('should add a bookmark with auto-generated id and lastAccessed=0', () => {
      useBookmarkStore.getState().addBookmark({
        title: 'Spark F18',
        url: 'https://spark-f18.tsmc.com',
        category: 'Spark',
        tags: ['f18'],
      });

      const { bookmarks } = useBookmarkStore.getState();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].title).toBe('Spark F18');
      expect(bookmarks[0].url).toBe('https://spark-f18.tsmc.com');
      expect(bookmarks[0].id).toBeDefined();
      expect(bookmarks[0].lastAccessed).toBe(0);
    });

    it('should add multiple bookmarks independently', () => {
      const store = useBookmarkStore.getState();
      store.addBookmark({ title: 'A', url: 'https://a.com', category: 'Cat1', tags: [] });
      store.addBookmark({ title: 'B', url: 'https://b.com', category: 'Cat2', tags: ['f12'] });

      const { bookmarks } = useBookmarkStore.getState();
      expect(bookmarks).toHaveLength(2);
      expect(bookmarks[0].id).not.toBe(bookmarks[1].id);
    });
  });

  describe('updateBookmark', () => {
    it('should update only the specified fields', () => {
      useBookmarkStore.getState().addBookmark({
        title: 'Old Title',
        url: 'https://old.com',
        category: 'Cat',
        tags: [],
      });
      const id = useBookmarkStore.getState().bookmarks[0].id;

      useBookmarkStore.getState().updateBookmark(id, { title: 'New Title' });

      const updated = useBookmarkStore.getState().bookmarks[0];
      expect(updated.title).toBe('New Title');
      expect(updated.url).toBe('https://old.com');
    });

    it('should not modify other bookmarks', () => {
      const store = useBookmarkStore.getState();
      store.addBookmark({ title: 'A', url: 'https://a.com', category: 'C', tags: [] });
      store.addBookmark({ title: 'B', url: 'https://b.com', category: 'C', tags: [] });

      const bookmarks = useBookmarkStore.getState().bookmarks;
      useBookmarkStore.getState().updateBookmark(bookmarks[0].id, { title: 'A2' });

      const result = useBookmarkStore.getState().bookmarks;
      expect(result[0].title).toBe('A2');
      expect(result[1].title).toBe('B');
    });
  });

  describe('deleteBookmark', () => {
    it('should remove the bookmark by id', () => {
      useBookmarkStore.getState().addBookmark({
        title: 'To Delete',
        url: 'https://del.com',
        category: 'C',
        tags: [],
      });
      const id = useBookmarkStore.getState().bookmarks[0].id;

      useBookmarkStore.getState().deleteBookmark(id);

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(0);
    });

    it('should not affect other bookmarks', () => {
      const store = useBookmarkStore.getState();
      store.addBookmark({ title: 'A', url: 'https://a.com', category: 'C', tags: [] });
      store.addBookmark({ title: 'B', url: 'https://b.com', category: 'C', tags: [] });

      const idA = useBookmarkStore.getState().bookmarks[0].id;
      useBookmarkStore.getState().deleteBookmark(idA);

      const remaining = useBookmarkStore.getState().bookmarks;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].title).toBe('B');
    });
  });

  describe('recordAccess', () => {
    it('should update lastAccessed timestamp', () => {
      useBookmarkStore.getState().addBookmark({
        title: 'Test',
        url: 'https://test.com',
        category: 'C',
        tags: [],
      });
      const id = useBookmarkStore.getState().bookmarks[0].id;
      expect(useBookmarkStore.getState().bookmarks[0].lastAccessed).toBe(0);

      useBookmarkStore.getState().recordAccess(id);

      const accessed = useBookmarkStore.getState().bookmarks[0].lastAccessed;
      expect(accessed).toBeGreaterThan(0);
    });
  });

  describe('importBookmarks', () => {
    it('should bulk import bookmarks with generated ids', () => {
      useBookmarkStore.getState().importBookmarks([
        { title: 'Import1', url: 'https://i1.com', category: 'C', tags: ['f18'] },
        { title: 'Import2', url: 'https://i2.com', category: 'C', tags: ['f12'] },
      ]);

      const { bookmarks } = useBookmarkStore.getState();
      expect(bookmarks).toHaveLength(2);
      expect(bookmarks[0].id).toBeDefined();
      expect(bookmarks[1].id).toBeDefined();
      expect(bookmarks[0].lastAccessed).toBe(0);
    });

    it('should append to existing bookmarks', () => {
      useBookmarkStore.getState().addBookmark({
        title: 'Existing',
        url: 'https://existing.com',
        category: 'C',
        tags: [],
      });

      useBookmarkStore.getState().importBookmarks([
        { title: 'New', url: 'https://new.com', category: 'C', tags: [] },
      ]);

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(2);
    });
  });

  describe('category operations', () => {
    it('should add a category with auto-generated id and order', () => {
      useBookmarkStore.getState().addCategory('Monitoring');

      const { categories } = useBookmarkStore.getState();
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe('Monitoring');
      expect(categories[0].order).toBe(0);
    });

    it('should update category name', () => {
      useBookmarkStore.getState().addCategory('Old Name');
      const id = useBookmarkStore.getState().categories[0].id;

      useBookmarkStore.getState().updateCategory(id, 'New Name');

      expect(useBookmarkStore.getState().categories[0].name).toBe('New Name');
    });

    it('should delete category and reassign bookmarks to Uncategorized', () => {
      useBookmarkStore.getState().addCategory('ToDelete');
      const catId = useBookmarkStore.getState().categories[0].id;

      useBookmarkStore.getState().addBookmark({
        title: 'BM',
        url: 'https://bm.com',
        category: 'ToDelete',
        tags: [],
      });

      useBookmarkStore.getState().deleteCategory(catId);

      expect(useBookmarkStore.getState().categories).toHaveLength(0);
      expect(useBookmarkStore.getState().bookmarks[0].category).toBe('Uncategorized');
    });

    it('should reorder categories', () => {
      const store = useBookmarkStore.getState();
      store.addCategory('A');
      store.addCategory('B');
      store.addCategory('C');

      const cats = useBookmarkStore.getState().categories;
      const reordered = [cats[2].id, cats[0].id, cats[1].id];
      useBookmarkStore.getState().reorderCategories(reordered);

      const result = useBookmarkStore.getState().categories;
      expect(result[0].name).toBe('C');
      expect(result[0].order).toBe(0);
      expect(result[1].name).toBe('A');
      expect(result[1].order).toBe(1);
      expect(result[2].name).toBe('B');
      expect(result[2].order).toBe(2);
    });
  });

  describe('workspace filter', () => {
    it('should set and clear activeWorkspace', () => {
      useBookmarkStore.getState().setActiveWorkspace('f18');
      expect(useBookmarkStore.getState().activeWorkspace).toBe('f18');

      useBookmarkStore.getState().setActiveWorkspace(null);
      expect(useBookmarkStore.getState().activeWorkspace).toBeNull();
    });
  });

  describe('search query', () => {
    it('should set search query', () => {
      useBookmarkStore.getState().setSearchQuery('spark');
      expect(useBookmarkStore.getState().searchQuery).toBe('spark');
    });
  });

  describe('exportToJSON / importFromJSON', () => {
    it('should export and re-import data without loss', () => {
      const store = useBookmarkStore.getState();
      store.addCategory('Spark');
      store.addBookmark({
        title: 'Spark F18',
        url: 'https://spark-f18.tsmc.com',
        category: 'Spark',
        tags: ['f18'],
      });

      const json = useBookmarkStore.getState().exportToJSON();
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('1.0');
      expect(parsed.total_bookmarks).toBe(1);
      expect(parsed.total_categories).toBe(1);

      // Clear and re-import
      resetStore();
      useBookmarkStore.getState().importFromJSON(json);

      const state = useBookmarkStore.getState();
      expect(state.bookmarks).toHaveLength(1);
      expect(state.categories).toHaveLength(1);
      expect(state.bookmarks[0].title).toBe('Spark F18');
    });
  });

  describe('updateHealthStatus', () => {
    it('should update health status of a bookmark', () => {
      useBookmarkStore.getState().addBookmark({
        title: 'Test',
        url: 'https://test.com',
        category: 'C',
        tags: [],
      });
      const id = useBookmarkStore.getState().bookmarks[0].id;

      useBookmarkStore.getState().updateHealthStatus(id, true);
      expect(useBookmarkStore.getState().bookmarks[0].isHealthy).toBe(true);

      useBookmarkStore.getState().updateHealthStatus(id, false);
      expect(useBookmarkStore.getState().bookmarks[0].isHealthy).toBe(false);
    });
  });
});
