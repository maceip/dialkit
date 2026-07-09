import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  annotationToDevNoteInput,
  removeAnnotationFromDevSession,
  syncAnnotationToDevSession,
  syncAnnotationUpdateToDevSession,
} from '../src/annotation/bridge-dev-session';
import type { Annotation } from '../src/annotation/types';
import { DevSessionStore } from '../src/store/DevSessionStore';

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: '1',
    x: 10,
    y: 20,
    comment: 'Make this button larger',
    element: 'button.primary',
    elementPath: 'main > button.primary',
    timestamp: Date.now(),
    ...overrides,
  };
}

function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

describe('annotation bridge to DevSessionStore', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createStorage() });
    vi.stubGlobal('location', {
      href: 'https://example.com/test',
      pathname: '/test',
    });
    DevSessionStore.disable();
    DevSessionStore.configure('test-project');
    DevSessionStore.resetSession();
  });

  it('maps annotation fields into a local note input', () => {
    const input = annotationToDevNoteInput(
      makeAnnotation({
        selectedText: 'Save',
        reactComponents: '<App> <Toolbar> <Button>',
        sourceFile: 'src/Button.tsx:12:4',
      }),
    );
    expect(input.target.selector).toBe('main > button.primary');
    expect(input.target.reactComponent).toBe('Button');
    expect(input.target.source?.file).toBe('src/Button.tsx');
    expect(input.comment).toContain('Make this button larger');
    expect(input.comment).toContain('Selected text: "Save"');
  });

  it('persists annotations into local DevSessionStore notes', () => {
    syncAnnotationToDevSession(makeAnnotation());
    const notes = DevSessionStore.getNotes();
    expect(notes.length).toBe(1);
    expect(notes[0].comment).toContain('Make this button larger');
    expect(notes[0].selector).toBe('main > button.primary');
    expect(notes[0].annotationId).toBe('1');
  });

  it('upserts an existing mirrored note instead of duplicating it', () => {
    syncAnnotationToDevSession(makeAnnotation());
    syncAnnotationToDevSession(makeAnnotation({ comment: 'Updated note' }));

    const notes = DevSessionStore.getNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].comment).toContain('Updated note');
  });

  it('skips non-feedback annotation kinds', () => {
    syncAnnotationToDevSession(makeAnnotation({ kind: 'placement', comment: 'place' }));
    expect(DevSessionStore.getNotes().length).toBe(0);
  });

  it('updates and removes the mirrored note by annotation id', () => {
    const first = makeAnnotation({ id: '1', comment: 'First note' });
    const second = makeAnnotation({ id: '2', comment: 'Second note' });

    syncAnnotationToDevSession(first);
    syncAnnotationToDevSession(second);
    syncAnnotationUpdateToDevSession({ ...second, comment: 'Second note updated' });

    let notes = DevSessionStore.getNotes();
    expect(notes.find((note) => note.annotationId === '1')?.comment).toContain('First note');
    expect(notes.find((note) => note.annotationId === '2')?.comment).toContain('Second note updated');

    removeAnnotationFromDevSession(second);
    notes = DevSessionStore.getNotes();
    expect(notes.some((note) => note.annotationId === '1')).toBe(true);
    expect(notes.some((note) => note.annotationId === '2')).toBe(false);
  });

  it('updates an exported mirrored note instead of adding a duplicate', () => {
    const annotation = makeAnnotation();

    syncAnnotationToDevSession(annotation);
    DevSessionStore.markExported();

    syncAnnotationUpdateToDevSession({
      ...annotation,
      comment: 'Updated after export',
    });

    const notes = DevSessionStore.getNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].comment).toContain('Updated after export');
    expect(notes[0].exportedAt).not.toBeNull();
  });

  it('uses the caller project key when enabling sync', () => {
    DevSessionStore.disable();
    DevSessionStore.configure('default');
    DevSessionStore.resetSession();
    DevSessionStore.disable();

    syncAnnotationToDevSession(makeAnnotation(), 'custom-project');

    expect(DevSessionStore.getProjectKey()).toBe('custom-project');
    expect(DevSessionStore.getNotes()).toHaveLength(1);
    DevSessionStore.configure('default');
    expect(DevSessionStore.getNotes()).toHaveLength(0);
  });
});
