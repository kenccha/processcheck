---
phase: 01-security-hardening
plan: 02
subsystem: firestore-rules
tags: [security, firestore-rules, storage-rules, firebase]
dependency_graph:
  requires: [01-01]
  provides: [SEC-01, SEC-02]
  affects: [all Firestore collection writes, Firebase Storage]
tech_stack:
  added: []
  patterns: [isAuthenticated() helper, explicit collection rules, storage auth gate]
key_files:
  created:
    - processcheck-html/storage.rules
  modified:
    - processcheck-html/firestore.rules
    - processcheck-html/firebase.json
decisions:
  - "firebase.json required a firestore section (was missing) — added alongside storage section so both rule sets deploy correctly"
  - "Firebase Storage service not enabled on project — storage.rules files are correct but deploy requires user to activate Storage in Firebase console"
  - "No role-based Firestore rules — role data is in Firestore (not Auth tokens), so client-side enforcement remains unchanged"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-12"
  tasks_completed: 2
  files_modified: 3
---

# Phase 01 Plan 02: Firestore Rules Hardening and Storage Rules Summary

All 14 Firestore collections now require Firebase Auth for writes (unauthenticated POST returns 403); storage.rules created with auth-required read/write, pending Firebase Storage activation in console.

## What Was Built

### Firestore Rules Hardening (SEC-01)

Rewrote `firestore.rules` completely:

- Removed `isStoredUser()` helper that returned `true` unconditionally (was a placeholder).
- All 14 collections use `allow write: if isAuthenticated();` — no `|| true` or `if true` bypasses remain.
- Added explicit `activityLogs` rule (was missing from rules entirely — would silently deny writes in production since Firestore Rules v2 defaults to deny).
- Added explicit `feedbacks` rule (written by `docs/deliverables/js/feedback-system.js`, was missing).
- All reads remain open (`allow read: if true;`) — user lists, project data, and portal views need unauthenticated reads.

Added `"firestore": { "rules": "firestore.rules" }` section to `firebase.json` (was missing — Firebase CLI could not deploy rules without this). Deployed successfully via `firebase deploy --only firestore:rules`.

**Verification:** Unauthenticated curl POST to `https://firestore.googleapis.com/v1/projects/processsss-appp/databases/(default)/documents/projects` returns HTTP 403.

### Firebase Storage Rules (SEC-02)

Created `storage.rules` with `allow read, write: if request.auth != null;` for all paths.

Added `"storage": { "rules": "storage.rules" }` to `firebase.json`.

**Blocker:** Firebase Storage service not enabled on project `processsss-appp`. Both bucket names (`processsss-appp.appspot.com` and `processsss-appp.firebasestorage.app`) return HTTP 404. User must visit `https://console.firebase.google.com/project/processsss-appp/storage` and click "Get Started" before running `firebase deploy --only storage`.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Harden firestore.rules + fix firebase.json | 5a9412e | firestore.rules, firebase.json |
| 2 | Create storage.rules | 07ba77b | storage.rules |

## Decisions Made

1. **firebase.json needed firestore section** — the rules file existed but `firebase deploy --only firestore:rules` failed because firebase.json had no `"firestore"` key. Added as a Rule 3 auto-fix (blocking issue). Both `firestore` and `storage` sections were added together.
2. **Firebase Storage not enabled** — deploy for storage rules requires the Storage service to be activated in the Firebase console first. This is a user action, not a code issue. All rule files and configuration are correct.
3. **No role-based Firestore rules** — Firestore `request.auth.uid` uses Firebase Auth UIDs, which do not match the Firestore user document auto-generated IDs. Role enforcement stays client-side as planned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] firebase.json missing firestore section**
- **Found during:** Task 1
- **Issue:** `firebase deploy --only firestore:rules` returned "No targets in firebase.json match '--only firestore:rules'" because firebase.json had only a `hosting` section.
- **Fix:** Added `"firestore": { "rules": "firestore.rules" }` to firebase.json at the same time as the `storage` section from Task 2.
- **Files modified:** firebase.json
- **Commit:** 5a9412e

### Auth Gates

**Firebase Storage not activated**
- **Found during:** Task 2 deploy attempt
- **Status:** Storage rules file and firebase.json configuration are correct.
- **Required user action:** Visit `https://console.firebase.google.com/project/processsss-appp/storage` → click "Get Started" → then run `firebase deploy --only storage`.
- **Impact:** SEC-02 file content is complete; deployment is blocked by a console prerequisite, not a code issue.

## Self-Check: PASSED

- FOUND: processcheck-html/firestore.rules
- FOUND: processcheck-html/storage.rules
- FOUND: processcheck-html/firebase.json
- FOUND: .planning/phases/01-security-hardening/01-02-SUMMARY.md
- FOUND commit: 5a9412e (Task 1)
- FOUND commit: 07ba77b (Task 2)
