import { useCallback, useEffect, useMemo, useState } from 'react';
import { SidebarSearch } from './SidebarSearch';
import { CategoryGroup } from './CategoryGroup';
import { SidebarActions } from './SidebarActions';
import { useBookmarkStore } from '../../stores/bookmark-store';
import { useTabStore } from '../../stores/tab-store';
import { useUIStore } from '../../stores/ui-store';
import { fuzzyMatch } from '../../lib/fuzzy-search';
import type { Bookmark } from '../../lib/types';

interface Props {
  onAddBookmark: () => void;
  onImport: () => void;
  onSettings: () => void;
  onEditBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
}

export function Sidebar({ onAddBookmark, onImport, onSettings, onEditBookmark, onDeleteBookmark }: Props) {
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const categories = useBookmarkStore((s) => s.categories);
  const searchQuery = useBookmarkStore((s) => s.searchQuery);
  const activeWorkspace = useBookmarkStore((s) => s.activeWorkspace);
  const exportToJSON = useBookmarkStore((s) => s.exportToJSON);
  const recordAccess = useBookmarkStore((s) => s.recordAccess);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const openTab = useTabStore((s) => s.openTab);
  const keyboardNavIndex = useUIStore((s) => s.keyboardNavIndex);
  const setKeyboardNavIndex = useUIStore((s) => s.setKeyboardNavIndex);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    bookmark: Bookmark;
  } | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeUrl = activeTab?.urls[0] ?? null;

  const filtered = useMemo(() => {
    let result = bookmarks;
    if (activeWorkspace) {
      result = result.filter((b) => b.tags.includes(activeWorkspace));
    }
    if (searchQuery) {
      result = result.filter(
        (b) =>
          fuzzyMatch(b.title, searchQuery) ||
          b.tags.some((t) => fuzzyMatch(t, searchQuery))
      );
    }
    return result;
  }, [bookmarks, activeWorkspace, searchQuery]);

  const grouped = useMemo(() => {
    const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
    const categoryNames = sortedCategories.map((c) => c.name);

    const groups: { name: string; bookmarks: Bookmark[] }[] = [];
    const usedNames = new Set<string>();

    for (const name of categoryNames) {
      const catBookmarks = filtered.filter((b) => b.category === name);
      if (catBookmarks.length > 0) {
        groups.push({ name, bookmarks: catBookmarks });
        usedNames.add(name);
      }
    }

    // Uncategorized or categories not in the list
    const remaining = filtered.filter((b) => !usedNames.has(b.category));
    if (remaining.length > 0) {
      const otherGroups = new Map<string, Bookmark[]>();
      for (const b of remaining) {
        const name = b.category || 'Uncategorized';
        if (!otherGroups.has(name)) otherGroups.set(name, []);
        otherGroups.get(name)!.push(b);
      }
      for (const [name, bks] of otherGroups) {
        groups.push({ name, bookmarks: bks });
      }
    }

    return groups;
  }, [filtered, categories]);

  const flatBookmarks = useMemo(
    () => grouped.flatMap((g) => g.bookmarks),
    [grouped]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' &&
        (document.activeElement as HTMLInputElement).type !== 'text'
      )
        return;

      const isSearchFocused =
        document.activeElement?.tagName === 'INPUT' &&
        document.activeElement?.closest('[data-sidebar-search]');

      if (!isSearchFocused && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter')
        return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setKeyboardNavIndex(
          keyboardNavIndex < flatBookmarks.length - 1 ? keyboardNavIndex + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setKeyboardNavIndex(
          keyboardNavIndex > 0 ? keyboardNavIndex - 1 : flatBookmarks.length - 1
        );
      } else if (e.key === 'Enter' && keyboardNavIndex >= 0) {
        e.preventDefault();
        const bookmark = flatBookmarks[keyboardNavIndex];
        if (bookmark) {
          openTab(bookmark.url, bookmark.title);
          recordAccess(bookmark.id);
        }
      }
    },
    [keyboardNavIndex, flatBookmarks, setKeyboardNavIndex, openTab, recordAccess]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleExport = () => {
    const json = exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tibdp-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleContextMenu = (e: React.MouseEvent, bookmark: Bookmark) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, bookmark });
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [contextMenu]);

  let globalIndex = 0;

  return (
    <div className="w-80 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col h-full overflow-hidden">
      <div data-sidebar-search>
        <SidebarSearch />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {grouped.map((group) => {
          const startIndex = globalIndex;
          globalIndex += group.bookmarks.length;
          return (
            <CategoryGroup
              key={group.name}
              name={group.name}
              bookmarks={group.bookmarks}
              activeUrl={activeUrl}
              keyboardSelectedIndex={keyboardNavIndex}
              globalStartIndex={startIndex}
              onContextMenu={handleContextMenu}
            />
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-gray-500">
            {searchQuery ? 'No bookmarks match your search' : 'No bookmarks yet'}
          </div>
        )}
      </div>
      <SidebarActions
        onAddBookmark={onAddBookmark}
        onImport={onImport}
        onExport={handleExport}
        onSettings={onSettings}
      />

      {contextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              onEditBookmark(contextMenu.bookmark);
              setContextMenu(null);
            }}
            className="w-full px-4 py-1.5 text-sm text-gray-200 hover:bg-gray-700 text-left"
          >
            Edit
          </button>
          <button
            onClick={() => {
              onDeleteBookmark(contextMenu.bookmark);
              setContextMenu(null);
            }}
            className="w-full px-4 py-1.5 text-sm text-gray-200 hover:bg-gray-700 text-left"
          >
            Delete
          </button>
          <button
            onClick={() => {
              window.open(contextMenu.bookmark.url, '_blank');
              setContextMenu(null);
            }}
            className="w-full px-4 py-1.5 text-sm text-gray-200 hover:bg-gray-700 text-left"
          >
            Open in New Window
          </button>
        </div>
      )}
    </div>
  );
}
