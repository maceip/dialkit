export interface ElementInfo {
  url: string;
  pathname: string;
  selector: string;
  element: string;
  reactComponent: string | null;
  reactStack: string[];
  framework?: 'react' | 'vue' | 'svelte' | 'solid' | null;
  dialkitId?: string;
  source?: { file: string; line?: number; column?: number };
  rect: { x: number; y: number; width: number; height: number };
}

import { parseSourceMeta } from './dialkit-target';

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function getReactFiber(el: Element | null): any {
  if (!el || el.nodeType !== 1) return null;
  const keys = Object.keys(el);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.indexOf('__reactFiber$') === 0 || k.indexOf('__reactInternalInstance$') === 0) {
      return (el as any)[k];
    }
  }
  return null;
}

function getVueComponent(el: Element | null): any {
  if (!el || el.nodeType !== 1) return null;
  return (el as any).__vueParentComponent ?? (el as any).__vue__ ?? null;
}

function getSvelteComponent(el: Element | null): any {
  if (!el || el.nodeType !== 1) return null;
  const keys = Object.keys(el);
  for (const k of keys) {
    if (k.startsWith('__svelte')) return (el as any)[k];
  }
  return null;
}

function getSolidOwner(el: Element | null): any {
  if (!el || el.nodeType !== 1) return null;
  return (el as any)._$owner ?? (el as any).$$component ?? null;
}

function fiberComponentName(fiber: any): string | null {
  let cur = fiber;
  let depth = 0;
  while (cur && depth < 40) {
    if (cur.type) {
      if (typeof cur.type === 'function') {
        return cur.type.displayName || cur.type.name || 'Anonymous';
      }
      if (typeof cur.type === 'object' && cur.type.displayName) {
        return cur.type.displayName;
      }
    }
    if (cur.elementType && typeof cur.elementType === 'function') {
      return cur.elementType.displayName || cur.elementType.name || 'Anonymous';
    }
    cur = cur.return;
    depth++;
  }
  return null;
}

function fiberStack(fiber: any): string[] {
  const names: string[] = [];
  let cur = fiber;
  let depth = 0;
  while (cur && depth < 12) {
    const name = fiberComponentName(cur);
    if (name && names[names.length - 1] !== name) names.push(name);
    cur = cur.return;
    depth++;
  }
  return names.reverse();
}

function vueStack(component: any): string[] {
  const names: string[] = [];
  let cur = component;
  let depth = 0;
  while (cur && depth < 12) {
    const name = cur.type?.name || cur.type?.__name || cur.type?.displayName;
    if (name && names[names.length - 1] !== name) names.push(name);
    cur = cur.parent;
    depth++;
  }
  return names.reverse();
}

function svelteStack(component: any): string[] {
  const names: string[] = [];
  if (component?.function?.name) names.push(component.function.name);
  return names;
}

function solidStack(owner: any): string[] {
  const names: string[] = [];
  let cur = owner;
  let depth = 0;
  while (cur && depth < 12) {
    const name = cur?.name || cur?.component?.name || cur?.owner?.name;
    if (name && names[names.length - 1] !== name) names.push(name);
    cur = cur.owner ?? cur.parent;
    depth++;
  }
  return names.reverse();
}

function readDialkitMeta(el: Element): Pick<ElementInfo, 'dialkitId' | 'source'> {
  let node: Element | null = el;
  while (node && node.nodeType === 1) {
    const id = node.getAttribute('data-dialkit-id');
    const source = parseSourceMeta(node.getAttribute('data-dialkit-source'));
    if (id || source) return { dialkitId: id ?? undefined, source: source ?? undefined };
    node = node.parentElement;
  }
  return {};
}

function detectComponentStack(el: Element): { stack: string[]; framework: ElementInfo['framework'] } {
  const fiber = getReactFiber(el);
  if (fiber) return { stack: fiberStack(fiber), framework: 'react' };
  const vue = getVueComponent(el);
  if (vue) return { stack: vueStack(vue), framework: 'vue' };
  const svelte = getSvelteComponent(el);
  if (svelte) return { stack: svelteStack(svelte), framework: 'svelte' };
  const solid = getSolidOwner(el);
  if (solid) return { stack: solidStack(solid), framework: 'solid' };
  return { stack: [], framework: null };
}

export function cssPath(el: Element | null): string {
  if (!el || el.nodeType !== 1) return '';
  const dkId = el.getAttribute('data-dialkit-id');
  if (dkId) return `[data-dialkit-id="${cssEscape(dkId)}"]`;
  if (el.id) return `#${cssEscape(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node !== document.documentElement) {
    let part = node.tagName.toLowerCase();
    const dk = node.getAttribute('data-dialkit-id');
    if (dk) {
      parts.unshift(`[data-dialkit-id="${cssEscape(dk)}"]`);
      break;
    }
    if (node.id) {
      parts.unshift(`#${cssEscape(node.id)}`);
      break;
    }
    const className = (node.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (className.length) {
      part += className.map((c) => `.${cssEscape(c)}`).join('');
    }
    const parent: Element | null = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child): child is Element => child instanceof Element && child.tagName === node!.tagName,
      );
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}

function elementLabel(el: Element): string {
  const tag = el.tagName ? el.tagName.toLowerCase() : 'node';
  const dk = el.getAttribute('data-dialkit-id');
  const id = el.id ? `#${el.id}` : '';
  const cls = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const classPart = cls.length ? `.${cls.join('.')}` : '';
  const text = ((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return (dk ? `[${dk}] ` : '') + tag + id + classPart + (text ? ` "${text}"` : '');
}

export function inspectElement(el: Element | null): ElementInfo | null {
  if (!el || el.nodeType !== 1) return null;
  const { stack, framework } = detectComponentStack(el);
  const meta = readDialkitMeta(el);
  const r = el.getBoundingClientRect();
  return {
    url: location.href,
    pathname: location.pathname,
    selector: cssPath(el),
    element: elementLabel(el),
    reactComponent: stack.length ? stack[stack.length - 1] : null,
    reactStack: stack,
    framework,
    dialkitId: meta.dialkitId,
    source: meta.source,
    rect: {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
    },
  };
}
