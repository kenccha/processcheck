# Architecture

**Analysis Date:** 2026-03-12

## Pattern Overview

**Overall:** Multi-Page Application (MPA) with a per-page Controller pattern

**Key Characteristics:**
- Each HTML page is a shell: minimal static HTML with a single `<script type="module">` entry point
- Each page's controller (in `js/pages/`) is responsible for auth guard, nav render, Firestore subscriptions, state management, and full DOM rendering via `innerHTML`
- Shared infrastructure lives in `js/` (firebase init, auth, Firestore service, components, utils) and is imported as ES modules across all page controllers
- No build step — all JS is native ES modules, Firebase SDK loaded via CDN `<script type="importmap">`

## Layers

**Infrastructure / Firebase:**
- Purpose: Initialize Firebase app and export singletons
- Location: `js/firebase-init.js`
- Contains: `db` (Firestore), `auth` (Firebase Auth), `storage` (Firebase Storage)
- Depends on: Firebase CDN modules via importmap
- Used by: `js/firestore-service.js`, `js/auth.js`, `js/review-system.js`

**Authentication Layer:**
- Purpose: Session management, login flows, page guard
- Location: `js/auth.js`
- Contains: `getUser()`, `login()` (demo cards), `loginWithMicrosoft()` (OAuth), `guardPage()`, `logout()`, `startSessionWatcher()`
- Depends on: `js/firebase-init.js`, `js/firestore-service.js`
- Used by: Every page controller (always called at module top level)
- Session storage: `localStorage` key `pc_user`, 24-hour TTL

**Data Access Layer:**
- Purpose: All Firestore CRUD operations and real-time subscriptions
- Location: `js/firestore-service.js` (132 KB, ~3300 lines)
- Contains:
  - Timestamp conversion helpers: `toDate()`, `docToProject()`, `docToChecklistItem()`, etc.
  - `subscribe*` functions using `onSnapshot` for real-time data (e.g., `subscribeProjects`, `subscribeChecklistItems`, `subscribeAllChecklistItems`, `subscribeChecklistItemsByAssignee`)
  - `fallbackLoad*` functions for one-time fetch (used for dashboard performance optimization)
  - CRUD: `createProject`, `updateProject`, `completeTask`, `approveTask`, `rejectTask`, `restartTask`, `recalculateProjectStats`
  - Template management: `seedTemplatesIfEmpty`, `applyTemplateToProject`
  - Notification creation (auto-triggered inside `completeTask`, `approveTask`, `rejectTask`)
  - Inline mock data (`getMockData()`) for seeding
- Depends on: `js/firebase-init.js`
- Used by: All page controllers

**Shared UI / Components:**
- Purpose: Navigation bar, theme management, spinner, shared badges
- Location: `js/components.js`
- Contains: `renderNav()` (injects full nav HTML into `#nav-root`, returns unsubscribe fn for notification listener), `renderSpinner()`, `initTheme()`, `toggleTheme()`, `getTheme()`, `setTheme()`
- Navigation config: `BASE_NAV_LINKS` constant (role-aware — observer gets "사용자 관리" appended to review dropdown)
- Depends on: `js/auth.js`, `js/firestore-service.js`, `js/utils.js`, `js/review-system.js`
- Used by: All page controllers

**Utilities:**
- Purpose: Pure helper functions, domain constants
- Location: `js/utils.js`
- Contains: `PHASE_GROUPS` (6-phase definitions), `GATE_STAGES`, `departments`, `projectStages`, `formatStageName()`, `getStatusLabel()`, `getRiskLabel()`, `daysUntil()`, `escapeHtml()`, `formatDate()`, `getQueryParam()`, `exportToCSV()`, `exportToPDF()`
- Depends on: nothing
- Used by: All page controllers, `js/components.js`, `js/review-system.js`

