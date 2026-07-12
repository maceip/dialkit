// =============================================================================
// Region-screenshot storage (local-only, linked to annotations by id)
// =============================================================================

import { getAnnotationProjectKey } from './storage';

const KEY_PREFIX = 'dialkit:screenshots:v1:';

type ScreenshotEntry = { at: number; dataUrl: string };
type ScreenshotMap = Record<string, ScreenshotEntry>;

function storageKey(pathname: string): string {
  return `${KEY_PREFIX}${getAnnotationProjectKey()}:${pathname}`;
}

function loadMap(pathname: string): ScreenshotMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(pathname));
    return raw ? (JSON.parse(raw) as ScreenshotMap) : {};
  } catch {
    return {};
  }
}

function saveMap(pathname: string, map: ScreenshotMap): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(storageKey(pathname));
    } else {
      localStorage.setItem(storageKey(pathname), JSON.stringify(map));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist a captured region. On quota pressure, evicts oldest screenshots for
 * the page until the new one fits (or gives up and reports false).
 */
export function saveScreenshot(pathname: string, id: string, dataUrl: string): boolean {
  const map = loadMap(pathname);
  map[id] = { at: Date.now(), dataUrl };
  if (saveMap(pathname, map)) return true;

  const byAge = Object.entries(map)
    .filter(([key]) => key !== id)
    .sort((a, b) => a[1].at - b[1].at);
  for (const [oldId] of byAge) {
    delete map[oldId];
    if (saveMap(pathname, map)) return true;
  }
  delete map[id];
  saveMap(pathname, map);
  return false;
}

export function loadScreenshot(pathname: string, id: string): string | null {
  return loadMap(pathname)[id]?.dataUrl ?? null;
}

export function deleteScreenshot(pathname: string, id: string): void {
  const map = loadMap(pathname);
  if (!(id in map)) return;
  delete map[id];
  saveMap(pathname, map);
}

export function clearScreenshots(pathname: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(pathname));
  } catch {
    // ignore
  }
}
