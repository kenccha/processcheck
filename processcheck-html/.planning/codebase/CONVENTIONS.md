# Coding Conventions

**Analysis Date:** 2026-03-12

## Naming Patterns

**Files:**
- Page entry points: `[name].html` (e.g., `index.html`, `dashboard.html`, `project-detail.html`)
- Page controllers: `js/pages/[name].js` (e.g., `js/pages/dashboard.js`, `js/pages/project-detail.js`)
- Core modules: `js/[name].js` (lowercase, dash-separated: `firestore-service.js`, `firebase-init.js`, `review-system.js`)
- CSS: Single file `css/styles.css` with CSS custom properties and component classes

**Functions:**
- camelCase for all functions: `subscribeProjects()`, `completeTask()`, `validateInput()`
- Prefixes for function families:
  - `subscribe*` for Firestore real-time subscriptions: `subscribeProjects()`, `subscribeChecklistItems()`
  - `get*` for sync reads: `getUser()`, `getFilteredProjects()`
  - `load*` for async fallback reads: `fallbackLoadProjects()`
  - `create*` for Firestore creation: `createUser()`, `createChecklistItem()`
  - `update*` for Firestore updates: `updateTask()`, `updateProject()`
  - `delete*` for deletion: `deleteChecklistItem()`
  - `format*` for string formatting: `formatDate()`, `formatStageName()`
  - `get*Class` or `get*Label` for UI helpers: `getStatusBadgeClass()`, `getRiskLabel()`
  - `render*` for DOM rendering: `renderNav()`, `renderSpinner()`

**Variables:**
- camelCase throughout: `activeTab`, `checklistItems`, `selectedStageId`
- Prefixes for state management:
  - `show*` for boolean toggles: `showLaterTasks`
  - `selected*` for current selection: `selectedStage`, `selectedTaskIds`
  - `all*` for full collections: `allProjects`, `allTasks`, `allUsers`
  - `unsub*` for Firestore unsubscribe functions: `unsubProject`, `unsubChecklist`, `unsubNav`
  - `*Limit`, `*TTL` for numeric configurations: `approvalLimit`, `CACHE_TTL`
- HTML classes: kebab-case: `badge-success`, `empty-state`, `inline-code`, `mention-tag`
- CSS variables: lowercase with dashes: `--primary-500`, `--surface-1`, `--foreground`

**Types/Objects:**
- Korean domain terminology preserved: `stageId`, `departmentId`, `projectType` (not translated)
- Constants: UPPERCASE_SNAKE_CASE: `STORAGE_KEY`, `ALLOWED_DOMAIN`, `MAX_FILE_SIZE`, `CACHE_TTL`, `FILE_ICONS`
- Collections/arrays: plural: `projects`, `departments`, `checklistItems`, `notifications`
- Database field names: exact Firestore schema: `projectId`, `stage`, `approvalStatus`, `completedDate`

## Code Style

**Formatting:**
- No explicit formatter configured (no Prettier, no ESLint rules enforced at build time)
- Conventions observed in codebase:
  - 2-space indentation
  - Semicolons used consistently
  - Single quotes for strings (some files use double quotes, mixed standard)
  - Inline comments use `//` with leading space
  - Block comments use `/* */` style

**Module structure:**
- ES modules (`import`/`export`)
- Firebase imports at top: `import { specific, exports } from "firebase/..."`
- Internal imports organized: services first (`./firestore-service.js`), then utils (`./utils.js`)
- Page files import all needed dependencies at top before any code execution

**File organization pattern:**
```javascript
// ═══════════════════════════════════════════════════════════════════════════════
// [Module name] — [brief description]
// ═══════════════════════════════════════════════════════════════════════════════

// Section comments use full-width divider lines
// ─── Subsection ────────────────────────────────────────────────────────────

// Then code follows
```

## Import Organization

**Order:**
1. Firebase/external SDKs (`firebase/app`, `firebase/firestore`, etc.)
2. Local service modules (`./firestore-service.js`, `./firebase-init.js`)
3. Utility modules (`./utils.js`, `./auth.js`, `./components.js`)
4. Page-specific modules (`./pages/*.js`)

**Path aliases:**
- No aliases — all imports use relative paths: `./auth.js`, `../utils.js`, `../firestore-service.js`
- Structure is flat enough that relative imports are clear

**Example from `js/pages/project-detail.js`:**
```javascript
import { guardPage } from "../auth.js";
import { renderNav, renderSpinner, initTheme } from "../components.js";
import {
  subscribeProjects,
  subscribeChecklistItems,
  // ... more imports
} from "../firestore-service.js";
import {
  departments,
  PHASE_GROUPS,
  formatDate,
  // ... more imports
} from "../utils.js";
```

## Error Handling

**Patterns:**
- Authentication guard at page entry: `const user = guardPage(); if (!user) throw new Error("Not authenticated");`
- Try-catch blocks wrap Firestore operations and data parsing
- Firestore operations wrapped: `try { localStorage.setItem(...) } catch { localStorage.removeItem(...) }`
- Silent failures with fallback in cache loading: `catch { return null; }`
- Error feedback to user via modal alerts: `alert("작업 생성 실패: " + err.message)`
- Error logs to console for debugging: `console.error("Init error:", err)`

