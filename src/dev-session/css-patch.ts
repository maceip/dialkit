import type { CssOverrideEntry } from '../store/DevSessionStore';

export function buildCssPatch(overrides: CssOverrideEntry[]): string {
  const bySelector = new Map<string, Map<string, string>>();
  for (const o of overrides) {
    const props = bySelector.get(o.selector) ?? new Map<string, string>();
    props.set(o.property, o.value);
    bySelector.set(o.selector, props);
  }

  const blocks: string[] = [];
  for (const [selector, props] of bySelector) {
    const lines = [`/* ${selector} */`, `${selector} {`];
    for (const [property, value] of props) {
      lines.push(`  ${property}: ${value};`);
    }
    lines.push('}', '');
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n');
}

export function buildInlineStylePatch(overrides: CssOverrideEntry[]): string {
  const bySelector = new Map<string, Map<string, string>>();
  for (const o of overrides) {
    const props = bySelector.get(o.selector) ?? new Map<string, string>();
    props.set(o.property, o.value);
    bySelector.set(o.selector, props);
  }

  return [...bySelector.entries()].map(([selector, props]) => {
    const style = [...props.entries()].map(([k, v]) => `${k}: ${v}`).join('; ');
    return `${selector} { style="${style}" }`;
  }).join('\n');
}
