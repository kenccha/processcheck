// =============================================================================
// Focus Trap — trap keyboard focus inside modals/dialogs
// =============================================================================

let activeContainer = null;
let escHandler = null;

function onKeyDown(e) {
  if (!activeContainer) return;

  // Escape to close
  if (e.key === "Escape") {
    if (escHandler) escHandler();
    return;
  }

  // Tab trap
  if (e.key === "Tab") {
    const focusable = activeContainer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

export function trapFocus(container, onEscape) {
  activeContainer = container;
  escHandler = onEscape || null;
  document.addEventListener("keydown", onKeyDown);

  // Auto-focus first focusable element
  requestAnimationFrame(() => {
    const first = container.querySelector(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    );
    if (first) first.focus();
  });
}

export function releaseFocus() {
  activeContainer = null;
  escHandler = null;
  document.removeEventListener("keydown", onKeyDown);
}
