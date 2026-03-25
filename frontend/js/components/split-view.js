const SplitView = (() => {
    // Keyword pairs for auto-detecting related bookmarks
    const RELATED_PAIRS = [
        ['spark', 'airflow'],
        ['spark', 'grafana'],
        ['airflow', 'grafana'],
        ['jenkins', 'grafana'],
    ];

    function findRelatedBookmark(bookmark) {
        const bookmarks = Store.getState().bookmarks;
        const urlLower = bookmark.url.toLowerCase();
        const titleLower = bookmark.title.toLowerCase();

        for (const [kw1, kw2] of RELATED_PAIRS) {
            const hasKw1 = urlLower.includes(kw1) || titleLower.includes(kw1);
            const hasKw2 = urlLower.includes(kw2) || titleLower.includes(kw2);

            if (hasKw1) {
                // Find a bookmark with kw2 and matching factory tag
                const matchTag = (bookmark.tags || []).find(t => /^f\d+[a-z]?$/i.test(t));
                const related = bookmarks.find(b =>
                    b.id !== bookmark.id &&
                    (b.url.toLowerCase().includes(kw2) || b.title.toLowerCase().includes(kw2)) &&
                    (!matchTag || (b.tags || []).includes(matchTag))
                );
                if (related) return related;
            }
            if (hasKw2) {
                const matchTag = (bookmark.tags || []).find(t => /^f\d+[a-z]?$/i.test(t));
                const related = bookmarks.find(b =>
                    b.id !== bookmark.id &&
                    (b.url.toLowerCase().includes(kw1) || b.title.toLowerCase().includes(kw1)) &&
                    (!matchTag || (b.tags || []).includes(matchTag))
                );
                if (related) return related;
            }
        }
        return null;
    }

    function render(contentArea, tab) {
        if (!tab.isCombined || !tab.urls || tab.urls.length < 2) return;

        const container = document.createElement('div');
        container.className = 'split-view';
        container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;';

        for (let i = 0; i < 2; i++) {
            const pane = document.createElement('div');
            pane.className = 'split-pane';
            pane.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;' + (i === 0 ? 'border-right:2px solid var(--border);' : '');

            // Pane header
            const header = document.createElement('div');
            header.className = 'split-pane-header';
            header.innerHTML = `
                <span class="truncate" style="flex:1">${escapeHtml(tab.titles[i])}</span>
                <button class="btn-icon" title="Refresh" onclick="this.closest('.split-pane').querySelector('iframe')?.contentWindow?.location.reload()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                </button>
                <button class="btn-icon" title="Open in New Window" data-open-url="${i}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                </button>
                <button class="btn-icon" title="Exit Split View" data-tab-id="${tab.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            `;
            pane.appendChild(header);

            // Open in new window handler
            header.querySelector('[data-open-url]').addEventListener('click', () => {
                window.open(tab.urls[i], '_blank');
            });

            // Exit split handler
            header.querySelector('[title="Exit Split View"]').addEventListener('click', () => {
                Store.exitCombinedView(tab.id);
            });

            // Iframe
            const iframeContainer = SmartIframe.createIframeContainer(tab.urls[i], tab.titles[i]);
            iframeContainer.style.cssText = 'flex:1;position:relative;';
            pane.appendChild(iframeContainer);

            container.appendChild(pane);
        }

        contentArea.appendChild(container);
    }

    // Show combined view suggestion banner when opening a bookmark
    function showCombinedBanner(bookmark) {
        const related = findRelatedBookmark(bookmark);
        if (!related) return;

        const existing = document.querySelector('.combined-banner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.className = 'combined-banner';
        banner.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
            <span>Related bookmark found: <strong>${escapeHtml(related.title)}</strong></span>
            <button class="btn btn-ghost btn-sm">Open Combined View</button>
            <button class="btn-icon banner-close" aria-label="Dismiss">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        `;

        banner.querySelector('.btn-ghost').addEventListener('click', () => {
            Store.openCombinedTab(bookmark, related);
            banner.remove();
        });
        banner.querySelector('.banner-close').addEventListener('click', () => banner.remove());

        const contentArea = document.getElementById('content-area');
        if (contentArea) contentArea.insertBefore(banner, contentArea.firstChild);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Listen for new tabs to show combined banner
    function init() {
        Store.on('activeTab:changed', () => {
            const { tabs, activeTabId } = Store.getState();
            const tab = tabs.find(t => t.id === activeTabId);
            if (tab && !tab.isCombined) {
                const bookmark = Store.getState().bookmarks.find(b => b.id === tab.bookmarkId);
                if (bookmark) showCombinedBanner(bookmark);
            }
        });
    }

    return { init, render, findRelatedBookmark };
})();
