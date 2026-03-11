# Roadmap: ProcessCheck

## Overview

**v1.0 (Phases 1-6):** Production readiness — security, stability, workflow, file upload, UX polish, advanced workflow.
**v2.0 (Phases 7-10):** UX/UI 대규모 개선 — 경쟁사 분석 기반 26개 기능. Foundation CSS → inline actions → power user → advanced DnD/bulk.

## Phases

- [x] **Phase 1: Security Hardening** - Lock down Firestore/Storage rules and eliminate XSS + session risks (completed 2026-03-11)
- [x] **Phase 2: Stability & Data Integrity** - Fix known data corruption bugs and make multi-step operations atomic (completed 2026-03-12)
- [x] **Phase 3: Core Flow Pipeline** - Complete approval workflow with gate auto-advance, reviewer notifications, manager filtering, and accurate stats (completed 2026-03-12)
- [x] **Phase 4: File Upload** - Connect the existing file upload UI to Firebase Storage (already built, verified 2026-03-12)
- [x] **Phase 5: UX Polish** - Forms validation, toast notifications, responsive layout, accessibility, empty states, and navigation (completed 2026-03-12)
- [x] **Phase 6: Advanced Workflow** - Activity timeline, @mention, bulk assign, new user onboarding, and print view (completed 2026-03-12)

## Phase Details

### Phase 1: Security Hardening
**Goal**: The app is safe for real users — no unauthorized writes, no XSS, no persistent demo bypass
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. An unauthenticated HTTP request to Firestore is rejected with a permission error
  2. Demo card login is blocked on the production Firebase Hosting URL (works only on localhost)
  3. Submitting a task name containing `<script>alert(1)</script>` does not execute JavaScript on any page
  4. A user who logs in is automatically logged out after 24 hours and redirected to the login page
  5. Firebase Storage upload and download requests from unauthenticated origins are rejected
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Demo card hostname gate (SEC-03) + 24h session expiry (SEC-05)
- [ ] 01-02-PLAN.md — Firestore rules hardened (SEC-01) + Storage rules created (SEC-02)
- [ ] 01-03-PLAN.md — XSS audit: escapeHtml() in notification panel (SEC-04)

### Phase 2: Stability & Data Integrity
**Goal**: Known data corruption and error-handling bugs are eliminated — the app behaves predictably under real conditions
**Depends on**: Phase 1
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. D-Day displays a correct number on all project cards — no "Invalid Date" or "NaN days" text appears
  2. When a network error occurs during a task action, the modal closes and a readable error message appears
  3. Navigating to a project URL that does not exist shows "프로젝트를 찾을 수 없습니다" instead of a blank page
  4. Navigating away from the sales page does not leave orphaned Firestore listeners (confirmed via browser devtools)
  5. Running "템플릿 적용" twice on the same project does not create duplicate checklist items
  6. Completing or approving a task either fully succeeds or fully rolls back — no partial state in Firestore
  7. Bulk approve/complete shows a result summary ("5건 성공, 1건 실패") instead of silently skipping failures
**Plans**: TBD

### Phase 3: Core Flow Pipeline
**Goal**: The approval pipeline works end-to-end with correct visibility, notifications, filtering, and stats at every step
**Depends on**: Phase 2
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, WORK-01, WORK-02, WORK-03, SYNC-01, SYNC-02, SYNC-03, SYNC-04, FLOW-01
**Success Criteria** (what must be TRUE):
  1. After a gate stage is approved, all tasks in the next phase automatically become active (in_progress) without manual action
  2. Unassigned tasks appear in a dedicated "미배정" section visible to managers on the dashboard
  3. Managers see only their own department's tasks on the dashboard task tab, not all tasks
  4. The navigation bar shows a live unread notification badge count that updates without page refresh
  5. A rejected task shows the rejection reason in a prominent banner at the top of the task detail page
  6. Project progress, riskLevel, and currentStage update immediately after any task or approval action — no stale counts
  7. The approval button shows "모든 작업이 완료되어야 승인 가능" when incomplete tasks remain, and is disabled
**Plans**: TBD

### Phase 4: File Upload
**Goal**: Users can attach files to tasks and retrieve them, making task detail a complete work-evidence record
**Depends on**: Phase 1 (SEC-02 Storage rules required)
**Requirements**: FILE-01, FILE-02
**Success Criteria** (what must be TRUE):
  1. A user can select a file on a task detail page and see it upload with a progress indicator
  2. After upload, the file appears in a list on the task detail page with a clickable download link
  3. All previously uploaded files for a task are present in the list when the page reloads
**Plans**: TBD

### Phase 5: UX Polish
**Goal**: The interface is reliable, responsive, and navigable — users get clear feedback on every action and the app works on mobile and keyboard-only
**Depends on**: Phase 3
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. Submitting any form with missing or invalid fields shows inline error messages before the request fires
  2. Every successful or failed action shows a toast notification — no browser alert() dialogs remain
  3. The app layout does not break at 768px — navigation, modals, and tables are usable on mobile
  4. Pressing Escape closes any open modal; keyboard focus is trapped inside the modal while it is open
  5. Typing in the navigation search bar returns matching projects and tasks by name
  6. Status indicators use icons or text labels in addition to color so they are distinguishable without color vision
