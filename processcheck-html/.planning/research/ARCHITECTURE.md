# Architecture Patterns

**Domain:** Vanilla JS + Firebase SPA (hardware development process management)
**Researched:** 2026-03-12
**Confidence:** HIGH — analysis based on direct codebase inspection

---

## Current Architecture Assessment

### What Works Well

- ES module imports give clean dependency graph — each file knows exactly what it uses.
- `onSnapshot` + callback pattern for subscriptions is idiomatic Firebase and genuinely reactive.
- `beforeunload` cleanup for subscriptions prevents Firestore listener leaks on page navigation.
- Three-phase dashboard loading (cache → one-shot query → background subscription) is a sophisticated optimization that keeps the UI fast.
- CSS custom properties for theming are zero-JS, performant, and flash-free.
- Page-per-route MPA structure means no client-side router complexity — each HTML file is its own bundle boundary.

### What Causes Maintenance Pain

**`firestore-service.js` (2,060 lines, 70+ exports) is the core problem.** It contains seven logically distinct domains all in one file:

| Domain | Approximate Line Count |
|--------|----------------------|
| Type converters (Timestamp → Date) | ~60 lines |
| Seeding / mock data | ~500 lines |
| Projects CRUD + subscriptions | ~120 lines |
| Checklist items CRUD + subscriptions + stats | ~350 lines |
| Templates CRUD + apply-to-project | ~200 lines |
| Customers + launch checklists + portal | ~300 lines |
| Users + notifications + activity logs | ~200 lines |
| Change requests | ~80 lines |

When a bug is in "task approval", you read all 2,060 lines to find it. When "customers" and "checklist templates" both need edits, merge conflicts are frequent.

**Page controllers mix rendering and business logic.** `project-detail.js` (1,231 lines) does: URL param extraction, subscription setup, state derivation, 5 view renderers, modals, CSV export, and event handling — all interleaved. Adding a new view mode means reading 1,000+ lines to find the right insertion point.

**No event system for cross-page communication.** When a task is approved in `project-detail.js`, the dashboard doesn't react unless its subscription fires independently. There is no `EventTarget`-based bus to decouple these.

---

## Recommended Architecture

### Principle: Vertical Slices, Not Big Files

Split by **business domain** (vertical), not by technical role (horizontal). A domain slice owns its Firestore queries, its state, and its render helpers. Page controllers become thin coordinators.

### Component Boundaries (Target State)

```
js/
  firebase-init.js          (unchanged — singleton Firebase init)
  auth.js                   (unchanged — session management)
  utils.js                  (unchanged — pure functions, no side effects)

  services/                 (split from firestore-service.js)
    converters.js           (toDate, docToProject, docToChecklistItem, ...)
    projects.js             (subscribeProjects, createProject, updateProject, ...)
    checklist.js            (subscribeChecklistItems, completeTask, approveTask, ...)
    templates.js            (subscribeTemplateItems, applyTemplateToProject, ...)
    customers.js            (subscribeCustomers, createCustomer, ...)
    launch.js               (subscribeLaunchChecklists, completeLaunchChecklist, ...)
    users.js                (subscribeUsers, createUser, updateUser, ...)
    notifications.js        (subscribeNotifications, createNotification, ...)
    activity.js             (subscribeActivityLogs, addActivityLog, ...)
    seed.js                 (seedTemplatesIfEmpty, seedDatabaseIfEmpty, getMockData)

  components/               (split from components.js)
    theme.js                (getTheme, setTheme, toggleTheme, initTheme)
    nav.js                  (renderNav, BASE_NAV_LINKS, getNavLinks)
    badges.js               (status badges, role badges, risk badges)
    spinner.js              (renderSpinner)

  state/                    (new — observable state for shared data)
    store.js                (createStore — simple observable)

  pages/                    (page controllers — thin coordinators)
    dashboard.js
    projects.js
    project-detail.js
    ...
```

### Component Communication (What Talks to What)

```
HTML page
  └── pages/*.js (coordinator)
        ├── auth.js            (session: who is logged in?)
        ├── services/*.js      (data: Firestore operations)
        ├── utils.js           (formatting: display helpers)
        ├── components/*.js    (UI: nav, spinner, badges)
        └── state/store.js     (shared state between multiple subscriptions)
```

**Dependency rules:**
- `services/*.js` imports only `firebase-init.js` and `services/converters.js`. Nothing else.
- `components/*.js` imports only `auth.js`, `utils.js`, and other `components/*.js`.
- `pages/*.js` imports from `services/`, `components/`, `utils.js`, and `auth.js`. Never imports from another page.
- `state/store.js` imports nothing (pure utility).

---

## Data Flow

### Current Data Flow (Problem)

