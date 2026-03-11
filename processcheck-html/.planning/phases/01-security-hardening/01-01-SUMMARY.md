---
phase: 01-security-hardening
plan: 01
subsystem: auth
tags: [security, session, demo-gating, localStorage]
dependency_graph:
  requires: []
  provides: [SEC-03, SEC-05]
  affects: [all protected pages via components.js renderNav()]
tech_stack:
  added: []
  patterns: [SESSION_TTL constant, loginAt timestamp, IS_PROD hostname check, setInterval session watcher]
key_files:
  created: []
  modified:
    - js/auth.js
    - js/pages/login.js
    - js/components.js
decisions:
  - "IS_PROD check is UI-layer defense only — Firestore rules (Plan 02) provide actual enforcement"
  - "startSessionWatcher called once per renderNav() call — multiple calls would stack intervals but each page only calls renderNav() once"
  - "guardPage() calls logout() without await — window.location.href in logout() fires immediately regardless"
metrics:
  duration: "~12 minutes"
  completed: "2026-03-12"
  tasks_completed: 2
  files_modified: 3
---

# Phase 01 Plan 01: Demo Card Gating and Session Expiry Summary

Production demo cards hidden on non-localhost hostnames; all login paths now stamp loginAt and sessions expire after 24 hours with a 5-minute background watcher.

## What Was Built

### Session TTL Enforcement (SEC-05)

Added `SESSION_TTL = 24 * 60 * 60 * 1000` to `js/auth.js`. All three login paths now stamp `loginAt: Date.now()` into the localStorage session object:

- `login()` — demo card login (worker/manager/observer)
- `loginWithMicrosoft()` — existing user branch and new user branch
- `completeRegistration()` — registration completion flow

`guardPage()` now checks expiry on every protected page load. `startSessionWatcher()` is exported and polls every 5 minutes from `components.js` `renderNav()` — no per-page changes needed.

### Demo Card Gating (SEC-03)

Added `IS_PROD` hostname check near the top of `js/pages/login.js`. On any hostname other than `localhost` or `127.0.0.1`, the following elements are hidden:

- `#user-cards` — the demo card buttons container
- `#login-divider` — horizontal rule separator
- `.login-prompt` — paragraph text above demo cards (replaced with "InBody 계정으로 로그인하세요")

This is UI-layer defense in depth. Plan 02 Firestore rules are the actual enforcement gate for unauthorized demo user writes.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add loginAt + 24h session expiry to auth.js | 2d13822 | js/auth.js |
| 2 | Gate demo cards to localhost, wire session watcher | d86e45f | js/pages/login.js, js/components.js |

## Decisions Made

1. **IS_PROD as UI defense only** — hiding demo cards prevents accidental usage on production but is not security enforcement. Plan 02's Firestore rules prevent demo users (who lack Firebase Auth tokens) from writing to Firestore.
2. **startSessionWatcher in renderNav()** — all protected pages already call `renderNav()` exactly once at init time, making it the correct single injection point instead of modifying 12+ individual page JS files.
3. **logout() not awaited in guardPage()** — `logout()` is async (calls `signOut(auth)`) but `window.location.href` inside it fires synchronously from the localStorage removal perspective. This matches the existing codebase pattern.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: js/auth.js
- FOUND: js/pages/login.js
- FOUND: js/components.js
- FOUND commit: 2d13822 (Task 1)
- FOUND commit: d86e45f (Task 2)
