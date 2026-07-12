import { DevSessionStore } from '../store/DevSessionStore';
import { inspectElement } from '../utils/dom-inspect';
import type { ElementInfo } from '../utils/dom-inspect';
import { registerElementDialPanel, unregisterElementDialPanel } from './element-panel';
import { listComputedStyleDefs } from './computed-styles';
import { buildCssPatch } from './css-patch';
import { globalCssUndo } from './css-undo';
import {
  CSS_INSPECTOR_PROPERTIES,
  applyCssOverride,
  readCssValues,
  type CssPropertyDef,
} from './css-inspector';
import { MoveTool } from './layout-tools';

export interface DevSessionHostOptions {
  projectKey?: string;
}

type HostListener = () => void;

let activeHost: DevSessionHost | null = null;

export class DevSessionHost {
  private root: HTMLDivElement;
  private contextMenu: HTMLDivElement;
  private cssPanel: HTMLDivElement;
  private listeners = new Set<HostListener>();
  private targetEl: Element | null = null;
  private targetInfo: ElementInfo | null = null;
  private cssTarget: HTMLElement | null = null;
  private cssValues: Record<string, string> = {};
  private cssMode: 'common' | 'all' = 'common';
  private menuPos = { x: 0, y: 0 };
  private unsubStore: (() => void) | null = null;
  private projectKey: string;
  private moveTool = new MoveTool();

  constructor(options: DevSessionHostOptions = {}) {
    this.projectKey = options.projectKey ?? 'default';
    this.root = document.createElement('div');
    this.root.className = 'dialkit-dev-host';
    this.contextMenu = this.createContextMenu();
    this.cssPanel = this.createCssPanel();
    this.root.append(this.contextMenu, this.cssPanel);
  }

