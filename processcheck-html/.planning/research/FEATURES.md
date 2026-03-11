# Feature Landscape

**Domain:** Hardware product development process management (PLM-adjacent, multi-department gate-review workflow tool)
**Researched:** 2026-03-12
**Confidence:** MEDIUM-HIGH (based on codebase analysis + domain knowledge of PLM/process tools)

---

## What Already Exists (Baseline Inventory)

Before mapping the landscape, this is what the app already ships:

| Category | Existing |
|----------|----------|
| Auth | Microsoft OAuth + demo cards, localStorage session, role-based page guards |
| Projects | CRUD, 7 view modes, 6-phase pipeline, D-Day tracking, type tabs (신규개발/설계변경) |
| Checklist/Tasks | 193 template items, template-to-project generation, 5 checklist sub-views, task detail with comments + file upload |
| Workflow | complete → pending → approve/reject → restart cycle, observer-only approval |
| Notifications | Auto-generated on complete/approve/reject, in-app notification center |
| Dashboard | Project-centric 4-tab (projects/tasks/approvals/notifications), D-Day + delay focus |
| Analytics | Reports page with Chart.js (phase bottleneck, dept workload, weekly trend, project progress), Activity log |
| Design Changes | minor/medium/major scale differentiation, customer-linked requests |
| Customers | customer management, customer portal (read-only, email auth), portal notifications |
| Sales | Sales launch dashboard with 6 views (product/matrix/timeline/customer/table/readiness) |
| Admin | Checklist template admin (matrix/tree/list), user management (observer only) |
| Meta | Review/feedback system, manual page, light/dark theme, Firebase Hosting CI/CD |

---

## Table Stakes

Features users expect from a process management tool. Missing = product feels incomplete or untrustworthy.

### UX Reliability

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| Timestamps display correctly | Users make decisions based on dates; "Invalid Date" breaks trust immediately | Low | **BROKEN** | `toDate()` doesn't handle `{seconds, nanoseconds}` Firestore objects — causes "Invalid Date" and "NaN days" |
| Modals always close on error | Stuck UI requires a page refresh — users lose flow | Low | **BROKEN** | Modal overlay not removed in `finally` block; manifests on network failure during task creation |
| Non-existent resource shows 404-like page | Sharing a deleted project link shows spinner forever | Low | **BROKEN** | `project-detail.js` has no timeout or "not found" fallback |
| Loading states are accurate | Spinner that never resolves is worse than no spinner | Low | Partial | Some pages have no retry/timeout; spinner can be permanent |
| Actions give feedback | "Did it work?" is the most common user question | Low | Partial | `showFeedback()` exists in some pages but not all action flows |
| Empty states are helpful | Empty list with no message → users think something is broken | Low | Partial | Some views have empty states, some show blank containers |

### Core Workflow Completeness

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| File upload actually works | Task detail has file upload UI; files are attachment evidence for approvals | Medium | **STUB** | Firebase Storage SDK imported and `handleFileUpload()` coded in task-detail.js, but Firestore security rules block Storage access |
| Stage auto-advance after all tasks approved | Without this, nothing moves forward unless someone manually updates stage | Medium | Missing | `currentStage` computed by `recalculateProjectStats()` but no automatic gate-crossing logic |
| Rejection must carry a reason | Rejected work with no explanation cannot be reworked correctly | Low | Partial | `rejectionReason` field exists and is stored, but UI doesn't always surface it prominently to workers |
| Assignee can be reassigned | Tasks get stuck when original assignee leaves or is overloaded | Low | Exists | `bulkUpdateAssignee()` available; manager role covers this |
| Due date per task is visible in list views | Without dates in lists, priority is invisible | Low | Partial | Dates shown in task detail but checklist list views don't consistently show dueDate |

### Access Control Integrity

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| Firestore rules enforce roles server-side | Client-side checks are trivially bypassed via devtools | High | **Missing** | All collections except `reviews` have `allow write: if true`; anyone can corrupt data |
| Session expiry / logout actually cleans up | A user who resigns should not retain access indefinitely | Low | Partial | `logout()` calls Firebase Auth `signOut()` but localStorage is not cleared cross-tab; no session TTL |
| Demo cards disabled in production | Role override on client is a security hole in a real deployment | Low | Missing | Feature flag to disable demo login in production does not exist |

