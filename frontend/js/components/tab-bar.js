const TabBar = (() => {
    function init() {
        render();
        Store.on('tabs:changed', render);
        Store.on('activeTab:changed', render);
    }

    function render() {
        const tabList = document.querySelector('#tab-bar .tab-list');
        if (!tabList) return;

        const { tabs, activeTabId } = Store.getState();

        if (tabs.length === 0) {
            tabList.innerHTML = '';
            return;
        }

        tabList.innerHTML = tabs.map(tab => {
            const active = tab.id === activeTabId ? ' active' : '';
            const icon = tab.isCombined
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>'
                : '';
            return `<div class="tab${active}" data-tab-id="${tab.id}">
                ${icon}
                <span class="tab-title truncate">${escapeHtml(tab.title)}</span>
                <button class="tab-close" data-tab-id="${tab.id}" aria-label="Close tab">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>`;
        }).join('');

        // Click to switch tab — also focus the child window
        tabList.querySelectorAll('.tab').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.tab-close')) return;
                Store.setActiveTab(el.dataset.tabId);
                if (typeof SmartWindow !== 'undefined') {
                    SmartWindow.focusBookmark(el.dataset.tabId);
                }
            });
        });

        // Close button — also close the child window
        tabList.querySelectorAll('.tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof SmartWindow !== 'undefined') {
                    SmartWindow.closeBookmark(btn.dataset.tabId);
                }
                Store.closeTab(btn.dataset.tabId);
            });
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init };
})();
