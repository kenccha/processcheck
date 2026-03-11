# Codebase Concerns

**Analysis Date:** 2026-03-12

## Security Issues

**Firestore Rules — Overly Permissive:**
- Issue: All collections (projects, checklistItems, templateItems, notifications, changeRequests, customers, launchChecklists, portalNotifications) have `allow write: if true` with only inline comments indicating client-side enforcement
- Files: `firestore.rules` (lines 26, 32, 38, 44, 50, 56, 62, 68, 74, 80)
- Impact: Any unauthenticated user or compromised client can modify, delete, or corrupt critical business data (project schedules, approval statuses, customer information)
- Current mitigation: Client-side role checks in JavaScript (e.g., `user.role === "observer"`)
- Recommendations:
  - Implement proper Firestore security rules: `allow write: if request.auth != null && request.auth.token.role == "observer"` for write-restricted collections
  - Use `isAuthenticated()` helper (line 7-8) in all write rules
  - Validate `request.resource.data` structure server-side for critical fields (approvalStatus, projectStatus, etc.)
  - Document why reviews collection alone requires `isAuthenticated()` (line 86) vs. others

**Demo Card Authentication:**
- Issue: Demo card login (`js/auth.js:24-40`) creates users with hardcoded role override (line 37: `const sessionUser = { ...user, role };`)
- Files: `js/auth.js` (lines 24-40), `js/pages/login.js` (card login UI)
- Impact: Anyone can log in as any role (worker/manager/observer) with demo cards; no email validation
- Current mitigation: Demo cards are for development; production relies on Microsoft OAuth
- Recommendations:
  - Disable demo cards in production (use feature flag or environment check)
  - If keeping for testing, restrict to IP whitelist or special domain only
  - Never allow role override on client-side; role must come from server (Firestore user record)

**Email Domain Restriction Incomplete:**
- Issue: Microsoft OAuth restricts to `@inbody.com` domain (`js/auth.js:10, 55`), but auto-registration as `worker` bypasses admin role assignment verification
- Files: `js/auth.js` (lines 54-79)
- Impact: Any @inbody.com email can register as worker/observer depending on intent; no audit of who created accounts
- Current mitigation: Manual admin adjustment post-registration via admin-users.html
- Recommendations:
  - Log all Microsoft OAuth registrations with timestamp, email, auto-assigned role
  - Add webhook to alert admin of new user registrations
  - Implement user approval flow: new user → "pending" role until admin approves

**HTML Injection via innerHTML:**
- Issue: Multiple pages use `innerHTML` to render dynamic content without consistent HTML escaping
- Files: `js/pages/dashboard.js` (line 361, 783), `js/pages/admin-checklists.js` (line 1137, 1146), `js/pages/project-detail.js` (line 1135, 1202), `js/pages/projects.js` (line 250)
- Impact: If comment text, assignee names, or stage descriptions contain `<script>`, `<img onerror>`, or `<svg onload>`, could execute arbitrary JavaScript
- Current mitigation: `escapeHtml()` function exists (`js/utils.js:154-158`) using `textContent` approach
- Recommendations:
  - Audit all `innerHTML` assignments; verify `escapeHtml()` is called on all user-sourced data (comments, task titles, project names)
  - Replace `innerHTML` with `textContent` + template strings where possible
  - Sanitize HTML in `renderSimpleMarkdown()` (js/utils.js:190-201) — currently allows HTML entities but not tags

---

## Tech Debt

**Large Monolithic Files:**
- Files:
  - `js/firestore-service.js` (2,060 lines) — all CRUD + subscriptions in one file
  - `js/pages/sales.js` (1,694 lines) — sales dashboard UI + logic
  - `js/pages/admin-checklists.js` (1,313 lines) — 3 view modes (matrix/tree/list) + CRUD
  - `js/pages/projects.js` (1,292 lines) — 7 view modes + filtering + sorting
  - `js/pages/project-detail.js` (1,231 lines) — 3 tabs + 5 checklist views + matrix + export