### Navigation & Discoverability

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| Breadcrumbs link back to parent | Deep pages (task detail) need a clear path back | Low | Partial | Breadcrumb exists in task-detail.js but navigates to dashboard, not to project |
| Back button works as expected | Users click browser back; if URL isn't set up correctly, it loops | Low | Partial | Single-page navigation via URL params works; edge cases with modals |
| Search across projects | Users have 50+ design changes per month; they need to find by name | Low | Partial | Search exists in projects.js table view; not global |
| Notification badge count | Users need to know how many things need their attention without opening a page | Low | Partial | Notification count in dashboard stat card; no persistent badge in nav |

### Data Integrity

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| Multi-step operations are atomic | Approve task = 4 writes; if write 3 fails, data is inconsistent | High | Missing | No Firestore transaction wrapping in `approveTask`, `completeTask`, `rejectTask` |
| Audit trail (who did what, when) | Required for any compliance-sensitive approval workflow (ISO-certified medical device co.) | High | Partial | `activityLogs` collection exists with `subscribeAllActivityLogs()` and activity.js page; logs 5 action types |
| Duplicate checklist prevention | `applyTemplateToProject()` called twice creates double items | Low | Missing | No idempotency check before template application |

---

## Differentiators

Features that set the product apart from generic project management tools. Not universally expected, but high value for this specific domain.

### Process Intelligence

| Feature | Value Proposition | Complexity | Status | Notes |
|---------|-------------------|------------|--------|-------|
| Phase bottleneck heatmap | Which department is blocking which phase — visible to leadership | Medium | Exists | reports.js + bottleneck tab in project detail |
| D-Day countdown with delay reason | Surfaces the "why" behind schedule slips, not just that slippage exists | Low | Exists | Project cards show D-Day + 1-line delay summary |
| Gate completion confidence indicator | "Phase WM is 90% complete — 2 required items remain" before approval | Medium | Partial | Matrix view shows completion counts; no aggregate "ready to gate" signal |
| Cross-department dependency visibility | "개발팀 is waiting on 품질팀 for 3 items" — unblocking view | Medium | Partial | Bottleneck tab shows phase×dept heatmap; no explicit dependency chain |
| Completion velocity trend | "We're completing tasks 20% slower this sprint vs. last" | Medium | Exists | Weekly completion trend chart in reports.js |

### Operational UX for Korean Manufacturing Context

| Feature | Value Proposition | Complexity | Status | Notes |
|---------|-------------------|------------|--------|-------|
| @mention in comments | Workers can pull in colleagues without leaving the task | Medium | Exists | `parseMentions()` + `extractMentions()` in utils.js; `@` triggers user dropdown in task-detail.js |
| Bulk task reassignment | Manager can redistribute 20 tasks in one action (monthly ~50 design changes) | Low | Exists | `bulkUpdateAssignee()` in project-detail.js |
| Bulk approval | Observer approving a completed gate can approve all items at once | Low | Exists | `bulkApproveTasks()` in dashboard.js |
| Template-driven checklist (193 items) | No manual setup per project; department + phase + type filter automatically | High | Exists | `applyTemplateToProject()` fully implemented |
| Design change scale differentiation | Minor/medium/major get different template subsets — no overhead for small changes | Medium | Exists | `changeScale` param in template generation |
| Customer portal (read-only) | Dealers / subsidiaries see their product's progress without needing internal accounts | Medium | Exists | `customer-portal.html` with email auth |
| Sales launch readiness dashboard | Dedicated view for 영업팀 to track dealer notifications, pricing, training completion | High | Exists | `sales.html` with 6 view modes |

### Reporting & Export

| Feature | Value Proposition | Complexity | Status | Notes |
|---------|-------------------|------------|--------|-------|
| CSV export per analysis view | Reports data portable to Excel for meetings and compliance docs | Low | Exists | `downloadCSV()` helper; all 4 report sections have CSV export |
| PDF export of project checklist | Printable approval record for gate review meetings | Medium | Partial | `exportToPDF()` function exists in utils.js; integration in project-detail.js |
| Cross-project analytics (Chart.js) | Leadership view across all active projects simultaneously | High | Exists | reports.js with 4 chart types using Chart.js via CDN |

---

## Missing Features (Gap Analysis vs. Table Stakes + Expected UX Quality)

These are features the current app is missing that real users of a process management tool in a medical device manufacturing context would expect.

### Priority 1: Breaks Trust (Users Stop Using the Tool)

