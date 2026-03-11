// DnD wrapper for SortableJS with onSnapshot protection

let isDragging = false;
let pendingRender = null;

export function initSortable(containerEl, options = {}) {
  if (typeof Sortable === 'undefined') {
    console.warn('SortableJS not loaded');
    return null;
  }

  const sortable = new Sortable(containerEl, {
    animation: 150,
    ghostClass: 'dnd-ghost',
    chosenClass: 'dnd-chosen',
    dragClass: 'dnd-drag',
    ...options,
    onStart: (evt) => {
      isDragging = true;
      options.onStart?.(evt);
    },
    onEnd: (evt) => {
      isDragging = false;
      options.onEnd?.(evt);
      if (pendingRender) {
        pendingRender();
        pendingRender = null;
      }
    },
  });

  return sortable;
}

export function guardRender(renderFn) {
  if (isDragging) {
    pendingRender = renderFn;
    return false;
  }
  renderFn();
  return true;
}
