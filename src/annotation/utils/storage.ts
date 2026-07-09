// =============================================================================
// Local-only annotation storage (DialKit)
// =============================================================================
//
// Annotations persist in browser localStorage under dialkit-prefixed keys.
// Hosted / MCP / cloud sync paths from upstream Agentation are intentionally
// omitted — use DevSessionStore for project-scoped agent notes.
//

import type { Annotation } from "../types";

const STORAGE_PREFIX = "dialkit:annotations:";
const DEFAULT_RETENTION_DAYS = 30;

export function getStorageKey(pathname: string): string {
  return `${STORAGE_PREFIX}${pathname}`;
}

export function loadAnnotations<T = Annotation>(pathname: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(getStorageKey(pathname));
    if (!stored) return [];
    const data = JSON.parse(stored);
    const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return data.filter((a: { timestamp?: number }) => !a.timestamp || a.timestamp > cutoff);
  } catch {
    return [];
  }
}

export function saveAnnotations<T = Annotation>(pathname: string, annotations: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(pathname), JSON.stringify(annotations));
  } catch {
    // localStorage might be full or disabled
  }
}

export function clearAnnotations(pathname: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getStorageKey(pathname));
  } catch {
    // ignore
  }
}

/**
 * Load all annotations from localStorage across all pages.
 * Returns a map of pathname -> annotations.
 */
export function loadAllAnnotations<T = Annotation>(): Map<string, T[]> {
  const result = new Map<string, T[]>();
  if (typeof window === "undefined") return result;

  try {
    const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const pathname = key.slice(STORAGE_PREFIX.length);
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          const filtered = data.filter(
            (a: { timestamp?: number }) => !a.timestamp || a.timestamp > cutoff
          );
          if (filtered.length > 0) {
            result.set(pathname, filtered);
          }
        }
      }
    }
  } catch {
    // ignore errors
  }

  return result;
}

// =============================================================================
// Layout Mode Storage
// =============================================================================

const DESIGN_PREFIX = "dialkit:annotation-design:";

export function loadDesignPlacements<T = unknown>(pathname: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(`${DESIGN_PREFIX}${pathname}`);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveDesignPlacements<T = unknown>(pathname: string, placements: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${DESIGN_PREFIX}${pathname}`, JSON.stringify(placements));
  } catch {
    // localStorage might be full or disabled
  }
}

export function clearDesignPlacements(pathname: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${DESIGN_PREFIX}${pathname}`);
  } catch {
    // ignore
  }
}

// =============================================================================
// Rearrange Mode Storage
// =============================================================================

const REARRANGE_PREFIX = "dialkit:annotation-rearrange:";

export function loadRearrangeState<T = unknown>(pathname: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${REARRANGE_PREFIX}${pathname}`);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveRearrangeState<T = unknown>(pathname: string, state: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${REARRANGE_PREFIX}${pathname}`, JSON.stringify(state));
  } catch {
    // localStorage might be full or disabled
  }
}

export function clearRearrangeState(pathname: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${REARRANGE_PREFIX}${pathname}`);
  } catch {
    // ignore
  }
}

// =============================================================================
// Wireframe Storage (persists wireframe state across page refresh)
// =============================================================================

const WIREFRAME_PREFIX = "dialkit:annotation-wireframe:";

export function loadWireframeState<T = unknown>(pathname: string): { rearrange: T | null; placements: unknown[]; purpose: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${WIREFRAME_PREFIX}${pathname}`);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveWireframeState(pathname: string, state: { rearrange: unknown; placements: unknown[]; purpose: string }): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${WIREFRAME_PREFIX}${pathname}`, JSON.stringify(state));
  } catch {
    // localStorage might be full or disabled
  }
}

export function clearWireframeState(pathname: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${WIREFRAME_PREFIX}${pathname}`);
  } catch {
    // ignore
  }
}

// =============================================================================
// Toolbar Visibility (per-tab session)
// =============================================================================

const TOOLBAR_HIDDEN_SESSION_KEY = "dialkit:annotation-toolbar-hidden";

export function loadToolbarHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(TOOLBAR_HIDDEN_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveToolbarHidden(hidden: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (hidden) {
      sessionStorage.setItem(TOOLBAR_HIDDEN_SESSION_KEY, "1");
    } else {
      sessionStorage.removeItem(TOOLBAR_HIDDEN_SESSION_KEY);
    }
  } catch {
    // ignore
  }
}
