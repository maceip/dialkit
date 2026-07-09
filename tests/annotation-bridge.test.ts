import { describe, expect, it, beforeEach } from 'vitest';
import {
  annotationToDevNoteInput,
  syncAnnotationToDevSession,
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

describe('annotation bridge to DevSessionStore', () => {
  beforeEach(() => {
    DevSessionStore.resetSession();
    DevSessionStore.configure('test-project');
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
  });

  it('skips non-feedback annotation kinds', () => {
    syncAnnotationToDevSession(makeAnnotation({ kind: 'placement', comment: 'place' }));
    expect(DevSessionStore.getNotes().length).toBe(0);
  });
});