**Timeout/retry:**
- No explicit retry logic observed
- `setTimeout()` used for UI delays (e.g., print window focus): `setTimeout(() => { printWindow.print(); }, 500)`
- SessionStorage cache has TTL: `CACHE_TTL = 120_000` (2 minutes)

**Validation:**
- Input validation: `validateInput(str, maxLength = 500)` returns trimmed/limited string
- File validation: `validateFile(file)` returns `{ valid: boolean, error: string }`
- ID validation: `validateId(id)` checks regex `^[a-zA-Z0-9_-]+$`

**Custom errors:**
- Thrown as `throw new Error("message")` with Korean text for user-facing errors
- Examples: `"Not authenticated"`, `"@inbody.com 이메일만 사용할 수 있습니다."`, `"파일 크기가 10MB를 초과합니다"`

## Logging

**Framework:** Native `console` object (no logger library)

**Patterns:**
- `console.error()` for initialization failures and exception logging: `console.error("Init error:", err)`
- Minimal logging elsewhere — mostly for development debugging
- Log entries often paired with user-facing error modal/toast
- No info/warn/debug logs observed; only error logs on exception path

**Locations:**
- `js/pages/admin-checklists.js:69` — init error logging
- `js/pages/dashboard.js:155` — cache load error (silent)
- `js/pages/task-detail.js:762` — file delete error with user feedback
- All Firestore error handling paths include `console.error()` where critical

## Comments

**When to Comment:**
- Section headers with full-width divider: `// ─── Auth guard ─────────────────────────────────────────────────────────`
- State initialization blocks: `// --- State ---`
- Complex filter/calculation logic: `// Derived state`, `// Phase 0: Instant render from cache`
- Intentional silent failures: `// Ignore — user might not have used Firebase Auth`
- HTML comment sections: `<!-- Login Page -->`, `<!-- Tabs -->`, `<!-- Modal -->`

**JSDoc/TSDoc:**
- Not used — plain JavaScript, no TypeScript
- Function signatures documented via inline comments above when non-obvious
- Example from `js/utils.js:206-209`:
  ```javascript
  export function exportToCSV(data, headers, filename = "export.csv") {
    // Support both formats:
    // 1) headers = ["col1", "col2"], data = [["val1", "val2"], ...]  (simple arrays)
    // 2) headers = [{label, key}, ...], data = [{field: val}, ...]   (object format)
  ```

**Parameter documentation:**
- Inline comments explain special behaviors
- Default parameters in function signature: `formatDate(date)`, `validateInput(str, maxLength = 500)`

## Function Design

**Size:**
- Small utility functions: 5-20 lines (e.g., `getTheme()`, `formatDate()`)
- Mid-size helpers: 30-100 lines (e.g., `loadFromCache()`, `getFilteredProjects()`)
- Large complex functions: 200+ lines for page render loops (e.g., `render()` in `project-detail.js`)
- No explicit line count limits observed, but functions aim for single responsibility

**Parameters:**
- Positional parameters first, then options: `updateTask(taskId, newStatus, assignee)`
- Optional parameters with defaults: `validateInput(str, maxLength = 500)`, `exportToCSV(data, headers, filename = "export.csv")`
- Callbacks passed for Firestore subscriptions: `subscribeProjects((projects) => { ... })`

**Return Values:**
- Firestore read functions return promises: `getUsers()`, `getTemplateDepartments()`
- Subscription functions return unsubscribe function: `unsub = subscribeProjects((data) => {}); ... unsub();`
- Helper functions return computed values: `formatDate()`, `getRiskClass()`, `getStatusLabel()`
- Validation functions return object with status: `validateFile()` → `{ valid: boolean, error: string }`
- Async operations return promises; sync operations return synchronously

## Module Design

**Exports:**
- `firestore-service.js`: Functions only (no class exports), all async Firestore CRUD operations + subscriptions
- `utils.js`: Utility functions (format, validate, helpers), constant arrays (departments, projectStages, PHASE_GROUPS)
- `auth.js`: Auth functions (login, logout, guardPage), localStorage session management
- `components.js`: Shared UI components (renderNav, renderSpinner), theme management
- `firebase-init.js`: Singleton Firebase app/db/auth/storage exports

**Barrel Files:**
- No barrel files (no `index.js` re-exports)
- Each page imports directly: `import { renderNav } from "../components.js"`

**Naming conventions for exports:**
- All exports are named (no default exports)
- Single export per concept: one function = one export

**Example from `js/auth.js`:**
```javascript
export function getUser() { ... }
export async function login(name, role) { ... }
export async function loginWithMicrosoft() { ... }
export function guardPage() { ... }
export async function logout() { ... }
```

## HTML Structure

**Data attributes:**
- `data-theme="dark"` for theme mode
- `data-view="matrix"` for view mode selection (admin-checklists)
- `id` and `class` for selectors (no data-* for internal selectors)

**CSS Custom Properties:**
- Light mode is default (`:root`), dark mode uses `[data-theme="dark"]`
- Color tokens: `--primary-*`, `--success-*`, `--warning-*`, `--danger-*`, `--slate-*`
- Surface tokens: `--surface-0` (bg) through `--surface-4` (borders)
- Semantic tokens: `--foreground`, `--background`, `--shadow-glow`, `--radius-lg`

---

*Convention analysis: 2026-03-12*