- Impact:
  - Hard to debug; multiple concerns mixed together
  - Difficult to reuse code across pages (e.g., project subscription used in dashboard, project-detail, sales)
  - Expensive to test changes to one feature without regression in others
  - Maintenance burden: finding where a specific function is defined requires searching 1000+ lines

- Recommendations:
  - Refactor `firestore-service.js` into domain modules:
    - `services/projects.js` (subscribeProjects, updateProject, etc.)
    - `services/checklists.js` (subscribeChecklistItems, completeTask, etc.)
    - `services/templates.js` (subscribeTemplateItems, applyTemplateToProject)
    - Keep `firestore-service.js` as barrel export
  - Extract view rendering functions into separate files (e.g., `views/matrix-view.js`, `views/timeline-view.js`)
  - Create shared utility modules: `helpers/filter.js`, `helpers/sort.js`, `helpers/format.js`

**Unsubscribe Management — Incomplete:**
- Issue: Some pages track unsubscribers correctly (`js/pages/dashboard.js:65-110`, `js/pages/task-detail.js:66-85`), but others don't
- Files: `js/pages/sales.js` (no unsubscriber tracking for projects/launchChecklists subscriptions, lines 138-150)
- Impact: Firestore `onSnapshot` listeners remain active even after navigating away, consuming quota + memory leaks
- Current pattern (correct): `const unsubscribers = []; unsubscribers.push(...); window.addEventListener("beforeunload", ...)` (dashboard.js)
- Recommendations:
  - Audit ALL pages: grep for `subscribe*` calls not assigned to unsubscriber array
  - Create helper: `subscribeWithCleanup(callback)` that auto-registers with cleanup array
  - Add page unload handler pattern to every page:
    ```javascript
    const unsubscribers = [];
    window.addEventListener("beforeunload", () => {
      unsubscribers.forEach(fn => fn && fn());
    });
    ```

**Missing Error Recovery:**
- Issue: Failed Firestore operations log errors but don't recover gracefully
- Files: `js/firestore-service.js` (lines 897, 1003, 1038, 1121, 1191), `js/pages/project-detail.js` (line 1119), `js/pages/sales.js` (lines 1495, 1512, 1528, 1542, 1612, 1667, 1686)
- Impact: Users see spinner forever if Firestore fails; no retry logic; no user-facing error message in most cases
- Current pattern: `catch (e) { console.error(...); }` — logs error but doesn't stop spinner or notify user
- Recommendations:
  - Implement retry logic with exponential backoff for failed writes:
    ```javascript
    async function retryOperation(fn, maxRetries = 3, delayMs = 1000) {
      for (let i = 0; i < maxRetries; i++) {
        try { return await fn(); }
        catch (e) {
          if (i === maxRetries - 1) throw e;
          await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
        }
      }
    }
    ```
  - Show user feedback on error: `showFeedback("error", "작업 저장 실패. 다시 시도해주세요.")` (pattern from task-detail.js:762)
  - Add global error boundary for unhandled promise rejections

**Hardcoded Role Logic:**
- Issue: Role-based access control is spread across multiple files with hardcoded strings
- Files:
  - `js/auth.js` (line 10: hardcoded "inbody.com" domain)
  - `js/utils.js` (line 95-99: role name mapping)
  - `js/pages/admin-checklists.js` (line 25: `if (user.role !== "observer")` check)
  - `js/pages/dashboard.js` (line 167: conditional subscription based on role)
  - `js/pages/admin-users.js` (line 27: `if (user.role !== "observer")` check)

- Impact: Changing role names or adding new roles requires updating multiple files; easy to miss a spot and create permission bypass
- Recommendations:
  - Create `js/auth-constants.js` with:
    ```javascript
    export const ROLES = {
      WORKER: "worker",
      MANAGER: "manager",
      OBSERVER: "observer",
    };
    export const ROLE_PERMISSIONS = {
      [ROLES.WORKER]: ["view:own-tasks", "create:comments"],
      [ROLES.MANAGER]: ["assign:tasks", "view:team"],
      [ROLES.OBSERVER]: ["approve:all", "edit:templates"],
    };
    ```
  - Create `canUserAction(user, action)` helper that checks permissions centrally

