# PRD: TSMC Internal Bookmark & Dashboard Portal (TIBDP)

## 1. Overview

### 1.1 Product Name
TSMC Internal Bookmark & Dashboard Portal (TIBDP)

### 1.2 Purpose
Provide semiconductor engineers with a centralized bookmark management system and dashboard to monitor factory-specific tools (Spark, Airflow, Grafana) across multiple TSMC sites. The portal eliminates the need to manually track dozens of tool URLs across different factories, enabling faster context-switching and better operational awareness.

### 1.3 Target Users
- TSMC semiconductor engineers
- Factory operations staff who need to access monitoring tools across multiple sites

### 1.4 Key Sites (Factory Tags)
`f12`, `f14a`, `f14b`, `f15a`, `f15b`, `f16`, `f18`, `f18b`, `f20`, `f21`, `f22`, `f23`, `foc`, `ftest`, `ftestdev`

---

## 2. Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | React (Vite) + TypeScript |
| Styling | Tailwind CSS + Shadcn UI |
| State Management | Zustand (with persistence middleware) |
| Icons | Lucide-react |
| Data Persistence | LocalStorage / IndexedDB |
| Backend | None (client-side only for MVP) |

---

## 3. Core Data Schema

### 3.1 FactoryTag
```typescript
type FactoryTag = 'f12' | 'f14a' | 'f14b' | 'f15a' | 'f15b' | 'f16' | 'f18' | 'f18b' | 'f20' | 'f21' | 'f22' | 'f23' | 'foc' | 'ftest' | 'ftestdev';
```

### 3.2 Bookmark
```typescript
interface Bookmark {
  id: string;           // UUID
  title: string;        // Display name
  url: string;          // Full URL to the tool
  category: string;     // Grouping category (e.g., "Monitoring", "Data Pipeline")
  tags: FactoryTag[];   // Associated factory sites
  isCombined?: boolean; // Whether this bookmark is part of a combined view pair
  lastAccessed: number; // Unix timestamp of last access
}
```

### 3.3 TabState
```typescript
interface TabState {
  id: string;
  type: 'single' | 'split';  // single iframe or split-screen
  urls: string[];             // 1 URL for single, 2 for split
  active: boolean;            // Currently visible tab
}
```

### 3.4 Category
```typescript
interface Category {
  id: string;
  name: string;
  order: number;  // Display order in sidebar
}
```

---

## 4. Feature Requirements

### 4.1 Sidebar & Navigation

**Description:** A persistent left sidebar that organizes bookmarks by category/group and provides search + keyboard navigation.

**Requirements:**
- FR-4.1.1: Display bookmarks grouped by category, with collapsible category sections
- FR-4.1.2: Show bookmark count per category
- FR-4.1.3: Fuzzy search input at the top of the sidebar, filtering by title and tags
- FR-4.1.4: Keyboard shortcut `/` focuses the search input
- FR-4.1.5: Arrow Up/Down keys navigate through search results
- FR-4.1.6: Enter key opens the selected bookmark
- FR-4.1.7: Escape key clears search and returns focus to normal navigation
- FR-4.1.8: Visual highlight on the currently selected item during keyboard navigation

**Acceptance Criteria:**
- Typing `/` anywhere (except when focused on an input) activates search
- Fuzzy search matches partial strings in both title and tag fields
- Navigation wraps around (bottom to top, top to bottom)

---

### 4.2 Intelligent Tab Management

**Description:** Manage open bookmarks as internal tabs with iframe rendering, preventing duplicates.

**Requirements:**
- FR-4.2.1: Opening a bookmark creates a new tab in the main viewport
- FR-4.2.2: If a URL is already open in an existing tab, focus that tab instead of creating a duplicate
- FR-4.2.3: Render bookmark URLs within iframes (SmartIframe component)
- FR-4.2.4: Tabs display the bookmark title and a close button
- FR-4.2.5: Clicking a tab switches the active view to that tab's content
- FR-4.2.6: Support closing individual tabs

**Acceptance Criteria:**
- No duplicate tabs for the same URL
- Tab bar shows all open bookmarks with clear active state
- Tabs can be opened and closed without page reload

---

### 4.3 Iframe Debugger & Fallback

**Description:** Detect when an iframe cannot load (due to CORS / X-Frame-Options) and provide a graceful fallback.

**Requirements:**
- FR-4.3.1: Detect iframe load failures (CORS, X-Frame-Options, CSP violations)
- FR-4.3.2: Display an error message explaining why the page cannot be embedded
- FR-4.3.3: Provide an "Open in New Window" button as fallback
- FR-4.3.4: Show a loading indicator while the iframe is loading

**Acceptance Criteria:**
- Blocked iframes show a clear error message instead of a blank frame
- "Open in New Window" opens the URL in a new browser tab

---

### 4.4 Combined View (Smart Split-Screen)

**Description:** Auto-detect related bookmarks and offer a split-screen combined view.

**Requirements:**
- FR-4.4.1: Auto-detect bookmark pairs from the same factory that match Spark/Airflow keywords
- FR-4.4.2: When a combinable bookmark is opened, suggest the combined view option
- FR-4.4.3: Combined view renders two iframes side-by-side in a 50/50 vertical split
- FR-4.4.4: Each pane in the combined view can be individually refreshed or opened in a new window
- FR-4.4.5: Users can manually exit the combined view to return to single-pane mode