| Gap | Impact | Complexity | Recommendation |
|-----|--------|------------|----------------|
| Timestamp conversion bug | Dates display as "Invalid Date" or "NaN days" throughout the app | Low | Fix `toDate()` to handle `{seconds, nanoseconds}` Firestore format |
| Modal stuck open on network error | User must refresh; uncommitted form data is lost | Low | Add `finally { overlay.remove() }` pattern to all modal submit handlers |
| Infinite spinner for deleted projects | Sharing/bookmarking a deleted project URL shows spinner forever | Low | Add 5s timeout + "프로젝트를 찾을 수 없습니다" fallback |
| File upload does nothing silently | Task detail has a file upload UI that appears to work but the Security Rules block Storage writes | Medium | Fix Firestore + Storage security rules, verify end-to-end upload + download flow |
| No server-side authorization | Any user can promote themselves to observer via browser devtools | High | Implement proper Firestore security rules: role-based write access, authenticated reads |

### Priority 2: Users Work Around the Tool (Friction Tax)

| Gap | Impact | Complexity | Recommendation |
|-----|--------|------------|----------------|
| No stage auto-advance | After all tasks in a phase are approved, current stage must be manually updated or rely on `recalculateProjectStats()` which only updates a field; no visual trigger or notification | Medium | When last required item in a phase is approved, notify observer + suggest advancing to next phase |
| Bulk approval errors are invisible | If 3 of 10 bulk approvals fail (network), user sees "done" with 3 items silently skipped | Low | Use `Promise.allSettled()` and show success/failure count |
| No persistent notification badge | Unread notification count not shown in navigation; users miss items requiring their action | Low | Show badge count on nav notification icon; subscribe to unread count |
| Due dates not visible in checklist list view | Workers cannot prioritize tasks without opening each one | Low | Add `dueDate` column to checklist list view and phase view item rows |
| Rejection reason not prominently shown to worker | Worker sees task is "반려" but must scroll to find why | Low | Show rejection reason as a colored banner at top of task detail when `status === "rejected"` |
| Unsubscriber leak in sales.js | Memory/quota leak — Firestore subscriptions stay open after page unload | Low | Add `beforeunload` cleanup to sales.js (already done correctly in other pages) |

### Priority 3: Production Readiness (Stability at Scale)

| Gap | Impact | Complexity | Recommendation |
|-----|--------|------------|----------------|
| No transaction wrapping for multi-step writes | Inconsistent state if approve/reject partially fails (task approved, notification not sent, project stats stale) | High | Wrap `completeTask`, `approveTask`, `rejectTask` in Firestore transactions |
| Duplicate checklist on double-apply | Calling `applyTemplateToProject()` twice creates doubled items; user accidentally re-applies | Low | Add `if (await hasChecklistItems(projectId)) return 0` guard |
| Pagination missing on notifications + activity logs | At 50 notifications/day with 10 users, unread list grows unbounded; no `limit()` on query | Low | Add `limit(50)` + "더보기" lazy load button; implement read/unread split view |
| Demo login not disabled in production | Any user can log in as observer via demo cards; acceptable for staging, unacceptable in production | Low | Add `DEMO_MODE` flag (can be toggled per deployment config in `firebase-init.js`) |
| No session expiry | localStorage user object has no TTL; revoked users retain access until manual logout | Low | Add `expiresAt` to stored user object; validate on each page load |
| XSS via innerHTML | User-authored content (comments, project names) injected via `innerHTML` without consistent escaping | Medium | Audit all `innerHTML` assignments; verify `escapeHtml()` is called on all user-sourced strings |

### Priority 4: Expected Operational Features (Users Ask for This After First Week)

| Gap | Impact | Complexity | Recommendation |
|-----|--------|------------|----------------|
| Task dependency (A must complete before B) | Some checklist items logically depend on others; no way to model this | High | Add `dependsOn: [taskId]` field to checklistItem; show blocked indicator in UI |
| Deadline reminder notifications | System should ping assignees when a task is N days from due date | Medium | Firebase Scheduled Function (Cloud Functions) or cron-triggered client check on login |
| Project duplication / template projects | Creating a new 신규개발 project requires re-applying templates; users want "copy from project X" | Medium | Add "프로젝트 복사" in project creation flow |
| Change request timeline / history | Once a design change is approved or rejected, there's no audit trail showing the decision chain | Medium | Extend `changeRequests` schema with `statusHistory` array |
| Checklist item reorder within a phase | Template items in a phase have an implicit order but no drag-reorder in project checklist (only template admin has drag-drop) | Medium | Add drag-to-reorder in project checklist tree/list view using same pattern as admin-checklists.js |
| Global search (projects + tasks) | With 50 design changes/month, finding "where is the sensor spec task for the blood pressure project" requires navigating 3 levels | Medium | Add global search bar in nav; query projects + checklist items by title keyword |
| Print-friendly project status report | Gate review meetings need a printable 1-pager per project | Medium | Dedicated print CSS + print button generating project header + phase table + task summary |

