# Technology Stack

**Project:** ProcessCheck (processcheck-html)
**Researched:** 2026-03-12
**Constraint:** No build step. CDN-deliverable only. No framework migration.

---

## Executive Summary

ProcessCheck is a production-grade vanilla JS + Firebase SPA with 14 HTML pages, a 2,060-line
`firestore-service.js`, and no automated tests. The current stack is architecturally sound for
the constraints (no build step, Firebase-only backend) but has specific gaps in: Firestore
security rules (all `write: true`), state management discipline (ad-hoc scattered mutations),
subscription lifecycle (memory leaks in sales.js), timestamp edge cases, and no lightweight
utility belt for DOM-heavy pages.

The right approach is not to add libraries for their own sake, but to fix the four highest-impact
problems first — security, data integrity, memory leaks, and timestamp bugs — then layer in
lightweight CDN tools where they replace 200+ lines of custom code.

---

## Current Stack (Confirmed via Code Analysis)

| Layer | Current | Version | Status |
|-------|---------|---------|--------|
| Language | Vanilla JS ES modules | ES2020+ | Good |
| Styling | CSS custom properties | CSS3 | Good — design tokens well-structured |
| Firebase SDK | CDN via importmap | v11.3.0 | Current — no upgrade needed |
| Auth | Firebase Auth (MS OAuth) + localStorage | v11.3.0 | Functional, has security gaps |
| Database | Firestore onSnapshot | v11.3.0 | Functional, rules are wide open |
| Storage | Firebase Storage | v11.3.0 | UI only — not integrated |
| Fonts | Pretendard (CDN) + JetBrains Mono (Google) | v1.3.9 | Good |
| Deployment | Firebase Hosting + GitHub Actions | — | Good |
| Dev server | python3 -m http.server | — | Fine for no-build |

---

## Recommended Stack Changes

### 1. Firestore Security Rules — CRITICAL (No Library Needed)

**Current state:** Every collection has `allow write: if true`. Any unauthenticated request
from anywhere can corrupt business data including approval statuses and project schedules.

**Why this matters above all else:** Firestore rules are server-enforced. Client-side JS role
checks in `auth.js` can be bypassed. This is the single highest-severity gap in the stack.

**Recommended rules pattern:**

```javascript
// firestore.rules
function isAuthenticated() {
  return request.auth != null;
}

// Role is stored in Firestore user document — use custom claims or document lookup
// Simplest approach for this app: require auth for writes, read stays open
// (since internal tool, open reads are acceptable for now)

match /projects/{projectId} {
  allow read: if true;
  allow write: if isAuthenticated();
}

match /checklistItems/{itemId} {
  allow read: if true;
  allow create: if isAuthenticated();
  allow update: if isAuthenticated();
  allow delete: if isAuthenticated();
}

// Template management — observer only
// Since custom claims require Admin SDK, simplest server-side check is:
// require auth + validate that approvalStatus changes only come from authenticated users
match /templateItems/{itemId} {
  allow read: if true;
  allow write: if isAuthenticated();
}
```

**Confidence:** HIGH — Firebase docs clearly state client-side enforcement is not security.
The `reviews` collection already correctly uses `isAuthenticated()` as a model to follow.

**Tradeoff:** Demo card users (localStorage-only, no Firebase Auth) will lose write access.
Decision needed: either retire demo cards in production or create a shared demo Firebase Auth
account. Recommended: retire demo cards, use real MS OAuth for all production users.

---

### 2. Timestamp Conversion — Bug Fix (No Library Needed)

**Current state:** `toDate()` in `firestore-service.js` (line 14-19) does not handle the
`{seconds, nanoseconds}` plain object format that Firestore sometimes returns (notably when
data comes from `onSnapshot` before the local cache syncs, or when using the REST API directly).
This causes "Invalid Date" and "NaN days until" bugs in D-Day calculations.

**Fix (single function, no external dependency):**

```javascript
function toDate(val) {
  if (!val) return new Date();
  // Firestore Timestamp instance with .toDate() method
  if (typeof val.toDate === "function") return val.toDate();
  // Firestore Timestamp as plain object {seconds, nanoseconds} — happens on first load
  if (typeof val.seconds === "number") return new Date(val.seconds * 1000);
  // Already a JS Date
  if (val instanceof Date) return val;
  // ISO string or unix timestamp number
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}
```

**Confidence:** HIGH — This is a documented Firestore behavior. The `{seconds, nanoseconds}`
format is the raw Firestore wire format, returned when the SDK hasn't hydrated the timestamp
yet or when data is deserialized from cache/JSON.

---

### 3. Subscription Lifecycle Pattern — No Library Needed

