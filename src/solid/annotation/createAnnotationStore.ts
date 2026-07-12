import { createMemo, createSignal, onCleanup } from 'solid-js';
import type { Annotation } from '../../annotation/types';
import {
  loadAnnotations,
  migrateDevSessionNotes,
  saveAnnotations,
  setAnnotationProjectKey,
} from '../../annotation/utils/storage';
import {
  deleteScreenshot,
  loadScreenshot,
  saveScreenshot,
} from '../../annotation/utils/screenshot-store';
import {
  captureRegion,
  selectRegion,
  supportsCapture,
} from '../../annotation/utils/region-capture';
import { generateOutput } from '../../annotation/utils/generate-output';
import type { OutputDetailLevel } from '../../annotation/output-types';
import {
  closestCrossingShadow,
  getElementClasses,
  getElementPath,
  getNearbyText,
  identifyElement,
} from '../../annotation/utils/element-identification';

export type PendingAnnotation = {
  x: number;
  y: number;
  element: string;
  elementPath: string;
  selectedText?: string;
  boundingBox?: Annotation['boundingBox'];
  nearbyText?: string;
  cssClasses?: string;
  isFixed?: boolean;
  screenshotId?: string;
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAnnotationUi(target: Element): boolean {
  return Boolean(
    closestCrossingShadow(target, '[data-dialkit-annotation-root]')
    || closestCrossingShadow(target, '[data-dialkit-annotation-toolbar]')
    || closestCrossingShadow(target, '[data-annotation-popup]')
    || closestCrossingShadow(target, '[data-annotation-marker]')
    || closestCrossingShadow(target, '.dialkit-root')
    || closestCrossingShadow(target, '.dialkit-dev-host'),
  );
}

export function createAnnotationStore(projectKey = 'default') {
  setAnnotationProjectKey(projectKey);
  if (typeof window !== 'undefined') migrateDevSessionNotes(projectKey);

  const pathname = () => (typeof location !== 'undefined' ? location.pathname : '/');
  const [active, setActive] = createSignal(false);
  const [annotations, setAnnotations] = createSignal<Annotation[]>(
    typeof window !== 'undefined' ? loadAnnotations(pathname()) : [],
  );
  const [pending, setPending] = createSignal<PendingAnnotation | null>(null);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [detailLevel, setDetailLevel] = createSignal<OutputDetailLevel>('standard');

  const persist = (next: Annotation[]) => {
    setAnnotations(next);
    saveAnnotations(pathname(), next);
  };

  const markdown = createMemo(() => generateOutput(annotations(), pathname(), detailLevel()));

  const reloadFromStorage = () => {
    setAnnotations(loadAnnotations(pathname()));
  };

  const buildPendingFromEvent = (e: MouseEvent): PendingAnnotation | null => {
    const target = e.target;
    if (!(target instanceof Element) || isAnnotationUi(target)) return null;

    const el = target instanceof HTMLElement ? target : target.parentElement;
    if (!el) return null;

    const selection = window.getSelection()?.toString().trim() || undefined;
    const rect = el.getBoundingClientRect();
    const identified = identifyElement(el);
    const isFixed = ['fixed', 'sticky'].includes(getComputedStyle(el).position);

    return {
      x: (rect.left + rect.width / 2) / window.innerWidth * 100,
      y: isFixed ? rect.top + rect.height / 2 : rect.top + window.scrollY + rect.height / 2,
      element: identified.name,
      elementPath: getElementPath(el),
      selectedText: selection,
      boundingBox: {
        x: rect.left,
        y: isFixed ? rect.top : rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      },
      nearbyText: getNearbyText(el) || undefined,
      cssClasses: getElementClasses(el) || undefined,
      isFixed,
    };
  };

  const addAnnotation = (comment: string) => {
    const p = pending();
    if (!p || !comment.trim()) return;
    const annotation: Annotation = {
      id: uid(),
      x: p.x,
      y: p.y,
      comment: comment.trim(),
      element: p.element,
      elementPath: p.elementPath,
      timestamp: Date.now(),
      selectedText: p.selectedText,
      boundingBox: p.boundingBox,
      nearbyText: p.nearbyText,
      cssClasses: p.cssClasses,
      isFixed: p.isFixed,
      screenshotId: p.screenshotId,
    };
    persist([annotation, ...annotations()]);
    setPending(null);
  };

  /** Discard the pending note; drops its captured region so no orphan lingers. */
  const cancelPending = () => {
    const p = pending();
    if (p?.screenshotId) deleteScreenshot(pathname(), p.screenshotId);
    setPending(null);
  };

  /**
   * Region-capture flow: drag a rectangle, grab the tab pixels for it, store
   * the webp in localStorage, and open the note composer for the element
   * under the region's center with the screenshot linked.
   */
  const captureRegionAnnotation = async (): Promise<boolean> => {
    if (pending() || editingId()) return false;
    const rect = await selectRegion();
    if (!rect) return false;

    const dataUrl = await captureRegion(rect);

    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    let el = document.elementFromPoint(cx, cy);
    if (el && isAnnotationUi(el)) el = document.body;
    const target = (el instanceof HTMLElement ? el : el?.parentElement) ?? document.body;

    const identified = identifyElement(target);
    const isFixed = ['fixed', 'sticky'].includes(getComputedStyle(target).position);

    let screenshotId: string | undefined;
    if (dataUrl) {
      screenshotId = uid();
      if (!saveScreenshot(pathname(), screenshotId, dataUrl)) screenshotId = undefined;
    }

    setPending({
      x: (cx / window.innerWidth) * 100,
      y: isFixed ? cy : cy + window.scrollY,
      element: identified.name,
      elementPath: getElementPath(target),
      boundingBox: {
        x: rect.x,
        y: isFixed ? rect.y : rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      },
      nearbyText: getNearbyText(target) || undefined,
      cssClasses: getElementClasses(target) || undefined,
      isFixed,
      screenshotId,
    });
    return true;
  };

  const screenshotFor = (a: Pick<Annotation, 'screenshotId'>): string | null =>
    a.screenshotId ? loadScreenshot(pathname(), a.screenshotId) : null;

  const updateAnnotation = (id: string, comment: string) => {
    persist(
      annotations().map((a) => (a.id === id ? { ...a, comment: comment.trim() } : a)),
    );
    setEditingId(null);
  };

  const deleteAnnotation = (id: string) => {
    const doomed = annotations().find((a) => a.id === id);
    if (doomed?.screenshotId) deleteScreenshot(pathname(), doomed.screenshotId);
    persist(annotations().filter((a) => a.id !== id));
    setEditingId(null);
  };

  const clearAll = () => {
    for (const a of annotations()) {
      if (a.screenshotId) deleteScreenshot(pathname(), a.screenshotId);
    }
    cancelPending();
    persist([]);
    setEditingId(null);
  };

  const copyMarkdown = async () => {
    const text = markdown();
    if (!text) return false;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      return true;
    }
    return false;
  };

  /**
   * Armed annotate mode places pins on RIGHT-click, so ordinary left-clicks
   * (links, buttons) keep working while the mode is on. Registered on window
   * capture: window is visited before document, so stopPropagation() keeps
   * the dev-session context menu (document capture) from opening too.
   */
  const attachPageListeners = () => {
    if (typeof window === 'undefined') return () => {};

    const onContextMenu = (e: MouseEvent) => {
      if (!active() || pending() || editingId()) return;
      if (e.target instanceof Element && isAnnotationUi(e.target)) return;
      const next = buildPendingFromEvent(e);
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(next);
    };

    window.addEventListener('contextmenu', onContextMenu, true);
    return () => window.removeEventListener('contextmenu', onContextMenu, true);
  };

  return {
    projectKey,
    active,
    setActive,
    annotations,
    pending,
    setPending,
    cancelPending,
    editingId,
    setEditingId,
    copied,
    detailLevel,
    setDetailLevel,
    markdown,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAll,
    copyMarkdown,
    reloadFromStorage,
    attachPageListeners,
    captureRegionAnnotation,
    captureSupported: supportsCapture,
    screenshotFor,
  };
}

export type AnnotationStore = ReturnType<typeof createAnnotationStore>;

/** Convenience for components that need cleanup when active toggles. */
export function useAnnotationPageCapture(store: AnnotationStore) {
  let detach: (() => void) | undefined;
  const sync = () => {
    detach?.();
    detach = undefined;
    if (store.active()) detach = store.attachPageListeners();
  };
  sync();
  onCleanup(() => detach?.());
  return sync;
}
