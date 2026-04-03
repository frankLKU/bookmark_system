const Store = (() => {
    // State
    const state = {
        bookmarks: [],
        categories: [],
        tabs: [],           // { id, url, title, bookmarkId }
        activeTabId: null,
        activeWorkspace: null,  // null = ALL, or factory tag string
        searchQuery: '',
        collapsedCategories: new Set(),
        healthStatus: {},   // { bookmark_id: { is_healthy, status_code, checked_at } }
        keyboardNavIndex: -1,
        chromeTabs: [],         // tabs from Chrome Extension via REST polling
        chromeConnected: false, // is Chrome Extension WebSocket connected?
    };

    // Event system
    const listeners = {};

    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
        return () => {
            listeners[event] = listeners[event].filter(cb => cb !== callback);
        };
    }

    function emit(event, data) {
        (listeners[event] || []).forEach(cb => cb(data));
    }

    // State getters
    function getState() { return state; }

    function getFilteredBookmarks() {
        let items = state.bookmarks;
        if (state.activeWorkspace) {
            items = items.filter(b =>
                b.tags && b.tags.some(t => t.toLowerCase() === state.activeWorkspace.toLowerCase())
            );
        }
        if (state.searchQuery) {
            const q = state.searchQuery.toLowerCase();
            items = items.filter(b =>
                b.title.toLowerCase().includes(q) ||
                b.url.toLowerCase().includes(q) ||
                (b.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }
        return items;
    }

    // Data loading
    async function loadBookmarks() {
        const resp = await API.listBookmarks({ per_page: 100 });
        if (resp.success) {
            state.bookmarks = resp.data.items;
            emit('bookmarks:changed', state.bookmarks);
        }
    }

    async function loadCategories() {
        const resp = await API.listCategories();
        if (resp.success) {
            state.categories = resp.data;
            emit('categories:changed', state.categories);
        }
    }

    async function loadHealthStatus() {
        const resp = await API.getHealthStatus();
        if (resp.success) {
            const map = {};
            resp.data.forEach(h => { map[h.bookmark_id] = h; });
            state.healthStatus = map;
            emit('health:changed', state.healthStatus);
        }
    }

    // Bookmark CRUD
    async function addBookmark(data) {
        const resp = await API.createBookmark(data);
        if (resp.success) await loadBookmarks();
        return resp;
    }

    async function updateBookmark(id, data) {
        const resp = await API.updateBookmark(id, data);
        if (resp.success) await loadBookmarks();
        return resp;
    }

    async function deleteBookmark(id) {
        const resp = await API.deleteBookmark(id);
        if (resp.success) {
            // Also close tab if open
            const tabIdx = state.tabs.findIndex(t => t.bookmarkId === id);
            if (tabIdx !== -1) closeTab(state.tabs[tabIdx].id);
            await loadBookmarks();
        }
        return resp;
    }

    // Category CRUD
    async function addCategory(data) {
        const resp = await API.createCategory(data);
        if (resp.success) await loadCategories();
        return resp;
    }

    async function updateCategory(id, data) {
        const resp = await API.updateCategory(id, data);
        if (resp.success) await loadCategories();
        return resp;
    }

    async function deleteCategory(id) {
        const resp = await API.deleteCategory(id);
        if (resp.success) {
            await loadCategories();
            await loadBookmarks();
        }
        return resp;
    }

    async function reorderCategories(order) {
        const resp = await API.reorderCategories(order);
        if (resp.success) await loadCategories();
        return resp;
    }

    // Import
    async function importBookmarks(bookmarks) {
        const resp = await API.importConfirm(bookmarks);
        if (resp.success) {
            await loadCategories();
            await loadBookmarks();
        }
        return resp;
    }

    // Tab management
    function openTab(bookmark) {
        // Dedup: if URL already open, just focus it
        const existing = state.tabs.find(t => t.url === bookmark.url);
        if (existing) {
            state.activeTabId = existing.id;
            emit('tabs:changed', state.tabs);
            emit('activeTab:changed', state.activeTabId);
            return;
        }

        const tab = {
            id: 'tab-' + Date.now(),
            url: bookmark.url,
            title: bookmark.title,
            bookmarkId: bookmark.id,
        };
        state.tabs.push(tab);
        state.activeTabId = tab.id;
        emit('tabs:changed', state.tabs);
        emit('activeTab:changed', state.activeTabId);

        // Update last accessed
        API.updateAccess(bookmark.id);
    }

    function closeTab(tabId) {
        state.tabs = state.tabs.filter(t => t.id !== tabId);
        if (state.activeTabId === tabId) {
            state.activeTabId = state.tabs.length > 0 ? state.tabs[state.tabs.length - 1].id : null;
        }
        emit('tabs:changed', state.tabs);
        emit('activeTab:changed', state.activeTabId);
    }

    function setActiveTab(tabId) {
        state.activeTabId = tabId;
        emit('activeTab:changed', state.activeTabId);
    }

    // Workspace filter
    function setWorkspace(tag) {
        state.activeWorkspace = tag;
        state.keyboardNavIndex = -1;
        emit('workspace:changed', tag);
        emit('bookmarks:changed', state.bookmarks);
    }

    // Search
    function setSearch(query) {
        state.searchQuery = query;
        state.keyboardNavIndex = -1;
        emit('search:changed', query);
        emit('bookmarks:changed', state.bookmarks);
    }

    // Category collapse
    function toggleCategoryCollapse(categoryId) {
        if (state.collapsedCategories.has(categoryId)) {
            state.collapsedCategories.delete(categoryId);
        } else {
            state.collapsedCategories.add(categoryId);
        }
        emit('categories:changed', state.categories);
    }

    // Keyboard nav
    function setKeyboardNavIndex(index) {
        state.keyboardNavIndex = index;
        emit('keyboardNav:changed', index);
    }

    // --- Chrome Extension commands (via REST → backend → WebSocket → extension) ---

    async function openInChrome(tag) {
        const bookmarks = state.bookmarks.filter(b =>
            b.tags && b.tags.some(t => t.toLowerCase() === tag.toLowerCase())
        );
        const urls = bookmarks.map(b => b.url);
        if (urls.length === 0) return;

        await fetch('/api/v1/chrome/open-tab-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag, urls }),
        });
    }

    function normalizeUrl(url) {
        // Strip protocol, www, fragment, and trailing slash for comparison
        return (url || '')
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/#.*$/, '')
            .replace(/\/+$/, '')
            .toLowerCase();
    }

    function normalizeUrlNoQuery(url) {
        // Strip query params too — for fuzzy matching after exact match fails
        return normalizeUrl(url).replace(/\?.*$/, '');
    }

    function findChromeTabByUrl(url) {
        const norm = normalizeUrl(url);
        // Pass 1: exact match (after normalizing protocol/www/fragment/slash)
        const exact = state.chromeTabs.find(t => normalizeUrl(t.url) === norm);
        if (exact) return exact;
        // Pass 2: match ignoring query params (handles redirects adding/removing params)
        const normNoQ = normalizeUrlNoQuery(url);
        if (normNoQ) {
            return state.chromeTabs.find(t => normalizeUrlNoQuery(t.url) === normNoQ);
        }
        return null;
    }

    async function openBookmarkInChrome(bookmark) {
        // Refresh chrome tabs before checking to avoid stale data
        await loadChromeTabs();

        // 1. Check if this URL is already open in a Chrome tab
        const existing = findChromeTabByUrl(bookmark.url);
        if (existing) {
            await switchChromeTab(existing.id);
            API.updateAccess(bookmark.id);
            return;
        }

        // 2. Not open yet — find the bookmark's first tag and open the whole group
        const tag = (bookmark.tags && bookmark.tags.length > 0)
            ? bookmark.tags[0].toLowerCase()
            : null;

        if (tag) {
            // Check if the group is already open (has tabs with that groupName)
            const groupOpen = state.chromeTabs.some(t =>
                t.groupName && t.groupName.toLowerCase() === tag
            );

            if (groupOpen) {
                // Group is open but this specific URL isn't — open it in the same window
                await fetch('/api/v1/chrome/open-single-tab', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tag, url: bookmark.url }),
                });
            } else {
                // Open the full group with this URL as the focus target
                await fetch('/api/v1/chrome/open-tab-group', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tag, urls: getTagUrls(tag), focusUrl: bookmark.url }),
                });
            }
        } else {
            // No tag — open single tab in a default window
            await fetch('/api/v1/chrome/open-single-tab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: bookmark.url }),
            });
        }

        API.updateAccess(bookmark.id);
    }

    function getTagUrls(tag) {
        return state.bookmarks
            .filter(b => b.tags && b.tags.some(t => t.toLowerCase() === tag))
            .map(b => b.url);
    }

    async function switchChromeTab(tabId) {
        await fetch('/api/v1/chrome/switch-tab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tabId }),
        });
    }

    async function closeChromeTab(tabId) {
        await fetch('/api/v1/chrome/close-tab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tabId }),
        });
    }

    async function closeChromeGroup(tag) {
        await fetch('/api/v1/chrome/close-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag }),
        });
    }

    async function loadChromeTabs() {
        try {
            const resp = await fetch('/api/v1/chrome/tabs');
            const data = await resp.json();
            if (data.success) {
                state.chromeTabs = data.data.tabs;
                state.chromeConnected = data.data.connected;
                emit('chromeTabs:changed', state.chromeTabs);
                emit('chromeConnected:changed', state.chromeConnected);
            }
        } catch (e) {
            state.chromeConnected = false;
            emit('chromeConnected:changed', false);
        }
    }

    return {
        on, emit, getState, getFilteredBookmarks,
        loadBookmarks, loadCategories, loadHealthStatus,
        addBookmark, updateBookmark, deleteBookmark,
        addCategory, updateCategory, deleteCategory, reorderCategories,
        importBookmarks,
        openTab, closeTab, setActiveTab,
        setWorkspace, setSearch,
        toggleCategoryCollapse, setKeyboardNavIndex,
        openInChrome, openBookmarkInChrome, switchChromeTab, closeChromeTab, closeChromeGroup,
        loadChromeTabs,
    };
})();
