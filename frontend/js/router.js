const Router = (() => {
    function init() {
        // Nothing to do — workspace state is managed by Store
    }

    function setWorkspace(tag) {
        Store.setWorkspace(tag);
    }

    function getWorkspace() {
        return Store.getState().activeWorkspace;
    }

    return { init, setWorkspace, getWorkspace };
})();
