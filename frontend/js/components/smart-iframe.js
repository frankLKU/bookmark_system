const SmartIframe = (() => {
    function init() {
        render();
        Store.on('activeTab:changed', render);
        Store.on('tabs:changed', render);
    }

    function render() {
        const contentArea = document.getElementById('content-area');
        const emptyState = document.getElementById('empty-state');
        if (!contentArea) return;

        const { tabs, activeTabId } = Store.getState();
        const activeTab = tabs.find(t => t.id === activeTabId);

        // Remove previous iframes and error cards (keep empty-state)
        contentArea.querySelectorAll('.iframe-container, .error-card-container').forEach(el => el.remove());

        if (!activeTab) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        if (activeTab.isCombined && activeTab.urls) {
            // Split view handled by SplitView component
            if (typeof SplitView !== 'undefined') {
                SplitView.render(contentArea, activeTab);
            }
            return;
        }

        // Single iframe
        const container = createIframeContainer(activeTab.url, activeTab.title);
        contentArea.appendChild(container);
    }

    function createIframeContainer(url, title) {
        const container = document.createElement('div');
        container.className = 'iframe-container';
        container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';

        // Loading spinner
        const spinner = document.createElement('div');
        spinner.className = 'loading-overlay';
        spinner.innerHTML = '<div class="loading-spinner"></div><p>Loading...</p>';
        container.appendChild(spinner);

        // Create iframe via proxy
        const proxyUrl = `/api/v1/proxy?url=${encodeURIComponent(url)}`;

        // First check if proxy returns a login error
        fetch(proxyUrl)
            .then(resp => resp.text())
            .then(text => {
                // Try to parse as JSON (login error response)
                try {
                    const json = JSON.parse(text);
                    if (json.success === false) {
                        spinner.remove();
                        showErrorCard(container, title, url, json.message, json.data?.requires_login);
                        return;
                    }
                } catch (e) {
                    // Not JSON, it's actual content — proceed with iframe
                }

                spinner.remove();
                const iframe = document.createElement('iframe');
                iframe.src = proxyUrl;
                iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups';
                // No allow-top-navigation — prevents login pages from redirecting the entire browser window
                iframe.style.cssText = 'width:100%;height:100%;border:none;';
                iframe.title = title;

                iframe.addEventListener('error', () => {
                    iframe.remove();
                    showErrorCard(container, title, url, 'Failed to load this page');
                });

                container.appendChild(iframe);
            })
            .catch(err => {
                spinner.remove();
                showErrorCard(container, title, url, 'Network error: ' + err.message);
            });

        return container;
    }

    function showErrorCard(container, title, url, message, requiresLogin = false) {
        const card = document.createElement('div');
        card.className = 'error-card';
        card.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="1.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
            <h3>${requiresLogin ? 'Login Required' : 'Unable to Load'}</h3>
            <p>${escapeHtml(message)}</p>
            <p class="text-muted text-xs">${escapeHtml(title)}</p>
            <button class="btn btn-primary" onclick="window.open('${escapeAttr(url)}', '_blank')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                Open in New Window
            </button>
        `;
        container.appendChild(card);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    return { init, createIframeContainer };
})();
