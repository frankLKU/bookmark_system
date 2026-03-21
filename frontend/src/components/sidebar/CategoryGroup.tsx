import { ChevronRight, ChevronDown } from 'lucide-react';
import { useUIStore } from '../../stores/ui-store';
import { BookmarkItem } from './BookmarkItem';
import type { Bookmark } from '../../lib/types';

interface Props {
  name: string;
  bookmarks: Bookmark[];
  activeUrl: string | null;
  keyboardSelectedIndex: number;
  globalStartIndex: number;
  onContextMenu: (e: React.MouseEvent, bookmark: Bookmark) => void;
}

export function CategoryGroup({
  name,
  bookmarks,
  activeUrl,
  keyboardSelectedIndex,
  globalStartIndex,
  onContextMenu,
}: Props) {
  const collapsed = useUIStore((s) => s.collapsedCategories);
  const toggleCategory = useUIStore((s) => s.toggleCategory);
  const isCollapsed = collapsed.includes(name);

  if (bookmarks.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        onClick={() => toggleCategory(name)}
        className="w-full h-8 px-3 flex items-center gap-1 text-sm font-semibold text-gray-300 hover:text-gray-100"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        <span className="flex-1 text-left">{name}</span>
        <span className="text-xs text-gray-500">{bookmarks.length}</span>
      </button>
      {!isCollapsed && (
        <div className="px-1">
          {bookmarks.map((bookmark, i) => (
            <BookmarkItem
              key={bookmark.id}
              bookmark={bookmark}
              isActive={activeUrl === bookmark.url}
              isKeyboardSelected={keyboardSelectedIndex === globalStartIndex + i}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}
