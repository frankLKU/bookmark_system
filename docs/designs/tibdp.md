# UI Design Specification: TIBDP

## 1. Overall Layout

The application uses a two-panel layout: a fixed-width sidebar on the left and a flexible main viewport on the right.

```
+---------------------------------------------------------------+
| [Factory Workspace Bar]  f12 | f14a | f14b | ... | ALL        |
+---------------+-----------------------------------------------+
|               |  [Tab Bar]                                     |
|   SIDEBAR     |  Tab1  |  Tab2  |  Tab3  |  +                 |
|   (320px)     +-----------------------------------------------+
|               |                                                |
|  [Search]     |           MAIN VIEWPORT                        |
|  [Categories] |        (iframe content area)                   |
|  [Bookmarks]  |                                                |
|               |                                                |
|  [Actions]    |                                                |
+---------------+-----------------------------------------------+
```

- **Total min-width:** 1280px (desktop-only, per PRD scope)
- **Sidebar width:** 320px, fixed
- **Main viewport:** fills remaining width
- **Factory Workspace Bar:** full-width horizontal bar at the top, height 40px

---

## 2. Factory Workspace Bar

**Location:** Top of the page, full width, above both sidebar and main viewport.

**Purpose:** Arc-inspired workspace switcher (FR-4.7.3). Filters the entire sidebar to show bookmarks for a specific factory.

**Component: `WorkspaceBar`**

