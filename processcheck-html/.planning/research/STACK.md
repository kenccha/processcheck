# Stack Research: v2.0 UX/UI 대규모 개선

**Researched:** 2026-03-12
**Constraint:** No build step. CDN-deliverable only. No framework migration.

## New Libraries Needed (3 only)

| Library | Version | Purpose | Delivery | Size |
|---------|---------|---------|----------|------|
| SortableJS | 1.15.7 | Kanban DnD | CDN `<script>` (not importmap — UMD global) | 44KB min |
| ninja-keys | 1.2.2 | Cmd+K command palette | CDN `<script type="module">` web component | 18KB min |
| Notyf | 3.10.0 | Toast notifications | jsDelivr ES module via importmap | 5KB min+css |

### Why these specific versions
- **SortableJS**: Most mature DnD for sortable lists. No touch polyfill needed (built-in). CDN `<script>` tag, exposes `window.Sortable`. Not in importmap because it's UMD.
- **ninja-keys**: Web component, zero framework dependency. `<ninja-keys>` custom element — just add to HTML. Supports dynamic action registration.
- **Notyf**: Smallest toast library with ES module support. Replaces all `alert()` calls. Supports success/error/warning types + custom duration.

## Features Requiring ZERO Libraries (7)

| Feature | Implementation |
|---------|---------------|
| Skeleton loading | Pure CSS `.skeleton` class with shimmer animation |
| Slide-over panel | CSS transform + JS toggle (like existing modals) |
| View transitions | CSS `@keyframes` fade/slide, `requestAnimationFrame` |
| Filter pills | HTML `<button>` with `.active` toggle + CSS |
| Hover-reveal actions | CSS `:hover` + `opacity` transition |
| Battery-bar progress | CSS `linear-gradient` + width percentage |
| Animations | CSS `transition` on existing elements |

## CDN Integration Pattern

```html
<!-- In importmap (add to existing) -->
<script type="importmap">
{
  "imports": {
    "notyf": "https://cdn.jsdelivr.net/npm/notyf@3.10.0/+esm"
  }
}
</script>

<!-- Notyf CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/notyf@3.10.0/notyf.min.css">

<!-- SortableJS (UMD — before closing </body>) -->
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/Sortable.min.js"></script>

<!-- ninja-keys (web component) -->
<script type="module" src="https://cdn.jsdelivr.net/npm/ninja-keys@1.2.2/dist/ninja-keys.min.js"></script>
```

## New Module Structure

```
js/ui/
  toast.js          — Notyf wrapper, key-based dedup, bulk throttle
  skeleton.js       — Show/hide skeleton placeholders
  slide-over.js     — Peek panel for project/task preview
  cmd-k.js          — ninja-keys action registry, singleton guard
  filter-pills.js   — Pill rendering, URL state sync, clear-all
  inline-edit.js    — Status/assignee dropdown, optimistic update
  dnd.js            — SortableJS kanban wrapper, isDragging flag
```

## Build Order (dependency chain)

1. **Toast + Skeleton + CSS tokens** — foundation, no deps
2. **Cmd+K + Filter pills** — need toast for feedback
3. **Inline edit + Slide-over** — need toast for confirmation
4. **DnD + Heatmap** — need inline-edit patterns, most complex
