# Codebase Structure

**Analysis Date:** 2026-03-12

## Directory Layout

```
processcheck-html/
├── index.html                    # Login page (Microsoft OAuth + demo cards)
├── home.html                     # Hub/home page (navigation to dashboard/projects/etc)
├── landing.html                  # Marketing landing page (no auth required)
├── manual.html                   # User manual (no auth required)
├── dashboard.html                # Project-centric dashboard (4 tabs: projects/tasks/approvals/notifications)
├── projects.html                 # Project list & 7 view modes (table/matrix/cards/gantt/kanban/timeline/calendar)
├── project.html                  # Project detail (3 tabs: overview+tasks/schedule/bottleneck)
├── task.html                     # Task detail (timeline, comments, file uploads, approvals)
├── admin-checklists.html         # Template item management (3 modes: matrix/tree/list) — observer only
├── admin-users.html              # User management (role/dept assignment) — observer only
├── customers.html                # Customer management (dealers, subsidiaries, hospitals)
├── customer-portal.html          # Customer-facing read-only project view (email auth)
├── sales.html                    # Sales launch preparation dashboard
├── activity.html                 # Activity/event log
├── notifications.html            # Notifications page (timeline view)
├── reports.html                  # Reports & analytics (placeholder)
│
├── css/
│   └── styles.css                # Single design system file (light/dark themes, tokens, components)
│
├── js/
│   ├── firebase-init.js          # Firebase SDK initialization (app, auth, db, storage)
│   ├── auth.js                   # Authentication (login, MS OAuth, logout, session mgmt)
│   ├── firestore-service.js      # All Firestore CRUD + subscriptions (380+ lines)
│   ├── components.js             # Shared UI components (nav, spinner, badges, theme)
│   ├── utils.js                  # Utility functions (date, role, formatting, helpers)
│   ├── review-system.js          # Review/feedback system (comments, issues, approvals)
│   ├── feedback-widget.js        # Feedback prompt widget (inline on pages)
│   │
│   └── pages/
│       ├── login.js              # Login page controller (demo cards, MS OAuth flow)
│       ├── home.js               # Home hub page controller
│       ├── landing.js            # Landing page controller (no auth)
│       ├── manual.js             # Manual page controller (search, scroll spy, no auth)
│       ├── dashboard.js          # Dashboard page controller (role-based subscriptions)
│       ├── projects.js           # Projects page controller (7 view modes, filtering, sorting)
│       ├── project-detail.js     # Project detail page controller (3 tabs, checklist CRUD)
│       ├── task-detail.js        # Task detail page controller (timeline, approvals)
│       ├── admin-checklists.js   # Template admin page controller (matrix/tree/list views)
│       ├── admin-users.js        # User admin page controller (role/dept editing)
│       ├── customers.js          # Customer management page controller
│       ├── customer-portal.js    # Customer portal page controller (email auth)
│       ├── sales.js              # Sales launch dashboard page controller
│       ├── activity.js           # Activity log page controller
│       ├── notifications.js      # Notifications page controller
│       └── reports.js            # Reports page controller
│
├── docs/
│   ├── manual.md                 # User manual content (Korean, source of truth)
│   └── deliverables/
│       ├── wireframes.html       # Design wireframes (interactive deliverable)
│       ├── checklist-wireframe.html  # Checklist template wireframe (live Firestore data)
│       ├── user-flows.html       # User flow diagrams
│       ├── flow-annotations.html # Flow diagrams with annotations
│       ├── diagram-viewer.html   # System architecture diagrams (DrawIO)
│       ├── feedback.html         # Feedback aggregation view (all page feedbacks)
│       │
│       └── js/
│           ├── deliverable-nav.js    # Top nav + sidebar for deliverable pages
│           ├── review-bootstrap.js   # Standalone review system for deliverables
│           ├── checklist-live.js     # Live Firestore sync for checklist wireframe
│           └── feedback-system.js    # Feedback collection & UI (screenshot + comments)
│
├── img/
│   ├── [14 PNG files]            # Manual page screenshots (captured via Puppeteer)
│
├── firebase.json                 # Firebase Hosting deployment config
├── .firebaserc                   # Firebase project ID binding
└── firestore.rules               # Firestore security rules (reviews collection auth)
```