---

## Performance Bottlenecks

**Unfiltered Real-Time Subscriptions:**
- Issue: Some pages subscribe to ALL items, then filter client-side
- Files:
  - `js/pages/admin-checklists.js` (line 54: `subscribeAllTemplateItems(callback)` loads all 193 template items for matrix/list view)
  - `js/pages/sales.js` (line 145: `subscribeAllLaunchChecklists()` loads entire launchChecklists collection, then filters by project/status)
  - `js/pages/project-detail.js` (line 80: `subscribeChecklistItems(projectId)` correctly scoped by projectId ✓)

- Impact:
  - As template/launch data grows, initial load becomes slower
  - Each page render iterates through all items to filter
  - High Firestore document read cost

- Recommendations:
  - Implement Firestore `query(where(...))` in subscribeAllLaunchChecklists:
    ```javascript
    export function subscribeLaunchChecklistsByStatus(status, callback) {
      const q = query(collection(db, "launchChecklists"), where("status", "==", status));
      return onSnapshot(q, snap => callback(snap.docs.map(d => docToLaunchChecklist(d.id, d.data()))));
    }
    ```
  - For template items, add query by phase/department to admin-checklists.js
  - Cache filtered results in state, re-query only when filters change

**Missing Pagination:**
- Issue: Pages load all data and render all rows; no pagination for large lists
- Files:
  - `js/pages/projects.js` (table/matrix/card views render all projects, could be 100+)
  - `js/pages/notifications.js` (renders all notifications, could be 1000s)
  - `js/pages/activity.js` (activity log has no limit)

- Impact: Initial render is slow; browser memory usage grows; scrolling becomes janky
- Recommendations:
  - Implement virtual scrolling or pagination (load 50 items initially, "Load more" button)
  - For notifications, store read/unread flag and show recent 30 by default
  - Add query limits: `query(collection(...), orderBy("createdAt", "desc"), limit(50))`

**Expensive Recalculations on Every Render:**
- Issue: Matrix views (project-detail.js, admin-checklists.js) recalculate cell data on every render
- Files: `js/pages/project-detail.js` (lines 89-97: `getMatrixCellData()` called for each cell), `js/pages/admin-checklists.js` (similar pattern in matrix rendering)
- Impact: O(n²) or O(n³) complexity if there are many stages/departments/items
- Recommendations:
  - Memoize `getMatrixCellData()` results:
    ```javascript
    const matrixCache = new Map();
    function getMatrixCellData(stageName, dept) {
      const key = `${stageName}|${dept}`;
      if (matrixCache.has(key)) return matrixCache.get(key);
      const result = { /* calculation */ };
      matrixCache.set(key, result);
      return result;
    }
    // Clear cache in render() when checklistItems change
    ```
  - Use DocumentFragment for bulk DOM updates instead of string concatenation + innerHTML

---

## Fragile Areas

**Browser Storage (localStorage/sessionStorage) for Authentication:**
- Files: `js/auth.js` (entire file), `js/pages/dashboard.js` (lines 74-101 CACHE_KEY), `js/pages/customer-portal.js` (lines 42, 418, 439)
- Why fragile:
  - localStorage is readable by any script on the domain (XSS vulnerability)
  - Stored user object includes role — if XSS exists, attacker can elevate themselves to observer
  - No expiration on localStorage (user stays logged in forever, even if account is revoked)
  - Sync across tabs: if user revokes permission in one tab, other tabs still have cached role

- Safe modification approach:
  - Use HTTP-only cookies instead of localStorage (requires backend)
  - Add expiration: store `expiresAt` and validate on each access
  - Remove stored user after 24h of inactivity
  - Regenerate role from server on page load (call `getUserByEmail()` first)
  - Clear all tabs on logout: use `storage` event listener to detect logout in other tabs

