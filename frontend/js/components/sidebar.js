const Sidebar = (() => {
    function init() {
        setupSearch();
        render();
        setupFooterActions();
        Store.on('bookmarks:changed', render);
        Store.on('categories:changed', render);
        Store.on('health:changed', render);
        Store.on('keyboardNav:changed', updateKeyboardHighlight);
    }

    function setupSearch() {
        const input = document.getElementById('search-input');
        const clearBtn = document.getElementById('search-clear');
        if (!input) return;

        input.addEventListener('input', () => {
            Store.setSearch(input.value);
            clearBtn.classList.toggle('hidden', !input.value);
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            Store.setSearch('');
            clearBtn.classList.add('hidden');
            input.focus();
        });
    }

    function setupFooterActions() {
        const exportBtn = document.getElementById('btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                const resp = await API.exportData();
                if (resp.success) {
                    const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `tibdp-export-${new Date().toISOString().slice(0,10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            });
        }
    }

    function render() {
        const container = document.getElementById('sidebar-content');
        if (!container) return;

        const { categories, collapsedCategories, healthStatus } = Store.getState();
        const filteredBookmarks = Store.getFilteredBookmarks();

        let html = '';
        let navIndex = 0;

        // Render each category group
        for (const cat of categories) {
            const catBookmarks = filteredBookmarks.filter(b => b.category_id === cat.id);
            if (catBookmarks.length === 0 && Store.getState().searchQuery) continue;

            const isCollapsed = collapsedCategories.has(cat.id);
            const chevron = isCollapsed
                ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>'
                : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';

            html += `<div class="category-group">
                <div class="category-header" data-category-id="${cat.id}">
                    <span class="category-chevron">${chevron}</span>
                    <span class="category-name">${escapeHtml(cat.name)}</span>
                    <span class="category-count">${catBookmarks.length}</span>
                </div>`;

            if (!isCollapsed) {
                html += '<div class="category-bookmarks">';
                for (const bm of catBookmarks) {
                    html += renderBookmarkItem(bm, healthStatus[bm.id], navIndex++);
                }
                html += '</div>';
            }
            html += '</div>';
        }

        // Uncategorized
        const uncategorized = filteredBookmarks.filter(b => !b.category_id);
        if (uncategorized.length > 0) {
            html += `<div class="category-group">
                <div class="category-header" data-category-id="uncategorized">
                    <span class="category-chevron"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></span>
                    <span class="category-name">Uncategorized</span>
                    <span class="category-count">${uncategorized.length}</span>
                </div>
                <div class="category-bookmarks">`;
            for (const bm of uncategorized) {
                html += renderBookmarkItem(bm, healthStatus[bm.id], navIndex++);
            }
            html += '</div></div>';
        }

        if (filteredBookmarks.length === 0) {
            html = '<div class="sidebar-empty">No bookmarks found</div>';
        }

        container.innerHTML = html;

        // Attach event listeners
        container.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', () => {
                const catId = header.dataset.categoryId;
                if (catId !== 'uncategorized') Store.toggleCategoryCollapse(catId);
            });
        });

        container.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.bookmarkId;
                const bookmark = Store.getState().bookmarks.find(b => b.id === id);
                if (bookmark) Store.openTab(bookmark);
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const id = item.dataset.bookmarkId;
                const bookmark = Store.getState().bookmarks.find(b => b.id === id);
                if (bookmark) showContextMenu(e.clientX, e.clientY, bookmark);
            });
        });
    }

    function renderBookmarkItem(bm, health, index) {
        let dotClass = 'gray';
        if (health) dotClass = health.is_healthy ? 'green' : 'red';

        return `<div class="bookmark-item" data-bookmark-id="${bm.id}" data-nav-index="${index}">
            <span class="health-dot ${dotClass}"></span>
            <div class="bookmark-info">
                <div class="bookmark-title truncate">${escapeHtml(bm.title)}</div>
                <div class="bookmark-url truncate">${escapeHtml(bm.url)}</div>
            </div>
        </div>`;
    }

    function showContextMenu(x, y, bookmark) {
        const menu = document.getElementById('context-menu');
        menu.innerHTML = `
            <div class="context-menu-item" data-action="edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                Edit
            </div>
            <div class="context-menu-item" data-action="delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                Delete
            </div>
            <div class="context-menu-item" data-action="open-new">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                Open in New Window
            </div>
        `;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.remove('hidden');

        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                if (action === 'edit' && typeof Modals !== 'undefined') {
                    Modals.showBookmarkForm(bookmark);
                } else if (action === 'delete' && typeof Modals !== 'undefined') {
                    Modals.showDeleteConfirm(bookmark.title, () => Store.deleteBookmark(bookmark.id));
                } else if (action === 'open-new') {
                    window.open(bookmark.url, '_blank');
                }
                menu.classList.add('hidden');
            });
        });

        // Close on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    function updateKeyboardHighlight(index) {
        document.querySelectorAll('.bookmark-item').forEach(item => {
            item.classList.toggle('keyboard-active', parseInt(item.dataset.navIndex) === index);
        });
        // Scroll into view
        const active = document.querySelector('.bookmark-item.keyboard-active');
        if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init };
})();