## Directory Purposes

**Root HTML Files:**
- Purpose: Entry points for different user flows and roles
- Contains: Minimal HTML shell + inline `<script type="importmap">` for Firebase CDN + page-specific style blocks + div#app/nav-root/other containers
- Key files: `index.html` (login), `home.html` (hub), `dashboard.html`, `projects.html`, `project.html`, `task.html`, `admin-checklists.html`, `admin-users.html`, `manual.html`

**`css/styles.css`:**
- Purpose: Single design system file with all tokens, components, and layouts
- Contains: CSS custom properties (light/dark mode), animations, resets, base styles, component classes (.nav-*, .card-*, .btn-*, .badge-*, etc)
- Key features: Light mode (default, `:root`), dark mode (`[data-theme="dark"]`), Pretendard + JetBrains Mono fonts, cyan primary color, scrollbar customization

**`js/firebase-init.js`:**
- Purpose: Firebase SDK initialization (singleton pattern)
- Contains: Firebase config, `initializeApp()`, `getFirestore()`, `getAuth()`, `getStorage()` exports
- Used by: All modules that need `db`, `auth`, or `storage` references

**`js/auth.js`:**
- Purpose: Authentication and session management
- Contains: `login(name, role)` (demo cards), `loginWithMicrosoft()` (OAuth popup), `completeRegistration()`, `logout()`, `getUser()` (localStorage check), page guard `guardPage()`
- Session storage: localStorage key `pc_user` stores `{id, name, email, role, department, authProvider}`

**`js/firestore-service.js`:**
- Purpose: All data operations — subscriptions, CRUD, transformations, seeding
- Contains:
  - Timestamp converters: `toDate()`, `docToProject()`, `docToChecklistItem()`, `docToChangeRequest()`, `docToUser()`, etc.
  - Subscriptions: `subscribeProjects()`, `subscribeChecklistItems()`, `subscribeAllChecklistItems()`, `subscribeNotifications()`, `subscribeTemplateItems()`, etc.
  - CRUD: `createProject()`, `updateProject()`, `createChecklistItem()`, `completeTask()`, `approveTask()`, `rejectTask()`, `updateChangeRequest()`, etc.
  - Utils: `getUsers()`, `getUserByName()`, `getUserByEmail()`, `createUser()`, `getUsersInDepartment()`
  - Seeding: `seedTemplatesIfEmpty()`, `applyTemplateToProject()`, `seedDatabaseIfEmpty()` (legacy, disabled)
  - Notifications: `createNotification()` (auto-called on task changes), `markNotificationRead()`
  - Stats: `recalculateProjectStats()` (auto-called on task complete/approve/reject/restart)
- Size: ~2000 lines (large monolithic file)

**`js/components.js`:**
- Purpose: Shared UI components (reused across pages)
- Contains:
  - Theme: `getTheme()`, `setTheme()`, `toggleTheme()`, `getThemeIcon()`, `initTheme()`
  - Navigation: `renderNav()` (renders top nav bar with links + role-based menu), `BASE_NAV_LINKS` array, `getNavLinks(userRole)`
  - Spinner: `renderSpinner()` (loading indicator HTML)
  - Review panel: `ReviewPanel` class (FAB + sidebar for feedback)
  - Badges: Helper functions for status/role/risk badges

**`js/utils.js`:**
- Purpose: Utility functions and constants
- Contains:
  - Constants: `departments` (10 departments), `projectStages` (12 stages), `PHASE_GROUPS` (6 phases), `GATE_STAGES` (approval gates)
  - Formatters: `formatStageName()`, `formatDate()`, `timeAgo()`, `getRiskClass()`, `getRiskLabel()`, `getStatusLabel()`, `getStatusBadgeClass()`
  - Helpers: `escapeHtml()`, `getRoleName()`, `daysUntil()`, `getProgressClass()`, `getQueryParam()`
  - Exports: `exportToCSV()`, `exportToPDF()`

**`js/review-system.js`:**
- Purpose: Review/feedback system for inline comments on any page
- Contains: `subscribeReviews()`, `addReview()`, `updateReviewStatus()`, `addReply()`, `deleteReview()`, `ReviewPanel` class
- Data: Stores in `reviews` collection with fields: `pageId`, `pageUrl`, `authorId`, `type` (comment/issue/approval), `status` (open/resolved), `content`, `votes`, `replies`, `history`

