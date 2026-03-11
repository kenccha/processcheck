// =============================================================================
// Custom Confirm Modal — replaces browser confirm()
// =============================================================================

let resolvePromise = null;

const overlay = document.createElement("div");
overlay.id = "confirm-modal-overlay";
overlay.innerHTML = `
  <div id="confirm-modal-box" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
    <p id="confirm-modal-title"></p>
    <div id="confirm-modal-actions">
      <button id="confirm-modal-cancel" class="btn-ghost">취소</button>
      <button id="confirm-modal-ok" class="btn-primary">확인</button>
    </div>
  </div>
`;

const style = document.createElement("style");
style.textContent = `
#confirm-modal-overlay {
  display:none; position:fixed; inset:0; z-index:9999;
  background:rgba(0,0,0,0.5); backdrop-filter:blur(2px);
  align-items:center; justify-content:center;
}
#confirm-modal-overlay.open { display:flex; }
#confirm-modal-box {
  background:var(--surface-2); border:1px solid var(--surface-3);
  border-radius:var(--radius-xl); padding:1.5rem; max-width:24rem; width:90%;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
#confirm-modal-title {
  color:var(--text-primary); font-size:0.9375rem; line-height:1.5; margin-bottom:1.25rem;
}
#confirm-modal-actions { display:flex; gap:0.5rem; justify-content:flex-end; }
#confirm-modal-actions button { min-width:4rem; padding:0.4rem 1rem; border-radius:var(--radius-md); font-size:0.8125rem; cursor:pointer; border:none; }
#confirm-modal-cancel { background:var(--surface-3); color:var(--text-secondary); }
#confirm-modal-cancel:hover { background:var(--surface-4); }
#confirm-modal-ok { background:var(--primary-500); color:white; }
#confirm-modal-ok:hover { background:var(--primary-600); }
`;

document.head.appendChild(style);
document.body.appendChild(overlay);

const box = overlay.querySelector("#confirm-modal-box");
const titleEl = overlay.querySelector("#confirm-modal-title");
const okBtn = overlay.querySelector("#confirm-modal-ok");
const cancelBtn = overlay.querySelector("#confirm-modal-cancel");

function close(result) {
  overlay.classList.remove("open");
  document.removeEventListener("keydown", onKey);
  if (resolvePromise) { resolvePromise(result); resolvePromise = null; }
}

function onKey(e) {
  if (e.key === "Escape") { close(false); return; }
  // Focus trap
  if (e.key === "Tab") {
    const focusable = [cancelBtn, okBtn];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

okBtn.addEventListener("click", () => close(true));
cancelBtn.addEventListener("click", () => close(false));
overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });

export function confirmModal(message) {
  return new Promise((resolve) => {
    resolvePromise = resolve;
    titleEl.textContent = message;
    overlay.classList.add("open");
    okBtn.focus();
    document.addEventListener("keydown", onKey);
  });
}
