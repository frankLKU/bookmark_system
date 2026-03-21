import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bookmark, Category, FactoryTag } from '../lib/types';

interface BookmarkStore {
  bookmarks: Bookmark[];
  categories: Category[];
  activeWorkspace: FactoryTag | null;
  searchQuery: string;

  setSearchQuery: (query: string) => void;
  setActiveWorkspace: (tag: FactoryTag | null) => void;

  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'lastAccessed'>) => void;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => void;
  deleteBookmark: (id: string) => void;
  recordAccess: (id: string) => void;
  importBookmarks: (bookmarks: Omit<Bookmark, 'id' | 'lastAccessed'>[]) => void;

  addCategory: (name: string) => void;
  updateCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (ids: string[]) => void;

  exportToJSON: () => string;
  importFromJSON: (json: string) => void;

  updateHealthStatus: (id: string, isHealthy: boolean) => void;
}

function generateId(): string {
  return crypto.randomUUID();
}

export const useBookmarkStore = create<BookmarkStore>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      categories: [],
      activeWorkspace: null,
      searchQuery: '',

      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveWorkspace: (tag) => set({ activeWorkspace: tag }),

      addBookmark: (bookmark) =>
        set((state) => ({
          bookmarks: [
            ...state.bookmarks,
            { ...bookmark, id: generateId(), lastAccessed: 0 },
          ],
        })),

      updateBookmark: (id, updates) =>
        set((state) => ({
          bookmarks: state.bookmarks.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        })),

      deleteBookmark: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        })),

      recordAccess: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.map((b) =>
            b.id === id ? { ...b, lastAccessed: Date.now() } : b
          ),
        })),

      importBookmarks: (newBookmarks) =>
        set((state) => ({
          bookmarks: [
            ...state.bookmarks,
            ...newBookmarks.map((b) => ({
              ...b,
              id: generateId(),
              lastAccessed: 0,
            })),
          ],
        })),

      addCategory: (name) =>
        set((state) => ({
          categories: [
            ...state.categories,
            {
              id: generateId(),
              name,
              order: state.categories.length,
            },
          ],
        })),

      updateCategory: (id, name) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, name } : c
          ),
        })),

      deleteCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
          bookmarks: state.bookmarks.map((b) =>
            b.category === state.categories.find((c) => c.id === id)?.name
              ? { ...b, category: 'Uncategorized' }
              : b
          ),
        })),

      reorderCategories: (ids) =>
        set((state) => ({
          categories: ids
            .map((id, index) => {
              const cat = state.categories.find((c) => c.id === id);
              return cat ? { ...cat, order: index } : null;
            })
            .filter((c): c is Category => c !== null),
        })),

      exportToJSON: () => {
        const { bookmarks, categories } = get();
        return JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            version: '1.0',
            categories,
            bookmarks,
            total_bookmarks: bookmarks.length,
            total_categories: categories.length,
          },
          null,
          2
        );
      },

      importFromJSON: (json) => {
        const data = JSON.parse(json);
        set({
          bookmarks: data.bookmarks || [],
          categories: data.categories || [],
        });
      },

      updateHealthStatus: (id, isHealthy) =>
        set((state) => ({
          bookmarks: state.bookmarks.map((b) =>
            b.id === id ? { ...b, isHealthy } : b
          ),
        })),
    }),
    {
      name: 'tibdp-bookmarks',
    }
  )
);
