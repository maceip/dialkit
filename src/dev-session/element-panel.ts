import { DialStore, type DialConfig, type DialValue } from '../store/DialStore';
import {
  CSS_INSPECTOR_PROPERTIES,
  applyCssOverride,
  readCssValues,
  type CssPropertyDef,
} from './css-inspector';
import type { ElementInfo } from '../utils/dom-inspect';

const ELEMENT_PANEL_PREFIX = 'dialkit:element:';

let activeElementPanelId: string | null = null;
let changeUnsub: (() => void) | null = null;
let activeElement: HTMLElement | null = null;

function hashSelector(selector: string): string {
  let h = 0;
  for (let i = 0; i < selector.length; i++) h = ((h << 5) - h) + selector.charCodeAt(i);
  return Math.abs(h).toString(36);
}

function panelIdFor(info: ElementInfo): string {
  return `${ELEMENT_PANEL_PREFIX}${info.dialkitId || hashSelector(info.selector)}`;
}

function cssKeyFromPath(path: string): string {
  return path.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function camelCase(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function parsePx(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function defToDialValue(def: CssPropertyDef, value: string): DialValue | [number, number, number, number] {
  if (def.type === 'color') return value || '#000000';
  if (def.type === 'number') return parseFloat(value) || 0;
  if (def.type === 'length') {
    const num = parsePx(value);
    return [num, 0, Math.max(Math.abs(num) * 3, 100), def.key === 'opacity' ? 0.01 : 1] as [number, number, number, number];
  }
  return value;
}

export function buildElementDialConfig(el: HTMLElement): DialConfig {
  const values = readCssValues(el);
  const config: DialConfig = {
    layout: {
      translateX: [0, -500, 500, 1],
      translateY: [0, -500, 500, 1],
    },
  };

  for (const def of CSS_INSPECTOR_PROPERTIES) {
    const raw = values[def.key];
    if (!raw) continue;
    config[camelCase(def.key)] = defToDialValue(def, raw);
  }

  return config;
}

function applyDialValueToElement(el: HTMLElement, path: string, value: DialValue): void {
  if (path === 'layout.translateX' || path === 'layout.translateY') {
    const current = getComputedStyle(el).transform;
    const match = current.match(/matrix\(([^)]+)\)/);
    let tx = 0;
    let ty = 0;
    if (match) {
      const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
      tx = parts[4] || 0;
      ty = parts[5] || 0;
    }
    const x = path === 'layout.translateX' ? Number(value) : tx;
    const y = path === 'layout.translateY' ? Number(value) : ty;
    el.style.transform = `translate(${x}px, ${y}px)`;
    return;
  }

  const cssKey = cssKeyFromPath(path);
  if (typeof value === 'number') {
    applyCssOverride(el, cssKey, cssKey === 'opacity' ? String(value) : `${value}px`);
  } else if (typeof value === 'string') {
    applyCssOverride(el, cssKey, value);
  }
}

export function registerElementDialPanel(el: HTMLElement, info: ElementInfo): string {
  unregisterElementDialPanel();
  const id = panelIdFor(info);
  const name = info.reactComponent ?? info.element ?? 'Element';
  const config = buildElementDialConfig(el);

  activeElement = el;
  activeElementPanelId = id;

  DialStore.registerPanel(id, name, config, {}, {
    retainOnUnmount: true,
    componentName: info.reactComponent ?? undefined,
    source: info.source,
  });

  changeUnsub = DialStore.subscribeChanges((event) => {
    if (event.panelId !== id || !activeElement) return;
    applyDialValueToElement(activeElement, event.path, event.value);
  });

  return id;
}

export function unregisterElementDialPanel(): void {
  changeUnsub?.();
  changeUnsub = null;
  if (activeElementPanelId) {
    DialStore.unregisterPanel(activeElementPanelId);
    activeElementPanelId = null;
  }
  activeElement = null;
}

export function getActiveElementPanelId(): string | null {
  return activeElementPanelId;
}