**Acceptance Criteria:**
- Pairing logic correctly identifies related bookmarks by factory tag + tool keyword
- Split layout is responsive and does not break at common viewport sizes
- Users are not forced into combined view; it is always optional

---

### 4.5 Data Import (OneTab Integration)

**Description:** Import bookmarks from the OneTab Chrome extension's text export format.

**Requirements:**
- FR-4.5.1: Provide an import dialog/modal that accepts raw text paste
- FR-4.5.2: Parse OneTab format (one URL per line, with optional title after `|`)
- FR-4.5.3: Auto-assign FactoryTags by detecting factory identifiers in the URL (e.g., `f18` in `https://spark-f18.tsmc.com`)
- FR-4.5.4: Auto-assign category based on URL keywords (e.g., `spark` -> "Spark", `airflow` -> "Airflow", `grafana` -> "Monitoring")
- FR-4.5.5: Show a preview of parsed bookmarks before confirming import
- FR-4.5.6: Allow user to edit/correct auto-assigned tags and categories before import

**Acceptance Criteria:**
- Correctly parses standard OneTab export format
- Factory tags are correctly extracted from URLs
- Users can review and modify imports before saving

---

### 4.6 CRUD & Persistence

**Description:** Full create, read, update, delete operations for bookmarks and categories with browser-based persistence.

**Requirements:**
- FR-4.6.1: Create new bookmarks with title, URL, category, and tags
- FR-4.6.2: Edit existing bookmark properties
- FR-4.6.3: Delete bookmarks with confirmation
- FR-4.6.4: Create, rename, reorder, and delete categories
- FR-4.6.5: Persist all data to browser storage (LocalStorage or IndexedDB) via Zustand persistence middleware
- FR-4.6.6: "Export to JSON" button that downloads the full bookmark dataset
- FR-4.6.7: "Import from JSON" button to restore from a previously exported backup

**Acceptance Criteria:**
- Data survives page refresh
- Exported JSON can be re-imported without data loss
- Delete operations require user confirmation

---

### 4.7 UI/UX Enhancements

**Description:** Additional UI features for better usability.

**Requirements:**
- FR-4.7.1: Responsive layout that works on common desktop resolutions (1920x1080, 2560x1440)
- FR-4.7.2: Health indicators (colored status dots) next to bookmarks showing reachability
- FR-4.7.3: Arc-inspired workspace switcher: clickable factory tags (e.g., "F18") that filter the sidebar to show only bookmarks for that factory
- FR-4.7.4: Visual distinction between active workspace/filter and "all bookmarks" view
- FR-4.7.5: Dark/light mode support (following system preference)

**Acceptance Criteria:**
- Workspace filter correctly shows only bookmarks matching the selected factory
- Health indicators update on a reasonable interval (e.g., every 60 seconds)
- Layout does not break at supported resolutions

---

## 5. Non-Functional Requirements

| ID | Requirement |
|----|------------|
| NFR-1 | First meaningful paint < 1 second (client-side app, no network dependency for core data) |
| NFR-2 | All bookmark operations (create, edit, delete) complete within 100ms perceived latency |
| NFR-3 | Support 500+ bookmarks without noticeable performance degradation |
| NFR-4 | No backend server required for MVP; all data is client-side |
| NFR-5 | Compatible with latest Chrome and Edge browsers |

---

## 6. Implementation Priority

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | Zustand bookmark store with persistence | Foundation for all data operations |
| P0 | Sidebar with fuzzy search & keyboard nav | Primary navigation mechanism |
| P0 | Main viewport with tab management & SmartIframe | Core viewing experience |
| P1 | OneTab parser & import | Key onboarding flow for existing users |
| P1 | CRUD operations (add/edit/delete bookmarks & categories) | Essential management capability |
| P1 | Iframe fallback & error handling | Reliability for blocked iframes |
| P2 | Combined view (split-screen) | Power-user feature |
| P2 | Factory workspace switcher | Improved navigation for multi-site users |
| P2 | Health indicators | Nice-to-have operational awareness |
| P3 | Export/Import JSON backup | Data safety feature |
| P3 | Dark/light mode | Polish |

---

## 7. Out of Scope (MVP)

- User authentication / login
- Server-side bookmark storage or sync
- Mobile-responsive layout (desktop-focused)
- Bookmark sharing between users
- Browser extension integration (beyond OneTab text import)
- Real-time collaboration

---

## 8. API Interface Notes

Since this is a client-side-only application for MVP, there are no backend REST APIs. All data operations go through the Zustand store with LocalStorage/IndexedDB persistence.

If a backend is added later (e.g., for multi-device sync or team sharing), the API specification should follow the project convention:
- Prefix: `/api/v1/`
- Response format: `{ "data": ..., "message": "...", "success": true/false }`
- API specs should be documented in `docs/designs/api-tibdp.md` before implementation

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| Factory Tag | An identifier for a TSMC fabrication facility (e.g., f18, f14a) |
| Combined View | A split-screen layout showing two related bookmarks side-by-side |
| SmartIframe | An iframe component with error detection and fallback behavior |
| OneTab | A Chrome extension that converts open tabs to a text list of URLs |
| Workspace | A filtered view of bookmarks scoped to a specific factory |
