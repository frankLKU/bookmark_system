const WorkspaceBar = (() => {
    function init() {
        render();
        Store.on('workspace:changed', render);
        Store.on('bookmarks:changed', render);
    }

    function getUniqueTags() {
        const bookmarks = Store.getState().bookmarks;
        const tagSet = new Set();
        bookmarks.forEach(b => {
            (b.tags || []).forEach(t => tagSet.add(t.toLowerCase()));
        });
        return Array.from(tagSet).sort();
    }

    function render() {
        const container = document.querySelector('#workspace-bar .workspace-chips');
        if (!container) return;

        const current = Store.getState().activeWorkspace;
        const tags = getUniqueTags();

        let html = `<button class="workspace-chip${current === null ? ' active' : ''}" data-tag="">ALL</button>`;
        tags.forEach(tag => {
            const active = tag === current ? ' active' : '';
            html += `<button class="workspace-chip${active}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag.toUpperCase())}<span class="open-in-chrome" data-chrome-tag="${escapeHtml(tag)}" title="Open all in Chrome">&#9654;</span></button>`;
        });
        // Add tag button
        html += `<button class="workspace-chip workspace-add-tag" title="Add tag to a bookmark">+</button>`;

        container.innerHTML = html;

        // Click to filter
        container.querySelectorAll('.workspace-chip:not(.workspace-add-tag)').forEach(chip => {
            chip.addEventListener('click', () => {
                const tag = chip.dataset.tag || null;
                Store.setWorkspace(tag);
            });

            // Right-click to rename/delete
            chip.addEventListener('contextmenu', (e) => {
                if (!chip.dataset.tag) return; // Can't rename ALL
                e.preventDefault();
                showTagContextMenu(e, chip.dataset.tag);
            });
        });

        // Add tag button
        const addBtn = container.querySelector('.workspace-add-tag');
        if (addBtn) {
            addBtn.addEventListener('click', () => showAddTagPrompt());
        }

        // Open in Chrome buttons
        container.querySelectorAll('.open-in-chrome').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't trigger chip filter
                const tag = btn.dataset.chromeTag;
                if (typeof Store !== 'undefined' && Store.openInChrome) {
                    Store.openInChrome(tag);
                }
            });
        });
    }

    function showTagContextMenu(e, tag) {
        const menu = document.getElementById('context-menu');
        menu.className = '';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.innerHTML = `
            <ul class="context-menu-list">
                <li class="context-menu-item" data-action="rename">Rename "${tag}"</li>
                <li class="context-menu-separator"></li>
                <li class="context-menu-item danger" data-action="delete">Delete "${tag}" from all bookmarks</li>
            </ul>
        `;

        menu.querySelector('[data-action="rename"]').addEventListener('click', () => {
            menu.classList.add('hidden');
            renameTag(tag);
        });
        menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
            menu.classList.add('hidden');
            deleteTag(tag);
        });

        // Close on outside click
        const closeMenu = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    function showAddTagPrompt() {
        const tag = prompt('Enter new tag name:');
        if (!tag || !tag.trim()) return;
        const tagName = tag.trim().toLowerCase();
        // Add this tag to selected bookmarks or just show it
        // For now, just filter by it (it will appear once a bookmark has it)
        alert(`To add the "${tagName}" tag, edit a bookmark and add it to the Tags field.`);
    }

    async function renameTag(oldTag) {
        const newTag = prompt(`Rename tag "${oldTag}" to:`, oldTag);
        if (!newTag || !newTag.trim() || newTag.trim().toLowerCase() === oldTag) return;
        const newTagName = newTag.trim().toLowerCase();

        // Update all bookmarks that have this tag
        const bookmarks = Store.getState().bookmarks;
        for (const bm of bookmarks) {
            if (bm.tags && bm.tags.some(t => t.toLowerCase() === oldTag)) {
                const updatedTags = bm.tags.map(t => t.toLowerCase() === oldTag ? newTagName : t);
                await Store.updateBookmark(bm.id, { tags: updatedTags });
            }
        }
        await Store.loadBookmarks();
        if (Store.getState().activeWorkspace === oldTag) {
            Store.setWorkspace(newTagName);
        }
    }

    async function deleteTag(tag) {
        if (!confirm(`Remove tag "${tag}" from all bookmarks?`)) return;

        const bookmarks = Store.getState().bookmarks;
        for (const bm of bookmarks) {
            if (bm.tags && bm.tags.some(t => t.toLowerCase() === tag)) {
                const updatedTags = bm.tags.filter(t => t.toLowerCase() !== tag);
                await Store.updateBookmark(bm.id, { tags: updatedTags });
            }
        }
        await Store.loadBookmarks();
        if (Store.getState().activeWorkspace === tag) {
            Store.setWorkspace(null);
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init };
})();
