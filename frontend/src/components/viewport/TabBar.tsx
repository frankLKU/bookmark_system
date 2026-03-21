import { X } from 'lucide-react';
import { useTabStore } from '../../stores/tab-store';

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const closeTab = useTabStore((s) => s.closeTab);

  if (tabs.length === 0) return null;

  return (
    <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center overflow-x-auto shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const title =
          tab.type === 'split'
            ? `${tab.titles[0]} | ${tab.titles[1]}`
            : tab.titles[0];

        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group min-w-[120px] max-w-[200px] h-full flex items-center gap-2 px-3 cursor-pointer text-sm transition-colors border-b-2 ${
              isActive
                ? 'bg-gray-800 border-blue-500 text-gray-200'
                : 'bg-gray-900 border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <span className="truncate flex-1">{title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={`shrink-0 p-0.5 rounded hover:bg-gray-700 transition-colors ${
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
