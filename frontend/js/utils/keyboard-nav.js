const KeyboardNav = (() => {
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
                }
                break;

            case 'ArrowDown':
                if (isSearchInput || !isInInput) {
                    e.preventDefault();
                    navigateDown();
                }
                break;

            case 'ArrowUp':
                if (isSearchInput || !isInInput) {
                    e.preventDefault();
                    navigateUp();
                }
                break;

            case 'Enter':
                if (isSearchInput || !isInInput) {
                    const idx = Store.getState().keyboardNavIndex;
                    if (idx >= 0) {
                        e.preventDefault();
                        openAtIndex(idx);
                    }
                }
                break;

            case 'Escape':
                if (isSearchInput) {
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
        }
    }

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
            Store.openTab(items[index]);
            Store.setKeyboardNavIndex(-1);
        }
    }

    return { init };
})();
