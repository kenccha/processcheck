# Pitfalls Research: v2.0 UX/UI 대규모 개선

**Researched:** 2026-03-12
**Confidence:** HIGH — 7 critical pitfalls identified from codebase analysis

## Critical Pitfalls (7)

### 1. DnD + onSnapshot Re-render Kills Active Drag

**Problem:** Firestore `onSnapshot` triggers DOM re-render while user is mid-drag. SortableJS loses its drag handle reference → item snaps back or duplicates.

**Solution:**
```js
let isDragging = false;
sortable.on('start', () => { isDragging = true; });
sortable.on('end', () => { isDragging = false; renderList(); });

// In onSnapshot callback:
if (!isDragging) renderList();
else pendingUpdate = data; // Apply after drag ends
```

**Impact:** Without this, kanban DnD will appear broken ~20% of the time on active projects.

### 2. HTML5 DnD Has No Touch Support

**Problem:** HTML5 Drag and Drop API doesn't fire on mobile Safari/Chrome. SortableJS has built-in touch support BUT requires `touch-action: none` CSS.

**Decision needed:** Desktop-only DnD vs. mobile polyfill. Recommendation: Desktop-only with graceful fallback (show sort buttons on mobile instead of DnD).

**Solution:**
```css
.kanban-card { touch-action: none; }
@media (max-width: 768px) {
  .kanban-card { touch-action: auto; }
  .sort-buttons { display: flex; }
}
```

### 3. Optimistic UI Rollback Race Condition

**Problem:** User changes status A→B, then immediately B→C before Firestore confirms A→B. If A→B fails and rolls back to A, the C state is now inconsistent.

**Solution:** Shared `optimisticUpdate()` utility with a per-item lock:
```js
const pendingUpdates = new Map();

async function optimisticUpdate(itemId, field, newValue, firestoreCall) {
  if (pendingUpdates.has(itemId)) await pendingUpdates.get(itemId);
  const promise = firestoreCall(newValue);
  pendingUpdates.set(itemId, promise);
  try { await promise; } finally { pendingUpdates.delete(itemId); }
}
```

### 4. CSS Slate Tokens — Inverted Light/Dark Mode

**Problem:** Some `--slate-*` values are inverted between modes. New UI components may look correct in one mode but broken in the other.

**Solution:** Additive-only CSS changes first. New components use semantic tokens (`--bg-surface`, `--text-primary`) not raw slate values. Audit existing token usage before changing values.

### 5. Cmd+K Listener Duplication

**Problem:** `renderNav()` runs on every page load. Cmd+K init inside `renderNav()` would duplicate keyboard listeners.

**Solution:** Singleton guard:
```js
let cmdKInitialized = false;
export function initCommandPalette() {
  if (cmdKInitialized) return;
  cmdKInitialized = true;
}
```

### 6. Toast Flooding from Bulk Operations

**Problem:** Bulk approve 20 items → 20 individual success toasts flood the screen.

**Solution:** Key-based deduplication + batch summary:
```js
showToast('success', `${count}건 승인 완료`, 'bulk-approve');
```

### 7. localStorage View State Versioning

**Problem:** Saved filter/view state crashes new code when schema changes.

**Solution:** Version field — discard if mismatch:
```js
const VIEW_STATE_VERSION = 1;
function loadViewState(page) {
  const parsed = JSON.parse(localStorage.getItem(`pc-view-${page}`));
  if (!parsed || parsed.version !== VIEW_STATE_VERSION) return null;
  return parsed;
}
```

## Medium Pitfalls (3)

### 8. Slide-over Z-index Conflicts
Existing modals use `z-index: 1000`. Slide-over: `z-index: 900`.

### 9. Filter Pill URL State Sync
URL params for shareable filters, localStorage for personal preferences (view mode, sort order).

### 10. ninja-keys Action Staleness
Refresh actions on each `onSnapshot` update or on palette open.
