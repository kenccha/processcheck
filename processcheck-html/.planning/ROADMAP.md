# Roadmap: ProcessCheck Production Readiness

## Overview

ProcessCheck is a working, feature-complete app that needs hardening before real users can trust
it. This milestone delivers the app in production-safe state: locked-down Firestore rules, fixed
data corruption bugs, a complete approval pipeline, working file uploads, and a polished UX.
Phases are ordered security-first — each phase leaves the app in a deployable state.

## Phases

- [ ] **Phase 1: Security Hardening** - Lock down Firestore/Storage rules and eliminate XSS + session risks
- [ ] **Phase 2: Stability & Data Integrity** - Fix known data corruption bugs and make multi-step operations atomic
- [ ] **Phase 3: Core Flow Pipeline** - Complete approval workflow with gate auto-advance, reviewer notifications, manager filtering, and accurate stats
- [ ] **Phase 4: File Upload** - Connect the existing file upload UI to Firebase Storage
- [ ] **Phase 5: UX Polish** - Forms validation, toast notifications, responsive layout, accessibility, empty states, and navigation
- [ ] **Phase 6: Advanced Workflow** - Activity timeline, @mention, bulk assign, new user onboarding, and print view

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

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 1/3 | In Progress|  |
| 2. Stability & Data Integrity | 0/TBD | Not started | - |
| 3. Core Flow Pipeline | 0/TBD | Not started | - |
| 4. File Upload | 0/TBD | Not started | - |
| 5. UX Polish | 0/TBD | Not started | - |
| 6. Advanced Workflow | 0/TBD | Not started | - |