```
onSnapshot callback → module-level let variable → render() → innerHTML replace → addEventListener
```

The problem: `render()` is one monolithic function. Changing the active tab re-renders the entire page including list items that haven't changed. This causes event listener memory accumulation when `addEventListener` calls aren't tracked (in pages that don't carefully clean up delegated listeners).

### Improved Data Flow

```
onSnapshot callback → store.setState(key, value) → store triggers listeners → render only changed section
```

With an event-delegated DOM (one listener on `#app` rather than per-item listeners), re-rendering sections doesn't require cleanup.

**Pattern: Event Delegation**

```javascript
// One listener on the container, never on individual items
app.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  handlers[action]?.(id, btn);
});
```

This replaces the current `querySelectorAll(".some-btn").forEach(btn => addEventListener(...))` pattern that fires after every `render()` call.

**Pattern: Minimal Observable Store**

```javascript
// state/store.js — 30 lines, no dependencies
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Map();

  return {
    get: (key) => state[key],
    getAll: () => ({ ...state }),
    set(key, value) {
      state = { ...state, [key]: value };
      listeners.get(key)?.forEach(fn => fn(value, state));
      listeners.get("*")?.forEach(fn => fn(state));
    },
    on(key, fn) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
      return () => listeners.get(key).delete(fn); // returns unsubscribe
    },
  };
}
```

Page controllers create a store per page and pass it to render functions. The store keys map to sections of the page (`activeTab`, `projects`, `tasks`, `filters`). Only the section whose data key changed re-renders.

---

## Patterns to Follow

### Pattern 1: Domain Service Module

Each `services/*.js` file follows this shape:

```javascript
// services/checklist.js
import { collection, onSnapshot, ... } from "firebase/firestore";
import { db } from "../firebase-init.js";
import { docToChecklistItem } from "./converters.js";

// Subscriptions
export function subscribeChecklistItems(projectId, callback) {
  const q = query(collection(db, "checklistItems"), where("projectId", "==", projectId));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => docToChecklistItem(d.id, d.data())));
  });
}

// Commands (write operations with side effects)
export async function completeTask(taskId) { ... }
export async function approveTask(taskId, reviewerName) { ... }

// Queries (read operations, one-shot)
export async function getChecklistItem(id) { ... }
```

Subscriptions return their unsubscribe function. Commands call `recalculateProjectStats` and `createNotification` from their respective service modules (imported at the top, not from the same file).

### Pattern 2: Subscription Lifecycle Manager

Replace the `const unsubscribers = []` array + `beforeunload` pattern with a lifecycle class that's clearer:

```javascript
// state/subscriptions.js
export class SubscriptionManager {
  #subs = new Set();

  add(unsubFn) {
    if (typeof unsubFn === "function") this.#subs.add(unsubFn);
    return unsubFn;
  }

  unsubAll() {
    this.#subs.forEach(fn => fn());
    this.#subs.clear();
  }
}

// Usage in page controller:
const subs = new SubscriptionManager();
window.addEventListener("beforeunload", () => subs.unsubAll());

subs.add(subscribeProjects(onProjects));
subs.add(subscribeChecklistItems(projectId, onItems));
```

This is a safe refactor — same behavior as current code, better named, prevents double-unsubscribe bugs.

### Pattern 3: Render Section Functions

Instead of one `render()` that rebuilds all of `app.innerHTML`, split into section renderers:

```javascript
// pages/project-detail.js — structure
function renderHeader() { ... }       // project title, D-Day, phase pipeline
function renderWorkTab() { ... }      // checklist list in active view mode
function renderScheduleTab() { ... }  // gantt chart
function renderBottleneckTab() { ... }

function render() {
  // Only re-render what changed based on what triggered this call
  renderHeader();
  if (activeTab === "work") renderWorkTab();
  else if (activeTab === "schedule") renderScheduleTab();
  else renderBottleneckTab();
}
```

The key insight: `renderHeader()` is cheap (pure string from project object). Calling `render()` in full when only `checklistFilter` changed means the header rerenders unnecessarily. Sections with stable data should be skipped.

### Pattern 4: Template Literal Components

For repeated UI patterns (task rows, project cards), extract template functions rather than inlining HTML in page controllers:

```javascript
// components/task-card.js
export function taskCardHTML({ id, title, status, assignee, dueDate, importance }) {
  return `
    <div class="task-card" data-task-id="${id}">
      <span class="task-title">${escapeHtml(title)}</span>
      ...
    </div>
  `;
}
```

This makes the card testable in isolation and reusable across dashboard and project-detail pages, which currently duplicate task card rendering.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: God Service Module

**What:** Keep adding functions to `firestore-service.js` as features are added.

**Why bad:** Already at 2,060 lines and causing merge conflicts. Searching for specific functions requires `Ctrl+F`. TypeScript migration (if ever) would need to type all 70 exports at once.

**Instead:** Each new feature domain gets its own `services/[domain].js` from the start.

### Anti-Pattern 2: querySelectorAll addEventListener After Every Render

**What:**
```javascript
function render() {
  app.innerHTML = buildHTML();
  app.querySelectorAll(".approve-btn").forEach(btn => {
    btn.addEventListener("click", handleApprove);
  });
}
```

**Why bad:** Each render call adds new listeners. If `render()` is called 10 times (10 subscription updates), the approve handler fires 10 times per click. The current code has this risk in pages that don't carefully deduplicate.

**Instead:** One delegated listener on `app`, registered once at page init. See Pattern 2 above.

### Anti-Pattern 3: Importing from Other Page Controllers

**What:** `dashboard.js` importing a render helper from `project-detail.js`.

**Why bad:** Creates circular dependency risk and couples pages to each other's internals.

**Instead:** Shared render helpers go in `components/*.js`. Pages import from components, never from each other.

### Anti-Pattern 4: In-Place Seeding Code in Production Service

**What:** 500 lines of `getMockData()` and `_getTemplateItems()` living in `firestore-service.js`.

**Why bad:** Seeding code is never called in production (it's disabled). It inflates the file by 25% and adds irrelevant context when debugging production issues.

**Instead:** Move to `services/seed.js`. Import in `login.js` only when development mode is needed.

---

## Refactoring Order (Build Dependencies)

The dependency graph determines safe refactoring order. Each step should leave the app working.

### Step 1: Extract Converters (Zero Risk)

Extract the 7 `docToXxx()` functions and `toDate()` into `services/converters.js`.

- **Why first:** Everything depends on converters. Extracting them creates a stable foundation.
- **Risk:** Near zero — pure functions, no side effects.
- **Verification:** Search all imports of `firestore-service.js` and confirm converters are not directly imported by pages (they're not — they're internal helpers).

### Step 2: Extract Seed Data (Zero Risk)

Move `getMockData()`, `_getTemplateItems()`, `seedTemplatesIfEmpty()`, `seedDatabaseIfEmpty()` to `services/seed.js`.

- **Why second:** Largest chunk by line count (~500 lines). Removing it makes the remaining service file manageable.
- **Risk:** Near zero — seeding is called only from `login.js`. Update one import path.

### Step 3: Extract Notification Service (Low Risk)

Move `subscribeNotifications`, `createNotification`, `markNotificationRead`, `markAllNotificationsRead` to `services/notifications.js`.

- **Why third:** Notifications are imported by many pages but have no dependencies on other service domains. Extracting creates no circular imports.
- **Risk:** Low — update import paths in 5-6 page controllers.

### Step 4: Extract User Service (Low Risk)

Move `getUsers`, `getUserByName`, `getUserByEmail`, `createUser`, `updateUser`, `subscribeUsers`, `updateUserRole`, `updateUserDepartment`, `deactivateUser`, `activateUser` to `services/users.js`.

- **Why fourth:** Users are imported by `auth.js` and several page controllers. Clean boundary.
- **Risk:** Low — `auth.js` needs import path update.

### Step 5: Extract Template Service (Low Risk)

Move all `subscribeTemplateItems`, `getTemplateStages`, `getTemplateDepartments`, `addTemplateItem`, `updateTemplateItem`, `deleteTemplateItem`, `reorderTemplateItems`, `addTemplateStage`, `deleteTemplateStage`, `applyTemplateToProject` to `services/templates.js`.

- **Why fifth:** Only used by `admin-checklists.js` and `project-detail.js`. Clean boundary.
- **Risk:** Low — 2 page files need import updates.

### Step 6: Extract Customer + Launch + Portal Service (Low Risk)

Move `subscribeCustomers`, `createCustomer`, `updateCustomer`, `deleteCustomer`, `getCustomer`, `subscribeLaunchChecklists`, `subscribeAllLaunchChecklists`, `updateLaunchChecklist`, `completeLaunchChecklist`, `confirmLaunchChecklist`, `applyLaunchChecklistToProject`, `recalculateLaunchDueDates`, `subscribePortalNotifications`, `createPortalNotification`, `markPortalNotificationRead` to `services/customers.js` and `services/launch.js`.

- **Risk:** Low — primarily used by `customers.js`, `customer-portal.js`, `sales.js`.

### Step 7: Extract Activity Log Service (Low Risk)

Move `subscribeActivityLogs`, `subscribeAllActivityLogs`, `addActivityLog` to `services/activity.js`.

- **Risk:** Near zero — used only by `activity.js` page controller.

### Step 8: Remaining Core Stays in firestore-service.js (or rename to services/core.js)

After steps 1-7, `firestore-service.js` contains only:
- Projects CRUD + subscriptions
- Checklist items CRUD + subscriptions + `recalculateProjectStats()`
- Change requests

This is ~500-600 lines — a reasonable single-file scope. Can be renamed to `services/core.js` or left as is.

---

## Splitting Large Page Controllers

After the service split, focus on the three largest page controllers. The same pattern applies to each.

### Project Detail (`project-detail.js`, 1,231 lines)

Split into:

```
pages/project-detail/
  index.js          (entry: auth guard, subscriptions, event delegation — ~100 lines)
  header.js         (renderHeader: D-Day, phase pipeline, delay banner — ~150 lines)
  checklist.js      (renderWorkTab, 5 view modes: phase/timeline/dept/board/list — ~400 lines)
  schedule.js       (renderScheduleTab: gantt chart — ~200 lines)
  bottleneck.js     (renderBottleneckTab: heatmap, pipeline diagram — ~200 lines)
  modals.js         (task create modal, template apply modal — ~150 lines)
```

**Entry point `index.js` coordinates state, subscriptions, and event delegation. It does not render HTML.**

### Projects List (`projects.js`, 1,292 lines)

Split into:

```
pages/projects/
  index.js          (entry: auth guard, subscriptions, tab state — ~100 lines)
  views/
    table.js        (table view + sort — ~200 lines)
    matrix.js       (matrix view + PHASE_GROUPS — ~200 lines)
    cards.js        (card view — ~100 lines)
    gantt.js        (gantt chart — ~200 lines)
    kanban.js       (kanban board — ~150 lines)
    timeline.js     (timeline view — ~150 lines)
    calendar.js     (calendar view — ~150 lines)
  create-modal.js   (create project dialog — ~100 lines)
```

The `index.js` holds view-mode state and imports the active view renderer. Only the active view module is loaded on each render — other views are dormant.

### Dashboard (`dashboard.js`, 843 lines)

Split into:

```
pages/dashboard/
  index.js          (entry: cache, subscriptions, tab routing — ~150 lines)
  tabs/
    projects-tab.js (project cards with D-Day — ~200 lines)
    tasks-tab.js    (urgency groups — ~200 lines)
    approvals-tab.js (~100 lines)
    notifications-tab.js (~100 lines)
```

---

## Scalability Considerations

| Concern | Current | After Refactoring |
|---------|---------|-----------------|
| New feature domain | Add ~100 lines to 2060-line file | Create new `services/[domain].js` |
| Debug subscription leak | Search 843+ line dashboard.js | `subs.unsubAll()` called in SubscriptionManager |
| Duplicate task card HTML | Copy-paste between dashboard and project-detail | Import `taskCardHTML()` from `components/task-card.js` |
| New view mode in projects | Insert into 1292-line controller | Add `pages/projects/views/new-view.js` |
| Onboard new developer | Explain one 2060-line file | Each service file has 1 domain, self-documenting |

---

## Roadmap Implications

**Phase ordering rationale:**

1. Service extraction (Steps 1-8 above) must come before page controller splitting. If you split page controllers first, they still import from the monolithic service file and the benefit is reduced.

2. Subscription lifecycle manager (`SubscriptionManager`) is a 30-line change that can be done in any phase with low risk. Do it early since it improves safety for all subsequent refactoring.

3. Event delegation refactor should accompany page controller splits, not be done separately. It requires rewriting the event wiring section anyway.

4. Component extraction (template literal helpers for task cards, project cards) can be done incrementally — extract one card type per sprint without breaking anything.

**Phases that need deeper research:**

- State store (`state/store.js`): The simple observable pattern above covers 90% of cases. Research needed if inter-page state sharing is ever required (e.g., dashboard stat badge reflecting a project-detail mutation without a full subscription round-trip).
- Dynamic imports (`import()`): If any page controller split results in files that are only needed for specific view modes, lazy-loading via dynamic import can cut initial parse time. Needs verification that Firebase CDN importmap works with dynamic imports in all target browsers.

---

## Sources

- Direct codebase analysis: `js/firestore-service.js` (2060 lines), `js/pages/dashboard.js` (843 lines), `js/pages/project-detail.js` (1231 lines), `js/pages/projects.js` (1292 lines), `js/components.js` (434 lines)
- Pattern: Observable store — standard vanilla JS technique documented in MDN's EventTarget API and numerous framework internals
- Pattern: Event delegation — MDN Web Docs, "Event delegation" article (stable, no version concerns)
- Pattern: ES module splitting by domain — standard practice for large Node.js/browser projects, no external source needed
- Confidence: HIGH — all recommendations based on direct code inspection, not training data assumptions
