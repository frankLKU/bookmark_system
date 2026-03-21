import { useMemo } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { TabBar } from './TabBar';
import { SmartIframe } from './SmartIframe';
import { SplitView } from './SplitView';
import { CombinedViewBanner } from './CombinedViewBanner';
import { useTabStore } from '../../stores/tab-store';
import { useBookmarkStore } from '../../stores/bookmark-store';

export function MainViewport() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const openCombinedTab = useTabStore((s) => s.openCombinedTab);
  const bookmarks = useBookmarkStore((s) => s.bookmarks);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const relatedBookmark = useMemo(() => {
    if (!activeTab || activeTab.type !== 'single') return null;
    const currentUrl = activeTab.urls[0];
    const currentBookmark = bookmarks.find((b) => b.url === currentUrl);
    if (!currentBookmark) return null;

    const sparkAirflow = ['spark', 'airflow'];
    const currentKeyword = sparkAirflow.find((k) =>
      currentUrl.toLowerCase().includes(k)
    );
    if (!currentKeyword) return null;
    const pairKeyword = sparkAirflow.find((k) => k !== currentKeyword);
    if (!pairKeyword) return null;

    return bookmarks.find(
      (b) =>
        b.id !== currentBookmark.id &&
        b.url.toLowerCase().includes(pairKeyword) &&
        b.tags.some((t) => currentBookmark.tags.includes(t))
    );
  }, [activeTab, bookmarks]);

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col">
        <TabBar />
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center text-gray-500">
            <BookmarkPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Open a bookmark from the sidebar to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TabBar />
      {relatedBookmark && activeTab.type === 'single' && (
        <CombinedViewBanner
          key={activeTab.id}
          relatedTitle={relatedBookmark.title}
          onOpenCombined={() =>
            openCombinedTab(
              activeTab.urls[0],
              relatedBookmark.url,
              activeTab.titles[0],
              relatedBookmark.title
            )
          }
        />
      )}
      <div className="flex-1 min-h-0">
        {activeTab.type === 'split' ? (
          <SplitView
            tabId={activeTab.id}
            urls={activeTab.urls}
            titles={activeTab.titles}
          />
        ) : (
          <SmartIframe url={activeTab.urls[0]} />
        )}
      </div>
    </div>
  );
}
