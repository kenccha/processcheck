# Codebase Concerns

**Analysis Date:** 2026-03-12

---

## Security Considerations

**Firestore Rules: Overly Permissive Reads**
- Risk: Every collection except `activityLogs` allows `read: if true` (unauthenticated access). Any unauthenticated person can read all projects, checklist items, customers, notifications, change requests, launch checklists, and portal notifications directly from Firestore.
- Files: `firestore.rules`
- Current mitigation: None — rules are intentionally permissive for dropdown population (user list)
- Recommendation: Move unauthenticated reads to only the `users` collection (needed for task assignment). All other collections should require `isAuthenticated()` on reads.

**Session Not Refreshed on Activity**
- Risk: The 24-hour session TTL in `auth.js` is measured from `loginAt` (a fixed timestamp) and is never reset on user activity. A user actively working for 23+ hours will be abruptly logged out mid-session.
- Files: `js/auth.js` lines 11, 115–127
- Current mitigation: 5-minute polling interval in `startSessionWatcher()`
- Recommendation: Update `loginAt` on meaningful user actions (e.g., any Firestore write) to implement sliding expiration.

**Demo Cards Accessible in Production (Partial)**
- Risk: The `IS_PROD` guard in `login.js` hides demo cards only when `hostname !== "localhost"`. This correctly hides them on Firebase Hosting, but any non-`localhost` dev environment (e.g., Docker, LAN IP, alternate port) would also suppress them. The HTML for the cards and the role-selection form is always present in the DOM — only hidden via `style.display`.
- Files: `js/pages/login.js` lines 29–39, `index.html` lines 364–422
- Recommendation: The demo card HTML could be conditionally injected from JS rather than always present in DOM and then hidden.

**Azure AD Tenant ID Hardcoded in Source**
- Risk: The Azure AD tenant ID (`547afe76-db4a-45d9-9af8-c970051a4c7d`) and allowed domain (`inbody.com`) are hardcoded in source committed to git. While these are semi-public identifiers, rotating the tenant or expanding to other domains requires a code change.
- Files: `js/auth.js` lines 10, 47
- Recommendation: Move to a config object or environment-injected constant. Since this is plain HTML with no build step, a `config.js` module that is gitignored and replaced at deploy time is the cleanest approach.

**Storage Rules: No Path or Size Restrictions**
- Risk: Any authenticated Firebase user can read or write any path in Cloud Storage with no file-size or path restrictions.
- Files: `storage.rules`
- Current mitigation: Client-side 10MB limit and MIME type validation in `js/utils.js` `validateFile()`
- Recommendation: Add server-side `request.resource.size < 10 * 1024 * 1024` and content-type checks. Scope write rules to `tasks/{projectId}/{taskId}/{fileId}` path pattern.

**Firebase Config Exposed in Source**
- Files: `js/firebase-init.js` lines 12–18
- Current mitigation: Comment says "these values are safe to expose" — this is correct for Firebase's client SDK model, provided Firestore rules are tight (see above)
- No action needed beyond tightening Firestore rules.

---

## Tech Debt

**`subscribeAllChecklistItems` Fetches the Entire Collection Without Limits**
- Issue: `subscribeAllChecklistItems()` in `firestore-service.js` opens a real-time listener on the entire `checklistItems` collection with no `where`, `orderBy`, or `limit` clause. Observer-role dashboard and the reports page both use this subscription.
- Files: `js/firestore-service.js` line 826–830, `js/pages/dashboard.js` line 170, `js/pages/reports.js` line 9
- Impact: As the database grows (e.g., 193 items × N projects), every document in the collection is downloaded to every observer browser session on every change anywhere. This will degrade to unusably slow at scale.
- Fix approach: Add composite indexes and filter by project IDs the user is authorized to see. For the dashboard, the fallback loaders (`loadDashboardActiveTasks`) are already targeted — the background subscription should mirror that filter.

