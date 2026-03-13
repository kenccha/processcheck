const VIEW_STATE_VERSION = 1;

export function saveViewState(page, state) {
  try {
    localStorage.setItem(`pc-view-${page}`, JSON.stringify({ version: VIEW_STATE_VERSION, ...state }));
  } catch { /* ignore */ }
}

export function loadViewState(page) {
  try {
    const raw = localStorage.getItem(`pc-view-${page}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== VIEW_STATE_VERSION) return null;
    const { version: _version, ...state } = parsed;
    return state;
  } catch { return null; }
}
