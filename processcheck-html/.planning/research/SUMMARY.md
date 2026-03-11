# Research Summary: ProcessCheck Improvement Milestone

**Domain:** Internal SPA — Hardware product development process management
**Researched:** 2026-03-12
**Overall confidence:** HIGH (findings based on direct codebase analysis, not external research)

## Executive Summary

ProcessCheck is a working, feature-complete vanilla JS + Firebase SPA that is architecturally
sound but not yet production-safe. The most critical gap is that Firestore security rules have
`allow write: if true` for every collection, meaning any unauthenticated request can corrupt
approval records, project data, and customer information. This is a security issue, not a
performance or UX issue, and must be the first milestone priority.

The second priority tier is data integrity: the `toDate()` timestamp conversion function has a
known bug that causes "Invalid Date" in D-Day calculations; `applyTemplateToProject()` is not
idempotent (running it twice duplicates items); multi-step operations like `approveTask()` are
not atomic (no transaction wrapping). These are silent data corruption risks.

The third priority tier is reliability: Firestore subscriptions in `sales.js` (and possibly
other pages) leak memory by not cleaning up `onSnapshot` listeners on navigation. Large files
(`firestore-service.js` at 2,060 lines, `sales.js` at 1,694 lines) make bugs expensive to find
and fix. No automated tests mean regressions are silent.

UX improvements — responsive layout, better date pickers, fuzzy search, charts — are valuable
but should come only after the app is production-safe.

## Key Findings

**Stack:** Vanilla JS ES modules + Firebase SDK v11.3.0 via CDN importmap — no changes needed,
add only DOMPurify (XSS) and optionally Fuse.js (search).

**Architecture:** 14 HTML pages as separate SPAs sharing `auth.js`, `components.js`,
`utils.js`, and `firestore-service.js` via ES module imports. Pattern is correct — needs
consistency enforcement, not redesign.

**Critical pitfall:** Firestore security rules are entirely client-enforced. Demo card login
bypasses Firebase Auth, which means the `isAuthenticated()` rule would lock out demo users.
This requires a concrete decision before rules can be tightened.

## Implications for Roadmap

Based on codebase analysis, suggested phase structure:

1. **Security and Data Integrity** — Must be first
   - Addresses: Firestore rules, demo card auth decision, timestamp bug, atomic operations
   - Avoids pitfall: Shipping to real users before data is protected
   - Research flag: Needs decision on demo card fate before Firestore rules can be finalized

2. **Reliability and Error Handling** — Foundation for trust
   - Addresses: Subscription lifecycle leaks, modal error recovery, project-not-found state,
     bulk operation atomicity
   - Avoids pitfall: Users losing work silently or getting stuck on spinners

3. **Code Structure** — Enables future maintenance
   - Addresses: Refactor `firestore-service.js` into domain modules, centralize role/permission
     logic, add JSDoc, establish subscription cleanup pattern across all pages
   - Avoids pitfall: Every future feature requiring search through 2,000-line files

4. **UX Polish** — Visible improvements
   - Addresses: Responsive layout, consistent inline style removal, date picker quality,
     search UX improvements, Firebase Storage integration for file uploads
   - Standard patterns, unlikely to need deep research

5. **Performance** — Query optimization
   - Addresses: Pagination for notifications/activity logs, query scoping for launch checklists,
     Firestore composite indexes, matrix view memoization
   - Needs deeper research: Firestore read cost projection at current user scale

**Phase ordering rationale:**
- Phase 1 (security) must precede real user onboarding
- Phase 2 (reliability) prevents silent data loss that would undermine trust
- Phase 3 (code structure) reduces cost of phases 4 and 5
- Phases 4 and 5 are independent of each other and could run in parallel

**Research flags for phases:**
- Phase 1: Demo card + Firebase Auth decision is a design blocker for rules
- Phase 3: Large file refactoring carries regression risk — test coverage should come first
- Phase 5: Firestore read costs should be measured against actual usage before optimizing

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Security gaps | HIGH | Confirmed from `firestore.rules` — literal `allow write: if true` |
| Timestamp bug | HIGH | Confirmed from `firestore-service.js:14-19` code |
| Subscription leaks | HIGH | Confirmed `sales.js:138-150` has no unsubscribers |
| CDN library choices | MEDIUM-HIGH | DOMPurify and Fuse.js HIGH; ApexCharts MEDIUM pending ESM verification |
| Firestore cost at scale | LOW | No production usage data available to model |

## Gaps to Address

- Demo card authentication fate in production: must be decided before security rules can be written
- Firebase Storage integration: UI exists but backend connection is absent — requires design for
  file storage path structure and access rules
- Stage auto-transition after full approval: not implemented, needs design before coding