**`onSnapshot` Subscriptions Lack Error Callbacks**
- Issue: All 18 `onSnapshot` calls in `firestore-service.js` use only the success callback form. If Firestore rules deny access or the network fails, the snapshot silently stops updating with no UI feedback.
- Files: `js/firestore-service.js` — all `onSnapshot(q, (snap) => {...})` calls
- Impact: Users see stale data with no indication that live updates have stopped. There is no reconnect or degraded-state UI.
- Fix approach: Add error handler as third argument: `onSnapshot(q, callback, (err) => { console.error(err); showOfflineBanner(); })`.

**Dead Code: `completeRegistration` / Role Selection UI**
- Issue: Per CLAUDE.md (2026-03-11), new Microsoft OAuth users are auto-registered as `worker` without role selection. However, `completeRegistration()` is still exported from `auth.js`, imported in `login.js`, and the full role-selection HTML form (`#role-selection`, `#role-select`, `#dept-select`) remains in `index.html`. The `pendingAuthInfo` variable in `login.js` is always `null` because `loginWithMicrosoft()` no longer returns `isNewUser: true`.
- Files: `js/auth.js` lines 84–95, `js/pages/login.js` lines 21–161, `index.html` lines 380–422
- Impact: Dead code increases maintenance surface; the hidden role-selection form adds DOM bloat.
- Fix approach: Remove `completeRegistration()` from `auth.js`, remove its import and all related DOM refs from `login.js`, and remove the `#role-selection` block from `index.html`.

**`seedDatabaseIfEmpty()` Dead Code Still Present**
- Issue: The function is still exported from `firestore-service.js` even though CLAUDE.md (2026-03-11) states auto-seeding is disabled and all sample data was deleted. `seedTemplatesIfEmpty()` is still called from `login.js` line 62.
- Files: `js/firestore-service.js` lines 404–700+, `js/pages/login.js` line 62
- Impact: `seedDatabaseIfEmpty` is a large code block (~300 lines) that represents dead weight. `seedTemplatesIfEmpty` is still active and will re-seed templates on every login page load if templates are missing.
- Fix approach: Confirm template seeding behavior is intentional, then remove or clearly mark `seedDatabaseIfEmpty` as archived.

**Hardcoded Task-level Checklist in `task-detail.js`**
- Issue: `task-detail.js` line 49–55 initializes a hardcoded `checklist` array with 5 static items ("요구사항 문서 검토 완료", etc.) that are local state only and never persisted to Firestore. These appear to be a placeholder from initial development.
- Files: `js/pages/task-detail.js` lines 49–55
- Impact: The checklist UI in task detail appears to work but tracks no real data. Checking items does not save to Firestore.
- Fix approach: Either remove the local checklist UI entirely (tasks already have Firestore-backed status/approval fields) or implement persistence to a `checklist` subcollection/array field on the `checklistItems` document.

**`--nav-hover` CSS Variable Self-Reference in Dark Mode**
- Issue: `css/styles.css` line 128 defines `--nav-hover: var(--nav-hover)` in the `[data-theme="dark"]` block. This is a circular CSS variable reference — browsers resolve it to the initial value (empty/invalid) or fall back to the light-mode value. Dark mode nav hover states likely render incorrectly.
- Files: `css/styles.css` line 128
- Impact: Dark mode nav link hover background renders incorrectly.
- Fix approach: Replace with explicit dark-mode value, e.g. `--nav-hover: rgba(255, 255, 255, 0.06)`.

**Gantt Chart Phase Bars Use Equal Divisions**
- Issue: The schedule tab in `project-detail.js` divides total project duration evenly across all 6 phases (`phaseDuration = totalDays / 6`). This bears no relation to actual task due dates per phase.
- Files: `js/pages/project-detail.js` lines 621–622
- Impact: The Gantt view is visually misleading — it shows all phases as equal width regardless of actual workload distribution.
- Fix approach: Compute each phase's actual date range from the `dueDate` values of its checklist items.

**`exportToPDF` Opens Unblocked Popup**
- Issue: `utils.js` `exportToPDF()` uses `window.open("", "_blank")` and then `printWindow.document.write()`. This approach is blocked by popup blockers in most browsers and is deprecated by several browser vendors. It also does not produce a true PDF file.
- Files: `js/utils.js` lines 241–266
- Impact: PDF export silently fails for most users with default browser settings.
- Fix approach: Use a print CSS stylesheet (`@media print`) on the current page triggered by `window.print()`, or adopt a client-side PDF library like jsPDF.

