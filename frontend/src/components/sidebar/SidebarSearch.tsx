import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useBookmarkStore } from '../../stores/bookmark-store';
import { useUIStore } from '../../stores/ui-store';

export function SidebarSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchQuery = useBookmarkStore((s) => s.searchQuery);
  const setSearchQuery = useBookmarkStore((s) => s.setSearchQuery);
  const setKeyboardNavIndex = useUIStore((s) => s.setKeyboardNavIndex);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setKeyboardNavIndex(-1);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="px-3 py-2 sticky top-0 bg-gray-950 dark:bg-gray-950 z-10">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setKeyboardNavIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search bookmarks... ( / )"
          className="w-full h-9 pl-9 pr-8 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setKeyboardNavIndex(-1);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
