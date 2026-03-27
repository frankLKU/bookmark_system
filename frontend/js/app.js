/* ==========================================================================
   App Entry Point — TIBDP
   Initialises all components and wires up global button handlers after DOM
   and all deferred scripts have loaded.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    // ------------------------------------------------------------------
    // Bootstrap: apply theme before anything renders to avoid flash
    // ------------------------------------------------------------------
    if (typeof Theme !== 'undefined' && Theme.init) Theme.init();

    // ------------------------------------------------------------------
    // Bootstrap: load data
    // ------------------------------------------------------------------
    await Store.loadCategories();
    await Store.loadBookmarks();
    Store.loadHealthStatus(); // fire-and-forget — health check can be slow

    // ------------------------------------------------------------------
    // Initialise UI components (those that have an init())
    // ------------------------------------------------------------------
    if (typeof WorkspaceBar !== 'undefined' && WorkspaceBar.init) WorkspaceBar.init();
    if (typeof Sidebar !== 'undefined' && Sidebar.init) Sidebar.init();
    if (typeof TabBar !== 'undefined' && TabBar.init) TabBar.init();
    if (typeof SmartWindow !== 'undefined' && SmartWindow.init) SmartWindow.init();
    if (typeof KeyboardNav !== 'undefined' && KeyboardNav.init) KeyboardNav.init();
    if (typeof Router !== 'undefined' && Router.init) Router.init();

    // ------------------------------------------------------------------
    // Health check: run once immediately, then every 60 s
    // ------------------------------------------------------------------
    if (typeof API !== 'undefined') {
        API.triggerHealthCheck();
        setInterval(() => API.triggerHealthCheck(), 60000);
    }

    // ------------------------------------------------------------------
    // Wire sidebar footer buttons → Modals
    // ------------------------------------------------------------------
    const addBookmarkBtn = document.getElementById('btn-add-bookmark');
    if (addBookmarkBtn) {
        addBookmarkBtn.addEventListener('click', () => {
            if (typeof Modals !== 'undefined') Modals.showBookmarkForm();
        });
    }

    const importBtn = document.getElementById('btn-import');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            if (typeof Modals !== 'undefined') Modals.showImportModal();
        });
    }

    // Settings button → Category Manage Modal
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (typeof Modals !== 'undefined') Modals.showCategoryManageModal();
        });
    }
});
