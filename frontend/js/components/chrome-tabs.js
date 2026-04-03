// frontend/js/components/chrome-tabs.js
const ChromeTabs = (() => {
    let pollTimer = null;

    function init() {
        render();
        Store.on('chromeTabs:changed', render);
        Store.on('chromeConnected:changed', updateConnectionStatus);

        // Poll chrome tab state every 2 seconds
        pollTimer = setInterval(() => Store.loadChromeTabs(), 2000);
        Store.loadChromeTabs();
    }

    function updateConnectionStatus(connected) {
        const indicator = document.getElementById('chrome-status');
        if (!indicator) return;
        indicator.className = 'chrome-status ' + (connected ? 'connected' : 'disconnected');
        indicator.title = connected ? 'Chrome connected' : 'Chrome not connected';
    }

    function render() {
        const container = document.getElementById('chrome-tabs-content');
        if (!container) return;

        const { chromeTabs, chromeConnected } = Store.getState();

        if (!chromeConnected) {
            container.innerHTML = '<div class="chrome-tab-item" style="color:var(--color-text-tertiary);cursor:default;">Browser not connected</div>';
            return;
        }

        if (chromeTabs.length === 0) {
            container.innerHTML = '<div class="chrome-tab-item" style="cursor:default;">No tabs open</div>';
            return;
        }

        // Group tabs by groupName
        const groups = {};
        const ungrouped = [];

        chromeTabs.forEach(tab => {
            if (tab.groupName) {
                if (!groups[tab.groupName]) {
                    groups[tab.groupName] = [];
                }
                groups[tab.groupName].push(tab);
            } else {
                ungrouped.push(tab);
            }
        });

        let html = '';

        // Render groups
        Object.entries(groups).forEach(([groupName, tabs]) => {
            html += `
                <div class="chrome-group">
                    <div class="chrome-group-header">
                        <span><span class="group-color-dot"></span>${escapeHtml(groupName)}</span>
                        <button class="chrome-group-close" data-group="${escapeHtml(groupName)}" title="Close all tabs in this group">&times;</button>
                    </div>
                    ${tabs.map(tab => renderTab(tab)).join('')}
                </div>
            `;
        });

        // Render ungrouped tabs
        ungrouped.forEach(tab => {
            html += renderTab(tab);
        });

        container.innerHTML = html;

        // Attach event listeners
        container.querySelectorAll('.chrome-tab-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.tab-close')) return;
                const tabId = el.dataset.tabId;
                Store.switchChromeTab(tabId);
            });
        });

        container.querySelectorAll('.tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabId = btn.dataset.tabId;
                Store.closeChromeTab(tabId);
            });
        });

        container.querySelectorAll('.chrome-group-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.dataset.group;
                Store.closeChromeGroup(group);
            });
        });
    }

    function renderTab(tab) {
        const title = tab.title || tab.url || 'Untitled';
        const activeClass = tab.active ? ' style="font-weight:600;"' : '';
        return `
            <div class="chrome-tab-item" data-tab-id="${tab.id}"${activeClass}>
                <span class="tab-title">${escapeHtml(title)}</span>
                <button class="tab-close" data-tab-id="${tab.id}" title="Close tab">&times;</button>
            </div>
        `;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init };
})();