**Template → Project Checklist Generation:**
- Files: `js/firestore-service.js` (lines 1408-1490: `applyTemplateToProject()`)
- Why fragile:
  - No idempotency check: calling twice creates duplicate items
  - If Firestore write fails mid-batch, items are partially created (no rollback)
  - Hardcoded MINOR_PHASES (line 1423) — if phase structure changes, logic breaks silently
  - No validation that template data exists before referencing it (lines 1441-1448)

- Safe modification approach:
  - Check if checklistItems exist before generating: `if (await hasChecklistItems(projectId)) return 0;`
  - Use transaction instead of batch to ensure atomicity
  - Add error handling: if batch commit fails, rollback any added items
  - Move MINOR_PHASES to config constant (`js/auth-constants.js`)
  - Validate all template lookups before use

**Complex State Management in Large Pages:**
- Files: `js/pages/sales.js` (state: allItems, projects, viewMode, filters, selection state, expanded sets, pending confirm, bulk mode)
- Why fragile:
  - Multiple state sources of truth: viewMode + expanded state, selectedItems + bulkMode
  - State updates scattered across click handlers; no centralized state machine
  - If user clicks "Bulk start" then immediately changes view, pending bulk operation may update wrong items
  - Modal dialog state (`pendingConfirmId`) could leak if render fails

- Safe modification approach:
  - Create state reducer: `function appStateReducer(state, action) { switch (action.type) { ... } }`
  - Centralize all state updates in dispatch function
  - Add invariant checks: `console.assert(selectedItems.size === 0 || bulkMode, "State violation")`
  - Add loading/error flags to prevent concurrent operations

---

## Known Bugs

**Firestore Timestamp Conversion Edge Case:**
- Symptoms: Date fields sometimes show as "Invalid Date" or "NaN days until"
- Files: `js/firestore-service.js` (lines 14-19: `toDate()` fallback), `js/utils.js` (lines 137-143: `daysUntil()`)
- Trigger: When Firestore returns a timestamp as a plain JS object (not Timestamp instance)
- Current code: `if (val instanceof Date) return val; if (typeof val === "string" || typeof val === "number") return new Date(val);` — does NOT handle `{seconds, nanoseconds}` format
- Workaround: None — dates will be invalid
- Fix: Add case for Firestore Timestamp format:
  ```javascript
  function toDate(val) {
    if (val && typeof val.toDate === "function") return val.toDate();
    if (val && typeof val.seconds === "number") return new Date(val.seconds * 1000); // Timestamp object
    if (val instanceof Date) return val;
    if (typeof val === "string" || typeof val === "number") return new Date(val);
    return new Date();
  }
  ```

