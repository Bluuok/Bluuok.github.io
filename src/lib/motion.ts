/**
 * Bluuok Studio — Unified Motion Preferences & Lifecycle Controller
 * Effective reduced motion = systemReduced || userReduced === true.
 * In-memory state is prioritized; storage write failures do not break session state.
 */

export const STORAGE_KEY = 'bluuok-reduced-motion';

export interface MotionState {
  systemReduced: boolean;
  userReduced: boolean | null; // null = follow system
  isReduced: boolean;          // effective state: systemReduced || userReduced === true
}

export type MotionListener = (state: MotionState) => void;

const listeners = new Set<MotionListener>();

// Module-level in-memory cache
let cachedUserReduced: boolean | null = null;
let initialized = false;

function readStorage(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'true') return true;
    if (val === 'false') return false;
  } catch (err) {
    console.warn('[motion] Failed to read localStorage:', err);
  }
  return null;
}

function writeStorage(val: boolean | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (val === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(val));
    }
  } catch (err) {
    console.warn('[motion] Failed to write localStorage:', err);
  }
}

function ensureInitialized(): void {
  if (!initialized && typeof window !== 'undefined') {
    cachedUserReduced = readStorage();
    initialized = true;
  }
}

export function getMotionState(): MotionState {
  ensureInitialized();
  const systemReduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  // System reduced motion ALWAYS takes precedence
  const isReduced = systemReduced || cachedUserReduced === true;
  return { systemReduced, userReduced: cachedUserReduced, isReduced };
}

function applyDOM(state: MotionState): void {
  if (typeof document === 'undefined') return;
  const targetReduced = state.isReduced;
  document.documentElement.classList.toggle('reduced-motion', targetReduced);
  if (document.body) {
    document.body.classList.toggle('reduced-motion', targetReduced);
  }
}

function notify(): void {
  const state = getMotionState();
  applyDOM(state);
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (e) {
      console.error('[motion] listener error:', e);
    }
  }
}

export function setUserReduced(reduced: boolean | null): void {
  ensureInitialized();
  // 1. Update in-memory state first so motion updates immediately
  cachedUserReduced = reduced;
  notify();
  // 2. Safely attempt persistence
  writeStorage(reduced);
}

export function subscribeMotion(fn: MotionListener): () => void {
  ensureInitialized();
  listeners.add(fn);
  try {
    fn(getMotionState());
  } catch (e) {
    console.error('[motion] initial subscribe error:', e);
  }
  return () => {
    listeners.delete(fn);
  };
}

// Global window listeners for system changes & multi-tab storage sync
if (typeof window !== 'undefined') {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', () => {
    notify();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cachedUserReduced = readStorage();
      notify();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyDOM(getMotionState()), { once: true });
  } else {
    applyDOM(getMotionState());
  }
}
