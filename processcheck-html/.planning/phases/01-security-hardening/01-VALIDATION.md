---
phase: 1
slug: security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework configured (CLAUDE.md confirms: "No test framework is currently configured") |
| **Config file** | none — manual verification only |
| **Quick run command** | Manual browser spot-check (see Per-Task Map) |
| **Full suite command** | 5-step manual checklist (see Manual-Only Verifications) |
| **Estimated runtime** | ~10 minutes for full suite |

---

## Sampling Rate

- **After every task commit:** Manual spot-check of the specific behavior changed
- **After every plan wave:** Run full 5-step manual checklist below
- **Before `/gsd:verify-work`:** Full suite must pass
- **Max feedback latency:** 10 minutes (manual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-* | 01 | 1 | SEC-01 | smoke (manual) | `curl` unauthenticated POST → expect 403 | ❌ manual | ⬜ pending |
| 1-02-* | 02 | 1 | SEC-02 | smoke (manual) | Storage REST API without auth → expect 403 | ❌ manual | ⬜ pending |
| 1-03-* | 03 | 1 | SEC-03 | smoke (manual) | Open production URL, verify demo section hidden | ❌ manual | ⬜ pending |
| 1-04-* | 04 | 2 | SEC-04 | smoke (manual) | Create task with `<img src=x onerror=alert(1)>`, no alert fires | ❌ manual | ⬜ pending |
| 1-05-* | 05 | 2 | SEC-05 | unit (manual) | Set `loginAt` to `Date.now() - 86400001`, reload page → redirects | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No automated test infrastructure exists — all verification is manual.

- [ ] No Wave 0 setup needed (no test files to create)

*Existing infrastructure: None. All Phase 1 verifications are manual browser/curl checks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Unauthenticated Firestore write rejected | SEC-01 | No test framework; requires real Firebase project | `curl -X POST "https://firestore.googleapis.com/v1/projects/[PROJECT_ID]/databases/(default)/documents/projects" -H "Content-Type: application/json" -d '{}'` — expect HTTP 403 |
| Unauthenticated Storage upload rejected | SEC-02 | Requires real Firebase Storage; no test framework | Attempt upload via Storage REST API without Bearer token — expect HTTP 403 |
| Demo cards hidden on production hostname | SEC-03 | Requires production URL or hostname override | Open `https://[firebase-hosting-url]`, verify `#user-cards` section is not visible; open `localhost:8080`, verify it IS visible |
| XSS payload does not execute in task name | SEC-04 | Requires browser rendering; no headless test setup | Create task with name `<img src=x onerror=alert(1)>`, navigate to dashboard and task detail — verify no `alert()` dialog fires |
| Session expires after 24h | SEC-05 | Requires time manipulation; no test framework | Open browser DevTools → Application → Local Storage → set `loginAt` to `Date.now() - 86400001`, reload any protected page (e.g., dashboard.html) — verify redirect to `index.html` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 600s (manual 10-minute suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