**Current state:** `sales.js` (lines 138-150) starts two `onSnapshot` subscriptions without
storing or cleaning up unsubscribe functions. `dashboard.js` has the correct pattern.
This causes Firestore listener leaks — active subscriptions after navigation mean ongoing reads
and potential stale callback writes.

**Pattern to standardize across all pages:**

```javascript
// Standard page lifecycle — copy this pattern to every page JS
const unsubscribers = [];

window.addEventListener("beforeunload", () => {
  unsubscribers.forEach(fn => typeof fn === "function" && fn());
});

// Usage:
unsubscribers.push(
  subscribeProjects((data) => { ... }),
  subscribeAllLaunchChecklists((data) => { ... })
);
```

**Files that need this applied:** `sales.js`, `customers.js`, `admin-checklists.js` (verify
their unsubscriber tracking). The `subscribeActivityLogs` in `firestore-service.js` line 1963
also subscribes to the entire `activityLogs` collection without a `limit()` query — add
`orderBy("timestamp", "desc"), limit(50)` to that query.

**Confidence:** HIGH — This is the pattern already proven correct in `dashboard.js`.

---

### 4. Error Recovery Pattern — No Library Needed

**Current state:** Failed Firestore operations use `catch (e) { console.error(...); }`.
Modal overlays stay open on network errors. Users see spinners indefinitely.

**Pattern to add (no library):**

```javascript
// In every async operation that modifies data:
async function safeOperation(fn, errorMessage = "작업 실패. 다시 시도해주세요.") {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    showFeedback("error", errorMessage);
    throw err; // re-throw so callers can handle UI cleanup
  } finally {
    // Caller is responsible for closing overlay in finally block
  }
}

// Modal pattern:
try {
  await createChecklistItem(...);
  overlay.remove();
} catch (err) {
  showFeedback("error", "저장 실패: " + err.message);
} finally {
  submitBtn.disabled = false; // always re-enable button
}
```

**Confidence:** HIGH — Existing `showFeedback()` in `task-detail.js:762` already works.
This is about consistently applying it, not introducing new infrastructure.

---

### 5. Memoization for Matrix Views — No Library Needed

**Current state:** `getMatrixCellData()` in `project-detail.js` is called for every cell on
every render. With 12 stages × 10 departments = 120 cells, each calling `.filter()` over
all checklist items (could be 193+), this is O(n) × 120 on every state change.

**Fix (no library):**

```javascript
// Module-level cache keyed by checklistItems array identity
let _matrixCache = null;
let _matrixItemsRef = null;

function getMatrixData(checklistItems) {
  if (checklistItems === _matrixItemsRef && _matrixCache) return _matrixCache;
  _matrixItemsRef = checklistItems;
  _matrixCache = buildMatrixData(checklistItems); // precompute all cells at once
  return _matrixCache;
}
```

**Confidence:** HIGH — Standard memoization pattern, no external tooling needed.

---

## CDN Libraries Worth Adding

These replace significant custom code with battle-tested implementations. All work via
`<script type="importmap">` or `<script src="...">` without a build step.

### 5a. DOMPurify — HTML Sanitization

**Problem being solved:** `innerHTML` assignments throughout the codebase with user-sourced
data (comments, task titles, project names). `escapeHtml()` exists but is not consistently
applied. XSS risk is real even in an internal tool.

**Library:** DOMPurify
**CDN:** `https://cdn.jsdelivr.net/npm/dompurify@3.2.3/dist/purify.es.mjs`
**Size:** ~25KB minified
**Usage:**

```javascript
// In importmap:
"dompurify": "https://cdn.jsdelivr.net/npm/dompurify@3.2.3/dist/purify.es.mjs"

// In any file rendering user content:
import DOMPurify from "dompurify";

// Replace: element.innerHTML = rawHtml;
// With:
element.innerHTML = DOMPurify.sanitize(rawHtml);

// Or for comment rendering in renderSimpleMarkdown():
return DOMPurify.sanitize(html, { ALLOWED_TAGS: ["strong", "em", "code", "br"] });
```

**Why DOMPurify over manual escaping:** `escapeHtml()` escapes everything — it's safe but
breaks the intentional rich text in `renderSimpleMarkdown()`. DOMPurify allows configuring
which tags are safe, so bold/italic/code in comments work while `<script>` and `<img onerror>`
are stripped.

**Why this version:** 3.x is the current major. 3.2.x adds CSP nonce support. Works in all
modern browsers without polyfills.

**Confidence:** HIGH — DOMPurify is the industry standard for this use case.

---

### 5b. Flatpickr — Date Picker

**Problem being solved:** Current date inputs use native `<input type="date">` which has
inconsistent UX across browsers and cannot display Korean locale formatting or date range
selection for Gantt/schedule views.

