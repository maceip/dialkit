import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAnnotations,
  getStorageKey,
  loadAnnotations,
  migrateDevSessionNotes,
  saveAnnotations,
  setAnnotationProjectKey,
} from '../src/annotation/utils/storage';

function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
}

describe('annotation storage', () => {
  beforeEach(() => {
    installMemoryStorage();
    setAnnotationProjectKey('default');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scopes keys by project and pathname', () => {
    setAnnotationProjectKey('demo');
    expect(getStorageKey('/app')).toBe('dialkit:annotations:v1:demo:/app');
  });

  it('round-trips annotations in localStorage', () => {
    setAnnotationProjectKey('demo');
    const annotation = {
      id: 'a1',
      x: 10,
      y: 20,
      comment: 'tighten spacing',
      element: 'Button',
      elementPath: 'body > button',
      timestamp: Date.now(),
    };
    saveAnnotations('/', [annotation]);
    expect(loadAnnotations('/')).toEqual([annotation]);
    clearAnnotations('/');
    expect(loadAnnotations('/')).toEqual([]);
  });

  it('migrates legacy DevSession notes once', () => {
    const projectKey = 'migrated-demo';
    localStorage.setItem(
      `dialkit:dev-session:v2:${projectKey}`,
      JSON.stringify({
        version: 2,
        projectKey,
        notes: [
          {
            id: 'n1',
            comment: 'old note',
            pagePath: '/legacy',
            selector: '.card',
            element: 'div',
            createdAt: new Date().toISOString(),
            reactComponent: 'Card',
          },
        ],
        changes: [],
      }),
    );

    migrateDevSessionNotes(projectKey);
    setAnnotationProjectKey(projectKey);
    const notes = loadAnnotations('/legacy');
    expect(notes).toHaveLength(1);
    expect(notes[0]?.comment).toBe('old note');
    expect(notes[0]?.elementPath).toBe('.card');

    migrateDevSessionNotes(projectKey);
    expect(loadAnnotations('/legacy')).toHaveLength(1);
  });

  it('public annotation barrel does not re-export sync helpers', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const indexPath = path.join(process.cwd(), 'src/annotation/index.ts');
    const source = await fs.readFile(indexPath, 'utf8');
    expect(source).toContain('migrateDevSessionNotes');
    expect(source).not.toMatch(/createSession|syncAnnotation|from ['"].*sync['"]/);
  });
});
