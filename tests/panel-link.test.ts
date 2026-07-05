import { describe, expect, it } from 'vitest';
import { matchPanelForTarget } from '../src/dev-session/panel-link';
import type { PanelConfig } from '../src/store/DialStore';
import type { ElementInfo } from '../src/utils/dom-inspect';

function panel(name: string, id = name): PanelConfig {
  return {
    id,
    name,
    controls: [],
    values: {},
    shortcuts: {},
  };
}

describe('matchPanelForTarget', () => {
  it('matches component stack to panel name', () => {
    const target = {
      reactStack: ['App', 'PhotoStack', 'Card'],
      selector: '.card',
    } as ElementInfo;
    const matched = matchPanelForTarget(target, [panel('Stage'), panel('Photo Stack', 'photo-stack')]);
    expect(matched?.id).toBe('photo-stack');
  });

  it('ignores generic component names', () => {
    const target = {
      reactStack: ['div', 'span'],
      selector: '.x',
    } as ElementInfo;
    expect(matchPanelForTarget(target, [panel('Photo Stack')])).toBeNull();
  });
});
