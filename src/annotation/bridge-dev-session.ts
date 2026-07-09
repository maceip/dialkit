import type { Annotation } from '../annotation/types';
import { DevSessionStore } from '../store/DevSessionStore';
import type { DevNote } from '../store/DevSessionStore';
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

function ensureDevSessionConfigured(projectKey?: string): void {
  const nextProjectKey = projectKey ?? DevSessionStore.getProjectKey();
  if (!DevSessionStore.isEnabled() || DevSessionStore.getProjectKey() !== nextProjectKey) {
    DevSessionStore.configure(nextProjectKey);
  }
}

function isMatchingAnnotationTarget(note: DevNote, annotation: Annotation): boolean {
  return note.selector === annotation.elementPath || note.element === annotation.element;
}

function findMirroredNote(
  annotation: Annotation,
  options?: { includeExported?: boolean },
): DevNote | undefined {
  const openNotes = DevSessionStore.getNotes().filter(
    (note) => note.status === 'open' && (options?.includeExported || !note.exportedAt),
  );
  const exactMatch = openNotes.find((note) => note.annotationId === annotation.id);
  if (exactMatch) return exactMatch;

  const targetMatches = openNotes.filter((note) => isMatchingAnnotationTarget(note, annotation));
  return targetMatches.length === 1 ? targetMatches[0] : undefined;
}

export function syncAnnotationToDevSession(annotation: Annotation, projectKey?: string): void {
  if (annotation.kind && annotation.kind !== 'feedback') return;
  if (!annotation.comment?.trim()) return;
  ensureDevSessionConfigured(projectKey);
  const input = annotationToDevNoteInput(annotation);
  const match = findMirroredNote(annotation, { includeExported: true });
  if (match) {
    DevSessionStore.updateNote(match.id, {
      comment: input.comment,
    });
    return;
  }
  DevSessionStore.addNote({
    annotationId: annotation.id,
    ...input,
  });
}

export function syncAnnotationUpdateToDevSession(annotation: Annotation, projectKey?: string): void {
  if (annotation.kind && annotation.kind !== 'feedback') return;
  ensureDevSessionConfigured(projectKey);
  const match = findMirroredNote(annotation, { includeExported: true });
  if (match) {
    DevSessionStore.updateNote(match.id, {
      comment: annotationToDevNoteInput(annotation).comment,
    });
  } else {
    syncAnnotationToDevSession(annotation, projectKey);
  }
}

export function removeAnnotationFromDevSession(annotation: Annotation, projectKey?: string): void {
  ensureDevSessionConfigured(projectKey);
  const match = findMirroredNote(annotation, { includeExported: true });
  if (match) DevSessionStore.deleteNote(match.id);
}