**Review System:**
- Purpose: In-app review/feedback panel for all pages
- Location: `js/review-system.js`
- Contains: `ReviewPanel` class, `subscribeReviews()`, `addReview()`, vote/reply/status CRUD
- Auth restriction: Write requires `authProvider === "microsoft"`, demo users can only read
- Depends on: `js/firebase-init.js`, `js/auth.js`, `js/utils.js`, `js/firestore-service.js`
- Used by: `js/components.js` (mounts panel via `#nav-review-btn`)

**Page Controllers:**
- Purpose: Page-specific business logic, state, and DOM rendering
- Location: `js/pages/*.js`
- Contains: One module per page; each handles auth guard, nav render, Firestore subscriptions, local state (module-level `let` variables), and full DOM re-render via `app.innerHTML = ...`
- Pattern: Top-level imperative execution (not class-based), state is module-level variables
- Depends on: `js/auth.js`, `js/components.js`, `js/firestore-service.js`, `js/utils.js`

**Deliverable Pages (separate subsystem):**
- Purpose: Design review documents (wireframes, flows, diagrams)
- Location: `docs/deliverables/`
- Contains: Self-contained HTML pages with their own nav injected by `docs/deliverables/js/deliverable-nav.js` (IIFE, not ES module)
- Special JS: `docs/deliverables/js/review-bootstrap.js` (standalone review system), `docs/deliverables/js/checklist-live.js` (Firestore live data), `docs/deliverables/js/feedback-system.js` (screenshot feedback)

## Data Flow

**Page Load Flow:**

1. Browser loads HTML shell (minimal static content)
2. Inline `<script>` in `<head>` reads `localStorage("pc-theme")` and sets `data-theme` on `<html>` (flash prevention)
3. `<script type="importmap">` registers Firebase CDN URLs
4. `<script type="module" src="js/pages/[page].js">` executes
5. Page controller calls `initTheme()`, then `guardPage()` — redirects to `index.html` if unauthenticated or session expired
6. Controller calls `renderNav(document.getElementById("nav-root"))` — injects nav HTML, subscribes to notifications, returns unsubscribe function
7. Controller subscribes to Firestore collections via `subscribe*` functions
8. Firestore `onSnapshot` callbacks update module-level state variables and re-invoke `render()`
9. `render()` replaces `app.innerHTML` with freshly-generated HTML string

**Authentication Flow:**

1. User visits `index.html`, handled by `js/pages/login.js`
2. Demo card: calls `login(name, role)` → `getUserByName` or `createUser` in Firestore → saves to `localStorage("pc_user")` → redirect to `home.html`
3. Microsoft OAuth: `loginWithMicrosoft()` → Firebase Auth popup → validates `@inbody.com` domain → `getUserByEmail` lookup → if new, auto-creates as `worker` with empty department → saves to `localStorage` → redirect to `home.html`
4. Production environment (non-localhost): demo cards are hidden automatically
5. Session TTL: 24 hours, checked on every `guardPage()` call and by 5-minute interval via `startSessionWatcher()`

**Real-time Data Subscription Pattern:**

```javascript
// Typical page controller pattern:
const unsubProject = subscribeProjects((projects) => {
  allProjects = projects;
  computeDerived();
  render();
});

// Cleanup on page unload (not always implemented):
window.addEventListener("beforeunload", () => {
  unsubProject();
});
```

**Dashboard Performance Pattern (two-phase load):**

1. Phase 0: Render from `sessionStorage` cache (key: `pc_dash_{userId}`, TTL: 120 seconds) for instant display
2. Phase 1: `fallbackLoad*` one-time fetches for fast targeted queries (no listener overhead)
3. Phase 2: Background `subscribe*` `onSnapshot` listeners replace Phase 1 data for live updates

**State Management:**

- All state is module-level `let` variables inside each page controller JS file
- No global state store
- Re-render triggered explicitly by calling `render()` after state mutation
- `sessionStorage` used only by dashboard for cache; no other cross-page state except auth in `localStorage`

## Key Abstractions

