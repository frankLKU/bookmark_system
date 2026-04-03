const Theme = (() => {
    const STORAGE_KEY = 'tibdp-theme';

    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            apply(saved);
        } else {
            // Follow system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            apply(prefersDark ? 'dark' : 'light');
        }

        // Listen for system changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(STORAGE_KEY)) {
                apply(e.matches ? 'dark' : 'light');
            }
        });

        // Wire up toggle button
        const toggleBtn = document.getElementById('btn-theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggle);
        }
    }

    function apply(theme) {
        document.documentElement.dataset.theme = theme;
        updateIcon(theme);
    }

    function toggle() {
        const current = document.documentElement.dataset.theme;
        const next = current === 'dark' ? 'light' : 'dark';
        apply(next);
        localStorage.setItem(STORAGE_KEY, next);
    }

    function updateIcon(theme) {
        const btn = document.getElementById('btn-theme-toggle');
        if (!btn) return;
        if (theme === 'dark') {
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
        } else {
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
        }
    }

    return { init, toggle };
})();
