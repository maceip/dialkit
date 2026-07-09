import type { Annotation } from '../annotation/types';
import { DevSessionStore } from '../store/DevSessionStore';
import type { ElementInfo } from '../utils/dom-inspect';

function annotationTarget(annotation: Annotation): ElementInfo {
  const stack = annotation.reactComponents
    ? annotation.reactComponents
        .split(/\s+/)
        .map((s) => s.replace(/^<|>$/g, '').trim())
        .filter(Boolean)
    : [];

  const sourceFile = annotation.sourceFile;
  let source: ElementInfo['source'] | undefined;
  if (sourceFile) {
    const match = sourceFile.match(/^(.*?)(?::(\d+))?(?::(\d+))?$/);
    if (match) {
      source = {
        file: match[1],
        line: match[2] ? Number(match[2]) : undefined,
        column: match[3] ? Number(match[3]) : undefined,
      };
    }
  }

  const href = annotation.url
    ?? (typeof location !== 'undefined' ? location.href : '');
  const pathname = typeof location !== 'undefined' ? location.pathname : '';
  const bb = annotation.boundingBox;

  return {
    url: href,
    pathname,
    element: annotation.element,
    selector: annotation.elementPath || annotation.element,
    reactComponent: stack[stack.length - 1] ?? null,
    reactStack: stack,
    dialkitId: undefined,
    source,
    rect: {
      x: bb?.x ?? 0,
      y: bb?.y ?? annotation.y ?? 0,
      width: bb?.width ?? 0,
      height: bb?.height ?? 0,
    },
  };
}

export function annotationToDevNoteInput(annotation: Annotation): {
  comment: string;
  target: ElementInfo;
} {
  const parts = [annotation.comment.trim()];
  if (annotation.selectedText) {
    parts.push(`Selected text: "${annotation.selectedText}"`);
  }
  if (annotation.nearbyText) {
    parts.push(`Nearby: ${annotation.nearbyText}`);
  }
  if (annotation.cssClasses) {
    parts.push(`Classes: ${annotation.cssClasses}`);
  }

  return {
    comment: parts.filter(Boolean).join('\n\n'),
    target: annotationTarget(annotation),
  };
}

export function syncAnnotationToDevSession(annotation: Annotation): void {
  if (annotation.kind && annotation.kind !== 'feedback') return;
  if (!annotation.comment?.trim()) return;
  if (!DevSessionStore.isEnabled()) {
    DevSessionStore.configure(DevSessionStore.getProjectKey());
  }
  DevSessionStore.addNote(annotationToDevNoteInput(annotation));
}

export function syncAnnotationUpdateToDevSession(annotation: Annotation): void {
  if (annotation.kind && annotation.kind !== 'feedback') return;
  const notes = DevSessionStore.getNotes();
  const match = notes.find(
    (n) =>
      n.status === 'open' &&
      !n.exportedAt &&
      (n.selector === annotation.elementPath || n.element === annotation.element),
  );
  if (match) {
    DevSessionStore.updateNote(match.id, {
      comment: annotationToDevNoteInput(annotation).comment,
    });
  } else {
    syncAnnotationToDevSession(annotation);
  }
}

export function removeAnnotationFromDevSession(annotation: Annotation): void {
  const notes = DevSessionStore.getNotes();
  const match = notes.find(
    (n) =>
      n.status === 'open' &&
      (n.selector === annotation.elementPath || n.element === annotation.element) &&
      n.comment.includes(annotation.comment.trim().slice(0, 40)),
  );
  if (match) DevSessionStore.deleteNote(match.id);
}
