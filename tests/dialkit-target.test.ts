import { describe, expect, it } from 'vitest';
import { dialkitTarget, formatSourceMeta, parseSourceMeta } from '../src/utils/dialkit-target';

describe('dialkitTarget', () => {
  it('formats and parses source metadata', () => {
    const meta = { file: 'src/Card.tsx', line: 12, column: 4 };
    expect(formatSourceMeta(meta)).toBe('src/Card.tsx:12:4');
    expect(parseSourceMeta('src/Card.tsx:12:4')).toEqual(meta);
  });

  it('creates stable target props', () => {
    expect(dialkitTarget({ id: 'hero', source: { file: 'src/App.tsx', line: 3 } })).toEqual({
      'data-dialkit-id': 'hero',
      'data-dialkit-source': 'src/App.tsx:3',
    });
  });
});
