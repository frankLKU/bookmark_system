import { useEffect } from 'react';
import { useBookmarkStore } from '../stores/bookmark-store';

export function useHealthCheck() {
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const updateHealthStatus = useBookmarkStore((s) => s.updateHealthStatus);

  useEffect(() => {
    const checkHealth = async () => {
      for (const bookmark of bookmarks) {
        try {
          await fetch(bookmark.url, { mode: 'no-cors', cache: 'no-store' });
          updateHealthStatus(bookmark.id, true);
        } catch {
          updateHealthStatus(bookmark.id, false);
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, [bookmarks.length]); // Re-run when bookmark count changes
}
