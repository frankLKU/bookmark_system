const SmartWindow = (() => {
    let _bridgeReady = false;

    function init() {
        // pywebview bridge becomes available after this event
        window.addEventListener('pywebviewready', () => {
            _bridgeReady = true;
        });
        // Also check if already ready (race condition guard)
        if (window.pywebview && window.pywebview.api) {
            _bridgeReady = true;
        }

        Store.on('activeTab:changed', render);
        Store.on('tabs:changed', render);
        render();
    }

    function openBookmark(tabId, url, title) {
        if (_bridgeReady && window.pywebview) {
            window.pywebview.api.open_bookmark(tabId, url, title);
        } else {
            // Fallback for browser-based development
            window.open(url, '_blank');
        }
    }

    function focusBookmark(tabId) {
        if (_bridgeReady && window.pywebview) {
            window.pywebview.api.focus_bookmark(tabId);
        }
    }

    function closeBookmark(tabId) {
        if (_bridgeReady && window.pywebview) {
            window.pywebview.api.close_bookmark(tabId);
        }
    }

    function render() {
        const contentArea = document.getElementById('content-area');
        const emptyState = document.getElementById('empty-state');
        if (!contentArea) return;

        contentArea.querySelectorAll('.window-status-card').forEach(el => el.remove());

        const { tabs, activeTabId } = Store.getState();
        const activeTab = tabs.find(t => t.id === activeTabId);

        if (!activeTab) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        // Show status card instead of iframe
        const card = document.createElement('div');
        card.className = 'window-status-card';
        card.innerHTML = `
            <h3>${escapeHtml(activeTab.title)}</h3>
            <p>Opened in separate window</p>
            <button class="btn btn-primary" data-action="focus">Focus Window</button>
            <button class="btn btn-ghost" data-action="close">Close Window</button>
        `;
        card.querySelector('[data-action="focus"]').addEventListener('click', () => {
            focusBookmark(activeTab.id);
        });
        card.querySelector('[data-action="close"]').addEventListener('click', () => {
            Store.closeTab(activeTab.id);
            closeBookmark(activeTab.id);
        });
        contentArea.appendChild(card);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init, openBookmark, focusBookmark, closeBookmark };
})();
