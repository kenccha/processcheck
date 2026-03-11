// Toast notification system using Notyf
// Singleton instance, key-based deduplication for bulk operations

let notyfInstance = null;
const activeToasts = new Map();

function getNotyf() {
  if (!notyfInstance) {
    notyfInstance = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'bottom' },
      dismissible: true,
      ripple: false,
      types: [
        { type: 'success', background: '#16a34a', icon: false },
        { type: 'error', background: '#dc2626', icon: false },
        { type: 'warning', background: '#d97706', className: 'notyf-warning', icon: false },
        { type: 'info', background: '#0891b2', className: 'notyf-info', icon: false },
      ]
    });
  }
  return notyfInstance;
}

export function showToast(type, message, key = null) {
  if (key && activeToasts.has(key)) return;
  const notyf = getNotyf();
  const toast = notyf.open({ type, message });
  if (key) {
    activeToasts.set(key, toast);
    toast.on('dismiss', () => activeToasts.delete(key));
  }
  return toast;
}

export function initToast() {
  // Just ensure instance exists
  getNotyf();
}