**`js/pages/*.js`:**
- Purpose: Page-specific controllers — handle subscriptions, state, rendering, event listeners
- Pattern: Each page file:
  1. Imports auth guard and calls `guardPage()` to verify user
  2. Imports shared components (nav, spinner, theme)
  3. Imports firestore service for data subscriptions
  4. Imports utils for formatting/helpers
  5. Defines local state variables (`let projects = []`, `let checklistItems = []`, etc)
  6. Sets up subscriptions with `onSnapshot` callbacks
  7. Defines render function that clears `app.innerHTML` and rebuilds DOM
  8. Attaches event listeners to rendered DOM elements
  9. Returns unsubscribe functions on cleanup

**`docs/manual.md`:**
- Purpose: Single source of truth for user documentation (Korean)
- Contains: 10+ sections (시작하기, 프로젝트관리, 작업관리, 승인workflow, 설계변경, 출시준비, 고객, 체크리스트관리, 역할별가이드, FAQ, 용어집)
- Used by: `manual.js` parses and renders as HTML

**`docs/deliverables/`:**
- Purpose: Design deliverables (wireframes, flows, diagrams) with integrated feedback system
- Contains: Static HTML files with embedded review system for design feedback
- Key: Each page loads `deliverable-nav.js` for top nav + `review-bootstrap.js` for review panel

## Key File Locations

**Entry Points:**
- `index.html` + `js/pages/login.js`: Login (demo cards + Microsoft OAuth)
- `home.html` + `js/pages/home.js`: Home hub (navigation hub)
- `dashboard.html` + `js/pages/dashboard.js`: Main dashboard (project-centric view)
- `projects.html` + `js/pages/projects.js`: Project list (7 view modes)
- `project.html` + `js/pages/project-detail.js`: Project detail (3 tabs)
- `admin-checklists.html` + `js/pages/admin-checklists.js`: Template admin (observer only)

**Configuration:**
- `firebase.json`: Firebase Hosting config (public dir, redirects)
- `.firebaserc`: Firebase project ID mapping
- `js/firebase-init.js`: Firebase SDK config and exports
- `firestore.rules`: Firestore security rules (if deployed)

**Core Logic:**
- `js/firestore-service.js`: All Firestore operations (subscriptions, CRUD, seeding)
- `js/auth.js`: Authentication and session management
- `js/components.js`: Shared UI components and navigation

**Testing/Seeding:**
- Mock data inline in `firestore-service.js:getMockData()` (193 template items)
- `seedTemplatesIfEmpty()`: Auto-seed templates if collection is empty
- Demo user login: 3 sample cards (김철수/worker, 이영희/manager, 박민수/observer)

## Naming Conventions

**Files:**
- HTML pages: `kebab-case.html` (e.g., `admin-users.html`, `project-detail.html`)
- JavaScript modules: `kebab-case.js` or `camelCase.js` (mixed — most are camelCase in `pages/`, kebab in root `js/`)
- CSS: Single file `styles.css`
- Directories: `kebab-case` (e.g., `js/pages/`, `docs/deliverables/`)

**Functions:**
- Exports: `camelCase` (e.g., `subscribeProjects()`, `completeTask()`, `renderNav()`)
- Callbacks: Arrow functions inline (e.g., `(data) => { allProjects = data; render(); }`)
- Event handlers: `handleXxx()` or bound directly via `addEventListener()`

**Variables:**
- Local state: camelCase (e.g., `allProjects`, `checklistItems`, `activeTab`)
- Constants: UPPER_SNAKE_CASE (e.g., `STORAGE_KEY`, `ALLOWED_DOMAIN`, `CACHE_TTL`, `PHASE_GROUPS`)
- DOM refs: `camelCase` with `-` for HTML IDs (e.g., `const user = document.getElementById("user-input")`)

**Types/Collections:**
- Firestore collections: snake_case plurals (e.g., `projects`, `checklistItems`, `templateItems`, `notifications`, `reviews`)
- Document fields: camelCase (e.g., `projectId`, `startDate`, `approvalStatus`, `isRequired`)
- Enums/Status: snake_case (e.g., `pending`, `in_progress`, `completed`, `rejected`, `approved`)

