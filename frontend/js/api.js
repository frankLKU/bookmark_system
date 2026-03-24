const API = (() => {
    const BASE = '/api/v1';

    async function request(method, path, body = null) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) opts.body = JSON.stringify(body);
        const resp = await fetch(`${BASE}${path}`, opts);
        return resp.json();
    }

    return {
        // Bookmarks
        listBookmarks: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request('GET', `/bookmarks${qs ? '?' + qs : ''}`);
        },
        getBookmark: (id) => request('GET', `/bookmarks/${id}`),
        createBookmark: (data) => request('POST', '/bookmarks', data),
        updateBookmark: (id, data) => request('PUT', `/bookmarks/${id}`, data),
        deleteBookmark: (id) => request('DELETE', `/bookmarks/${id}`),
        updateAccess: (id) => request('PATCH', `/bookmarks/${id}/access`),

        // Categories
        listCategories: () => request('GET', '/categories'),
        createCategory: (data) => request('POST', '/categories', data),
        updateCategory: (id, data) => request('PUT', `/categories/${id}`, data),
        deleteCategory: (id) => request('DELETE', `/categories/${id}`),
        reorderCategories: (order) => request('PUT', '/categories/reorder', { order }),

        // Import/Export
        importOnetab: (content) => request('POST', '/import/onetab', { content }),
        importConfirm: (bookmarks) => request('POST', '/import/confirm', { bookmarks }),
        exportData: () => request('GET', '/export'),
        importJson: (data) => request('POST', '/import/json', data),

        // Health
        triggerHealthCheck: () => request('POST', '/health/check'),
        getHealthStatus: () => request('GET', '/health/status'),
    };
})();
