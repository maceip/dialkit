import type { PanelConfig } from '../store/DialStore';
import type { ElementInfo } from '../utils/dom-inspect';

const GENERIC = new Set([
  'div', 'span', 'button', 'a', 'p', 'section', 'article', 'main', 'header', 'footer',
  'anonymous', 'anonymouscomponent', 'fragment', 'slot',
]);

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (GENERIC.has(a) || GENERIC.has(b)) return false;
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  return a.includes(b) || b.includes(a);
}

function scorePanel(panel: PanelConfig, stackNames: string[], innermost: string | undefined): number {
  let score = 0;
  const candidates = [
    panel.componentName,
    panel.name,
    panel.id,
    panel.source?.file.split('/').pop()?.replace(/\.\w+$/, ''),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const norm = normalizeName(candidate);
    for (const name of stackNames) {
      if (namesMatch(name, norm)) score += 10;
    }
    if (innermost && namesMatch(innermost, norm)) score += 20;
  }

  if (panel.source?.file && stackNames.length) score += 2;
  return score;
}

export function matchPanelForTarget(
  target: ElementInfo | null,
  panels: PanelConfig[],
): PanelConfig | null {
  if (!target || panels.length === 0) return null;

  const stackNames = (target.reactStack ?? []).map(normalizeName);
  const innermost = stackNames[stackNames.length - 1];

  let best: PanelConfig | null = null;
  let bestScore = 0;

  for (const panel of panels) {
    if (panel.id.startsWith('dialkit:element:')) continue;
    const score = scorePanel(panel, stackNames, innermost);
    if (score > bestScore) {
      bestScore = score;
      best = panel;
    }
  }

  if (best && bestScore >= 10) return best;
  if (!stackNames.length && panels.length === 1 && !panels[0]!.id.startsWith('dialkit:element:')) {
    return panels[0]!;
  }
  return null;
}