| Element | Spec |
|---------|------|
| Container | Horizontal scrollable bar, height: 40px, dark background (#111827) (dark) / light gray (#f3f4f6) (light) |
| Factory Chips | Pill-shaped buttons, one per FactoryTag. Label is uppercase (e.g., "F18"). Horizontally arranged with gap: 4px |
| "ALL" Button | First item, shows all bookmarks (no filter). Default active state |
| Active State | Active chip uses blue background (CSS Variable) with white text, inactive uses dark gray background (CSS Variable) with light gray text (dark) |
| Interaction | Click sets the active workspace filter. Only one can be active at a time |

**Factory Tags (from PRD):** `f12`, `f14a`, `f14b`, `f15a`, `f15b`, `f16`, `f18`, `f18b`, `f20`, `f21`, `f22`, `f23`, `foc`, `ftest`, `ftestdev`

---

## 3. Sidebar

**Width:** 320px, fixed. Full height below the workspace bar.
**Background:** very dark background (CSS Variable, ~#030712) (dark) / white (light), with a right border separator.

### 3.1 Search Input

**Component: `SidebarSearch`**

| Element | Spec |
|---------|------|
| Container | Sticky top of sidebar, padding: 8px 12px |
| Input | Full width, height: 36px, placeholder "Search bookmarks... ( / )", border-radius: 6px |
| Icon | `Search` icon (Lucide) on the left inside the input |
| Clear Button | `X` icon appears when input has text; clears search on click |
| Keyboard | `/` focuses input (global hotkey, except when in another input). `Escape` clears and blurs. `ArrowUp`/`ArrowDown` navigate results. `Enter` opens selected |

### 3.2 Category Groups

**Component: `CategoryGroup`**

Each category is a collapsible section containing its bookmarks.

| Element | Spec |
|---------|------|
| Header | height: 32px, flex row: `ChevronRight`/`ChevronDown` icon (12px) + category name (semibold, 14px font size) + bookmark count badge (right-aligned, ~12px font size, muted color) |
| Collapse | Click header toggles section open/closed. Default: open |
| Order | Categories displayed in `category.order` sequence |
| Empty State | If a category has no bookmarks matching current workspace filter, hide the entire group |

### 3.3 Bookmark Item

**Component: `BookmarkItem`**

Each bookmark entry within a category group.

| Element | Spec |
|---------|------|
| Container | height: 36px, padding: 8px 12px, flex row, border-radius: 6px on hover. Cursor pointer |
| Health Dot | 8px circle, left side. Green (CSS Variable, ~#22c55e) = healthy, Red (CSS Variable, ~#ef4444) = unreachable, Gray (CSS Variable, ~#9ca3af) = unchecked/unknown |
| Title | 14px font size, truncated with ellipsis if too long |
| Tags | Small muted text below title showing factory tags (e.g., "f18, f14a"), ~12px font size, muted gray (CSS Variable) |
| Hover | dark background (#1f2937) (dark) / light gray (#f3f4f6) (light) |
| Active | slightly lighter dark background (#374151) (dark) / very light blue (#eff6ff) (light), left border accent: 2px solid blue (CSS Variable) |
| Keyboard Nav | Highlighted item gets the active style. Visual ring focus indicator |
| Combined Icon | If `isCombined`, show a small `Columns2` icon (Lucide) next to the title |
| Click | Opens bookmark in main viewport tab (or focuses existing tab if URL already open) |
| Right-click | Context menu with: Edit, Delete, Open in New Window |

### 3.4 Sidebar Footer Actions

**Component: `SidebarActions`**

| Element | Spec |
|---------|------|
| Container | Sticky bottom of sidebar, padding: 8px 12px, top border |
| Add Bookmark | Button: `+ Add Bookmark` - opens AddBookmarkModal |
| Import | Button: `Import` (upload icon) - opens ImportModal |
| Export | Button: `Export` (download icon) - triggers JSON download |
| Settings | Gear icon button - opens SettingsModal (dark/light toggle) |

All buttons are 14px font size, icon + label, gap: 8px, horizontal layout wrapping as needed.

---

## 4. Main Viewport

### 4.1 Tab Bar

**Component: `TabBar`**

| Element | Spec |
|---------|------|
| Container | height: 40px, horizontal scrollable, dark background (#111827) (dark) / very light gray (#f9fafb) (light), bottom border |
| Tab | min-width: 120px, max-width: 200px, flex row: favicon (16px, optional) + title (truncated) + close button (`X`, 14px) |
| Active Tab | slightly lighter dark (#1f2937) with 2px bottom border blue (CSS Variable) (dark) / white with 2px bottom border blue (CSS Variable) (light) |
| Inactive Tab | dark background (#111827), muted gray text (CSS Variable) (dark) / light gray (#f3f4f6), muted text (CSS Variable) (light) |
| Close Button | Visible on hover or when tab is active. Click closes tab |
| Click | Switches to that tab's content |
| No Tabs State | Show a centered welcome message: "Open a bookmark from the sidebar to get started" |

### 4.2 Content Area - Single View

**Component: `SmartIframe`**

| Element | Spec |
|---------|------|
| Container | Fills all remaining space below tab bar, width: 100%, height: 100% |
| Iframe | `width: 100%`, `height: 100%`, `border: none` |
| Loading State | Centered spinner + "Loading..." text overlay while iframe loads |
| Error State | When iframe fails to load (X-Frame-Options, CORS, CSP): show error card centered in viewport |

**Error Card (`IframeErrorFallback`):**

```
+-------------------------------------------+
|     [AlertTriangle Icon]                   |
|                                            |
|  This page cannot be embedded              |
|                                            |
|  The target site blocks iframe embedding   |
|  due to security restrictions.             |
|                                            |
|  [ Open in New Window ]                    |
+-------------------------------------------+
```

- Card: max-width: ~448px, centered, border-radius: 8px, padding: 32px, box-shadow (elevation)
- Button: Primary style, opens URL in `window.open(url, '_blank')`

### 4.3 Content Area - Combined/Split View

**Component: `SplitView`**

| Element | Spec |
|---------|------|
| Container | Same area as single view, split into two equal panes (50/50 vertical split) |
| Divider | 4px vertical divider between panes, dark gray (CSS Variable, ~#374151), cursor `col-resize` (visual only, not draggable in MVP) |
| Left Pane | Contains `SmartIframe` for first URL |
| Right Pane | Contains `SmartIframe` for second URL |
| Pane Header | Each pane has a small header bar (height: 28px): truncated title + refresh button + "open in new window" button + "exit split" button (on either pane) |

**Combined View Suggestion Banner (`CombinedViewBanner`):**

When a user opens a bookmark that has a detected pair (same factory, Spark+Airflow), show a banner at the top of the content area:

```
+-------------------------------------------------------------------+
| [Columns2 Icon] Related bookmark found: "Airflow F18"  [Open Combined View]  [Dismiss] |
+-------------------------------------------------------------------+
```

- Banner: height: 40px, dark blue semi-transparent (CSS Variable, ~#1e3a5f at 50% opacity) (dark) / very light blue (#eff6ff) (light), flex row
- Auto-dismissed after user acts or after 10 seconds
- "Open Combined View" replaces the current single tab with a split tab

---

## 5. Modals

### 5.1 Add/Edit Bookmark Modal

**Component: `BookmarkFormModal`**

```
+-------------------------------------------+
|  Add Bookmark              [X]            |
+-------------------------------------------+
|  Title                                     |
|  [________________________]               |
|                                            |
|  URL                                       |
|  [________________________]               |
|                                            |
|  Category                                  |
|  [Dropdown: select category___]           |
|                                            |
|  Factory Tags                              |
|  [f12] [f14a] [f14b] ... (toggle chips)   |
|                                            |
|  [ ] Mark as combined view pair            |
|                                            |
|        [Cancel]  [Save Bookmark]           |
+-------------------------------------------+
```

| Field | Spec |
|-------|------|
| Title | Text input, required, max 100 chars |
| URL | Text input, required, must be valid URL |
| Category | Dropdown select from existing categories, or type to create new |
| Factory Tags | Multi-select toggle chips. Each factory tag is a small pill that toggles on/off. Selected = blue background (CSS Variable) with white text, unselected = dark gray background (CSS Variable) with light gray text |
| Combined | Checkbox, optional |
| Modal | max-width: ~512px, centered, overlay backdrop: black at 50% opacity |

### 5.2 Import Modal (OneTab)

**Component: `ImportModal`**

```
+-------------------------------------------+
|  Import Bookmarks          [X]            |
+-------------------------------------------+
|  Paste your OneTab export below:           |
|  +--------------------------------------+ |
|  | https://spark-f18.tsmc.com | Spark   | |
|  | https://airflow-f18.tsmc.com | Air.. | |
|  |                                      | |
|  +--------------------------------------+ |
|                                            |
|  [Parse & Preview]                         |
|                                            |
|  Preview (2 bookmarks found):              |
|  +--------------------------------------+ |
|  | Title     | URL        | Tags | Cat  | |
|  | Spark F18 | spark-f18  | f18  | Spark| |
|  | Airflow   | airflow-f1 | f18  | Airfl| |
|  +--------------------------------------+ |
|  (each row is editable inline)             |
|                                            |
|        [Cancel]  [Import 2 Bookmarks]      |
+-------------------------------------------+
```

| Element | Spec |
|---------|------|
| Textarea | min-height: 120px, monospace font, for pasting raw OneTab text |
| Parse Button | Triggers parsing. Extracts URLs, auto-detects factory tags from URL, auto-assigns category from URL keywords |
| Preview Table | Editable table rows. User can correct auto-assigned tags and categories before confirming |
| Import Button | Disabled until parse is run. Shows count of bookmarks to import |
| Modal | max-width: ~672px, centered |

### 5.3 Delete Confirmation Modal

**Component: `DeleteConfirmModal`**

```
+-------------------------------------------+
|  Delete Bookmark?          [X]            |
+-------------------------------------------+
|                                            |
|  Are you sure you want to delete           |
|  "Spark F18 Dashboard"?                    |
|                                            |
|  This action cannot be undone.             |
|                                            |
|        [Cancel]  [Delete]                  |
+-------------------------------------------+
```

- Delete button: red background (CSS Variable, ~#dc2626) with white text
- Modal: max-width: ~384px, centered

### 5.4 Category Management Modal

**Component: `CategoryManageModal`**

```
+-------------------------------------------+
|  Manage Categories         [X]            |
+-------------------------------------------+
|  [+ New Category]                          |
|                                            |
|  [drag] Monitoring (12)     [edit] [del]  |
|  [drag] Data Pipeline (8)   [edit] [del]  |
|  [drag] Spark (15)          [edit] [del]  |
|  [drag] Airflow (10)        [edit] [del]  |
+-------------------------------------------+
```

| Element | Spec |
|---------|------|
| List | Draggable rows for reordering (sets `category.order`) |
| Each Row | Drag handle + category name + bookmark count + edit (pencil icon) + delete (trash icon) |
| Edit | Inline rename on click |
| Delete | Shows DeleteConfirmModal. Bookmarks in deleted category become uncategorized |
| New | Text input appears at top of list for entering new category name |

---

## 6. Component Hierarchy

```
App
+-- ThemeProvider (dark/light mode, follows system pref)
+-- WorkspaceBar
+-- AppLayout
    +-- Sidebar
    |   +-- SidebarSearch
    |   +-- CategoryGroup (repeated)
    |   |   +-- BookmarkItem (repeated)
    |   +-- SidebarActions
    +-- MainViewport
        +-- TabBar
        |   +-- Tab (repeated)
        +-- ContentArea
            +-- CombinedViewBanner (conditional)
            +-- SmartIframe (single view)
            +-- SplitView (combined view)
            |   +-- SmartIframe (left)
            |   +-- SmartIframe (right)
            +-- IframeErrorFallback (on error)
            +-- EmptyState (no tabs open)

Modals (rendered at root level via portal):
+-- BookmarkFormModal
+-- ImportModal
+-- DeleteConfirmModal
+-- CategoryManageModal
```

---

## 7. State Management (Vanilla JS)

The application uses a pub/sub pattern in `store.js` for state management:

### BookmarkStore
- `bookmarks: []` - all bookmarks
- `categories: []` - all categories
- `activeWorkspace: null` - current factory filter (null = all)
- `searchQuery: ''` - current search text
- `getFilteredBookmarks()` - derived: filtered by workspace + search
- CRUD methods via API calls: `addBookmark`, `updateBookmark`, `deleteBookmark`, `addCategory`, `updateCategory`, `deleteCategory`, `reorderCategories`
- `importBookmarks(parsed)` - bulk import via API
- `exportToJSON()` - triggers export API download

### TabStore
- `tabs: []` - open tabs
- `activeTabId: null` - currently visible tab
- `openTab(url, title)` - opens or focuses existing tab
- `closeTab(id)` - closes a tab
- `openCombinedTab(url1, url2, title)` - opens split view tab
- `exitCombinedView(tabId)` - converts split tab back to single

### UIStore
- `theme: 'system'` - 'light' | 'dark' | 'system'
- `collapsedCategories: []` - which categories are collapsed
- `keyboardNavIndex: -1` - current keyboard navigation position

---

## 8. Interaction Design

### 8.1 Keyboard Navigation Flow

1. User presses `/` (global) -> search input focused
2. User types query -> sidebar filters bookmarks in real-time (fuzzy match on title + tags)
3. `ArrowDown` / `ArrowUp` -> moves highlight through visible bookmark items (wraps around)
4. `Enter` -> opens highlighted bookmark in main viewport
5. `Escape` -> clears search, removes highlight, blurs input

### 8.2 Tab Deduplication Flow

1. User clicks bookmark in sidebar
2. Store checks if any existing tab has matching URL
3. If match found: set that tab as active (no new tab created)
4. If no match: create new `TabState` with `type: 'single'`, add to tab list, set as active

### 8.3 Combined View Flow

1. User opens a bookmark (e.g., "Spark F18")
2. System detects a related bookmark exists (e.g., "Airflow F18") by matching: same factory tag + complementary tool keyword (spark<->airflow)
3. `CombinedViewBanner` appears at top of content area
4. User clicks "Open Combined View" -> current tab converts to `type: 'split'` with both URLs
5. User can click "Exit Split" on either pane header -> tab reverts to `type: 'single'` with the original URL

### 8.4 OneTab Import Flow

1. User clicks "Import" in sidebar footer
2. `ImportModal` opens with empty textarea
3. User pastes OneTab text (format: `URL | Title` per line)
4. User clicks "Parse & Preview"
5. Parser extracts URLs, auto-detects factory tags from URL patterns (regex: `f\d+[a-z]?`), auto-assigns categories from URL keywords (`spark` -> "Spark", `airflow` -> "Airflow", `grafana` -> "Monitoring")
6. Preview table shows parsed results; user can inline-edit tags/categories
7. User clicks "Import N Bookmarks" -> bookmarks added to store

### 8.5 Health Check

- On initial load and every 60 seconds, the app pings each bookmark URL via `fetch` with `mode: 'no-cors'` (fire-and-forget to detect network reachability)
- Result updates the health dot color on each `BookmarkItem`
- Health checks run in background, non-blocking

---

## 9. Dark/Light Mode

- Follows `prefers-color-scheme` media query by default
- User can override via settings toggle in sidebar footer
- Uses CSS Variables on `<html data-theme="dark|light">` for theming
- Theme preference stored in localStorage

---

## 10. Responsive Behavior

The app targets desktop resolutions only (per PRD scope: 1920x1080, 2560x1440).

| Viewport | Behavior |
|----------|----------|
| >= 1280px | Full layout as designed |
| < 1280px | Not officially supported. Sidebar may overlay or collapse, but no mobile layout required |

---

## 11. Mapping to PRD Requirements

| PRD Requirement | UI Component / Behavior |
|-----------------|------------------------|
| FR-4.1.1 Bookmarks grouped by category | `CategoryGroup` + `BookmarkItem` |
| FR-4.1.2 Bookmark count per category | Count badge in `CategoryGroup` header |
| FR-4.1.3 Fuzzy search | `SidebarSearch` with real-time filtering |
| FR-4.1.4-8 Keyboard navigation | Global `/` hotkey, arrow keys, enter, escape |
| FR-4.2.1-6 Tab management | `TabBar` + `TabState` store + dedup logic |
| FR-4.3.1-4 Iframe fallback | `SmartIframe` + `IframeErrorFallback` |
| FR-4.4.1-5 Combined view | `SplitView` + `CombinedViewBanner` + pairing logic |
| FR-4.5.1-6 OneTab import | `ImportModal` with parser + preview table |
| FR-4.6.1-7 CRUD & persistence | `BookmarkFormModal` + `CategoryManageModal` + localStorage/API persistence |
| FR-4.7.1 Responsive desktop | Min 1280px layout |
| FR-4.7.2 Health indicators | Health dot on `BookmarkItem` |
| FR-4.7.3-4 Workspace switcher | `WorkspaceBar` |
| FR-4.7.5 Dark/light mode | `ThemeProvider` + system preference |
