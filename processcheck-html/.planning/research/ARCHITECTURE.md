# Architecture Research: v2.0 UX/UI 대규모 개선

**Researched:** 2026-03-12
**Confidence:** HIGH — all features use existing data patterns

## Key Finding: Zero New Firestore Queries

All 26 UX features operate on data already fetched by existing `onSnapshot` subscriptions. No new Firestore queries or collections needed.

| Feature | Data Source |
|---------|------------|
| Inline status change | Existing `checklistItems` subscription |
| Inline approval | Existing `checklistItems` subscription |
| Toast notifications | UI-only (no data) |
| Skeleton loading | UI-only (no data) |
| Battery-bar | Existing project progress calculation |
| Filter pills | Client-side filter on existing data |
| Cmd+K palette | Aggregates existing projects + tasks in memory |
| Slide-over panel | Existing `getProject()` / `getChecklistItem()` |
| Workload heatmap | Existing `checklistItems` grouped by dept × status |
| DnD kanban | Existing `checklistItems` + `updateChecklistItem()` |
| View state persistence | localStorage only |

## New Directory: `js/ui/`

Separation of concerns — UI interaction modules live in `js/ui/`, page controllers stay in `js/pages/`.

```
js/
  ui/                    ← NEW: shared UI interaction modules
    toast.js             — Notyf singleton + dedup
    skeleton.js          — Placeholder management
    slide-over.js        — Peek panel component
    cmd-k.js             — Command palette registry
    filter-pills.js      — Pill state management
    inline-edit.js       — Optimistic update pattern
    dnd.js               — SortableJS wrapper
  pages/                 ← EXISTING: page controllers (import from ui/)
    dashboard.js
    projects.js
    project-detail.js
    ...
  firestore-service.js   ← EXISTING: no changes needed
  components.js          ← EXISTING: add cmd-k init, toast init
  utils.js               ← EXISTING: add optimisticUpdate() helper
```

## Optimistic Update Pattern

Central pattern for inline edits — update UI immediately, write to Firestore, rollback on error:

```js
// js/utils.js — shared utility
export async function optimisticUpdate({ element, field, oldValue, newValue, firestoreCall }) {
  // 1. Immediately update DOM
  element.dataset[field] = newValue;
  renderValue(element, newValue);

  try {
    // 2. Write to Firestore
    await firestoreCall(newValue);
    showToast('success', '저장됨');
  } catch (err) {
    // 3. Rollback on failure
    element.dataset[field] = oldValue;
    renderValue(element, oldValue);
    showToast('error', '저장 실패: ' + err.message);
  }
}
```

## Integration Points

### components.js additions
- `initToast()` — create Notyf instance, attach to window
- `initCommandPalette()` — register `<ninja-keys>` with singleton guard
- Both called from `renderNav()` (runs on every page)

### CSS additions (styles.css)
- `.skeleton` shimmer animation
- `.slide-over` panel positioning
- `.filter-pill` active/inactive states
- `.battery-bar` progress indicator
- `.inline-edit` dropdown styles
- View transition keyframes

### Page controller changes
- Each page adds filter pills and skeleton to its render cycle
- Dashboard adds inline approval buttons
- Projects kanban view adds DnD initialization
- Project detail adds slide-over triggers on task click