**Modal Overlay Not Closed on Error:**
- Symptoms: Create checklist item modal stays open if network error occurs; user must refresh page
- Files: `js/pages/project-detail.js` (lines 1116-1119: try/catch doesn't close modal), `js/pages/admin-checklists.js` (lines 161-173: same pattern)
- Trigger: Fill form, click create, network fails mid-request
- Workaround: Manual page refresh
- Fix: Store modal reference, close in finally block:
  ```javascript
  try {
    await createChecklistItem(...);
  } catch (err) {
    alert("실패: " + err.message);
  } finally {
    overlay.remove(); // Always close modal
  }
  ```

**Missing Project ID Validation:**
- Symptoms: If project doesn't exist, project-detail page shows spinner forever
- Files: `js/pages/project-detail.js` (lines 41-45: checks projectId exists in URL but not in Firestore)
- Trigger: Share project link, then delete project, click old link
- Current behavior: Subscribes to projects, waits indefinitely for project match that never comes
- Fix: Add timeout or check:
  ```javascript
  setTimeout(() => {
    if (!project) {
      app.innerHTML = `<div class="card p-6 mt-6"><p>프로젝트를 찾을 수 없습니다.</p></div>`;
    }
  }, 5000);
  ```

**Bulk Operations Not Atomic:**
- Symptoms: If "Bulk approve 10 tasks" fails on task 7, user doesn't know 6 succeeded and 3 failed
- Files: `js/pages/dashboard.js` (line 779-789: `bulkApproveTasks()` has no per-item error tracking), `js/pages/sales.js` (lines 1667, 1686: bulk start/complete)
- Trigger: Network flaky, some requests timeout
- Workaround: Retry individual tasks manually
- Fix: Return per-item results:
  ```javascript
  const results = await Promise.allSettled(taskIds.map(id => approveTask(id)));
  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  showFeedback("info", `성공: ${succeeded}, 실패: ${failed}`);
  ```

---

## Scaling Limits

**Firestore Read Cost — No Query Optimization:**
- Current usage pattern: Every dashboard.js load does `subscribeProjects()` (reads all docs) + `subscribeChecklistItemsByAssignee()` (scoped by assignee)
- At scale (100 projects, 10,000 checklist items), initial dashboard render triggers ~11,000 reads
- With 100 daily active users, that's 1.1M reads/day from dashboard alone
- Firestore generous free tier (50K reads/day) will be exceeded at ~5 DAU

- Scaling path:
  - Implement pagination: `subscribeProjects(limit: 20)` + lazy load more on scroll
  - Use composite indexes for filtered queries: `WHERE department == X AND status == "in_progress" ORDER BY dueDate`
  - Cache read results client-side with TTL: refresh only every 60s unless user forces refresh
  - Implement read coalescing: if multiple pages ask for same data in same second, share subscription

**Data Size Growth — No Archive/Cleanup:**
- Issue: `launchChecklists` and `notifications` collections grow unbounded
- At scale (1000 products/year × 10 launch categories × 100 customers = 1M launch checklist items), firestore becomes slow
- Same for notifications: 10 teams × 5 actions/day = 50 notifications/day × 365 days = 18,250 notifications/year, explodes with years
- Impact: Slow queries, slower backups, higher storage cost

- Scaling path:
  - Archive completed notifications/launch checklists to separate collection after 90 days
  - Add retention policy: delete archived items after 2 years
  - Implement pagination with cursor-based pagination (not offset) for efficiency
  - Move historical data to BigQuery via Cloud Firestore export for analytics

**No Rate Limiting on Firestore Writes:**
- Issue: Any user can spam writes (e.g., click "approve" 1000x, update same item repeatedly)
- Impact: Quotas exhausted, write failures for legitimate users, potential cost spike

- Scaling path:
  - Implement client-side debouncing: `updateProject()` calls debounced to 500ms
  - Firestore Rules: `allow write: if request.time - resource.data.__lastUpdate > duration.value(1, 's')`
  - Add rate limiting middleware (if using Cloud Functions)

---

## Missing Critical Features

**No Transaction/Rollback Support:**
- Problem: If "approve task" operation includes:
  1. Update checklistItem.approvalStatus
  2. Update checklistItem.approvedBy
  3. Create notification
  4. Update project.progress

  And step 3 fails, steps 1-2 are already committed (no rollback)

- Impact: Data inconsistency (task marked approved but notification never sent, project progress wrong)
- Files: `js/firestore-service.js` (approveTask, completeTask, etc. — no transaction wrapping)
- Fix: Use Firestore transactions or implement compensating actions

**No Audit Trail:**
- Problem: Who approved task X? When did project status change? No history.
- Impact: Can't track who made critical decisions for compliance/debugging
- Files: No audit collection exists
- Recommendation: Add `auditLogs` collection:
  ```javascript
  {
    userId, userName, action, targetId, targetType, timestamp,
    changedFields: { approvalStatus: ["pending", "approved"] }
  }
  ```

**No Conflict Resolution for Concurrent Edits:**
- Problem: If two managers edit same checklist item simultaneously, one change is lost
- Impact: Data loss on concurrent edits
- Recommendation: Use client-side timestamps + last-write-wins or operational transforms

---

## Test Coverage Gaps

**Zero Automated Tests:**
- What's not tested: Any function, any page, any integration
- Files: No test files found (`*.test.js`, `*.spec.js`, `jest.config.js`, `vitest.config.js`)
- Risk: High — changes to Firestore schema, auth logic, or filtering could break silently
- Priority: High

- Recommendation:
  - Set up Vitest (lightweight, modern, works with ES modules)
  - Write unit tests for utilities (`utils.js` date formatting, filtering, escaping)
  - Write integration tests for Firestore service (mock Firebase SDK)
  - Write e2e tests for critical flows: login → create project → approve task → view dashboard
  - Target: 60%+ coverage for business logic files

**Manual Testing Dependency:**
- All QA happens via manual browser testing (no CI checks)
- Impact: Regressions caught late, deployment risk high
- Recommendation: Integrate tests into CI/CD (GitHub Actions → `npm run test` before deploy)

---

## CSS & Design Fragility

**Hardcoded Color/Spacing Values:**
- Issue: Colors and sizing scattered across `css/styles.css` and hardcoded in JS
- Files:
  - `css/styles.css` (CSS custom properties defined, good ✓)
  - `js/pages/sales.js` (line 90: hardcoded `color:#f59e0b` in HTML string)
  - `js/pages/project-detail.js` (various inline styles)

- Impact: Theme changes require updating CSS + JS; hard to maintain consistent design
- Recommendation: Export CSS variables to JavaScript or use utility classes instead of inline styles

**Responsive Design Gaps:**
- Issue: Page built for desktop; mobile experience not tested
- Files: All `.html` files lack viewport testing
- Impact: On mobile, wide tables overflow, modals might not fit
- Recommendation: Test on mobile devices, add `@media (max-width: 768px)` breakpoints

---

## Documentation Gaps

**No JSDoc Comments:**
- Issue: Complex functions like `applyTemplateToProject()` have doc comments, but most don't
- Files: `firestore-service.js` (good JSDoc), most page files (minimal comments)
- Impact: New contributors can't understand code intent, easy to use API incorrectly
- Recommendation: Add JSDoc to all exported functions

**No API Documentation:**
- Missing: How to add a new checklist view? How to add a new page? How to extend Firestore schema?
- Recommendation: Create `docs/development-guide.md` with:
  - Folder structure and naming conventions
  - How to add a Firestore collection
  - How to add a page + navigation link
  - How to create a new view mode in existing page
  - Firestore query patterns

---

## Environment & Deployment Concerns

**No Environment Variable Validation:**
- Issue: Firebase SDK initialized without checking required config keys exist
- Files: `js/firebase-init.js` (no error if keys missing)
- Impact: If `.firebaserc` or Firebase config is wrong, app silently fails at runtime
- Recommendation: Add startup validation:
  ```javascript
  const requiredKeys = ["apiKey", "projectId", "storageBucket"];
  for (const key of requiredKeys) {
    if (!firebaseConfig[key]) throw new Error(`Missing Firebase config: ${key}`);
  }
  ```

**Hardcoded Azure AD Tenant ID:**
- Issue: Microsoft OAuth tenant hardcoded in `js/auth.js` (line 46)
- Impact: Can't easily switch between dev/staging/prod Azure tenants
- Recommendation: Read from Firebase config or .firebaserc

---

## Recommendations Priority

**High (Security/Critical Data Loss):**
1. Fix Firestore Rules — implement proper authentication checks
2. Add transaction support to multi-step operations (approve, complete, reject)
3. Implement HTML injection protection audit
4. Add retry logic with proper error feedback

**Medium (Performance/Maintainability):**
5. Refactor monolithic files into smaller modules
6. Implement subscription cleanup on all pages
7. Add pagination/lazy loading for large lists
8. Fix timestamp conversion edge case

**Low (Technical Debt/Nice-to-Have):**
9. Add JSDoc documentation
10. Set up automated testing framework
11. Centralize role/permission logic
12. Implement audit trail

