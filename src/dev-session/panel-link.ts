import type { PanelConfig } from '../store/DialStore';
import type { ElementInfo } from '../utils/dom-inspect';

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

export function matchPanelForTarget(
  target: ElementInfo | null,
  panels: PanelConfig[],
): PanelConfig | null {
  if (!target || panels.length === 0) return null;

  const stackNames = (target.reactStack ?? []).map(normalizeName);
  const innermost = stackNames[stackNames.length - 1];

  for (const panel of panels) {
    const candidates = [
      normalizeName(panel.name),
      normalizeName(panel.id),
      panel.componentName ? normalizeName(panel.componentName) : '',
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (stackNames.some((name) => namesMatch(name, candidate))) {
        return panel;
      }
    }
  }

  if (innermost) {
    for (const panel of panels) {
      const candidate = normalizeName(panel.name);
      if (namesMatch(innermost, candidate)) return panel;
    }
  }

  return panels.length === 1 ? panels[0]! : null;
}