## Where to Add New Code

**New Feature (Component/Page):**
1. Create new HTML file in root (e.g., `reports.html`)
2. Create page controller in `js/pages/reports.js` (import auth guard, components, firestore service, utils)
3. Set up subscriptions and state management pattern (see `projects.js` or `dashboard.js` as template)
4. Add navigation link in `components.js:BASE_NAV_LINKS` and `docs/deliverables/js/deliverable-nav.js:MAIN_NAV` (keep in sync)
5. Add CSS styling to `css/styles.css` using design tokens (`:root` custom properties)

**New Firestore Collection/Document Type:**
1. Add transformer function in `firestore-service.js` (e.g., `docToNewType(id, data)` that converts Firestore Timestamps)
2. Add subscription function (e.g., `subscribeNewType(callback)`)
3. Add CRUD functions (e.g., `createNewType()`, `updateNewType()`, `deleteNewType()`)
4. If collection affects project stats, call `recalculateProjectStats()` in mutation
5. If collection should trigger notifications, call `createNotification()` in mutation

**New Page Component (Modal, Dialog, Sidebar):**
1. Create render function in relevant `pages/*.js` (e.g., `renderTaskModal(task)`)
2. Use CSS classes from `styles.css` for styling (`.modal-*`, `.card-*`, `.btn-*`, `.badge-*`)
3. Add event listeners to buttons in render function
4. On close, set UI state flag and call `render()` to re-render main page

**New Utility Function:**
1. Add to `js/utils.js` and export (e.g., `export function formatNewType() { ... }`)
2. If it's a formatter for display, follow naming: `formatXxx()` / `getXxxLabel()` / `getXxxClass()`
3. Add constants (departments, stages, etc) to utils exports

**Database Seeding (for testing/demo):**
1. Add mock data to `getMockData()` function in `firestore-service.js`
2. If new collection, add to return object and import in seed functions
3. Call `seedDatabaseIfEmpty()` or `seedTemplatesIfEmpty()` from login page
4. Mock data is filtered via `filterDemo()` in subscriptions (for demo vs real data separation)

## Special Directories

**`docs/deliverables/`:**
- Purpose: Design artifacts with integrated feedback system
- Generated: No (manually created HTML files)
- Committed: Yes
- Notes: Each page loads `deliverable-nav.js` for navigation consistency with main app, and `review-bootstrap.js` for standalone review system

**`docs/`:**
- Purpose: Documentation (manual.md is source of truth)
- Generated: `manual.js` renders `manual.md` content as HTML at runtime
- Committed: Yes (markdown source + 14 PNG screenshots)

**`img/`:**
- Purpose: Manual page screenshots
- Generated: Yes (via Puppeteer in build process — not in CI, run manually: `node scripts/capture-screenshots.mjs`)
- Committed: Yes (PNG files checked in)

**`js/pages/`:**
- Purpose: Page-specific controllers (one per HTML page)
- Pattern: Each imports shared infrastructure, sets up subscriptions, defines state, renders UI, manages events
- Size: 500-2000 lines per page (larger pages like dashboard.js, projects.js, project-detail.js)

---

## Import/Export Patterns

**ES Module Imports (all files use top-level imports):**
```javascript
// From auth.js
import { getUser, logout } from "./auth.js";

// From firestore-service.js
import { subscribeProjects, createProject, updateProject } from "./firestore-service.js";

// From Firebase CDN
import { initializeApp } from "firebase/app";
import { collection, doc, getDocs, onSnapshot } from "firebase/firestore";

// From utils.js
import { departments, PHASE_GROUPS, formatDate, getRiskClass } from "./utils.js";
```

**Firebase Firestore Usage:**
```javascript
// Subscribe to real-time updates
const unsubscribe = onSnapshot(query(collection(db, "projects"), where("status", "==", "active")), (snap) => {
  const projects = snap.docs.map(doc => docToProject(doc.id, doc.data()));
  callback(projects);
});

// Batch writes for bulk operations
const batch = writeBatch(db);
items.forEach(item => {
  batch.update(doc(db, "checklistItems", item.id), { assignee: newAssignee });
});
await batch.commit();
```
