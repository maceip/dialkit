import { describe, expect, it } from 'vitest';
import { buildCssPatch } from '../src/dev-session/css-patch';

describe('buildCssPatch', () => {
  it('groups overrides by selector', () => {
    const patch = buildCssPatch([
      {
        id: '1',
        at: 'now',
        selector: '.card',
        element: 'div.card',
        property: 'color',
        value: 'red',
        previousValue: 'black',
      },
      {
        id: '2',
        at: 'now',
        selector: '.card',
        element: 'div.card',
        property: 'padding',
        value: '12px',
        previousValue: '0px',
      },
    ]);
    expect(patch).toContain('.card {');
    expect(patch).toContain('color: red;');
    expect(patch).toContain('padding: 12px;');
  });
});
