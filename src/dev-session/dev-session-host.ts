import { DevSessionStore } from '../store/DevSessionStore';
import { DialStore } from '../store/DialStore';
import { inspectElement } from '../utils/dom-inspect';
import type { ElementInfo } from '../utils/dom-inspect';
import { matchPanelForTarget } from './panel-link';
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
import {
  MoveTool,
  alignElement,
  showMeasureOverlay,
  type MeasureOverlay,
} from './layout-tools';
import { requestScreenshot } from './screenshot';

export interface DevSessionHostOptions {
  projectKey?: string;
}

type HostListener = () => void;

let activeHost: DevSessionHost | null = null;

export class DevSessionHost {
  private root: HTMLDivElement;
  private contextMenu: HTMLDivElement;
  private noteComposer: HTMLDivElement;
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
  private measureOverlay: MeasureOverlay | null = null;

  constructor(options: DevSessionHostOptions = {}) {
    this.projectKey = options.projectKey ?? 'default';
    this.root = document.createElement('div');
    this.root.className = 'dialkit-dev-host';
    this.contextMenu = this.createContextMenu();
    this.noteComposer = this.createNoteComposer();
    this.cssPanel = this.createCssPanel();
    this.root.append(this.contextMenu, this.noteComposer, this.cssPanel);
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
    this.measureOverlay?.cleanup();
    this.measureOverlay = null;
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

  openNoteComposer(x?: number, y?: number): void {
    if (x !== undefined && y !== undefined) this.menuPos = { x, y };
    this.positionFloating(this.noteComposer, this.menuPos.x, this.menuPos.y);
    const textarea = this.noteComposer.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) setTimeout(() => textarea.focus(), 0);
    this.updateNoteComposerMeta();
    this.noteComposer.hidden = false;
    this.contextMenu.hidden = true;
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
    this.noteComposer.hidden = true;
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private onContextMenu = (e: MouseEvent): void => {
    const el = e.target as Element | null;
    if (!el || el.closest('.dialkit-root, .dialkit-dev-host')) return;
    e.preventDefault();
    e.stopPropagation();
    this.setTarget(el, { registerDialPanel: false });
    this.menuPos = { x: e.clientX, y: e.clientY };
    this.positionFloating(this.contextMenu, e.clientX, e.clientY);
    this.contextMenu.hidden = false;
    this.noteComposer.hidden = true;
    this.cssPanel.hidden = true;
  };

  private onDocumentClick = (e: MouseEvent): void => {
    const t = e.target as Node | null;
    if (!t) return;
    if (this.contextMenu.contains(t) || this.noteComposer.contains(t) || this.cssPanel.contains(t)) return;
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
    this.noteComposer.hidden = true;
    this.cssPanel.hidden = true;
    this.measureOverlay?.cleanup();
    this.measureOverlay = null;
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
      <button type="button" data-action="note">Leave note</button>
      <button type="button" data-action="css">Edit styles</button>
      <button type="button" data-action="dial">Open dial panel</button>
      <button type="button" data-action="measure">Measure</button>
      <button type="button" data-action="move">Move</button>
      <button type="button" data-action="align-left">Align left</button>
      <button type="button" data-action="align-center">Align center</button>
      <button type="button" data-action="align-right">Align right</button>
    `;
    menu.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest('[data-action]');
      if (!btn || !(this.targetEl instanceof HTMLElement)) return;
      const action = btn.getAttribute('data-action');
      if (action === 'note') this.openNoteComposer(this.menuPos.x, this.menuPos.y);
      if (action === 'css') this.openCssInspector(this.targetEl);
      if (action === 'dial' && this.targetEl instanceof HTMLElement && this.targetInfo) {
        registerElementDialPanel(this.targetEl, this.targetInfo);
        this.contextMenu.hidden = true;
      }
      if (action === 'measure') {
        this.measureOverlay?.cleanup();
        this.measureOverlay = showMeasureOverlay(this.targetEl);
        this.contextMenu.hidden = true;
      }
      if (action === 'move') {
        this.contextMenu.hidden = true;
        const start = (ev: MouseEvent) => {
          this.moveTool.start(this.targetEl as HTMLElement, ev);
          document.removeEventListener('mousedown', start, true);
        };
        document.addEventListener('mousedown', start, true);
      }
      if (action === 'align-left') { alignElement(this.targetEl, 'left'); this.contextMenu.hidden = true; }
      if (action === 'align-center') { alignElement(this.targetEl, 'center'); this.contextMenu.hidden = true; }
      if (action === 'align-right') { alignElement(this.targetEl, 'right'); this.contextMenu.hidden = true; }
    });
    return menu;
  }

  private createNoteComposer(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'dialkit-dev-note-composer';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="dialkit-dev-note-head"><strong>Agent note</strong><button type="button" data-close>&times;</button></div>
      <div class="dialkit-dev-note-meta"></div>
      <textarea rows="3" placeholder="What should change here?"></textarea>
      <div class="dialkit-dev-note-actions">
        <button type="button" data-save class="dialkit-dev-btn-primary">Save note</button>
        <button type="button" data-cancel>Cancel</button>
      </div>
    `;
    panel.querySelector('[data-close]')?.addEventListener('click', () => { panel.hidden = true; });
    panel.querySelector('[data-cancel]')?.addEventListener('click', () => { panel.hidden = true; });
    panel.querySelector('[data-save]')?.addEventListener('click', () => void this.saveNote(panel));
    return panel;
  }

  private async saveNote(panel: HTMLDivElement): Promise<void> {
    const textarea = panel.querySelector('textarea');
    const comment = textarea instanceof HTMLTextAreaElement ? textarea.value : '';
    const targetInfo = this.targetEl
      ? inspectElement(this.targetEl) ?? this.targetInfo
      : this.targetInfo;
    const panels = DialStore.getPanels();
    const matched = matchPanelForTarget(targetInfo, panels);
    const screenshotDataUrl = this.targetEl && targetInfo
      ? await requestScreenshot(targetInfo, this.targetEl)
      : null;
    DevSessionStore.addNote({
      comment,
      target: targetInfo,
      panelId: matched?.id,
      panelName: matched?.name,
      dialSnapshot: matched ? DialStore.getValues(matched.id) : undefined,
      screenshotDataUrl,
    });
    if (textarea instanceof HTMLTextAreaElement) textarea.value = '';
    panel.hidden = true;
    this.clearTargetHighlight();
    this.targetEl = null;
    this.targetInfo = null;
    unregisterElementDialPanel();
    this.notify();
  }

  private updateNoteComposerMeta(): void {
    const meta = this.noteComposer.querySelector('.dialkit-dev-note-meta');
    if (!meta) return;
    const panels = DialStore.getPanels();
    const matched = matchPanelForTarget(this.targetInfo, panels);
    const lines: string[] = [];
    if (this.targetInfo?.selector) lines.push(`<code>${escapeHtml(this.targetInfo.selector)}</code>`);
    if (this.targetInfo?.source?.file) {
      lines.push(`<span>${escapeHtml(this.targetInfo.source.file)}${this.targetInfo.source.line ? `:${this.targetInfo.source.line}` : ''}</span>`);
    }
    if (this.targetInfo?.reactComponent) lines.push(`<span>${escapeHtml(this.targetInfo.reactComponent)}</span>`);
    if (matched) lines.push(`<span>Panel: ${escapeHtml(matched.name)}</span>`);
    meta.innerHTML = lines.join('') || '<span>Tagged element</span>';
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