**Page Shell Pattern:**
- Purpose: HTML file is only a loading skeleton; all content is injected by JS
- Examples: `dashboard.html`, `project.html`, `projects.html`, `task.html`
- Pattern:
  ```html
  <div id="nav-root"></div>
  <main id="app" class="page-content">
    <div class="spinner-overlay">...</div>  <!-- shown until JS renders -->
  </main>
  <script type="module" src="js/pages/[page].js"></script>
  ```

**Firestore Document Mappers:**
- Purpose: Normalize Firestore Timestamp fields to JS Date objects on read
- Examples: `docToProject()`, `docToChecklistItem()`, `docToChangeRequest()`, `docToCustomer()` in `js/firestore-service.js`
- Pattern: All `subscribe*` and `get*` functions pass through these mappers before delivering data to page controllers

**Role-Based Rendering:**
- Purpose: UI adapts based on `user.role` (worker / manager / observer)
- Pattern: Page controllers check `user.role` inline inside `render()` to conditionally show/hide buttons, filter data, or choose subscription type
- Key rule: Only `user.role === "observer"` can approve tasks

**Template → Checklist System:**
- Purpose: `templateItems` (193 items across 6 phases × 10 departments) are applied to a project to generate `checklistItems`
- Key function: `applyTemplateToProject(projectId, projectType, changeScale?)` in `js/firestore-service.js`
- Filter logic: 신규개발 = all 193, 설계변경 minor = required only + 3 phases, medium = required only + all phases, major = all 193

## Entry Points

**Login:**
- Location: `index.html` + `js/pages/login.js`
- Triggers: Direct browser navigation
- Responsibilities: Demo card login, Microsoft OAuth, redirect to `home.html` on success, seed templates on first load

**Home (Hub):**
- Location: `home.html` + `js/pages/home.js`
- Triggers: Redirect after successful login, logo click in nav
- Responsibilities: Two-card hub — link to `dashboard.html` or `sales.html`

**Dashboard:**
- Location: `dashboard.html` + `js/pages/dashboard.js`
- Triggers: Navigation from hub
- Responsibilities: Role-based project/task/approval/notification tabs, D-Day metrics

**Project Detail:**
- Location: `project.html` + `js/pages/project-detail.js`
- Triggers: Navigation from `projects.html?id={projectId}` or `dashboard.html`
- Responsibilities: 3-tab view (overview+work, schedule, bottleneck), checklist CRUD, task assignment

**Sales Dashboard:**
- Location: `sales.html` + `js/pages/sales.js`
- Triggers: Hub card or nav "다른 사이트" dropdown
- Responsibilities: Launch checklist D-Day tracking, 6 view modes, customer tracking

## Error Handling

**Strategy:** Silent catch with console.error; no global error boundary

**Patterns:**
- Firestore operations wrapped in try/catch in page controllers; errors typically logged and UI reverts to previous state
- Auth errors shown inline in login form via `showError()` in `js/pages/login.js`
- Non-critical side effects (notification creation, activity logging) caught silently: `try { ... } catch(e) { console.error(...) }`
- `guardPage()` returns `null` and redirects on auth failure; page controllers check `if (!user) throw new Error("Not authenticated")`

## Cross-Cutting Concerns

**Theme:** Dark/light toggle via `data-theme` attribute on `<html>`; stored in `localStorage("pc-theme")`; flash prevention via inline `<script>` in every HTML `<head>`

**Validation:** Role checks done inline in page render functions; no shared validation layer

**Authentication:** `guardPage()` called at top of every page controller module; session expiry checked on load and every 5 minutes by `startSessionWatcher()` (called from `renderNav`)

**Navigation:** `renderNav()` in `js/components.js` is the single source of truth for nav structure; deliverable pages use a parallel `MAIN_NAV` in `docs/deliverables/js/deliverable-nav.js` — must be kept in sync manually

---

*Architecture analysis: 2026-03-12*