---

## Anti-Features

Features to explicitly NOT build, or to avoid scoping in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time chat / instant messaging | Scope creep; this is a process tracking tool, not Slack; adds complexity without core value | Use `@mention` in task comments for async comms |
| Mobile app (iOS/Android) | Out of scope per PROJECT.md; web-first is the right call for an internal tool | Ensure responsive layout works at 768px for tablet-in-meeting-room use case |
| PLM/ERP integration (SAP, Oracle) | Explicitly out of scope; this tool exists because existing PLM lacks visibility | Manual project creation; possibly import via CSV in future |
| Multi-language support | This is Korean-language only per PROJECT.md | Keep all UI in Korean |
| Complex RBAC beyond 3 roles | The 3-role system (worker/manager/observer) maps cleanly to the real org chart | Keep it simple; don't add sub-roles or department-scoped manager permissions |
| Automated stage gating (hard lock) | Full hard-locking prevents emergency manual overrides; design already decided: "warning only, no lock" | Show warning badges when entering next phase with uncompleted required items; do not block navigation |
| Gantt chart editing | Gantt is a read-only view of date data; making it editable adds huge complexity | Keep Gantt as visualization; edit dates through project detail form |
| AI-generated suggestions or auto-fill | Adds Firebase cost (Cloud Functions) and maintenance overhead not justified for 50-user internal tool | Keep workflow explicit and human-driven |
| Offline mode / PWA | Firebase real-time subscriptions require connectivity; offline mode is complex to implement correctly | Show connectivity loss banner; gracefully degrade to last cached data |

---

## Feature Dependencies

```
Firestore Security Rules fix
  → File Upload works (Storage rules)
  → Session expiry meaningful (auth rules enforced)
  → Demo disable needed (rules no longer last line of defense)

Transaction wrapping (approveTask / completeTask)
  → Stage auto-advance (needs consistent state to trigger)
  → Audit trail complete (incomplete transactions create gaps)

Audit trail (activityLogs)
  → Change request history
  → Compliance reporting (future)

Global search
  → Needs Firestore composite indexes on title fields
  → Consider Algolia if search becomes critical (future, not now)

Notification badge in nav
  → subscribeNotifications already exists
  → Just needs unread count rendered in components.js nav
```

---

## MVP Recommendation (For This Milestone)

The app is feature-rich but has trust-breaking bugs and security gaps that prevent production use. The order of work should be:

**Phase 1: Make it trustworthy**
1. Fix timestamp conversion bug (`toDate()` with Firestore `{seconds, nanoseconds}`)
2. Fix modal stuck on error (`finally` block)
3. Fix infinite spinner for missing projects (timeout + 404 page)
4. Fix file upload end-to-end (Storage rules + rule verification)
5. Implement Firestore security rules (role-based write access)

**Phase 2: Fill workflow gaps**
6. Wrap multi-step writes in Firestore transactions
7. Add idempotency guard to `applyTemplateToProject()`
8. Make bulk operation errors visible (`Promise.allSettled()`)
9. Fix unsubscriber leak in sales.js
10. Add persistent notification badge in nav
11. Show rejection reason prominently in task detail
12. Add due dates to checklist list/phase views

**Phase 3: Polish for real users**
13. Session expiry (24h TTL on localStorage user)
14. Demo login disable flag
15. Pagination for notifications and activity log
16. Global search (projects + tasks)
17. Breadcrumb fix (task → project → projects, not task → dashboard)

**Defer entirely:**
- Task dependencies (complex data model change)
- Deadline reminder notifications (requires Cloud Functions)
- Project duplication
- Advanced change request history

---

## Sources

- Codebase analysis: `.planning/codebase/CONCERNS.md` (security, tech debt, known bugs — MEDIUM confidence; derived from code review)
- Codebase analysis: `.planning/codebase/ARCHITECTURE.md` (component map, data flows — HIGH confidence; reflects actual code)
- Domain knowledge: PLM/gate-review workflow patterns for ISO-regulated hardware manufacturing (MEDIUM confidence; training data + standard industry practice)
- Competitive reference: Asana, Jira, Notion task management UX patterns for table stakes UX expectations (MEDIUM confidence)
- Project constraints: `.planning/PROJECT.md` (out of scope, context, constraints — HIGH confidence; project ground truth)
