# Codebase Structure

**Analysis Date:** 2026-03-12

## Directory Layout

```
processcheck-html/
├── index.html              # Login page (entry point)
├── home.html               # Hub — links to dashboard or sales
├── dashboard.html          # Role-based dashboard shell
├── projects.html           # Project list (7 views) shell
├── project.html            # Project detail (3 tabs) shell
├── task.html               # Task detail shell
├── sales.html              # Sales launch dashboard shell
├── admin-checklists.html   # Template admin shell
├── admin-users.html        # User management shell
├── customers.html          # Customer management shell
├── customer-portal.html    # Customer portal (email auth) shell
├── notifications.html      # Notifications shell
├── activity.html           # Activity log shell
├── reports.html            # Reports shell
├── manual.html             # User manual (no auth required) shell
├── landing.html            # Marketing/landing page (self-contained)
├── css/
│   └── styles.css          # All design tokens, components, utilities (3733 lines)
├── js/
│   ├── firebase-init.js    # Firebase app + db/auth/storage singletons
│   ├── auth.js             # Session management, login flows, page guard
│   ├── firestore-service.js# All Firestore CRUD + subscriptions (132 KB)
│   ├── components.js       # Nav, theme, spinner, shared UI components
│   ├── utils.js            # Pure helpers, domain constants (PHASE_GROUPS, etc.)
│   ├── review-system.js    # Review/feedback panel (Firestore reviews collection)
│   ├── feedback-widget.js  # Feedback widget (older, separate from review-system)
│   └── pages/
│       ├── login.js        # Login page controller
│       ├── home.js         # Hub page controller
│       ├── dashboard.js    # Dashboard controller (34 KB)
│       ├── projects.js     # Project list controller (54 KB)
│       ├── project-detail.js# Project detail controller (62 KB)
│       ├── task-detail.js  # Task detail controller (36 KB)
│       ├── sales.js        # Sales dashboard controller (75 KB)
│       ├── admin-checklists.js # Template admin controller (53 KB)
│       ├── admin-users.js  # User management controller (10 KB)
│       ├── customers.js    # Customer management controller (15 KB)
│       ├── customer-portal.js # Portal controller (19 KB)
│       ├── notifications.js# Notifications controller (15 KB)
│       ├── activity.js     # Activity log controller (15 KB)
│       ├── reports.js      # Reports controller (33 KB)
│       ├── manual.js       # Manual page controller (47 KB, embeds CSS)
│       └── landing.js      # Landing page controller (minimal)
├── img/                    # Manual screenshots (14 PNG files)
├── docs/
│   └── deliverables/       # Design review documents (read-only UI)
│       ├── wireframes.html
│       ├── checklist-wireframe.html
│       ├── user-flows.html
│       ├── flow-annotations.html
│       ├── diagram-viewer.html
│       ├── feedback.html
│       └── js/
│           ├── deliverable-nav.js  # IIFE top nav + sidebar + screenshot capture
│           ├── review-bootstrap.js # Standalone review system for deliverables
│           ├── checklist-live.js   # Firestore live data for checklist wireframe
│           └── feedback-system.js  # Firestore feedback CRUD
├── firebase.json           # Firebase Hosting config + Firestore rules pointer
├── firestore.rules         # Firestore security rules
├── storage.rules           # Firebase Storage security rules
├── .firebaserc             # Firebase project link (processsss-appp)
├── capture-screenshots.mjs # Puppeteer screenshot utility (dev tool, not deployed)
└── .planning/              # GSD planning documents (not deployed)
    ├── codebase/           # Codebase analysis documents
    ├── phases/             # Phase implementation plans
    └── research/           # Research notes
```

## Directory Purposes

**`css/`:**
- Purpose: Single global stylesheet — no component-scoped styles
- Contains: CSS custom properties (design tokens), light mode (`:root`) and dark mode (`[data-theme="dark"]`), layout utilities, component classes (`.nav`, `.card`, `.btn`, `.badge`, `.spinner`, `.modal`, etc.)
- Key files: `css/styles.css` (the only CSS file; 3733 lines)
- Note: Page-specific CSS is sometimes embedded as `<style>` in the HTML shell (e.g., `index.html`) or inside the page controller JS (e.g., `manual.js` injects a `<style>` tag)

**`js/` (shared modules):**
- Purpose: Infrastructure and shared utilities imported by all page controllers
- Contains: `firebase-init.js`, `auth.js`, `firestore-service.js`, `components.js`, `utils.js`, `review-system.js`
- All files are ES modules (`import`/`export`)

**`js/pages/`:**
- Purpose: One controller per page — handles the full lifecycle of one HTML page
- Contains: Page-specific state, render functions, event handlers
- Each file is an ES module loaded by its corresponding HTML shell via `<script type="module" src="js/pages/[page].js">`

**`img/`:**
- Purpose: Static images used in the manual page
- Contains: 14 PNG screenshots referenced by `js/pages/manual.js`
- Generated: Via `capture-screenshots.mjs` (Puppeteer)
- Committed: Yes

**`docs/deliverables/`:**
- Purpose: Design deliverable documents for project review — wireframes, user flows, architecture diagrams, feedback collection
- Contains: Self-contained HTML pages; each includes `deliverable-nav.js` as a classic `<script>` (IIFE, not ES module)
- Key distinction: Uses its own standalone review system (`review-bootstrap.js`) rather than `js/review-system.js`
- Not the main application — no auth guard, read-only views with Firestore feedback

