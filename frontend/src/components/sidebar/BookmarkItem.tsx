import { Columns2 } from 'lucide-react';
import type { Bookmark } from '../../lib/types';
import { useTabStore } from '../../stores/tab-store';
import { useBookmarkStore } from '../../stores/bookmark-store';

interface Props {
  bookmark: Bookmark;
  isActive: boolean;
  isKeyboardSelected: boolean;
  onContextMenu: (e: React.MouseEvent, bookmark: Bookmark) => void;
}

export function BookmarkItem({ bookmark, isActive, isKeyboardSelected, onContextMenu }: Props) {
  const openTab = useTabStore((s) => s.openTab);
  const recordAccess = useBookmarkStore((s) => s.recordAccess);

  const handleClick = () => {
    openTab(bookmark.url, bookmark.title);
    recordAccess(bookmark.id);
  };

  const healthColor =
    bookmark.isHealthy === true
      ? 'bg-green-500'
      : bookmark.isHealthy === false
        ? 'bg-red-500'
        : 'bg-gray-400';

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, bookmark)}
      className={`h-9 px-3 flex items-center gap-2 rounded-md cursor-pointer text-sm transition-colors ${
        isActive
          ? 'bg-gray-700 border-l-2 border-blue-500'
          : isKeyboardSelected
            ? 'bg-gray-700 ring-1 ring-blue-500'
            : 'hover:bg-gray-800'
      }`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${healthColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-gray-200">{bookmark.title}</span>
          {bookmark.isCombined && (
            <Columns2 className="w-3 h-3 text-gray-500 shrink-0" />
          )}
        </div>
        {bookmark.tags.length > 0 && (
          <div className="text-xs text-gray-500 truncate">
            {bookmark.tags.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}