**`reports.html` Not Linked from Navigation**
- Issue: `reports.html` and its page controller `js/pages/reports.js` exist and are fully implemented with Chart.js charts, but `reports.html` appears in no navigation link in `components.js`.
- Files: `reports.html`, `js/pages/reports.js`, `js/components.js` `BASE_NAV_LINKS`
- Impact: The reports page is a dead end — users can only reach it by typing the URL directly.
- Fix approach: Add a "리포트" link to `BASE_NAV_LINKS` or to the "리뷰" dropdown.

---

## Performance Bottlenecks

**Full Re-render on Every State Change**
- Problem: All page controllers call `render()` (which does `app.innerHTML = ...`) on every Firestore update, filter change, or tab switch. This destroys and rebuilds the entire DOM including form elements, focus positions, and scroll state.
- Files: `js/pages/dashboard.js` lines 161, 165, 183, 188, `js/pages/project-detail.js` lines 77, 82, 882, 890, 908, 913, 915
- Cause: innerHTML-based rendering with no virtual DOM or diffing
- Impact: Filter dropdowns lose focus, scroll positions reset, and the page flickers on every Firestore update (which arrives every time any checklist item changes anywhere).
- Improvement path: Separate data-update renders from interaction-state renders. Cache DOM nodes for interactive elements (filters, tabs). Consider an incremental render approach for the task list items.

**Notification Subscription Opened Twice for Dashboard Users**
- Problem: `renderNav` in `components.js` opens `subscribeNotifications(user.id, ...)` for the nav bell icon. `dashboard.js` also opens `subscribeNotifications(user.id, ...)` for the notifications tab. This creates two simultaneous Firestore listeners on the same query for the same user on the dashboard page.
- Files: `js/components.js` line 255, `js/pages/dashboard.js` line 192
- Cause: No shared subscription registry
- Impact: Double Firestore reads, double network traffic for notifications on the dashboard.
- Improvement path: Lift the notification subscription to a shared module or pass the data downward from nav to page.

**Dashboard Cache May Serve Stale Approval Data**
- Problem: The sessionStorage cache (`pc_dash_{userId}`) has a 2-minute TTL. During those 2 minutes, approvals completed by other users are not reflected. This is particularly visible in the "승인 대기" tab where items may already be approved but still show as pending.
- Files: `js/pages/dashboard.js` lines 70–106
- Impact: Incorrect approval count display; observer approving an already-approved item will get a Firestore error.
- Improvement path: Cache is intended for speed only — the background `onSnapshot` subscriptions that replace it within seconds are the right approach. Consider shortening or removing the cache, or invalidating it on any write from this session.

---

## UX / UI Concerns

**No Global Error State UI**
- Problem: When Firestore operations fail (network, permissions, quota), errors are logged to `console.error` but the user sees no feedback. The page silently stays in whatever state it was in before the failure.
- Affected: All page controllers — `project-detail.js`, `projects.js`, `dashboard.js`, etc.
- Impact: Users cannot distinguish "loading" from "failed" states. Especially problematic for approval/completion actions where silent failure means real work is lost.
- Fix approach: Add a toast/banner component to `components.js` and call it in `.catch()` handlers on all mutation operations.

**`bg-grid` Class Inconsistently Applied**
- Problem: Some pages use `class="page-wrapper bg-grid"` while others use just `class="page-wrapper"`. The grid background is missing on `admin-checklists.html`, `admin-users.html`, `project.html`, `task.html`, and `manual.html`.
- Files: `admin-checklists.html` line 21, `admin-users.html` line 21, `project.html` line 21, `task.html` line 21, `manual.html` line 21
- Impact: Visual inconsistency — task/project detail pages have a flat background while dashboard and projects pages have the grid texture.
- Fix approach: Apply `bg-grid` consistently to all `page-wrapper` divs.