## Key File Locations

**Entry Points:**
- `index.html` + `js/pages/login.js`: Application entry — login
- `home.html` + `js/pages/home.js`: Post-login hub
- `landing.html`: Public marketing page (no auth, largely self-contained HTML)
- `manual.html` + `js/pages/manual.js`: Public manual (no auth required)

**Configuration:**
- `js/firebase-init.js`: Firebase project config (API key, project ID, etc.) — hardcoded, safe for client
- `firebase.json`: Hosting public directory, cache headers, rules file paths
- `.firebaserc`: Firebase project alias (`processsss-appp`)
- `firestore.rules`: Collection-level read/write rules (most collections: read=public, write=authenticated)

**Core Logic:**
- `js/firestore-service.js`: Single file for ALL data access — CRUD, subscriptions, business logic (completeTask, approveTask, recalculateProjectStats, applyTemplateToProject, seeding)
- `js/auth.js`: Session management and authentication flows
- `js/components.js`: Navigation rendering and theme management

**Domain Constants:**
- `js/utils.js`: `PHASE_GROUPS` (6 phases), `GATE_STAGES`, `departments` (10 dept names), `projectStages` (12 stage keys)

## Naming Conventions

**Files:**
- HTML shells: `kebab-case.html` matching the page name (e.g., `admin-checklists.html`, `customer-portal.html`)
- Page controllers: `js/pages/kebab-case.js` matching the HTML shell name (e.g., `admin-checklists.js`)
- Shared modules: `js/camelCase.js` (e.g., `firestore-service.js` uses hyphens; `auth.js`, `utils.js` use lowercase)

**JavaScript:**
- Functions: `camelCase` (e.g., `guardPage`, `renderNav`, `subscribeProjects`, `completeTask`)
- Constants: `UPPER_SNAKE_CASE` for arrays/objects of domain constants (e.g., `PHASE_GROUPS`, `GATE_STAGES`, `BASE_NAV_LINKS`)
- Variables: `camelCase` for module-level state (e.g., `allProjects`, `activeTab`, `unsubscribers`)

**CSS Classes:**
- Component classes: `kebab-case` prefixed by component name (e.g., `.nav-link`, `.nav-dropdown`, `.card-header`, `.btn-primary`)
- Page-specific: `.login-*`, `.hub-*`, `.manual-*` prefixes
- Utility classes: short single-purpose (e.g., `.flex`, `.gap-8`, `.text-sm`, `.hidden`)

**Firestore Collections:**
- camelCase singular: `users`, `projects`, `checklistItems`, `templateItems`, `templateStages`, `templateDepartments`, `notifications`, `changeRequests`, `customers`, `launchChecklists`, `portalNotifications`, `reviews`, `activityLogs`, `feedbacks`

## Where to Add New Code

**New Application Page:**
1. Create HTML shell: `[page-name].html` — copy structure from `dashboard.html` (minimal shell with `#nav-root`, `#app`, importmap, `<script type="module" src="js/pages/[page-name].js">`)
2. Create page controller: `js/pages/[page-name].js` — start with auth guard, nav render, Firestore subscription
3. Add nav link: Update `BASE_NAV_LINKS` in `js/components.js` AND `MAIN_NAV` in `docs/deliverables/js/deliverable-nav.js`

**New Firestore Operation:**
- Add to `js/firestore-service.js` in the appropriate section (grouped by collection)
- Follow the `docTo*` mapper pattern for any new collection
- Use `subscribe*` for real-time, `get*` / `fallbackLoad*` for one-time fetch

**New Shared UI Component:**
- Add to `js/components.js` and export
- If it requires CSS, add to `css/styles.css` with a descriptive component prefix

**New Domain Constant or Utility Function:**
- Add to `js/utils.js` and export

**New Deliverable Design Document:**
- Add HTML file to `docs/deliverables/`
- Include `deliverable-nav.js` as a classic script (IIFE): `<script src="js/deliverable-nav.js"></script>`
- Add the page to `SUB_PAGES` array in `docs/deliverables/js/deliverable-nav.js`
- Do NOT use ES module `import` in deliverable pages — use IIFE globals

**Page-Specific CSS:**
- Prefer adding to `css/styles.css` with a page-specific prefix class
- Small page-specific overrides may be placed in a `<style>` block in the HTML shell
- `manual.js` uses an injected `<style>` tag inside the script — follow only for manual-scale isolated content

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents — not application code
- Generated: No (written by Claude agents)
- Committed: Yes

**`.firebase/`:**
- Purpose: Firebase CLI cache
- Generated: Yes
- Committed: No (in `.gitignore`)

**`img/`:**
- Purpose: Manual screenshots
- Generated: Via `capture-screenshots.mjs` Puppeteer script
- Committed: Yes

**`docs/deliverables/`:**
- Purpose: Design review artifacts — wireframes, flows, diagrams, feedback
- Generated: No (hand-crafted HTML)
- Committed: Yes
- Note: Uses separate nav system and standalone review system; treated as a sub-application with its own JS layer

---

*Structure analysis: 2026-03-12*