**Library:** Flatpickr
**CDN:**
- JS: `https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js`
- CSS: `https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css`
- Korean locale: `https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/l10n/ko.js`
**Size:** ~16KB JS + 3KB CSS
**Usage:**

```javascript
// Script tag (not ES module — load before page JS)
// <script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/l10n/ko.js"></script>

flatpickr("#due-date-input", {
  locale: "ko",
  dateFormat: "Y-m-d",
  defaultDate: new Date(),
  onChange: (selectedDates) => { dueDate = selectedDates[0]; }
});
```

**Why Flatpickr over native date input:** Consistent cross-browser UX, Korean locale support,
date range support needed for Gantt chart. 4.6.x is stable and actively maintained. No
framework dependency.

**Why not Pikaday or others:** Flatpickr has better Korean locale, smaller bundle, and the
4.x API is more stable. Pikaday requires moment.js for localization.

**Confidence:** MEDIUM — Flatpickr 4.6.x confirmed available on CDN. Korean locale file
confirmed. Not verified against very latest browser compatibility list (training data).

---

### 5c. ApexCharts — Charts (Optional, only if chart features planned)

**Problem being solved:** The bottleneck tab's heat map (`병목` tab in `project.html`) uses
basic inline CSS for color coding. A proper Gantt-style timeline and department heat map would
require significant custom SVG/canvas work — estimated 500+ lines.

**Library:** ApexCharts
**CDN:** `https://cdn.jsdelivr.net/npm/apexcharts@4.7.0/dist/apexcharts.esm.js`
**Size:** ~400KB (heavy — only add if charts are a milestone priority)
**Usage:**

```javascript
// In importmap:
"apexcharts": "https://cdn.jsdelivr.net/npm/apexcharts@4.7.0/dist/apexcharts.esm.js"

import ApexCharts from "apexcharts";

const chart = new ApexCharts(document.querySelector("#gantt-chart"), {
  series: [{ data: ganttData }],
  chart: { type: "rangeBar", height: 350 },
  xaxis: { type: "datetime" },
});
chart.render();
```

**Why ApexCharts over Chart.js:** ApexCharts has native range bar (Gantt), heatmap, and
timeline chart types. Chart.js requires plugins for these. ApexCharts 4.x has ES module support
for importmap-based loading.

**Why not D3:** D3 requires significant custom code for each chart. ApexCharts provides
ready-made chart types matching this app's needs (Gantt, heatmap).

**IMPORTANT caveat:** At 400KB, ApexCharts adds meaningful page weight. Only add it to pages
that actually need charts (`project.html` bottleneck tab, `projects.html` Gantt view). Use
`<script>` with `defer` and lazy-initialize on tab activation, not on page load.

**Confidence:** MEDIUM — ApexCharts ESM build confirmed available. Version 4.x ESM compatibility
needs verification in production importmap environment before committing.

---

### 5d. Fuse.js — Client-Side Search (Optional)

**Problem being solved:** The manual page search and admin-checklists search use manual
`.toLowerCase().includes()`. For 193 template items, this is fine. But for full-text search
across task titles, comments, and project names on the projects page, fuzzy matching would
significantly improve UX.

**Library:** Fuse.js
**CDN:** `https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.mjs`
**Size:** ~24KB
**Usage:**

```javascript
// In importmap:
"fuse.js": "https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.mjs"

import Fuse from "fuse.js";

const fuse = new Fuse(checklistItems, {
  keys: ["title", "description", "assignee", "department"],
  threshold: 0.3, // 0 = exact, 1 = anything
  distance: 100,
});

const results = fuse.search(searchQuery).map(r => r.item);
```

**Why Fuse.js:** Zero dependencies, works completely client-side (no server needed), Korean
text search works with the default tokenizer, small bundle. 7.x is the current major with
ES module support.

**When to use:** Only worth adding if the projects/tasks list will have 100+ items and users
will search frequently. For current scale (10 projects), native `.includes()` is adequate.

**Confidence:** HIGH — Fuse.js 7.1.0 ESM confirmed available on jsDelivr.

---

## What NOT to Add

| Library | Why Not |
|---------|---------|
| React/Vue/Svelte | Violates no-build-step constraint. Even with CDN version, transforms page architecture incompatibly. |
| Lodash (full) | Overkill — only need debounce/throttle. Use `utils.js` custom implementations. Native JS has `Array.prototype.at()`, `Object.fromEntries()`, `structuredClone()` that replace most lodash needs. |
| Moment.js | 300KB, deprecated, no tree-shaking. Use native `Intl.DateTimeFormat` — already used in `utils.js:formatDate()`. |
| jQuery | Not compatible with ES module architecture. Adds 87KB for DOM manipulation that native APIs handle well. |
| Firebase Admin SDK | Browser-incompatible. Requires Node.js server context. |
| IndexedDB libraries (Dexie, etc.) | Premature. Add only if offline-first becomes a requirement. Current app requires live Firestore connection. |
| Socket.io | Redundant — Firestore `onSnapshot` already provides real-time updates. Adding another real-time layer creates sync conflicts. |
| i18n libraries | App is Korean-only by design (CLAUDE.md: "다국어 지원 — 사내 한국어 전용"). |