**Approval Action in Dashboard Has No Rejection Path**
- Problem: The "승인 대기" tab in `dashboard.js` renders a quick-approve button (checkmark icon) for each pending task. There is no corresponding quick-reject button. The only way to reject is to navigate to the task detail page.
- Files: `js/pages/dashboard.js` lines 636–637
- Impact: Observer role approval workflow is fragmented — approving can be done in one click from the dashboard but rejection requires navigating away, losing dashboard context.
- Fix approach: Add a reject button with a small inline reason input, or a confirmation popover.

**No "Back to Project" Navigation on Task Detail**
- Problem: `task.html` loads with a nav that has no breadcrumb or back link to the originating project. The browser back button is the only way to return. If the user navigated from the dashboard, back goes to dashboard, not project.
- Files: `js/pages/task-detail.js`, `task.html`
- Impact: Disorienting navigation — users lose their place in the project checklist context.
- Fix approach: Add a breadcrumb using the `projectId` query param: "프로젝트 > [project name] > [task title]" with a clickable project link.

**Mobile Navigation Shows Parent Icons for Dropdown Children**
- Problem: In `components.js` `renderNav()`, the mobile menu flattens dropdown children and uses the *parent* link's icon for each child item. For example, all "리뷰" dropdown children (wireframes, user flows, diagrams, feedback, manual, user admin) show the "리뷰" icon instead of no icon or a per-item icon.
- Files: `js/components.js` lines 199–205
- Impact: All mobile menu items under dropdowns show identical icons, making them harder to distinguish.
- Fix approach: Either omit icons for child items in mobile menu, or assign per-item icons.

**Notification Panel Click Does Not Navigate**
- Problem: In `components.js` `renderNotifPanel()`, notification items mark themselves read on click but do not navigate to the linked page. The comment at line 294 says "link navigation could be added here" — it is not implemented.
- Files: `js/components.js` line 294
- Impact: Clicking a notification in the nav bell panel marks it read but does nothing else. Users must go to `notifications.html` to follow notification links.
- Fix approach: Apply the same `convertNotifLink()` logic from `dashboard.js` to the nav notification panel click handler.

**Sales Page Has Custom Nav Instead of Standard `renderNav`**
- Problem: `js/pages/sales.js` implements its own `renderSalesNav()` function (lines 80–128) duplicating nav HTML, theme toggle, logout, and feedback widget initialization. Changes to the standard nav in `components.js` are not reflected in the sales page.
- Files: `js/pages/sales.js` lines 80–128, `js/components.js`
- Impact: Nav drift — if nav structure changes, sales page requires a separate update. The sales page also lacks the notification bell, review panel, and session watcher that `renderNav` provides.
- Fix approach: Refactor `renderNav` to accept an `options` object (e.g., `{minimal: true, brand: "SL"}`) to allow the sales page to use the shared component.

**Gantt Today Marker Has Broken CSS Calculation**
- Problem: The today marker in `renderScheduleTab()` uses two duplicate `left:` declarations with a malformed calc: `left:calc(100px + ${todayPct}% * (100% - 100px) / 100%);left:calc(100px + ${todayPct / 100 * (100)}%)`. The second declaration overrides the first, and `todayPct / 100 * 100` simply equals `todayPct`, which does not account for the 100px label offset.
- Files: `js/pages/project-detail.js` line 672
- Impact: The "오늘" marker position is wrong — it does not correctly align within the bar area that starts at 100px from the left.
- Fix approach: Use a single correct calculation: `left: calc(100px + ${todayPct}% * (100% - 100px) / 100%)` or compute the absolute pixel offset with JS.

**Inline Styles Are Pervasive in Render Functions**
- Problem: Render functions in `dashboard.js` and `project-detail.js` contain 51 and 164 inline `style="..."` attributes respectively. These hardcode color values, spacing, and layout directly in JS strings rather than using CSS classes.
- Files: `js/pages/dashboard.js`, `js/pages/project-detail.js`
- Impact: Dark/light theme overrides cannot reliably target inline styles. Refactoring layout or colors requires scanning JS string literals. Inline styles also bypass the specificity system.
- Fix approach: Extract repeated style patterns to named CSS classes in `styles.css`. At minimum, replace `style="color: var(--danger-400)"` patterns with CSS classes like `.text-danger` already available in the stylesheet.

