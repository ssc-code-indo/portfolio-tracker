// ── GLOBAL STATE ─────────────────────────────────────────
// Single source of truth, persisted to localStorage

const DB_KEY = 'portfolio_v2';

const DEFAULT_STATE = {
  holdings:      [],   // equity, mf, gold, fd, savings
  expenses:      [],
  salarySlips:   [],
  policies:      [],
  importedFiles: [],
  snapshots:     [],
  // FX rates (fetched live)
  usdInr:  84,
  inrIdr:  189,
  // Settings
  currency:     'INR',
  displayMode:  'dark',
};

let _state = null;
let _listeners = new Set();

export function getState() {
  if (_state) return _state;
  try {
    const saved = localStorage.getItem(DB_KEY);
    _state = saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : { ...DEFAULT_STATE };
  } catch {
    _state = { ...DEFAULT_STATE };
  }
  return _state;
}

export function setState(updater) {
  const prev = getState();
  _state = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(_state));
  } catch (e) {
    console.error('Save failed:', e);
  }
  _listeners.forEach(fn => fn(_state));
}

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function useAppState() {
  // Used by React components via useSyncExternalStore
  return getState();
}