  mount(): () => void {
    if (activeHost && activeHost !== this) activeHost.unmount();
    activeHost = this;
    DevSessionStore.configure(this.projectKey);
    document.body.appendChild(this.root);
    document.addEventListener('contextmenu', this.onContextMenu, true);
    document.addEventListener('click', this.onDocumentClick, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    this.unsubStore = DevSessionStore.subscribe(() => this.notify());
    return () => this.unmount();
  }

  unmount(): void {
    if (activeHost === this) activeHost = null;
    document.removeEventListener('contextmenu', this.onContextMenu, true);
    document.removeEventListener('click', this.onDocumentClick, true);
    document.removeEventListener('keydown', this.onKeyDown, true);
    this.unsubStore?.();
    this.unsubStore = null;
    this.moveTool.stop();
    unregisterElementDialPanel();
    this.clearTargetHighlight();
    this.hideAll();
    this.root.remove();
  }

  subscribe(listener: HostListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setTarget(el: Element | null, options?: { registerDialPanel?: boolean }): void {
    this.clearTargetHighlight();
    this.targetEl = el;
    this.targetInfo = el ? inspectElement(el) : null;
    if (el) {
      el.classList.add('dialkit-feedback-selected');
      if (options?.registerDialPanel && el instanceof HTMLElement && this.targetInfo) {
        registerElementDialPanel(el, this.targetInfo);
      }
    } else {
      unregisterElementDialPanel();
    }
    this.notify();
  }

  tagTarget(el: Element): void {
    this.setTarget(el, { registerDialPanel: false });
  }

  getTarget(): Element | null {
    return this.targetEl;
  }

  getTargetInfo(): ElementInfo | null {
    return this.targetInfo;
  }


  openCssInspector(el?: HTMLElement): void {
    const target = el ?? (this.targetEl instanceof HTMLElement ? this.targetEl : null);
    if (!target) return;
    this.tagTarget(target);
    this.cssTarget = target;
    this.cssValues = readCssValues(target);
    this.renderCssFields();
    this.cssPanel.hidden = false;
    this.contextMenu.hidden = true;
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private onContextMenu = (e: MouseEvent): void => {
    const el = e.target as Element | null;
    if (!el || el.closest('.dialkit-root, .dialkit-dev-host, [data-dialkit-annotation-toolbar], [data-dialkit-annotation-root]')) return;
    e.preventDefault();
    e.stopPropagation();
    this.setTarget(el, { registerDialPanel: false });
    this.menuPos = { x: e.clientX, y: e.clientY };
    this.positionFloating(this.contextMenu, e.clientX, e.clientY);
    this.contextMenu.hidden = false;
    this.cssPanel.hidden = true;
  };

  private onDocumentClick = (e: MouseEvent): void => {
    const t = e.target as Node | null;
    if (!t) return;
    if (this.contextMenu.contains(t) || this.cssPanel.contains(t)) return;
    this.hideAll();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.hideAll();
      this.clearTargetHighlight();
      this.targetEl = null;
      this.targetInfo = null;
      unregisterElementDialPanel();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], .dialkit-root')) return;
      if (this.cssPanel.hidden) return;
      if (e.shiftKey) this.redoCss();
      else this.undoCss();
      e.preventDefault();
    }
  };

  private hideAll(): void {
    this.contextMenu.hidden = true;
    this.cssPanel.hidden = true;
    this.moveTool.stop();
  }

  private clearTargetHighlight(): void {
    this.targetEl?.classList.remove('dialkit-feedback-selected');
    document.querySelectorAll('.dialkit-feedback-highlight').forEach((n) => {
      n.classList.remove('dialkit-feedback-highlight');
    });
  }

  private positionFloating(el: HTMLElement, x: number, y: number): void {
    const pad = 8;
    const rect = { width: 280, height: 220 };
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    el.style.left = `${Math.max(pad, left)}px`;
    el.style.top = `${Math.max(pad, top)}px`;
  }

  private createContextMenu(): HTMLDivElement {
    const menu = document.createElement('div');
    menu.className = 'dialkit-dev-context-menu';
    menu.hidden = true;
    menu.innerHTML = `
      <button type="button" data-action="css">Edit styles</button>
      <button type="button" data-action="dial">Open dial panel</button>
      <button type="button" data-action="move">Move</button>
    `;
    menu.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest('[data-action]');
      if (!btn || !(this.targetEl instanceof HTMLElement)) return;
      const action = btn.getAttribute('data-action');
      if (action === 'css') this.openCssInspector(this.targetEl);
      if (action === 'dial' && this.targetEl instanceof HTMLElement && this.targetInfo) {
        registerElementDialPanel(this.targetEl, this.targetInfo);
        this.contextMenu.hidden = true;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dialkit:open-dials'));
        }
      }
      if (action === 'move') {
        this.contextMenu.hidden = true;
        const start = (ev: MouseEvent) => {
          this.moveTool.start(this.targetEl as HTMLElement, ev);
          document.removeEventListener('mousedown', start, true);
        };
        document.addEventListener('mousedown', start, true);
      }
    });
    return menu;
  }




  private createCssPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'dialkit-dev-css-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="dialkit-dev-css-head">
        <strong>Style editor</strong>
        <button type="button" data-close>&times;</button>
      </div>
      <div class="dialkit-dev-css-toolbar">
        <button type="button" data-undo>Undo</button>
        <button type="button" data-redo>Redo</button>
        <button type="button" data-mode>All props</button>
        <button type="button" data-patch>Copy patch</button>
      </div>
      <div class="dialkit-dev-css-fields"></div>
    `;
    panel.querySelector('[data-close]')?.addEventListener('click', () => { panel.hidden = true; });
    panel.querySelector('[data-undo]')?.addEventListener('click', () => this.undoCss());
    panel.querySelector('[data-redo]')?.addEventListener('click', () => this.redoCss());
    panel.querySelector('[data-mode]')?.addEventListener('click', (e) => {
      this.cssMode = this.cssMode === 'common' ? 'all' : 'common';
      const btn = e.currentTarget as HTMLButtonElement;
      btn.textContent = this.cssMode === 'common' ? 'All props' : 'Common';
      this.renderCssFields();
    });
    panel.querySelector('[data-patch]')?.addEventListener('click', async () => {
      const patch = buildCssPatch(DevSessionStore.getPendingCssOverrides());
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(patch);
    });
    return panel;
  }

  private undoCss(): void {
    const entry = globalCssUndo.undo();
    if (!entry || !this.cssTarget) return;
    applyCssOverride(this.cssTarget, entry.property, entry.previousValue);
    this.cssValues[entry.property] = entry.previousValue;
    this.renderCssFields();
  }

  private redoCss(): void {
    const entry = globalCssUndo.redo();
    if (!entry || !this.cssTarget) return;
    applyCssOverride(this.cssTarget, entry.property, entry.nextValue);
    this.cssValues[entry.property] = entry.nextValue;
    this.renderCssFields();
  }

  private renderCssFields(): void {
    const container = this.cssPanel.querySelector('.dialkit-dev-css-fields');
    if (!container || !this.cssTarget) return;
    container.innerHTML = '';
    const defs = this.cssMode === 'all'
      ? listComputedStyleDefs(this.cssTarget)
      : this.getRelevantDefs(this.cssTarget);
    for (const def of defs) {
      const row = document.createElement('label');
      row.className = 'dialkit-dev-css-row';
      const value = this.cssValues[def.key] ?? '';
      row.innerHTML = `<span>${escapeHtml(def.label)}</span>`;
      row.appendChild(this.createCssInput(def, value));
      container.appendChild(row);
    }
  }

  private getRelevantDefs(el: HTMLElement): CssPropertyDef[] {
    const isSvg = el instanceof SVGElement || Boolean((el as Element & { ownerSVGElement?: SVGSVGElement }).ownerSVGElement);
    return CSS_INSPECTOR_PROPERTIES.filter((def) => {
      if (def.key === 'stroke' || def.key === 'stroke-width' || def.key === 'fill') return isSvg;
      return def.key !== 'stroke' && def.key !== 'stroke-width' && def.key !== 'fill';
    });
  }

  private createCssInput(def: CssPropertyDef, value: string): HTMLElement {
    if (def.type === 'select' && def.options) {
      const select = document.createElement('select');
      for (const opt of def.options) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === value) o.selected = true;
        select.appendChild(o);
      }
      select.addEventListener('change', () => this.commitCss(def.key, select.value));
      return select;
    }
    const input = document.createElement('input');
    input.type = def.type === 'color' ? 'color' : def.type === 'number' ? 'number' : 'text';
    input.value = def.type === 'color' ? toHexColor(value) : value;
    input.addEventListener('change', () => this.commitCss(def.key, input.value));
    input.addEventListener('input', () => {
      if (def.type === 'color' || def.type === 'number') this.commitCss(def.key, input.value);
    });
    if (def.type === 'color' && supportsEyeDropper()) {
      const wrap = document.createElement('span');
      wrap.className = 'dialkit-dev-color-field';
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'dialkit-dev-eyedropper';
      pick.title = 'Pick color from screen';
      pick.setAttribute('aria-label', 'Pick color from screen');
      pick.innerHTML = EYEDROPPER_SVG;
      pick.addEventListener('click', async (e) => {
        e.preventDefault();
        const hex = await pickScreenColor();
        if (!hex) return;
        input.value = hex;
        this.commitCss(def.key, hex);
      });
      wrap.append(input, pick);
      return wrap;
    }
    return input;
  }

  private commitCss(property: string, value: string): void {
    if (!this.cssTarget || !this.targetInfo) return;
    const previous = applyCssOverride(this.cssTarget, property, value);
    globalCssUndo.push({
      selector: this.targetInfo.selector,
      property,
      previousValue: previous,
      nextValue: value,
    });
    this.cssValues[property] = value;
    DevSessionStore.logCssOverride({
      selector: this.targetInfo.selector,
      element: this.targetInfo.element,
      property,
      value,
      previousValue: previous,
      target: this.targetInfo,
    });
    this.notify();
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface EyeDropperApi {
  open(): Promise<{ sRGBHex: string }>;
}

function supportsEyeDropper(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window;
}

/** Native EyeDropper (Chromium): pick any pixel on screen. Null on cancel. */
async function pickScreenColor(): Promise<string | null> {
  try {
    const Ctor = (window as unknown as { EyeDropper: new () => EyeDropperApi }).EyeDropper;
    const result = await new Ctor().open();
    return result.sRGBHex;
  } catch {
    return null; // user pressed Escape
  }
}

const EYEDROPPER_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m18.4 3.6-2.5 2.5-.9-.9a1.3 1.3 0 0 0-1.8 1.8l.9.9-8.2 8.2c-.3.3-.5.7-.6 1.1l-.6 2.6a.7.7 0 0 0 .9.9l2.6-.6c.4-.1.8-.3 1.1-.6l8.2-8.2.9.9a1.3 1.3 0 0 0 1.8-1.8l-.9-.9 2.5-2.5a2.1 2.1 0 1 0-3-3l-.4.4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function toHexColor(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = value || '#000000';
  const normalized = ctx.fillStyle;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : '#000000';
}

export function mountDevSessionHost(options?: DevSessionHostOptions): () => void {
  const host = new DevSessionHost(options);
  return host.mount();
}

export function getDevSessionHost(): DevSessionHost | null {
  return activeHost;
}

export function unmountDevSessionHost(): void {
  activeHost?.unmount();
}
