---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: UX/UI 대규모 개선
status: planning
stopped_at: null
last_updated: "2026-03-12"
last_activity: 2026-03-12 — v2.0 requirements defined, roadmap phases 7-10 created
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** 여러 부서가 얽힌 하드웨어 개발 프로세스의 현재 상태와 병목을 누구나 즉시 파악할 수 있어야 한다.
**Current focus:** v2.0 UX/UI 대규모 개선 — ready to plan Phase 7

## Current Position

Phase: 7 (Foundation CSS + Toast + Skeleton) — not started
Plan: —
Status: Ready to plan
Last activity: 2026-03-12 — v2.0 requirements + roadmap created

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (v1.0 Phase 1)
- Average duration: —
- Total execution time: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v1.0]: Demo card login decision is a blocker for Firestore rules (SEC-01 depends on SEC-03 choice)
- [v1.0]: File Upload (Phase 4) depends on Storage rules landing in Phase 1 (SEC-02)
- [v1.0 Phase 01]: startSessionWatcher called once per renderNav() — all protected pages covered
- [v1.0 Phase 01]: IS_PROD check is UI-layer defense only; Firestore rules provide actual enforcement
- [v1.0 Phase 01]: firebase.json required a firestore section (was missing)
- [v1.0 Phase 01]: Firebase Storage not enabled on project — requires user to activate in console
- [v2.0]: 3 CDN libraries only: SortableJS 1.15.7, ninja-keys 1.2.2, Notyf 3.10.0
- [v2.0]: New js/ui/ directory for shared UI interaction modules
- [v2.0]: Zero new Firestore queries — all features use existing onSnapshot data
- [v2.0]: DnD is desktop-only with mobile fallback (sort buttons)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: —
Stopped at: —
Resume file: None
