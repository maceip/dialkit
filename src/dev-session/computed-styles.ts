import type { CssPropertyDef, CssPropertyType } from './css-inspector';

const SKIP_PROPS = new Set([
  'webkit',
  'epub',
  'azimuth',
  'cue',
  'pause',
  'rest',
  'speak',
  'voice',
]);

function inferType(property: string, value: string): CssPropertyType {
  if (property.includes('color') || property === 'fill' || property === 'stroke') return 'color';
  if (value.endsWith('px') || value.endsWith('em') || value.endsWith('rem') || value.endsWith('%')) return 'length';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
  return 'text';
}

export function listComputedStyleDefs(el: HTMLElement): CssPropertyDef[] {
  const computed = getComputedStyle(el);
  const defs: CssPropertyDef[] = [];
  for (let i = 0; i < computed.length; i++) {
    const key = computed.item(i);
    if (!key || SKIP_PROPS.has(key) || key.startsWith('-webkit-')) continue;
    const value = computed.getPropertyValue(key);
    if (!value || value === 'none' || value === 'auto' || value === 'normal') continue;
    defs.push({
      key,
      label: key,
      type: inferType(key, value),
    });
  }
  return defs.sort((a, b) => a.key.localeCompare(b.key));
}
