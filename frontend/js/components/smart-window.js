const SmartWindow = (() => {
    function init() {
        Store.on('activeTab:changed', render);
        Store.on('tabs:changed', render);
        render();
    }

    function openBookmark(tabId, url, title) {
        window.open(url, '_blank');
    }

    function focusBookmark(tabId) {
        // No-op: bookmarks open in system browser
    }

    function closeBookmark(tabId) {
        // No-op: bookmarks open in system browser
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

        const card = document.createElement('div');
        card.className = 'window-status-card';
        card.innerHTML = `
            <h3>${escapeHtml(activeTab.title)}</h3>
            <p>Opened in browser</p>
            <button class="btn btn-primary" data-action="open">Open Again</button>
            <button class="btn btn-ghost" data-action="close">Close Tab</button>
        `;
        card.querySelector('[data-action="open"]').addEventListener('click', () => {
            window.open(activeTab.url, '_blank');
        });
        card.querySelector('[data-action="close"]').addEventListener('click', () => {
            Store.closeTab(activeTab.id);
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
