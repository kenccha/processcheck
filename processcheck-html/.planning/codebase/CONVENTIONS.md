# Coding Conventions

**Analysis Date:** 2026-03-12

## Naming Patterns

**Files:**
- HTML pages: kebab-case, one page per file (`project-detail.js`, `admin-checklists.js`, `customer-portal.js`)
- JS modules: kebab-case (`firestore-service.js`, `firebase-init.js`, `review-system.js`)
- CSS: single file `css/styles.css` for all styles

**Functions:**
- camelCase for all exported and internal functions: `formatStageName`, `getRiskClass`, `daysUntil`, `guardPage`
- Async functions prefixed semantically: `completeTask`, `approveTask`, `rejectTask`, `restartTask`
- Subscribe functions prefixed with `subscribe`: `subscribeProjects`, `subscribeChecklistItems`, `subscribeNotifications`
- Get/fetch functions prefixed with `get`: `getUser`, `getProject`, `getUsers`
- Seed/init functions prefixed with `seed`: `seedTemplatesIfEmpty`, `seedDatabaseIfEmpty`
- Private helpers prefixed with `_`: `_getTemplateItems`, `_seedUpdateChecklistStatuses`
- Fallback fetch functions prefixed with `fallback`: `fallbackLoadProjects`, `fallbackLoadChecklistItemsByAssignee`

**Variables:**
- camelCase for all mutable state: `allProjects`, `activeTab`, `viewMode`, `pendingConfirmId`
- SCREAMING_SNAKE_CASE for module-level constants and config: `PHASE_GROUPS`, `GATE_STAGES`, `CACHE_KEY`, `CACHE_TTL`, `SESSION_TTL`, `ALLOWED_DOMAIN`
- Short names for loop counters and transients: `b` (batch), `d` (doc), `p` (project), `t` (task)

**DOM references:**
- Suffixed with conventional abbreviations: `navRoot`, `app`, `bellBtn`, `bellDot`, `mobileMenu`
- Always assigned at module top level from `getElementById` or `querySelector`

**CSS Classes:**
- BEM-like with component prefix: `nav-link`, `nav-dropdown`, `nav-logo-text`, `badge-primary`, `notif-item`
- Utility classes for layout: `flex`, `items-center`, `gap-8`, `text-soft`, `p-6`, `mt-4`
- State modifiers with `open`, `active`, `hidden`, `unread`, `loading` appended

## Code Style

**Formatting:**
- No linting config present (no `.eslintrc`, no `.prettierrc`, no `package.json`)
- 2-space indentation throughout
- Single quotes for strings in JS (`"use strict"` not present)
- Semicolons present
- Arrow functions for callbacks: `(data) => { ... }`, `(e) => { ... }`
- Template literals for HTML generation extensively

**Header Comments:**
- Every module opens with a box-art comment block using `═` characters:
  ```js
  // ═══════════════════════════════════════════════════════════════════════════════
  // Module Name — description
  // ═══════════════════════════════════════════════════════════════════════════════
  ```
- Section dividers use `─` characters:
  ```js
  // ─── Section Name ──────────────────────────────────────────────────────────────
  ```
- Some pages use `=` characters (inconsistently):
  ```js
  // =============================================================================
  // Page Title
  // =============================================================================
  ```

## Import Organization

**Order (consistent across page modules):**
1. Auth module: `import { guardPage, getUser } from "../auth.js"`
2. Components module: `import { renderNav, renderSpinner, initTheme } from "../components.js"`
3. `initTheme()` called immediately after components import (before other imports, to prevent flash)
4. Firestore service: `import { subscribeX, getX, updateX } from "../firestore-service.js"`
5. Utils: `import { formatDate, escapeHtml, ... } from "../utils.js"`
6. Firebase SDK (only when needed): `import { ref, uploadBytesResumable } from "firebase/storage"`

**Path conventions:**
- Page modules use relative `../` prefix to reach `js/` root: `"../auth.js"`, `"../utils.js"`
- Firebase SDK imported via importmap aliases: `"firebase/firestore"`, `"firebase/auth"`, `"firebase/storage"`
- No path aliases or bundler — bare module specifiers via `<script type="importmap">` in each HTML file

## Error Handling

**Patterns:**
- Auth guard at top of every page module:
  ```js
  const user = guardPage();
  if (!user) throw new Error("Not authenticated");
  ```
