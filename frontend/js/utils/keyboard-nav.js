const KeyboardNav = (() => {
    let tagNavIndex = -1; // -1 = not navigating tags, 0+ = tag chip index

    function init() {
        document.addEventListener('keydown', handleKeydown);
    }

    function handleKeydown(e) {
        // Don't handle if inside modal
        const modal = document.getElementById('modal-container');
        if (modal && !modal.classList.contains('hidden')) return;

        // Don't handle if inside textarea or input (except search)
        const active = document.activeElement;
        const isSearchInput = active && active.id === 'search-input';
        const isInInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

        switch (e.key) {
            case '/':
                if (!isInInput) {
                    e.preventDefault();
                    document.getElementById('search-input')?.focus();
                    resetTagNav();
                }
                break;

            case 'Tab':
                e.preventDefault();
                if (e.shiftKey) {
                    navigateTagPrev();
                } else {
                    navigateTagNext();
                }
                break;

            case 'ArrowDown':
                if (isSearchInput || !isInInput) {
                    e.preventDefault();
                    resetTagNav();
                    navigateDown();
                }
                break;

            case 'ArrowUp':
                if (isSearchInput || !isInInput) {
                    e.preventDefault();
                    resetTagNav();
                    navigateUp();
                }
                break;

            case ' ':
                if (tagNavIndex >= 0) {
                    e.preventDefault();
                    activateTagAtIndex();
                } else if (isSearchInput && Store.getState().keyboardNavIndex >= 0) {
                    e.preventDefault();
                    openAtIndex(Store.getState().keyboardNavIndex);
                }
                break;

            case 'Enter':
                if (tagNavIndex >= 0) {
                    e.preventDefault();
                    activateTagAtIndex();
                } else if (isSearchInput || !isInInput) {
                    const idx = Store.getState().keyboardNavIndex;
                    if (idx >= 0) {
                        e.preventDefault();
                        openAtIndex(idx);
                    }
                }
                break;

            case 'Escape':
                if (tagNavIndex >= 0) {
                    resetTagNav();
                } else if (isSearchInput) {
                    const input = document.getElementById('search-input');
                    if (input.value) {
                        input.value = '';
                        Store.setSearch('');
                        document.getElementById('search-clear')?.classList.add('hidden');
                    } else {
                        input.blur();
                    }
                    Store.setKeyboardNavIndex(-1);
                }
                break;

            case '?':
                if (!isInInput) {
                    e.preventDefault();
                    toggleHelp();
                }
                break;
        }
    }

    // --- Bookmark navigation ---

    function navigateDown() {
        const items = Store.getFilteredBookmarks();
        const current = Store.getState().keyboardNavIndex;
        const next = current < items.length - 1 ? current + 1 : 0;
        Store.setKeyboardNavIndex(next);
    }

    function navigateUp() {
        const items = Store.getFilteredBookmarks();
        const current = Store.getState().keyboardNavIndex;
        const next = current > 0 ? current - 1 : items.length - 1;
        Store.setKeyboardNavIndex(next);
    }

    function openAtIndex(index) {
        const items = Store.getFilteredBookmarks();
        if (index >= 0 && index < items.length) {
            Store.openBookmarkInChrome(items[index]);
            Store.setKeyboardNavIndex(-1);
        }
    }

    // --- Tag navigation ---

    function getTagChips() {
        return Array.from(document.querySelectorAll('#workspace-bar .workspace-chip:not(.workspace-add-tag)'));
    }

    function navigateTagNext() {
        const chips = getTagChips();
        if (chips.length === 0) return;
        Store.setKeyboardNavIndex(-1);
        tagNavIndex = tagNavIndex < chips.length - 1 ? tagNavIndex + 1 : 0;
        highlightTagChip(chips);
    }

    function navigateTagPrev() {
        const chips = getTagChips();
        if (chips.length === 0) return;
        Store.setKeyboardNavIndex(-1);
        tagNavIndex = tagNavIndex > 0 ? tagNavIndex - 1 : chips.length - 1;
        highlightTagChip(chips);
    }

    function highlightTagChip(chips) {
        chips.forEach((chip, i) => {
            chip.classList.toggle('keyboard-focus', i === tagNavIndex);
        });
    }

    function activateTagAtIndex() {
        const chips = getTagChips();
        if (tagNavIndex < 0 || tagNavIndex >= chips.length) return;
        const chip = chips[tagNavIndex];
        const tag = chip.dataset.tag || null;

        // If a specific tag (not ALL), open all its bookmarks in Chrome
        if (tag) {
            Store.openInChrome(tag);
        }
        // Also filter the sidebar to this tag
        Store.setWorkspace(tag);
        resetTagNav();
    }

    function resetTagNav() {
        tagNavIndex = -1;
        getTagChips().forEach(chip => chip.classList.remove('keyboard-focus'));
    }

    // --- Help overlay ---

    function toggleHelp() {
        let overlay = document.getElementById('keyboard-help');
        if (overlay) {
            overlay.remove();
            return;
        }
        overlay = document.createElement('div');
        overlay.id = 'keyboard-help';
        overlay.className = 'keyboard-help-overlay';
        overlay.innerHTML = `
            <div class="keyboard-help-content">
                <h3>Keyboard Shortcuts</h3>
                <table>
                    <tr><td><kbd>/</kbd></td><td>Focus search box</td></tr>
                    <tr><td><kbd>Ctrl+Shift+F</kbd></td><td>Focus search box (global, works from Chrome)</td></tr>
                    <tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd></td><td>Navigate bookmarks</td></tr>
                    <tr><td><kbd>Enter</kbd> / <kbd>Space</kbd></td><td>Open selected bookmark in Chrome</td></tr>
                    <tr><td><kbd>Tab</kbd></td><td>Next tag</td></tr>
                    <tr><td><kbd>Shift+Tab</kbd></td><td>Previous tag</td></tr>
                    <tr><td><kbd>Enter</kbd> / <kbd>Space</kbd> on tag</td><td>Open all bookmarks in tag</td></tr>
                    <tr><td><kbd>Esc</kbd></td><td>Clear search / cancel selection</td></tr>
                    <tr><td><kbd>?</kbd></td><td>Toggle this help</td></tr>
                </table>
                <p class="keyboard-help-dismiss">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</p>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        document.addEventListener('keydown', function closeHelp(e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', closeHelp);
            }
        });
    }

    return { init };
})();
