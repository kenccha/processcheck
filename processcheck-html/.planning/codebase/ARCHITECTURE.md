# Architecture

**Analysis Date:** 2026-03-12

## Pattern Overview

**Overall:** Client-side SPA (Single Page Application) using vanilla JavaScript ES modules with real-time Firebase Firestore subscriptions.

**Key Characteristics:**
- No build step or framework — plain HTML + CSS + JavaScript
- Firebase SDK v11.3.0 loaded via CDN with ES module `<script type="importmap">`
- Event-driven reactive architecture with `onSnapshot` subscriptions
- localStorage-based session management with Microsoft OAuth integration
- Declarative UI rendering pattern with full re-render on state change
- Light/dark theme support via CSS custom properties and `[data-theme="dark"]` attribute

## Layers

**Presentation Layer:**
- Purpose: Render UI, handle user interactions, manage view state
- Location: `js/pages/*.js` (page-specific controllers), `js/components.js` (shared UI components), `css/styles.css` (design system)
- Contains: Page controllers with event listeners, DOM rendering functions, form handling, view mode switching
- Depends on: Firestore Service, Auth, Utils
- Used by: HTML pages

**State & Subscription Layer:**
- Purpose: Real-time data synchronization via Firestore `onSnapshot` subscriptions
- Location: `js/firestore-service.js` (main data service)
- Contains: Subscription functions (`subscribeProjects`, `subscribeChecklistItems`, etc.), real-time unsubscribe management, sessionStorage caching for performance
- Depends on: Firebase SDK, Auth (for user context)
- Used by: Page controllers

**Data Access Layer:**
- Purpose: CRUD operations and Firestore queries
- Location: `js/firestore-service.js` (contains both subscriptions and CRUD)
- Contains: `createUser`, `updateProject`, `completeTask`, `approveTask`, `bulkUpdateAssignee`, etc.
- Depends on: Firebase Firestore SDK
- Used by: Page controllers, Subscription Layer

**Authentication Layer:**
- Purpose: Session management, login/logout, role/department assignment
- Location: `js/auth.js`
- Contains: `login()` (demo cards), `loginWithMicrosoft()`, `completeRegistration()`, `logout()`, localStorage session persistence
- Depends on: Firebase Auth, Firestore Service (for user lookup/creation)
- Used by: Login page, components, page guards

**Infrastructure Layer:**
- Purpose: Firebase initialization and shared utilities
- Location: `js/firebase-init.js`, `js/utils.js`, `js/components.js`
- Contains: Firebase app/auth/db/storage initialization, helper functions (date formatting, role mapping, filtering), shared components (navigation, theme, spinner)
- Depends on: Firebase SDK, localStorage
- Used by: All other layers

## Data Flow

**User Login Flow:**

1. User clicks demo card OR Microsoft button on `index.html` (login page)
2. `login.js` calls `auth.js:login()` or `auth.js:loginWithMicrosoft()`
3. Auth module queries Firestore for existing user via `firestore-service.js:getUserByName()` or `getUserByEmail()`
4. If user doesn't exist, auto-creates with `createUser()` (demo gets role directly, Microsoft users created as `worker` with auto-assignment by admin later)
5. User object stored in `localStorage` under key `pc_user`
6. Redirect to `home.html` (hub page with navigation links)

**Real-time Data Subscription (Example: Dashboard):**

1. `dashboard.js` calls `subscribeProjects()` → sets up Firestore `onSnapshot` listener on `projects` collection
2. Listener callback updates local state `allProjects = [...]`
3. State change triggers `render()` which re-renders the entire dashboard DOM
4. User interacts with UI (approves task, updates assignee) → calls Firestore mutation like `approveTask(taskId, approvalData)`
5. Firestore write triggers automatic notification for affected users (`createNotification` called inside mutation)
6. Dashboard subscription receives updated project/task data → state updates → re-render

**Task Completion & Approval Flow:**

1. Worker completes task → `completeTask(taskId)` sets `status: "completed"`, `completedDate: now`, `approvalStatus: "pending"`
2. Notification auto-created for manager/observer
3. Observer approves → `approveTask(taskId)` sets `approvalStatus: "approved"`, `approvedBy: user.name`, `approvedAt: now`
4. Project stats auto-recalculated via `recalculateProjectStats()` (called inside approve/reject/complete/restart)
5. All subscribers receive updated project and notification data → UI updates in real-time

**Template → Project Checklist Generation:**

1. User creates new project → `createProject()` stores project document
2. On first load of project detail, user clicks "템플릿 적용" button
3. Button calls `applyTemplateToProject(projectId, projectType, changeScale?)`
4. Service queries all 193 `templateItems` + filters by project type (신규개발 uses all, 설계변경 filters by `isRequired` and phase)
5. Creates `checklistItems` docs for each filtered template → Firestore batch write
6. Project stats recalculated (`recalculateProjectStats()`)
7. Subscription updates → Dashboard/Project Detail render new checklist

**State Management:**

- **Local State:** Page controllers maintain state in variables (`let allProjects = []`, `let checklistItems = []`)
- **Persisted State:** Authentication via `localStorage` (`pc_user` key), theme preference via `localStorage` (`pc-theme` key)
- **Session Cache:** Dashboard caches project/task data in `sessionStorage` for 2 minutes (120s TTL) to reduce API calls on tab refresh
- **Subscription State:** Real-time subscriptions hold unsubscribe functions in arrays, cleaned up on page unload