- Async operations use `try/catch` with `console.error` for logging:
  ```js
  try {
    await login(userName, role);
    window.location.href = "home.html";
  } catch (e) {
    console.error("로그인 오류:", e);
    // restore UI state
  }
  ```
- Fire-and-forget side effects (notifications, activity logs) wrap in silent try/catch:
  ```js
  try { await addActivityLog(...); } catch(e) {}
  try { await recalculateProjectStats(...); } catch(e) { console.error("...", e); }
  ```
- Missing URL params trigger immediate redirect + throw:
  ```js
  if (!projectId) {
    window.location.href = "projects.html?type=신규개발";
    throw new Error("No project ID");
  }
  ```
- User-facing feedback via in-page `showFeedback(type, text)` helper with 4-second auto-dismiss
- Error messages shown via `showError(msg)` / `removeError()` pattern that inserts/removes DOM elements

## Logging

**Framework:** `console.log` / `console.error` (no logging library)

**Patterns:**
- Emoji prefix used for success/info logs in seed/init functions: `"✅ 체크리스트 상태 업데이트"`, `"📦 템플릿 데이터 자동 생성 완료"`
- Korean error messages in catch blocks: `"로그인 오류:"`, `"알림 생성 실패:"`
- Silent catch `catch(e) {}` used for non-critical side effects (activity logs)
- Page-level debug logs are not stripped in production

## HTML Generation

**Pattern:** All dynamic UI is rendered by writing `innerHTML` with template literal strings:
```js
app.innerHTML = `
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
  </div>
`;
```

**XSS prevention:** `escapeHtml()` from `utils.js` must be called on any user-supplied string:
```js
export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
```
- `escapeHtml` is NOT called on trusted constants, badge classes, or internal enum values
- `data-*` attributes use `escapeHtml` for user-sourced values: `data-notif-id="${escapeHtml(n.id)}"`

## State Management

**Pattern:** Module-level `let` variables as reactive state store:
```js
let allProjects = [];
let activeTab = "projects";
let viewMode = "table";
```
- All subscriptions update state variables then call `render()`
- `render()` is a full re-render of `app.innerHTML` (no diffing/virtual DOM)
- UI state (tab, filter, expanded sets) persists in module variables across re-renders
- `Set` used for multi-select state: `let selectedTaskIds = new Set()`

**Subscriptions lifecycle:**
- All `onSnapshot` subscriptions return unsubscribe functions stored in `unsubscribers[]`
- Cleanup on `window.beforeunload`:
  ```js
  window.addEventListener("beforeunload", () => {
    unsubscribers.forEach((u) => u && u());
  });
  ```

## Firestore Data Mapping

**Pattern:** Each collection has a dedicated `docToX(id, data)` converter in `firestore-service.js`:
```js
function docToProject(id, data) {
  return { ...data, id, startDate: toDate(data.startDate), endDate: toDate(data.endDate) };
}
```
- Timestamps always converted to JS `Date` via `toDate(val)` helper
- Optional dates use conditional: `data.completedDate ? toDate(data.completedDate) : undefined`

## Module Design

**Exports:**
- `js/utils.js`: named exports only, pure helper functions and constants
- `js/auth.js`: named exports (`getUser`, `login`, `loginWithMicrosoft`, `logout`, `guardPage`, `startSessionWatcher`)
- `js/firebase-init.js`: named exports `db`, `auth`, `storage` + default app
- `js/firestore-service.js`: named exports for all CRUD, subscribe, and seed operations (~60+ exports)
- `js/components.js`: named exports (`renderNav`, `renderHomeNav`, `renderSpinner`, `renderBadge`, `navigate`, `initTheme`, `toggleTheme`, `getTheme`, `setTheme`)
- Page modules (`js/pages/*.js`): no exports (side-effect modules, loaded as `<script type="module">`)

**No barrel files:** imports always reference specific module files directly.

## CSS Architecture

**Design Tokens:**
- All colors, spacing, and shadows defined as CSS custom properties in `:root` (light mode)
- Dark mode overrides in `[data-theme="dark"]` selector
- Token naming: `--surface-0` through `--surface-4`, `--primary-500`, `--success-600`, `--danger-700`

**Theme flash prevention:** Inline `<script>` in every HTML `<head>`:
```html
<script>var t=localStorage.getItem("pc-theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");</script>
```

**Page-specific CSS:** Placed in `<style>` block inside the HTML file (not in `styles.css`)

---

*Convention analysis: 2026-03-12*