**Plans**: TBD

### Phase 6: Advanced Workflow
**Goal**: Power users can track all activity, communicate via @mention, bulk-assign tasks, onboard cleanly, and produce print reports
**Depends on**: Phase 5
**Requirements**: FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06
**Success Criteria** (what must be TRUE):
  1. The project detail page shows an activity timeline listing who did what and when ("김철수 님이 작업 완료 — 2시간 전")
  2. Writing @username in a comment creates a notification for that named user
  3. A manager can select multiple checklist items and assign them all to one assignee in a single action
  4. A new Microsoft OAuth user who has no department set sees a prompt to select their department after login
  5. Printing a project detail page produces a clean layout with navigation and action buttons hidden
**Plans**: TBD

### Phase 7: Foundation — CSS + Toast + Skeleton
**Goal**: Visual foundation for all v2.0 features — semantic CSS tokens, toast system, skeleton loading, battery-bar, and view transition animations
**Depends on**: Phase 1 (security baseline)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06, UXA-04
**Success Criteria** (what must be TRUE):
  1. All `alert()` calls are replaced with Notyf toast notifications (success/error/warning)
  2. Every data-loading page shows skeleton placeholders before content renders
  3. Project progress is displayed as a battery-bar instead of a percentage number
  4. List items reveal action buttons only on hover (hidden by default)
  5. CSS uses semantic tokens (`--bg-surface`, `--text-primary`) and both light/dark themes render correctly
  6. View/tab switching has a visible fade or slide animation
  7. Status colors follow a consistent 3-color system (green/yellow/red) across all pages
**Plans**: TBD

### Phase 8: Inline Actions + Navigation
**Goal**: Users can take actions directly from lists without page navigation — inline status change, inline approval, slide-over preview, and improved navigation links
**Depends on**: Phase 7 (toast system required for feedback)
**Requirements**: UXA-01, UXA-02, UXA-03, UXA-05, UXA-06, INF-01
**Success Criteria** (what must be TRUE):
  1. Opening a project detail page auto-scrolls the checklist to the current active phase
  2. Clicking approve/reject in the dashboard approval tab processes the action without navigating away
  3. All notification links navigate to the correct task detail page (zero 404s)
  4. Clicking a task in a list opens a slide-over panel showing task details without leaving the page
  5. Task status can be changed via inline dropdown in any checklist view
  6. Project table has a D-Day column sortable by deadline proximity
**Plans**: TBD

### Phase 9: Power User + Information Architecture
**Goal**: Power users can find anything instantly with Cmd+K, filter with pills, persist view preferences, and access a dedicated approval page
**Depends on**: Phase 8 (inline patterns established)
**Requirements**: PWR-01, PWR-02, PWR-03, INF-02, INF-03, INF-04, INF-05
**Success Criteria** (what must be TRUE):
  1. Pressing Cmd+K (Mac) or Ctrl+K (Win) opens a command palette that searches projects, tasks, and pages
  2. Active filters are shown as removable pill tags above the list
  3. View mode, sort order, and filter selections persist across page reloads via localStorage
  4. Low-frequency views are collapsed or hidden behind a "더보기" toggle
  5. Dashboard links directly to report/analytics pages
  6. Sales dashboard is accessible from the main navigation bar
  7. A dedicated approval page lists all pending items for observers
**Plans**: TBD

### Phase 10: Advanced — Bulk + Heatmap + DnD
**Goal**: Complete the UX transformation with bulk operations, workload visualization, real data in charts, and drag-and-drop kanban
**Depends on**: Phase 9 (filter/inline patterns needed)
**Requirements**: PWR-04, PWR-05, INF-06, INF-07, DND-01, DND-02, DND-03
**Success Criteria** (what must be TRUE):
  1. Users can select multiple checklist items and change status or assignee in one bulk action
  2. A department × phase heatmap visualizes workload distribution in the bottleneck tab
  3. Gantt chart renders actual project start/end dates and task progress from Firestore
  4. Activity history shows real Firestore notification/change data instead of placeholder content
  5. Kanban view supports drag-and-drop to change task status (SortableJS)
  6. Kanban has department swimlanes separating cards by team
  7. Urgent (red) items are pinned to the top of kanban columns
**Plans**: TBD

## Progress

**v1.0 Execution Order:** 1 → 2 → 3 → 4 → 5 → 6
**v2.0 Execution Order:** 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 3/3 | Complete | 2026-03-11 |
| 2. Stability & Data Integrity | 1/1 | Complete | 2026-03-12 |
| 3. Core Flow Pipeline | 1/1 | Complete | 2026-03-12 |
| 4. File Upload | — | Complete (already built) | 2026-03-12 |
| 5. UX Polish | 1/1 | Complete | 2026-03-12 |
| 6. Advanced Workflow | 1/1 | Complete | 2026-03-12 |
| 7. Foundation CSS + Toast + Skeleton | 1/1 | Complete | 2026-03-12 |
| 8. Inline Actions + Navigation | 1/1 | Complete | 2026-03-12 |
| 9. Power User + Info Architecture | 1/1 | Complete | 2026-03-12 |
| 10. Advanced — Bulk + Heatmap + DnD | 1/1 | Complete | 2026-03-12 |
