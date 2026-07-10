// =============================================================================
// DialKit annotation storage (local-only, vendored Agentation shape)
// =============================================================================

import type { Annotation } from '../types';

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = `dialkit:annotations:v${STORAGE_VERSION}:`;
const DEFAULT_RETENTION_DAYS = 7;
const TOOLBAR_HIDDEN_SESSION_KEY = 'dialkit:annotations:toolbar-hidden';

let activeProjectKey = 'default';

/** Scope annotation localStorage keys by DialKit projectKey. */
export function setAnnotationProjectKey(projectKey: string): void {
  activeProjectKey = projectKey || 'default';
}

export function getAnnotationProjectKey(): string {
  return activeProjectKey;
}

export function getStorageKey(pathname: string, projectKey = activeProjectKey): string {
  return `${STORAGE_PREFIX}${projectKey}:${pathname}`;
}

export function loadAnnotations<T = Annotation>(pathname: string): T[] {
  if (typeof window === 'undefined') return [];
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
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(pathname), JSON.stringify(annotations));
  } catch {
    // localStorage might be full or disabled
  }
}

export function clearAnnotations(pathname: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getStorageKey(pathname));
  } catch {
    // ignore
  }
}

/**
 * Load all annotations from localStorage for the active project.
 * Returns a map of pathname -> annotations.
 */
export function loadAllAnnotations<T = Annotation>(): Map<string, T[]> {
  const result = new Map<string, T[]>();
  if (typeof window === 'undefined') return result;

  try {
    const projectPrefix = `${STORAGE_PREFIX}${activeProjectKey}:`;
    const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(projectPrefix)) continue;
      const pathname = key.slice(projectPrefix.length);
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      const data = JSON.parse(stored);
      const filtered = data.filter(
        (a: { timestamp?: number }) => !a.timestamp || a.timestamp > cutoff,
      );
      if (filtered.length > 0) result.set(pathname, filtered);
    }
  } catch {
    // ignore errors
  }

  return result;
}

// Sync-marker helpers kept as no-ops / locals for toolbar API compatibility.
type AnnotationWithSyncMarker = Annotation & { _syncedTo?: string };

export function saveAnnotationsWithSyncMarker(
  pathname: string,
  annotations: Annotation[],
  _sessionId: string,
): void {
  saveAnnotations(pathname, annotations);
}

export function getUnsyncedAnnotations(pathname: string, _sessionId?: string): Annotation[] {
  return loadAnnotations<AnnotationWithSyncMarker>(pathname);
}

export function clearSyncMarkers(pathname: string): void {
  const annotations = loadAnnotations<AnnotationWithSyncMarker>(pathname);
  const cleaned = annotations.map((annotation) => {
    const { _syncedTo: _drop, ...rest } = annotation;
    return rest as Annotation;
  });
  saveAnnotations(pathname, cleaned);
}

// Design / rearrange / wireframe — stubs (not used; design-mode disabled)
export function loadDesignPlacements<T = unknown>(_pathname: string): T[] {
  return [];
}
export function saveDesignPlacements<T = unknown>(_pathname: string, _placements: T[]): void {}
export function clearDesignPlacements(_pathname: string): void {}
export function loadRearrangeState<T = unknown>(_pathname: string): T | null {
  return null;
}
export function saveRearrangeState<T = unknown>(_pathname: string, _state: T): void {}
export function clearRearrangeState(_pathname: string): void {}
export function loadWireframeState<T = unknown>(
  _pathname: string,
): { rearrange: T | null; placements: unknown[]; purpose: string } | null {
  return null;
}
export function saveWireframeState(
  _pathname: string,
  _state: { rearrange: unknown; placements: unknown[]; purpose: string },
): void {}
export function clearWireframeState(_pathname: string): void {}

// Session ids unused without sync — keep API so toolbar imports compile
export function getSessionStorageKey(pathname: string): string {
  return `${STORAGE_PREFIX}session:${activeProjectKey}:${pathname}`;
}
export function loadSessionId(_pathname: string): string | null {
  return null;
}
export function saveSessionId(_pathname: string, _sessionId: string): void {}
export function clearSessionId(_pathname: string): void {}

export function loadToolbarHidden(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(TOOLBAR_HIDDEN_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveToolbarHidden(hidden: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (hidden) sessionStorage.setItem(TOOLBAR_HIDDEN_SESSION_KEY, '1');
    else sessionStorage.removeItem(TOOLBAR_HIDDEN_SESSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * One-shot migration from DialKit DevSession notes (v2) into annotation storage.
 */
export function migrateDevSessionNotes(projectKey: string): void {
  if (typeof window === 'undefined') return;
  const legacyKey = `dialkit:dev-session:v2:${projectKey}`;
  const flagKey = `dialkit:annotations:migrated:${projectKey}`;
  try {
    if (localStorage.getItem(flagKey) === '1') return;
    const raw = localStorage.getItem(legacyKey);
    if (!raw) {
      localStorage.setItem(flagKey, '1');
      return;
    }
    const parsed = JSON.parse(raw) as {
      notes?: Array<{
        id: string;
        comment: string;
        pagePath?: string;
        selector?: string;
        element?: string;
        createdAt?: string;
        reactComponent?: string | null;
      }>;
    };
    const byPath = new Map<string, Annotation[]>();
    for (const note of parsed.notes ?? []) {
      const pathname = note.pagePath || '/';
      const list = byPath.get(pathname) ?? [];
      list.push({
        id: note.id,
        x: 50,
        y: 120,
        comment: note.comment || '',
        element: note.element || note.reactComponent || 'Element',
        elementPath: note.selector || '',
        timestamp: note.createdAt ? Date.parse(note.createdAt) || Date.now() : Date.now(),
        reactComponents: note.reactComponent ?? undefined,
      });
      byPath.set(pathname, list);
    }
    const prevKey = activeProjectKey;
    setAnnotationProjectKey(projectKey);
    for (const [pathname, annotations] of byPath) {
      const existing = loadAnnotations(pathname);
      saveAnnotations(pathname, [...existing, ...annotations]);
    }
    setAnnotationProjectKey(prevKey);
    localStorage.setItem(flagKey, '1');
  } catch {
    // ignore migration failures
  }
}
