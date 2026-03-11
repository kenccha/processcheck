# Domain Pitfalls

**Domain:** Internal process management tool — hardware product development (medical devices)
**Researched:** 2026-03-12
**Confidence:** HIGH (based on direct codebase analysis + established Firebase/vanilla JS production patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or user rejection.

---

### Pitfall 1: Firestore Security Rules Left as `allow write: if true`

**What goes wrong:** All 11 collections (projects, checklistItems, templateItems, notifications, changeRequests, customers, launchChecklists, portalNotifications, users, templateStages, templateDepartments) currently have `allow write: if true`. Any person with the app URL — including non-employees — can overwrite approval statuses, delete projects, or corrupt the entire database via the browser console or curl.

**Why it happens:** Rules are written as placeholders during development with client-side checks as a temporary substitute. The `// TODO` comment signals intent but never becomes a blocker.

**Consequences:**
- A curious employee opens DevTools, runs `updateDoc(doc(db, "projects", id), { status: "completed" })` — this succeeds silently
- An unauthenticated curl request from outside the company can delete or corrupt any document
- The `approvalStatus` field — the core governance mechanism — can be freely overwritten, defeating the entire observer-only approval design
- Customer data (customers collection) is accessible and writable by anyone who discovers the Firebase project ID (which is visible in `js/firebase-init.js` loaded over the network)

**Detection warning signs:**
- Firestore Rules Simulator in Firebase Console shows "ALLOW" for unauthenticated write requests
- `firestore.rules` contains `allow write: if true` with `// TODO` comments
- Demo card login creates users with no Firebase Auth token (so `request.auth != null` is always false for demo users)

**Prevention strategy:**
1. Separate demo card authentication from production security. Demo cards must be disabled before go-live (feature flag: `const IS_DEMO_MODE = false`).
2. Implement rules based on Firebase Auth token only — not localStorage role:
   ```
   function isAuthenticated() { return request.auth != null; }
   function isObserver() { return request.auth.token.role == "observer"; }
   // projects: any authenticated user can read; only observer can modify status/approval
   allow write: if isAuthenticated();  // minimum baseline
   ```
3. For critical fields (approvalStatus, projectStatus), add field-level validation in rules using `request.resource.data`.
4. The reviews collection already has `allow write: if isAuthenticated()` — this is the pattern to replicate everywhere.

**Phase to address:** Security hardening phase (Phase 1 of production prep).

---

### Pitfall 2: Role Stored in localStorage Can Be Trivially Escalated

**What goes wrong:** `js/auth.js` stores the entire user object — including `role` — in localStorage. Any authenticated user (or attacker with XSS access) can run `localStorage.setItem("pc_user", JSON.stringify({...JSON.parse(localStorage.getItem("pc_user")), role: "observer"}))` and instantly gain approval authority over every project.

**Why it happens:** localStorage was chosen for simplicity during development. No server-side session exists. Role checks are purely client-side (`user.role === "observer"`).

**Consequences:**
- Any worker can approve their own tasks by editing localStorage
- Demo card login explicitly overrides role: `const sessionUser = { ...user, role }` (auth.js line 37) — this line must never reach production
- The medical device approval workflow (the core compliance value of the system) is technically invalid if roles can be self-escalated

**Detection warning signs:**
- `js/auth.js` line 37: `const sessionUser = { ...user, role };` — role override exists
- No server-side session validation on any page load
- Role is read from `JSON.parse(localStorage.getItem("pc_user")).role` with no server revalidation

**Prevention strategy:**
1. On every authenticated page load, re-fetch the user record from Firestore by email/UID and use that as the authoritative role — not localStorage. localStorage is only a cache, not the source of truth.
2. Remove the demo card role override before go-live. If demo cards are retained for onboarding, they must read role from Firestore like MS OAuth users.
3. Long-term: use Firebase Custom Claims (`admin.auth().setCustomUserClaims()`) to embed role in the Firebase ID token. Then Firestore rules can verify role server-side without trusting client-provided data.

**Phase to address:** Security hardening phase (Phase 1). Custom Claims is a medium-term enhancement (Phase 3+).

---

### Pitfall 3: `applyTemplateToProject()` Creates Duplicates With No Idempotency Guard

**What goes wrong:** If a user clicks "체크리스트 생성" twice (double-click, slow network, or navigating away and back), `applyTemplateToProject()` runs twice and creates 193 duplicate checklist items. There is no check whether items already exist. The batch write has no rollback if it fails mid-way.

**Why it happens:** The function writes to Firestore unconditionally. No guard query runs first. The UI disables the button only client-side, which doesn't prevent concurrent calls from different tabs or devices.

**Consequences:**
- Project has 386 checklist items instead of 193 — all visible to users, causing confusion
- Duplicate items inflate all statistics (progress %, overdue counts, D-Day calculations)
- No rollback: if the second batch write fails, the database is in an inconsistent partial state
- Cleaning up duplicates requires manual Firestore Console intervention

**Detection warning signs:**
- Function at `firestore-service.js:1415` has no pre-check query
- UI button only has `disabled` attribute (easily bypassed or irrelevant in multi-tab scenario)
- No `templateAppliedAt` or `checklistCount` field on project document

**Prevention strategy:**
1. Add an idempotency check at the top of the function:
   ```javascript
   const existing = await getDocs(query(collection(db, "checklistItems"), where("projectId", "==", projectId), limit(1)));
   if (!existing.empty) throw new Error("체크리스트가 이미 존재합니다");
   ```
2. Set a `checklistApplied: true` flag on the project document as part of the same batch write — check this flag before running.
3. Use Firestore transactions for the flag + first batch write to make the check-and-set atomic.

**Phase to address:** Data integrity phase (Phase 1 or Phase 2).

---

### Pitfall 4: Multi-Step Operations Are Not Atomic (No Transaction Wrapping)

**What goes wrong:** `approveTask()` performs 4+ sequential Firestore writes (update checklistItem, create notification, update project stats, optionally create portal notification). If any step fails, earlier writes are already committed. The database ends up in an inconsistent state: task marked "approved" but project progress not updated, or notification sent but approval status not persisted.

**Why it happens:** Each operation is a separate `await updateDoc()` / `await addDoc()`. Firestore transactions were not used. Error handling only catches and logs errors without compensating.

**Consequences:**
- Project progress (%) and risk level become wrong — dashboard D-Day calculations based on stale stats
- Observer sees "승인 대기" items that are already approved (or vice versa)
- Notifications sent for approvals that never actually committed
- These inconsistencies are nearly impossible to detect without Firestore Console access

**Detection warning signs:**
- `firestore-service.js`: `approveTask`, `completeTask`, `rejectTask`, `restartTask` all use sequential `await` without wrapping in `runTransaction()`
- Catch blocks: `catch (e) { console.error(...); }` — no compensating actions
- `recalculateProjectStats()` is called after the primary write, so it will silently fail if the network drops between them

**Prevention strategy:**
1. Wrap the core status update + project stat recalculation in a Firestore transaction:
   ```javascript
   await runTransaction(db, async (tx) => {
     tx.update(taskRef, { approvalStatus: "approved", approvedBy, approvedAt });
     tx.update(projectRef, { progress: newProgress, currentStage: newStage });
   });
   // Notifications are fire-and-forget after the transaction succeeds
   ```
2. Notifications can remain non-transactional (fire-and-forget) since they are informational only — but the core data mutation must be atomic.
3. Add `Promise.allSettled` for notification writes to surface partial failures to users without blocking the primary operation.

**Phase to address:** Data integrity phase (Phase 1 or Phase 2).

---

### Pitfall 5: User Rejection — Too Much Visible Before Users Understand the System

**What goes wrong:** Internal tools for ~100 users across 10 departments fail when first-time users open the dashboard and see unfamiliar concepts (D-Day, phase pipeline, 4 tabs, checklist items with no assignee) without context. Users create tickets to IT, revert to spreadsheets, or just stop using the system.

**Why it happens:** Developers are familiar with the system's model. New users are not. The system was designed for power users who understand the 6-phase hardware development process — but workers in manufacturing or QA who only need to see their own tasks are shown the full project complexity.

**Consequences:**
- Adoption rate stays low — the tool fails its core mission of cross-department visibility
- Managers pressure IT to simplify or replace the tool
- Users make mistakes (completing wrong tasks, approving in wrong phase) due to confusion

**Detection warning signs:**
- The dashboard "작업" tab shows tasks from ALL projects to a worker — not filtered to their current assignments
- Empty state screens (no projects, no tasks) show blank space with no guidance
- First-time MS OAuth users land on dashboard with no department set and see "0건" everywhere

**Prevention strategy:**
1. Implement role-adaptive onboarding: workers see only their assigned tasks on first login; the full project view is a deliberate "zoom out" action.
2. Add empty state messaging: "작업이 없습니다. 매니저가 작업을 배분하면 여기에 표시됩니다."
3. New user first login (worker with no department): show a prompt "아직 부서가 지정되지 않았습니다. 관리자에게 문의하세요" instead of empty dashboard.
4. Build a short contextual tooltip or overlay for first-time users explaining D-Day and the phase pipeline.

**Phase to address:** UX stabilization phase (Phase 2).

---

## Moderate Pitfalls

---

### Pitfall 6: Firestore Subscription Leaks on Page Navigation

**What goes wrong:** Pages that don't clean up `onSnapshot` listeners correctly (notably `sales.js`, which has no unsubscriber array) keep Firebase WebSocket connections alive after navigation. Over a multi-hour session with repeated page visits, memory usage grows and Firestore read costs accumulate.

**Why it happens:** `sales.js` subscribes to `subscribeProjects` and `subscribeAllLaunchChecklists` but stores no references to the unsubscriber functions. The `window.beforeunload` cleanup pattern that `dashboard.js` uses correctly is absent.

**Consequences:**
- At 100 users each navigating 10 pages/day: phantom subscriptions multiply Firestore read costs by 2-4x
- Memory leaks manifest as browser tabs slowing down after 2+ hours of use
- `onSnapshot` callbacks fire after the user has navigated away, potentially calling `.innerHTML` on DOM elements that no longer exist (silent JS errors)

**Detection warning signs:**
- `sales.js` lines 138-150: `subscribeProjects()` and `subscribeAllLaunchChecklists()` return values discarded
- No `window.addEventListener("beforeunload", ...)` in `sales.js`
- Pattern in `dashboard.js` (correct): `unsubscribers.push(subscribeProjects(callback)); window.addEventListener("beforeunload", () => unsubscribers.forEach(fn => fn && fn()))`

**Prevention strategy:**
- Audit all page JS files for subscribe calls that don't push to an unsubscribers array
- Add the unsubscriber pattern as a mandatory template in any new page
- Create a helper: `function trackSubscription(fn) { unsubscribers.push(fn); }`

**Phase to address:** Stability phase (Phase 1 or Phase 2).

---

### Pitfall 7: Timestamp Conversion Bug Causes "Invalid Date" and Wrong D-Day

**What goes wrong:** `toDate()` in `firestore-service.js` handles `Timestamp.toDate()`, plain `Date`, strings, and numbers — but not the raw `{seconds, nanoseconds}` plain object that Firestore sometimes returns (e.g., when data is read from cache or from a batch write result). This produces `Invalid Date` for D-Day calculations and "NaN days until" in the UI.

**Why it happens:** Firestore's `Timestamp` class has a `.toDate()` method, but when serialized to/from sessionStorage cache or passed through `JSON.parse`, the Timestamp becomes a plain object `{seconds: N, nanoseconds: N}` without the method.

**Consequences:**
- Project cards show "D-NaN" for deadline-critical projects — users distrust the data
- `daysUntil()` returns `null` for items that should be flagged as overdue — urgency grouping breaks
- Cached dashboard data (sessionStorage) always has this bug since JSON.stringify strips Timestamp methods

**Detection warning signs:**
- Dashboard reopened after sessionStorage cache is populated shows "Invalid Date" in some project cards
- `toDate()` at `firestore-service.js:14-19` missing the `{seconds, nanoseconds}` case
- `loadFromCache()` in dashboard.js reconstructs dates from `JSON.parse` (which loses Timestamp type)

**Prevention strategy:**
```javascript
function toDate(val) {
  if (val && typeof val.toDate === "function") return val.toDate();
  if (val && typeof val.seconds === "number") return new Date(val.seconds * 1000); // plain object case
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}
```
This single line fix prevents the most visible data display bug.

**Phase to address:** Bug fix phase (Phase 1, high priority because it affects core D-Day display).

---

### Pitfall 8: Modals Frozen on Network Error

**What goes wrong:** When creating a checklist item or approving a task fails due to a network error, the modal overlay stays visible and the submit button stays disabled. The only recovery is a full page refresh. Users lose whatever they had typed.

**Why it happens:** `try/catch` blocks log the error but don't include `finally { overlay.remove(); btn.disabled = false; }`. The happy path closes the modal; the error path does not.

**Consequences:**
- Users see a frozen UI and assume the action succeeded or that the app is broken
- Users refresh, re-enter data, and the action runs again — potentially creating duplicates (compounded by Pitfall 3)
- Users lose trust in the tool after the first network hiccup

**Detection warning signs:**
- `project-detail.js` lines 1116-1119: `catch (err) { alert(...); }` — no `finally` block
- `admin-checklists.js` lines 161-173: same pattern
- No `btn.disabled = false` in error path in any modal handler

**Prevention strategy:**
- Add `finally` blocks to all modal submit handlers
- Show an inline error message within the modal rather than `alert()` (alert blocks the UI and is harder to dismiss on mobile)
- Add a toast/snackbar system for operation results so users have consistent feedback

**Phase to address:** UX stabilization phase (Phase 2).

---

### Pitfall 9: Missing Project Validation Causes Infinite Spinner

**What goes wrong:** If a project is deleted and someone follows an old link to `project.html?id=<deleted-id>`, the page subscribes to all projects and waits forever for a match that never arrives. The spinner never stops.

**Why it happens:** `project-detail.js` checks that `projectId` is present in the URL, but after subscribing to projects, it never times out or handles the case where no matching project is found in the snapshot.

**Consequences:**
- Shared project links (in notifications, emails, chat) break silently after the project is completed/archived
- Users assume the system is broken
- The 13 auto-generated notification links in the notification system all use `project.html?id=X` — any deleted project creates dead links

**Detection warning signs:**
- `project-detail.js` lines 41-45: checks `if (!projectId) redirect()` but no Firestore "not found" handling
- No timeout after projects subscription delivers data
- Completed/archived projects are not truly deleted but could be in the future

**Prevention strategy:**
- After the first `onSnapshot` callback returns, check if the project exists: if `allProjects.length > 0 && !foundProject`, render a "프로젝트를 찾을 수 없습니다" error card
- Add a 5-second timeout fallback as a safety net
- Notification links should always be verified at notification creation time (project still exists)

**Phase to address:** Stability phase (Phase 1).

---

### Pitfall 10: Firestore Read Cost Explosion at Scale

**What goes wrong:** `subscribeAllLaunchChecklists()` (sales.js) and `subscribeAllChecklistItems()` (dashboard.js for observers) load entire collections with no query filters. With 50 design changes/month × 100 checklist items each, the launchChecklists collection reaches 5,000+ items in year one. Every sales dashboard load reads all 5,000+ items.

**Why it happens:** Firestore queries were written for the development data size (dozens of items). Client-side filtering was easier to implement than composite Firestore indexes.

**Consequences:**
- Free tier (50K reads/day) exceeded at ~10 daily active users once data grows past year one
- Dashboard load time degrades from 200ms to 2-5 seconds as collection grows
- Users abandon slow pages and the tool loses adoption

**Detection warning signs:**
- `firestore-service.js`: `subscribeAllLaunchChecklists` uses `onSnapshot(collection(db, "launchChecklists"), ...)` with no `where()` clause
- `subscribeAllChecklistItems` similarly unfiltered
- Firestore Console Usage tab showing read counts growing monthly

**Prevention strategy:**
1. Add Firestore `where` + `limit` to every subscription that loads unbounded collections
2. For the sales dashboard: query by `projectId` or by `status != "archived"` to reduce read set
3. For notifications: add `orderBy("createdAt", "desc"), limit(50)` — most users only need recent 50
4. Create composite indexes for common queries: `(projectId, status)`, `(assignee, status, dueDate)`
5. Implement a periodic archival job (Cloud Function or manual) that moves completed old data

**Phase to address:** Performance phase (Phase 3). Not critical for 100 users initially but needs planning before data grows.

---

### Pitfall 11: Demo Card Login Must Not Reach Production Users

**What goes wrong:** `index.html` currently shows 3 demo login cards (김철수, 이영희, 박민수) with role override. If these remain visible in production, any employee can log in as `observer` (기획조정실) and approve any task — bypassing the company's governance process.

**Why it happens:** Demo cards were kept alongside MS OAuth for developer convenience. CLAUDE.md confirms demo cards are "for development" but there is no build-time or runtime gate disabling them.

**Consequences:**
- Any worker can click "박민수 (기획조정실)" and gain full approval authority
- Hardcoded emails (`chulsoo@company.com`) don't match real InBody employees — any login as these names creates phantom users in the system
- Audit trails are meaningless if anyone can act as observer

**Detection warning signs:**
- `index.html` contains demo card buttons with hardcoded names and roles
- `auth.js` line 37: `const sessionUser = { ...user, role };` — role override from UI
- No feature flag or environment variable controlling demo card visibility

**Prevention strategy:**
- Gate demo cards behind a URL parameter or local-only check: `if (location.hostname === "localhost" || location.hostname === "127.0.0.1") { showDemoCards(); }`
- Firebase Hosting deployed URL (`*.web.app`, custom domain) will never match localhost — demo cards invisible in production automatically
- Alternatively, remove demo card HTML entirely from production deployment via CI/CD step

**Phase to address:** Security hardening phase (Phase 1, must-fix before go-live).

---

## Minor Pitfalls

---

### Pitfall 12: HTML Injection via Unescaped innerHTML

**What goes wrong:** Multiple pages render user-provided data (task titles, assignee names, project names, comments) via `innerHTML` without consistently calling `escapeHtml()`. If an employee enters `<img src=x onerror=alert(1)>` as a project name, it executes in other users' browsers.

**Why it happens:** `escapeHtml()` exists in `utils.js` and is used in many places, but not all. Template literal HTML construction (`overlay.innerHTML = \`...\``) makes it easy to accidentally skip escaping.

**Detection warning signs:**
- `dashboard.js` lines 361, 783; `project-detail.js` line 1135; `projects.js` line 250: innerHTML assignments
- Not all user-sourced fields are wrapped in `escapeHtml()`

**Prevention strategy:**
- Audit all `innerHTML` assignments, verify `escapeHtml()` wraps every variable interpolated from user data
- Consider a lint rule or code review checklist item: "Any `innerHTML` assignment must use `escapeHtml()` on all dynamic values"
- For comments (which may use light markdown), ensure `renderSimpleMarkdown()` does not allow arbitrary HTML tags

**Phase to address:** Security hardening phase (Phase 1).

---

### Pitfall 13: Bulk Operations Fail Partially Without User Feedback

**What goes wrong:** "Bulk approve" on the dashboard runs `approveTask()` for N items using `Promise.allSettled`. If 3 of 10 fail, the success notification says "10개 처리 완료" without surfacing the failures.

**Why it happens:** `dashboard.js` bulk approve (line 779-789) uses `Promise.allSettled` correctly but doesn't differentiate fulfilled vs rejected results in the success message.

**Detection warning signs:**
- `dashboard.js` `bulkApproveTasks()`: result handling doesn't count rejections

**Prevention strategy:**
- After `Promise.allSettled`, count successes and failures: `showFeedback("info", \`승인 완료: ${succeeded}건. 실패: ${failed}건.\`)`
- Log failures with task IDs so users know which items need manual retry

**Phase to address:** Stability phase (Phase 2).

---

### Pitfall 14: No Expiration on localStorage Session

**What goes wrong:** A user logs in, leaves for a month, returns — and is still "logged in" with potentially a stale role. If an admin downgraded that user's role in Firestore, the localStorage session still shows the old role.

**Why it happens:** `localStorage.setItem(STORAGE_KEY, ...)` stores without expiration. There is no validation of session age on page load.

**Detection warning signs:**
- `auth.js` `getUser()` returns stored data with no freshness check
- No `loginAt` timestamp stored with session
- Admin role changes in `admin-users.html` don't invalidate active sessions

**Prevention strategy:**
- Store `loginAt: Date.now()` with the session and reject sessions older than 24 hours
- On every MS OAuth page load, re-validate role from Firestore (one read per session tab, cached in memory)
- When admin updates a user's role in `admin-users.html`, optionally write a `roleUpdatedAt` field — page load checks if localStorage session is older than this

**Phase to address:** Security hardening phase (Phase 2).

---

### Pitfall 15: Hardcoded Azure AD Tenant ID in Client-Side Code

**What goes wrong:** `js/auth.js` line 46 hardcodes the InBody Azure AD tenant UUID. This is visible to anyone who views page source. If the company migrates to a different Azure tenant or wants a staging environment with a different tenant, this requires a code change.

**Why it happens:** No environment configuration exists for the HTML port (no build step, no `.env` equivalent).

**Detection warning signs:**
- `auth.js` line 46: `tenant: "547afe76-db4a-45d9-9af8-c970051a4c7d"` — hardcoded UUID

**Prevention strategy:**
- Move tenant ID to `js/firebase-init.js` alongside other Firebase config constants
- Document in CLAUDE.md that this value must be updated if Azure tenant changes
- For staging vs production: use a thin config file (`js/env-config.js`) with different values per environment

**Phase to address:** Low priority — document and defer unless multi-environment support is required.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Security rules hardening | Demo card bypass survives rules change (Firestore rules secure but client still allows demo cards) | Disable demo cards AND fix rules in same PR |
| Template → checklist generation | Double-apply creates duplicate items that corrupt all stats | Add idempotency check before any UX work that touches this flow |
| Firestore transaction work | Non-atomic multi-step operations cause silent data drift | Fix approveTask/completeTask/rejectTask atomicity before adding more automation |
| UX improvements | Fixing visible symptoms (empty states, loading states) masks deeper role/data trust issues | Resolve auth trust model first; UX polish only after data integrity is confirmed |
| Notification system expansion | Unbounded notifications collection grows fast | Add query limits and read/unread pagination before adding more notification triggers |
| Storage / file upload | Firebase Storage rules are likely also open | Review Storage rules at same time as Firestore rules |
| First production users onboarding | Workers with no department assigned see broken dashboard | Add "pending department" empty state before inviting real users |
| Performance optimization | Premature optimization vs. actual bottleneck | Profile Firestore Console reads first — optimize only subscriptions exceeding 10K reads/day |

---

## Sources

- Direct codebase analysis: `firestore.rules`, `js/auth.js`, `js/firestore-service.js`, `js/pages/dashboard.js`, `js/pages/sales.js`, `js/pages/project-detail.js`
- Project context: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`
- Firebase Firestore security model: rules are enforced server-side; client-side role checks provide no security guarantee (HIGH confidence — this is a fundamental Firebase architectural principle)
- localStorage XSS risk: browser security model — any JS on the same domain can read localStorage (HIGH confidence — established browser security principle)
- Firestore read cost at scale: Firebase pricing documentation — 50K free reads/day on Spark plan (HIGH confidence — public Firebase pricing)
- Internal tool adoption failure patterns: based on established patterns from enterprise tool deployments and the specific UX issues identified in codebase analysis (MEDIUM confidence — pattern-based, not empirically measured for this app)
