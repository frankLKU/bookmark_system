import { FACTORY_TAGS } from '../../lib/types';
import { useBookmarkStore } from '../../stores/bookmark-store';

export function WorkspaceBar() {
  const activeWorkspace = useBookmarkStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useBookmarkStore((s) => s.setActiveWorkspace);

  return (
    <div className="h-10 bg-gray-900 dark:bg-gray-900 flex items-center gap-1 px-3 overflow-x-auto shrink-0">
      <button
        onClick={() => setActiveWorkspace(null)}
        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
          activeWorkspace === null
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        ALL
      </button>
      {FACTORY_TAGS.map((tag) => (
        <button
          key={tag}
          onClick={() => setActiveWorkspace(tag)}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeWorkspace === tag
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {tag.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
