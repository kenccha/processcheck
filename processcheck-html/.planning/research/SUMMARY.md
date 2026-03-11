# Research Summary: v2.0 UX/UI 대규모 개선

**Synthesized:** 2026-03-12
**Sources:** STACK.md, ARCHITECTURE.md, FEATURES.md, PITFALLS.md
**Overall confidence:** HIGH

## Executive Summary

ProcessCheck v2.0 focuses on UX/UI improvements identified from competitor analysis (Linear, Notion, Monday.com, Arena PLM, Jira, ClickUp). All 26 features can be implemented with only 3 new CDN libraries (SortableJS, ninja-keys, Notyf) — the remaining features use pure CSS and vanilla JS. Zero new Firestore queries needed; all features operate on existing `onSnapshot` data.

## Key Findings

### Stack
- **3 new libraries only:** SortableJS 1.15.7 (kanban DnD), ninja-keys 1.2.2 (Cmd+K), Notyf 3.10.0 (toast)
- **7 features = zero libraries:** skeleton, slide-over, view transitions, filter pills, hover-reveal, battery-bar, animations — all pure CSS/JS
- New `js/ui/` module directory with 7 files

### Architecture
- Zero new Firestore queries — all UX features use existing subscription data
- New `js/ui/` directory separates interaction modules from page controllers
- Shared `optimisticUpdate()` utility pattern for inline edits
- Toast + Cmd+K initialized from `components.js` renderNav() (runs on every page)

### Features (26 total)
- **13 Low complexity:** Pure CSS or simple JS toggle
- **10 Medium complexity:** New component + page integration
- **3 High complexity:** Bulk ops (C4), DnD kanban (E1), Gantt real data (D6)
- Build order: Foundation CSS → Inline actions → Power user → Advanced

### Pitfalls (7 critical)
1. **DnD + onSnapshot race** → `isDragging` flag to defer re-renders
2. **HTML5 DnD no touch** → desktop-only with mobile fallback buttons
3. **Optimistic rollback race** → per-item lock in `optimisticUpdate()`
4. **CSS token inversion** → additive-only changes, semantic tokens
5. **Cmd+K listener duplication** → singleton guard in components.js
6. **Toast flooding** → key-based dedup + batch summary
7. **localStorage versioning** → schema version field

## Implications for Roadmap

Recommended 4-phase structure (Phases 7-10, continuing from v1.0):

1. **Phase 7: Foundation** — CSS tokens + Toast + Skeleton + Battery-bar + Visual polish (B1-B6, A4)
2. **Phase 8: Inline Actions** — Status change + Approval + Navigation + Slide-over (A1-A3, A5-A6, D1)
3. **Phase 9: Power User** — Cmd+K + Filter pills + View state + Info architecture (C1-C3, D2-D5)
4. **Phase 10: Advanced** — Bulk ops + Heatmap + Gantt/History data + DnD kanban (C4-C5, D6-D7, E1-E3)

**Rationale:** Foundation first (toast/skeleton needed by later phases), inline actions next (highest user impact), power user features third, complex DnD/bulk last.
