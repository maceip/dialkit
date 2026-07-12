// =============================================================================
// Rail preferences: dragged position + accent color (persisted per browser)
// =============================================================================

const POS_KEY = 'dialkit:annotations:rail-pos';
const ACCENT_KEY = 'dialkit:annotations:accent';
const THEME_KEY = 'dialkit:annotations:theme';

export type RailPos = { x: number; y: number };

export type RailTheme = 'auto' | 'light' | 'dark';

export const DEFAULT_ACCENT = '#0088ff';

export const RAIL_ACCENTS: { value: string; label: string }[] = [
  { value: '#0088ff', label: 'Blue' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#ef4444', label: 'Red' },
  { value: '#64748b', label: 'Slate' },
];

export function loadRailPos(): RailPos | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw) as RailPos;
    return typeof pos?.x === 'number' && typeof pos?.y === 'number' ? pos : null;
  } catch {
    return null;
  }
}

export function saveRailPos(pos: RailPos | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos));
    else localStorage.removeItem(POS_KEY);
  } catch {
    // ignore
  }
}

export function loadAccent(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(ACCENT_KEY);
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveAccent(value: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY);
    else localStorage.setItem(ACCENT_KEY, value);
  } catch {
    // ignore
  }
}

export function loadTheme(): RailTheme {
  if (typeof window === 'undefined') return 'auto';
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveTheme(value: RailTheme): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, value);
  } catch {
    // ignore
  }
}

export function clampRailPos(pos: RailPos, railW: number, railH: number): RailPos {
  const pad = 8;
  return {
    x: Math.min(Math.max(pos.x, pad), Math.max(pad, window.innerWidth - railW - pad)),
    y: Math.min(Math.max(pos.y, pad), Math.max(pad, window.innerHeight - railH - pad)),
  };
}