---

## Fragile Areas

**`project-detail.js` Renders on Both Project and Checklist Subscriptions Independently**
- Files: `js/pages/project-detail.js` lines 75–83
- Why fragile: `unsubProject` and `unsubChecklist` both call `render()` independently. If a project update and a checklist update arrive within the same tick (common after bulk operations), `render()` runs twice in rapid succession, causing double DOM reconstruction and potential scroll position loss.
- Safe modification: Add a debounce or a `requestAnimationFrame` guard before `render()` calls from subscriptions.
- Test coverage: None.

**`approveTask` in Dashboard Has No Idempotency Guard**
- Files: `js/pages/dashboard.js` lines 778–791
- Why fragile: The approve button disables itself on click and shows "..." but the `onSnapshot` subscription re-renders `app.innerHTML` (including a fresh, re-enabled approve button) while the async `approveTask()` call is still in flight. A quick-clicking user can trigger multiple simultaneous approval calls for the same task.
- Safe modification: Track in-flight task IDs in a `Set` checked before calling `approveTask`.
- Test coverage: None.

**Hardcoded Checklist Phase Divisions for Template Application**
- Files: `js/firestore-service.js` `seedDatabaseIfEmpty()` line 494 — `MINOR_PHASES = ["phase0", "phase3", "phase5"]`
- Why fragile: The phase IDs for design-change "minor" projects are hardcoded as an array literal in the seed function. If phase IDs or the minor/medium/major rules change, this constant must be updated in two places (also `applyTemplateToProject`).
- Safe modification: Extract `MINOR_PHASES` and `MEDIUM_PHASES` as named exports from a shared constants module.

---

## Missing Critical Features

**File Upload UI Exists But Storage Backend Is Incomplete**
- Problem: `task.html` shows a file upload area with drag-and-drop and progress bar. `task-detail.js` imports Firebase Storage SDK and implements `uploadBytesResumable`. However, the `storage.rules` have no path-level restrictions and `addFileMetadata` / `removeFileMetadata` in `firestore-service.js` only store metadata (URL, name, size) — but the UI for listing and downloading previously uploaded files relies on these metadata entries having valid `downloadUrl` values. The full upload → metadata → display loop appears functional but has not been tested in production (per CLAUDE.md "Known Gaps").
- Files: `js/pages/task-detail.js` lines 111–148, `js/firestore-service.js` lines 2045–2060, `storage.rules`

**Stage Auto-Transition After Approval**
- Problem: When a gate stage task is approved, the project's `currentStage` is not automatically advanced to the next work stage. The project header and phase pipeline display the current phase based on a live computation over checklist items, but the `project.currentStage` field in Firestore is never updated by `approveTask`.
- Files: `js/firestore-service.js` `approveTask()`, `recalculateProjectStats()`
- Impact: Project list views and any external systems relying on `project.currentStage` show stale stage data.

**Change Request Department-level Approval Flow**
- Problem: Change requests can be approved/rejected at the project level but the domain model references individual department approvals. No per-department approval tracking exists in the data model or UI.
- Files: CLAUDE.md "Remaining Gaps"

---

## Test Coverage Gaps

**No Test Framework Exists**
- What's not tested: Everything. There are no unit tests, integration tests, or E2E tests of any kind.
- Files: All `js/` files
- Risk: All Firestore CRUD operations (`completeTask`, `approveTask`, `rejectTask`, `bulkApproveTasks`, `applyTemplateToProject`) run with zero automated verification. Auth session logic, role-based rendering decisions, and D-Day calculations are all untested.
- Priority: High — auth logic, role guards, and approval flows are the most critical to cover first.

**No Tests for Role-Based Access Control**
- What's not tested: The `user.role === "observer"` checks that gate approval actions. If the role check is accidentally removed or inverted, any worker could approve their own tasks.
- Files: `js/pages/dashboard.js` line 608, `js/firestore-service.js` `approveTask()`
- Risk: Security regression with no automated detection.
- Priority: High.

---

*Concerns audit: 2026-03-12*
