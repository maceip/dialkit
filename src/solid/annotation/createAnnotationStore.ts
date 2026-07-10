import { createMemo, createSignal, onCleanup } from 'solid-js';
import type { Annotation } from '../../annotation/types';
import {
  loadAnnotations,
  migrateDevSessionNotes,
  saveAnnotations,
  setAnnotationProjectKey,
} from '../../annotation/utils/storage';
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
    };
    persist([annotation, ...annotations()]);
    setPending(null);
  };

  const updateAnnotation = (id: string, comment: string) => {
    persist(
      annotations().map((a) => (a.id === id ? { ...a, comment: comment.trim() } : a)),
    );
    setEditingId(null);
  };

  const deleteAnnotation = (id: string) => {
    persist(annotations().filter((a) => a.id !== id));
    setEditingId(null);
  };

  const clearAll = () => {
    persist([]);
    setPending(null);
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

  /** Document-level capture listeners — Solid owns lifecycle via onCleanup. */
  const attachPageListeners = () => {
    if (typeof document === 'undefined') return () => {};

    const onClick = (e: MouseEvent) => {
      if (!active() || pending() || editingId()) return;
      const next = buildPendingFromEvent(e);
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(next);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  };

  return {
    projectKey,
    active,
    setActive,
    annotations,
    pending,
    setPending,
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