## Key Abstractions

**Subscription Manager:**
- Purpose: Encapsulate Firestore `onSnapshot` lifecycle (subscribe, unsubscribe, transform data)
- Examples: `subscribeProjects()`, `subscribeChecklistItems()`, `subscribeNotifications()` in `firestore-service.js`
- Pattern: Returns unsubscribe function; calls callback with transformed data; handles Firestore Timestamps → JS Date conversion

**Review System:**
- Purpose: Enable inline comments/feedback on any page (main app + deliverable pages)
- Examples: `subscribeReviews()`, `addReview()`, `addReply()` in `review-system.js`
- Pattern: Detects current page via `window.location.pathname`, renders review panel FAB or sidebar, syncs with `reviews` Firestore collection in real-time

**Notification System:**
- Purpose: Auto-generate notifications on task completion/approval/change request status changes
- Examples: `createNotification()` called inside `completeTask()`, `approveTask()`, `updateChangeRequest()`
- Pattern: Stores in `notifications` collection; linked to user ID for role-based subscription (`subscribeNotifications(userId)`)

**Project Stats Recalculator:**
- Purpose: Auto-calculate `progress`, `currentStage`, `riskLevel` based on checklist item statuses
- Examples: `recalculateProjectStats(projectId)` called after any task change
- Pattern: Counts completed/approved items per stage, determines current stage (first incomplete), calculates delay risk

## Entry Points

**Login (`index.html`):**
- Location: `index.html` + `js/pages/login.js`
- Triggers: User navigates to root or session expires
- Responsibilities: Render login UI (demo cards + Microsoft OAuth), handle login flow, seed templates if needed, redirect to home on success

**Home Hub (`home.html`):**
- Location: `home.html` + `js/pages/home.js`
- Triggers: Redirect after successful login
- Responsibilities: Render hub page with 4 main navigation cards (Dashboard, Projects, Checklists, Reviews), establish auth guard

**Dashboard (`dashboard.html`):**
- Location: `dashboard.html` + `js/pages/dashboard.js`
- Triggers: Click "출시위원회" nav link or card on hub
- Responsibilities: Project-centric overview with 4 tabs (Projects/Tasks/Approvals/Notifications), real-time subscription management, stat card rendering, task urgency grouping

**Projects (`projects.html`):**
- Location: `projects.html` + `js/pages/projects.js`
- Triggers: Click "출시위원회" / "설계변경" nav tabs or project card on hub
- Responsibilities: 7 view modes (table/matrix/cards/gantt/kanban/timeline/calendar), filtering/sorting, create project dialog, type tab switching

**Project Detail (`project.html`):**
- Location: `project.html` + `js/pages/project-detail.js`
- Triggers: Click project row or card in projects page
- Responsibilities: 3-tab view (overview+tasks / schedule / bottleneck), checklist item CRUD, task approval management, template application, phase pipeline visualization

**Task Detail (`task.html`):**
- Location: `task.html` + `js/pages/task-detail.js`
- Triggers: Click task in project detail checklist
- Responsibilities: Full task timeline, comment thread, file uploads, approval workflow, complete/reject/restart actions

**Admin Checklists (`admin-checklists.html`):**
- Location: `admin-checklists.html` + `js/pages/admin-checklists.js`
- Triggers: Click "체크리스트" nav link (observer only)
- Responsibilities: 3 view modes (matrix/tree/list), template item CRUD, stage/department management, bulk item edits

**Admin Users (`admin-users.html`):**
- Location: `admin-users.html` + `js/pages/admin-users.js`
- Triggers: Click "사용자 관리" in review dropdown (observer only)
- Responsibilities: User list, role/department assignment, bulk user imports

**Deliverables (`docs/deliverables/*.html`):**
- Location: `docs/deliverables/{wireframes, user-flows, diagram-viewer, feedback}.html`
- Triggers: Click "리뷰" nav dropdown items
- Responsibilities: Design artifact display, screenshot capture for feedback, feedback system UI

**Manual (`manual.html`):**
- Location: `manual.html` + `js/pages/manual.js`
- Triggers: Click "매뉴얼" in review dropdown (no auth required)
- Responsibilities: User documentation with search, sections for each role/feature, screenshot display

## Error Handling

**Strategy:** Try-catch blocks in async functions; fallback to localStorage/sessionStorage cache; console logging for debugging; error messages shown in modals/toasts.

**Patterns:**
- **Firestore Errors:** Caught in subscription callbacks; fallback functions like `fallbackLoadProjects()` use mock data
- **Auth Errors:** Caught in login/logout flows; error message shown in `<div class="login-error">`; button state reset
- **Validation Errors:** Input validation before Firestore writes; error toast shown via `showError()` helper

## Cross-Cutting Concerns

**Logging:** console.log/error/warn throughout; no centralized logger; timestamps added via `new Date().toISOString()`

**Validation:** Client-side only via form validation (required fields, email format); no server-side validation

**Authentication:** localStorage session check in `auth.js:getUser()`; page guard in `auth.js:guardPage()` redirects to login if not authenticated

**Authorization:** Role-based checks in components (e.g., `if (user.role === "observer")` to show admin buttons); Firestore rules (optional, not enforced in code) defined in `firestore.rules`

**Theme:** CSS custom properties + `[data-theme="dark"]` attribute; theme read/write in `components.js` (getTheme/setTheme); initialized before page render to prevent flash
