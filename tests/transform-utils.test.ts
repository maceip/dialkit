import { describe, expect, it } from 'vitest';
import { parseTranslate, applyTranslate } from '../src/dev-session/transform-utils';

describe('transform-utils', () => {
  it('reads translate from matrix()', () => {
    expect(parseTranslate('matrix(1, 0, 0, 1, 12, 24)')).toEqual({ x: 12, y: 24 });
  });

  it('updates existing translate in transform string', () => {
    expect(parseTranslate('rotate(45deg) translate(1px, 2px)')).toEqual({ x: 1, y: 2 });
  });
});
