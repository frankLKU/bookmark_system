const WorkspaceBar = (() => {
    // Factory tags commonly used at TSMC
    const WORKSPACES = [
        { tag: null, label: 'ALL' },
        { tag: 'f12', label: 'F12' },
        { tag: 'f14a', label: 'F14A' },
        { tag: 'f14b', label: 'F14B' },
        { tag: 'f15', label: 'F15' },
        { tag: 'f15b', label: 'F15B' },
        { tag: 'f16', label: 'F16' },
        { tag: 'f18', label: 'F18' },
        { tag: 'ftestdev', label: 'TestDev' },
    ];

    function init() {
        render();
        Store.on('workspace:changed', render);
    }

    function render() {
        const container = document.querySelector('#workspace-bar .workspace-chips');
        if (!container) return;

        const current = Store.getState().activeWorkspace;
        container.innerHTML = WORKSPACES.map(ws => {
            const active = ws.tag === current ? ' active' : '';
            return `<button class="workspace-chip${active}" data-tag="${ws.tag || ''}">${ws.label}</button>`;
        }).join('');

        container.querySelectorAll('.workspace-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const tag = chip.dataset.tag || null;
                Store.setWorkspace(tag);
            });
        });
    }

    return { init };
})();