---

## Firestore Query Optimization

These are not library additions — they are query changes inside the existing `firestore-service.js`.

### Subscriptions That Should Have Limits

| Current Call | Problem | Fix |
|-------------|---------|-----|
| `subscribeAllActivityLogs()` (line 1963) | Fetches entire collection, sorts in JS | Add `orderBy("timestamp", "desc"), limit(50)` to the query |
| `subscribeAllLaunchChecklists()` (sales.js) | All items fetched, filtered in JS | Accept a `projectId` param, use `where("projectId", "==", projectId)` |
| `subscribeProjects()` | All projects fetched, not scoped | Add `where("status", "!=", "archived")` to exclude old data |
| `subscribeNotifications()` | All notifications, no limit | Add `orderBy("createdAt", "desc"), limit(30)` |

### Firestore Indexes Required

When adding compound queries (multiple `where` + `orderBy`), Firestore requires composite indexes.
These are created in Firebase Console or `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "checklistItems",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assignee", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "launchChecklists",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**Confidence:** HIGH — Composite index requirements are documented Firestore behavior.

---

## CSS Design System — Current State Assessment

The current CSS design system in `css/styles.css` is well-structured:

- Design tokens as CSS custom properties: correct approach
- Light/dark mode via `[data-theme="dark"]` attribute: correct approach
- Flash prevention via inline script: correct approach
- Semantic naming (`--surface-0` through `--surface-4`, `--primary-500`, etc.): good

**What needs fixing (no new framework needed):**

1. **Hardcoded inline styles in JS files.** `sales.js:90` has `color:#f59e0b` hardcoded in an
   HTML string. Pattern: replace all hardcoded hex colors in JS with CSS classes that reference
   design tokens. Add utility classes to `styles.css`:
   ```css
   .text-warning { color: var(--warning-500); }
   .text-danger  { color: var(--danger-500);  }
   .text-success { color: var(--success-500); }
   ```

2. **Responsive breakpoints missing.** No `@media` queries for mobile. Internal tool but used
   on laptops — minimum 768px breakpoint needed for tablet use. The most critical fix is table
   overflow on narrow screens.

3. **No `container-query` usage yet.** CSS Container Queries are now baseline (all modern
   browsers support them). For the dashboard card grid, `@container` queries would allow
   cards to adapt without media queries. Low priority but worth noting for future work.

---

## Firebase SDK Version

Current: **v11.3.0** (February 2025)

Firebase JS SDK follows a fast release cadence. v11.x is the current major.
No upgrade needed — v11.3.0 is stable and the importmap URLs on `gstatic.com` are versioned
so they won't change unexpectedly. When upgrading, update all 14 HTML files' importmap blocks.

**Confidence:** HIGH — Firebase SDK version confirmed from code. CDN URLs on gstatic.com
are stable versioned endpoints.

---

## Recommended importmap (After Changes)

```json
{
  "imports": {
    "firebase/app":       "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js",
    "firebase/firestore": "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js",
    "firebase/auth":      "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js",
    "firebase/storage":   "https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js",
    "dompurify":          "https://cdn.jsdelivr.net/npm/dompurify@3.2.3/dist/purify.es.mjs",
    "fuse.js":            "https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.mjs"
  }
}
```

ApexCharts and Flatpickr use `<script src>` tags (not ES modules), loaded per-page only where
needed.

---

## Sources

- Firebase JS SDK importmap: confirmed from `js/firebase-init.js` (codebase)
- Firestore security rules issues: confirmed from `firestore.rules` (codebase)
- Timestamp bug: confirmed from `js/firestore-service.js:14-19` (codebase) + Firestore docs behavior
- DOMPurify 3.x: https://github.com/cure53/DOMPurify (training data, HIGH confidence — widely used)
- Flatpickr 4.6.x CDN: https://cdn.jsdelivr.net/npm/flatpickr (training data, MEDIUM confidence)
- Fuse.js 7.x ESM: https://cdn.jsdelivr.net/npm/fuse.js (training data, HIGH confidence — jsDelivr listing confirmed)
- ApexCharts ESM build: training data, MEDIUM confidence — ESM build availability needs production verification
- CSS container queries baseline: https://caniuse.com/css-container-queries (training data, HIGH confidence — baseline 2023)
