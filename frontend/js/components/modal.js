/* ==========================================================================
   Modals — TIBDP
   All modal dialogs: bookmark form, import, delete confirm, category manage.
   Exposed as window.Modals (called via typeof Modals !== 'undefined' guard).
   ========================================================================== */

const Modals = (() => {
    // -----------------------------------------------------------------------
    // Infrastructure
    // -----------------------------------------------------------------------

    function escapeHtml(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function open(html) {
        const container = document.getElementById('modal-container');
        container.innerHTML = `<div class="modal-backdrop">${html}</div>`;
        container.classList.remove('hidden');

        // Close on backdrop click (not on card click)
        container.querySelector('.modal-backdrop').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) close();
        });

        // Close on Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Focus first input
        setTimeout(() => {
            const firstInput = container.querySelector('input:not([type="checkbox"]), textarea, select');
            if (firstInput) firstInput.focus();
        }, 50);
    }

    function close() {
        const container = document.getElementById('modal-container');
        container.classList.add('hidden');
        container.innerHTML = '';
    }

    // -----------------------------------------------------------------------
    // 1. Bookmark Form (Add / Edit)
    // -----------------------------------------------------------------------

    function showBookmarkForm(bookmark) {
        const isEdit = Boolean(bookmark);
        const title = isEdit ? 'Edit Bookmark' : 'Add Bookmark';

        const { categories } = Store.getState();

        const categoryName = isEdit && bookmark.category_name ? bookmark.category_name : '';
        const categoryDatalist = categories.map(c =>
            `<option value="${escapeHtml(c.name)}">`
        ).join('');

        const tagsValue = isEdit && bookmark.tags ? bookmark.tags.join(', ') : '';

        const html = `
        <div class="modal-card modal-md">
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close" id="modal-close-btn" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div id="modal-error" class="hidden" style="color: var(--danger); font-size: var(--text-sm); margin-bottom: var(--space-3);"></div>

                <div class="form-group">
                    <label class="form-label" for="bm-title">Title <span style="color:var(--danger)">*</span></label>
                    <input type="text" id="bm-title" class="form-input" placeholder="My Bookmark"
                        value="${isEdit ? escapeHtml(bookmark.title) : ''}">
                </div>

                <div class="form-group">
                    <label class="form-label" for="bm-url">URL <span style="color:var(--danger)">*</span></label>
                    <input type="url" id="bm-url" class="form-input" placeholder="https://example.com"
                        value="${isEdit ? escapeHtml(bookmark.url) : ''}">
                </div>

                <div class="form-group">
                    <label class="form-label" for="bm-category">Category <span style="color:var(--text-muted); font-weight:400">(type or pick)</span></label>
                    <input type="text" id="bm-category" class="form-input" list="category-list"
                        placeholder="e.g. Monitoring, CI/CD"
                        value="${escapeHtml(categoryName)}">
                    <datalist id="category-list">${categoryDatalist}</datalist>
                </div>

                <div class="form-group">
                    <label class="form-label" for="bm-tags">Tags <span style="color:var(--text-muted); font-weight:400">(comma-separated)</span></label>
                    <input type="text" id="bm-tags" class="form-input" placeholder="fab14a, fab14b, monitor"
                        value="${escapeHtml(tagsValue)}">
                </div>

            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
                <button class="btn btn-primary" id="modal-save-btn">${isEdit ? 'Save Changes' : 'Add Bookmark'}</button>
            </div>
        </div>`;

        open(html);

        document.getElementById('modal-close-btn').addEventListener('click', close);
        document.getElementById('modal-cancel-btn').addEventListener('click', close);
        document.getElementById('modal-save-btn').addEventListener('click', () => saveBookmark(bookmark));
    }

    async function saveBookmark(existingBookmark) {
        const titleEl = document.getElementById('bm-title');
        const urlEl = document.getElementById('bm-url');
        const categoryEl = document.getElementById('bm-category');
        const tagsEl = document.getElementById('bm-tags');
        const errorEl = document.getElementById('modal-error');
        const saveBtn = document.getElementById('modal-save-btn');

        const titleVal = titleEl.value.trim();
        const urlVal = urlEl.value.trim();

        if (!titleVal) {
            errorEl.textContent = 'Title is required.';
            errorEl.classList.remove('hidden');
            titleEl.focus();
            return;
        }
        if (!urlVal) {
            errorEl.textContent = 'URL is required.';
            errorEl.classList.remove('hidden');
            urlEl.focus();
            return;
        }

        const tagsRaw = tagsEl.value.trim();
        const tags = tagsRaw
            ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
            : [];

        // Resolve category name → category_id (find or create)
        const categoryName = categoryEl.value.trim();
        let categoryId = null;
        if (categoryName) {
            const { categories } = Store.getState();
            const existing = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
            if (existing) {
                categoryId = existing.id;
            } else {
                // Create new category
                const catResp = await Store.addCategory({ name: categoryName });
                if (catResp && catResp.success && catResp.data) {
                    categoryId = catResp.data.id;
                }
            }
        }

        const data = {
            title: titleVal,
            url: urlVal,
            category_id: categoryId,
            tags,
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        let resp;
        if (existingBookmark) {
            resp = await Store.updateBookmark(existingBookmark.id, data);
        } else {
            resp = await Store.addBookmark(data);
        }

        if (resp && resp.success) {
            close();
        } else {
            const msg = (resp && resp.message) ? resp.message : 'Save failed. Please try again.';
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
            saveBtn.disabled = false;
            saveBtn.textContent = existingBookmark ? 'Save Changes' : 'Add Bookmark';
        }
    }

    // -----------------------------------------------------------------------
    // 2. Import Modal (OneTab + JSON)
    // -----------------------------------------------------------------------

    function showImportModal() {
        const html = `
        <div class="modal-card modal-lg">
            <div class="modal-header">
                <h2 class="modal-title">Import Bookmarks</h2>
                <button class="modal-close" id="modal-close-btn" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <!-- OneTab Section -->
                <div style="margin-bottom: var(--space-5);">
                    <h3 style="font-size:var(--text-sm); font-weight:600; color:var(--text-primary); margin:0 0 var(--space-2) 0;">
                        Import from OneTab
                    </h3>
                    <p style="font-size:var(--text-sm); color:var(--text-secondary); margin:0 0 var(--space-3) 0;">
                        Paste your OneTab export text below, then click Parse to preview.
                    </p>
                    <textarea id="onetab-input" class="form-textarea" rows="5"
                        placeholder="https://example.com | My Page&#10;https://another.com | Another Page"></textarea>
                    <div id="onetab-error" class="hidden" style="color:var(--danger); font-size:var(--text-sm); margin-top:var(--space-2);"></div>
                    <div style="margin-top:var(--space-2);">
                        <button class="btn btn-primary" id="parse-btn" style="height:32px;">
                            Parse
                        </button>
                    </div>
                </div>

                <!-- Preview Table (hidden until parsed) -->
                <div id="preview-section" class="hidden" style="margin-bottom:var(--space-5);">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-2);">
                        <h3 style="font-size:var(--text-sm); font-weight:600; color:var(--text-primary); margin:0;">
                            Preview <span id="preview-count" style="color:var(--text-muted); font-weight:400;"></span>
                        </h3>
                    </div>
                    <div style="overflow-x:auto; max-height:260px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius-md);">
                        <table class="import-preview-table" id="preview-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>URL</th>
                                    <th>Tags</th>
                                    <th>Category</th>
                                </tr>
                            </thead>
                            <tbody id="preview-tbody"></tbody>
                        </table>
                    </div>
                    <div id="confirm-error" class="hidden" style="color:var(--danger); font-size:var(--text-sm); margin-top:var(--space-2);"></div>
                </div>

                <!-- JSON Import Section -->
                <div style="border-top:1px solid var(--border); padding-top:var(--space-4);">
                    <h3 style="font-size:var(--text-sm); font-weight:600; color:var(--text-primary); margin:0 0 var(--space-2) 0;">
                        Import JSON Backup
                    </h3>
                    <p style="font-size:var(--text-sm); color:var(--text-secondary); margin:0 0 var(--space-3) 0;">
                        Restore from a previously exported JSON file. This will merge bookmarks.
                    </p>
                    <div style="display:flex; align-items:center; gap:var(--space-3);">
                        <input type="file" id="json-file-input" accept=".json" style="font-size:var(--text-sm); color:var(--text-primary);">
                        <button class="btn btn-primary" id="json-import-btn" disabled style="height:32px; flex-shrink:0;">
                            Import JSON
                        </button>
                    </div>
                    <div id="json-error" class="hidden" style="color:var(--danger); font-size:var(--text-sm); margin-top:var(--space-2);"></div>
                    <div id="json-success" class="hidden" style="color:var(--success); font-size:var(--text-sm); margin-top:var(--space-2);"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
                <button class="btn btn-primary hidden" id="confirm-import-btn">Confirm Import</button>
            </div>
        </div>`;

        open(html);

        document.getElementById('modal-close-btn').addEventListener('click', close);
        document.getElementById('modal-cancel-btn').addEventListener('click', close);
        document.getElementById('parse-btn').addEventListener('click', parseOnetab);
        document.getElementById('confirm-import-btn').addEventListener('click', confirmImport);

        // JSON file input — enable button when file selected
        const jsonFileInput = document.getElementById('json-file-input');
        const jsonImportBtn = document.getElementById('json-import-btn');
        jsonFileInput.addEventListener('change', () => {
            jsonImportBtn.disabled = !jsonFileInput.files.length;
        });
        jsonImportBtn.addEventListener('click', importJson);
    }

    async function parseOnetab() {
        const input = document.getElementById('onetab-input').value.trim();
        const errorEl = document.getElementById('onetab-error');
        const parseBtn = document.getElementById('parse-btn');

        errorEl.classList.add('hidden');

        if (!input) {
            errorEl.textContent = 'Please paste OneTab content before parsing.';
            errorEl.classList.remove('hidden');
            return;
        }

        parseBtn.disabled = true;
        parseBtn.textContent = 'Parsing…';

        const resp = await API.importOnetab(input);

        parseBtn.disabled = false;
        parseBtn.textContent = 'Parse';

        if (!resp || !resp.success) {
            const msg = (resp && resp.message) ? resp.message : 'Failed to parse OneTab content.';
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
            return;
        }

        const bookmarks = resp.data?.preview || resp.data || [];
        renderPreviewTable(bookmarks);

        document.getElementById('preview-section').classList.remove('hidden');
        document.getElementById('preview-count').textContent = `(${bookmarks.length} bookmarks)`;
        document.getElementById('confirm-import-btn').classList.remove('hidden');
        document.getElementById('confirm-import-btn').dataset.ready = 'true';
    }

    function renderPreviewTable(bookmarks) {
        const tbody = document.getElementById('preview-tbody');
        const { categories } = Store.getState();

        function buildCategoryOptions(selectedCategory) {
            return `<option value="">— None —</option>` +
                categories.map(c => {
                    const sel = selectedCategory && c.name.toLowerCase() === selectedCategory.toLowerCase() ? ' selected' : '';
                    return `<option value="${escapeHtml(c.name)}"${sel}>${escapeHtml(c.name)}</option>`;
                }).join('');
        }

        tbody.innerHTML = bookmarks.map((bm, i) => `
            <tr data-index="${i}">
                <td><input type="text" value="${escapeHtml(bm.title || '')}" data-field="title" class="preview-field"></td>
                <td><input type="text" value="${escapeHtml(bm.url || '')}" data-field="url" class="preview-field"></td>
                <td><input type="text" value="${escapeHtml((bm.tags || []).join(', '))}" data-field="tags" class="preview-field"></td>
                <td>
                    <select data-field="category" class="preview-field" style="height:28px; font-size:var(--text-xs); padding:0 var(--space-1); border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-primary); color:var(--text-primary); width:100%;">
                        ${buildCategoryOptions(bm.category)}
                    </select>
                </td>
            </tr>
        `).join('');

        // Store the parsed bookmarks on the confirm button for retrieval
        document.getElementById('confirm-import-btn')._parsedBookmarks = bookmarks;
    }

    async function confirmImport() {
        const confirmBtn = document.getElementById('confirm-import-btn');
        const errorEl = document.getElementById('confirm-error');
        errorEl.classList.add('hidden');

        // Collect current table values
        const rows = document.querySelectorAll('#preview-tbody tr');
        const bookmarks = [];

        rows.forEach(row => {
            const fields = row.querySelectorAll('.preview-field');
            const bm = {};
            fields.forEach(f => {
                const field = f.dataset.field;
                if (field === 'tags') {
                    bm.tags = f.value.split(',').map(t => t.trim()).filter(Boolean);
                } else {
                    bm[field] = field === 'category' ? f.value.trim() : (f.value.trim() || null);
                }
            });
            if (bm.title || bm.url) bookmarks.push(bm);
        });

        if (!bookmarks.length) {
            errorEl.textContent = 'No bookmarks to import.';
            errorEl.classList.remove('hidden');
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Importing…';

        const resp = await Store.importBookmarks(bookmarks);

        if (resp && resp.success) {
            close();
        } else {
            const msg = (resp && resp.message) ? resp.message : 'Import failed. Please try again.';
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Import';
        }
    }

    async function importJson() {
        const fileInput = document.getElementById('json-file-input');
        const errorEl = document.getElementById('json-error');
        const successEl = document.getElementById('json-success');
        const importBtn = document.getElementById('json-import-btn');

        errorEl.classList.add('hidden');
        successEl.classList.add('hidden');

        if (!fileInput.files.length) return;

        const file = fileInput.files[0];
        let data;
        try {
            const text = await file.text();
            data = JSON.parse(text);
        } catch (e) {
            errorEl.textContent = 'Invalid JSON file. Please check the file and try again.';
            errorEl.classList.remove('hidden');
            return;
        }

        importBtn.disabled = true;
        importBtn.textContent = 'Importing…';

        const resp = await API.importJson(data);

        importBtn.disabled = false;
        importBtn.textContent = 'Import JSON';

        if (resp && resp.success) {
            // Reload data then close
            await Store.loadCategories();
            await Store.loadBookmarks();
            successEl.textContent = 'Import successful!';
            successEl.classList.remove('hidden');
            setTimeout(close, 1200);
        } else {
            const msg = (resp && resp.message) ? resp.message : 'JSON import failed. Please try again.';
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
        }
    }

    // -----------------------------------------------------------------------
    // 3. Delete Confirm
    // -----------------------------------------------------------------------

    function showDeleteConfirm(title, onConfirm) {
        const html = `
        <div class="modal-card modal-sm">
            <div class="modal-header">
                <h2 class="modal-title">Delete Bookmark</h2>
                <button class="modal-close" id="modal-close-btn" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <p style="font-size:var(--text-sm); color:var(--text-primary); margin:0;">
                    Delete <strong>${escapeHtml(title)}</strong>?
                </p>
                <p style="font-size:var(--text-sm); color:var(--text-secondary); margin:var(--space-2) 0 0 0;">
                    This action cannot be undone.
                </p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
                <button class="btn btn-danger" id="modal-delete-btn">Delete</button>
            </div>
        </div>`;

        open(html);

        document.getElementById('modal-close-btn').addEventListener('click', close);
        document.getElementById('modal-cancel-btn').addEventListener('click', close);
        document.getElementById('modal-delete-btn').addEventListener('click', async () => {
            const deleteBtn = document.getElementById('modal-delete-btn');
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting…';
            await onConfirm();
            close();
        });
    }

    // -----------------------------------------------------------------------
    // 4. Category Manage Modal
    // -----------------------------------------------------------------------

    function showCategoryManageModal() {
        const html = `
        <div class="modal-card modal-md">
            <div class="modal-header">
                <h2 class="modal-title">Manage Categories</h2>
                <button class="modal-close" id="modal-close-btn" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <!-- Add new category -->
                <div style="display:flex; gap:var(--space-2); margin-bottom:var(--space-4);">
                    <input type="text" id="new-cat-input" class="form-input" placeholder="New category name" style="flex:1;">
                    <button class="btn btn-primary" id="add-cat-btn" style="flex-shrink:0;">Add</button>
                </div>
                <div id="cat-add-error" class="hidden" style="color:var(--danger); font-size:var(--text-sm); margin-bottom:var(--space-3);"></div>

                <!-- Category list -->
                <div id="cat-list" style="display:flex; flex-direction:column; gap:var(--space-1);">
                    <!-- Items rendered by renderCategoryList() -->
                </div>

                <div id="cat-list-empty" class="hidden" style="font-size:var(--text-sm); color:var(--text-muted); text-align:center; padding:var(--space-4) 0;">
                    No categories yet. Add one above.
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" id="modal-close-btn-footer">Done</button>
            </div>
        </div>`;

        open(html);

        document.getElementById('modal-close-btn').addEventListener('click', close);
        document.getElementById('modal-close-btn-footer').addEventListener('click', close);
        document.getElementById('add-cat-btn').addEventListener('click', addCategory);

        // Allow Enter key in input to add
        document.getElementById('new-cat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addCategory();
        });

        renderCategoryList();
    }

    function renderCategoryList() {
        const { categories } = Store.getState();
        const listEl = document.getElementById('cat-list');
        const emptyEl = document.getElementById('cat-list-empty');

        if (!listEl) return;

        if (!categories.length) {
            listEl.innerHTML = '';
            emptyEl && emptyEl.classList.remove('hidden');
            return;
        }

        emptyEl && emptyEl.classList.add('hidden');

        listEl.innerHTML = categories.map((cat, index) => `
            <div class="cat-row" data-cat-id="${escapeHtml(cat.id)}" data-index="${index}"
                draggable="true"
                style="display:flex; align-items:center; gap:var(--space-2); padding:var(--space-2) var(--space-2); border:1px solid var(--border); border-radius:var(--radius-md); background:var(--bg-primary); cursor:default;">
                <!-- Drag handle -->
                <span class="drag-handle" title="Drag to reorder"
                    style="cursor:grab; color:var(--text-muted); flex-shrink:0; display:flex; align-items:center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="8" y1="6" x2="16" y2="6"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                        <line x1="8" y1="18" x2="16" y2="18"/>
                    </svg>
                </span>
                <!-- Name — double-click to edit -->
                <span class="cat-name-display" data-cat-id="${escapeHtml(cat.id)}"
                    title="Double-click to rename"
                    style="flex:1; font-size:var(--text-sm); color:var(--text-primary); cursor:text; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${escapeHtml(cat.name)}
                </span>
                <!-- Delete button -->
                <button class="btn btn-ghost cat-delete-btn" data-cat-id="${escapeHtml(cat.id)}" data-cat-name="${escapeHtml(cat.name)}"
                    style="height:28px; padding:0 var(--space-2); color:var(--danger); flex-shrink:0;"
                    title="Delete category">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `).join('');

        // Attach double-click rename listeners
        listEl.querySelectorAll('.cat-name-display').forEach(span => {
            span.addEventListener('dblclick', () => startRenameCategory(span));
        });

        // Attach delete listeners
        listEl.querySelectorAll('.cat-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const catId = btn.dataset.catId;
                const catName = btn.dataset.catName;
                showDeleteCategoryConfirm(catId, catName);
            });
        });

        // Attach drag-and-drop
        setupCategoryDnd(listEl);
    }

    function startRenameCategory(span) {
        const catId = span.dataset.catId;
        const currentName = span.textContent.trim();

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'form-input';
        input.style.cssText = 'flex:1; height:28px; font-size:var(--text-sm);';

        span.replaceWith(input);
        input.focus();
        input.select();

        const save = async () => {
            const newName = input.value.trim();
            if (!newName || newName === currentName) {
                // Restore
                const restored = document.createElement('span');
                restored.className = 'cat-name-display';
                restored.dataset.catId = catId;
                restored.title = 'Double-click to rename';
                restored.style.cssText = 'flex:1; font-size:var(--text-sm); color:var(--text-primary); cursor:text; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
                restored.textContent = currentName;
                restored.addEventListener('dblclick', () => startRenameCategory(restored));
                input.replaceWith(restored);
                return;
            }
            const resp = await Store.updateCategory(catId, { name: newName });
            if (resp && resp.success) {
                renderCategoryList();
            } else {
                // Restore original on failure
                input.value = currentName;
                input.style.borderColor = 'var(--danger)';
            }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') {
                input.value = currentName;
                save();
            }
        });
    }

    function showDeleteCategoryConfirm(catId, catName) {
        // Inline confirmation row replacement
        const row = document.querySelector(`.cat-row[data-cat-id="${catId}"]`);
        if (!row) return;

        const originalHtml = row.innerHTML;
        row.innerHTML = `
            <span style="flex:1; font-size:var(--text-sm); color:var(--text-primary);">
                Delete <strong>${escapeHtml(catName)}</strong>? Bookmarks will become uncategorized.
            </span>
            <button class="btn btn-ghost" id="cat-delete-cancel" style="height:28px; padding:0 var(--space-2);">Cancel</button>
            <button class="btn btn-danger cat-delete-confirm" style="height:28px; padding:0 var(--space-2);">Delete</button>
        `;

        row.querySelector('#cat-delete-cancel').addEventListener('click', () => {
            row.innerHTML = originalHtml;
            // Re-attach listeners for this row
            const nameSpan = row.querySelector('.cat-name-display');
            if (nameSpan) nameSpan.addEventListener('dblclick', () => startRenameCategory(nameSpan));
            const deleteBtn = row.querySelector('.cat-delete-btn');
            if (deleteBtn) deleteBtn.addEventListener('click', () => showDeleteCategoryConfirm(deleteBtn.dataset.catId, deleteBtn.dataset.catName));
        });

        row.querySelector('.cat-delete-confirm').addEventListener('click', async () => {
            const confirmBtn = row.querySelector('.cat-delete-confirm');
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Deleting…';
            await Store.deleteCategory(catId);
            renderCategoryList();
        });
    }

    // -----------------------------------------------------------------------
    // Category Drag & Drop (HTML5 DnD API)
    // -----------------------------------------------------------------------

    let _dragSrcIndex = null;

    function setupCategoryDnd(listEl) {
        const rows = listEl.querySelectorAll('.cat-row');

        rows.forEach(row => {
            row.addEventListener('dragstart', (e) => {
                _dragSrcIndex = parseInt(row.dataset.index);
                row.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            });

            row.addEventListener('dragend', () => {
                row.style.opacity = '';
                listEl.querySelectorAll('.cat-row').forEach(r => r.style.outline = '');
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                listEl.querySelectorAll('.cat-row').forEach(r => r.style.outline = '');
                row.style.outline = '2px solid var(--accent)';
            });

            row.addEventListener('dragleave', () => {
                row.style.outline = '';
            });

            row.addEventListener('drop', async (e) => {
                e.preventDefault();
                row.style.outline = '';
                const destIndex = parseInt(row.dataset.index);

                if (_dragSrcIndex === null || _dragSrcIndex === destIndex) return;

                const { categories } = Store.getState();
                const reordered = [...categories];
                const [moved] = reordered.splice(_dragSrcIndex, 1);
                reordered.splice(destIndex, 0, moved);

                // Build new order array: list of category IDs in desired order
                const order = reordered.map(cat => cat.id);

                _dragSrcIndex = null;

                const resp = await Store.reorderCategories(order);
                if (resp && resp.success) {
                    renderCategoryList();
                }
            });
        });
    }

    // -----------------------------------------------------------------------
    // Add Category helper (used inside category modal)
    // -----------------------------------------------------------------------

    async function addCategory() {
        const input = document.getElementById('new-cat-input');
        const errorEl = document.getElementById('cat-add-error');
        const addBtn = document.getElementById('add-cat-btn');

        if (!input) return;
        errorEl && errorEl.classList.add('hidden');

        const name = input.value.trim();
        if (!name) {
            if (errorEl) {
                errorEl.textContent = 'Category name cannot be empty.';
                errorEl.classList.remove('hidden');
            }
            input.focus();
            return;
        }

        addBtn.disabled = true;

        const resp = await Store.addCategory({ name });

        addBtn.disabled = false;

        if (resp && resp.success) {
            input.value = '';
            input.focus();
            renderCategoryList();
        } else {
            if (errorEl) {
                const msg = (resp && resp.message) ? resp.message : 'Failed to add category.';
                errorEl.textContent = msg;
                errorEl.classList.remove('hidden');
            }
        }
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    return {
        open,
        close,
        showBookmarkForm,
        showImportModal,
        showDeleteConfirm,
        showCategoryManageModal,
    };
})();
