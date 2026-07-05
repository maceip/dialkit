export type CssPropertyType = 'color' | 'length' | 'number' | 'text' | 'select';

export interface CssPropertyDef {
  key: string;
  label: string;
  type: CssPropertyType;
  options?: string[];
}

export const CSS_INSPECTOR_PROPERTIES: CssPropertyDef[] = [
  { key: 'color', label: 'Color', type: 'color' },
  { key: 'background-color', label: 'Background', type: 'color' },
  { key: 'border-color', label: 'Border color', type: 'color' },
  { key: 'border-width', label: 'Border width', type: 'length' },
  { key: 'border-radius', label: 'Radius', type: 'length' },
  { key: 'opacity', label: 'Opacity', type: 'number' },
  { key: 'padding', label: 'Padding', type: 'length' },
  { key: 'margin', label: 'Margin', type: 'length' },
  { key: 'width', label: 'Width', type: 'length' },
  { key: 'height', label: 'Height', type: 'length' },
  { key: 'font-size', label: 'Font size', type: 'length' },
  { key: 'font-weight', label: 'Weight', type: 'select', options: ['300', '400', '500', '600', '700', '800'] },
  { key: 'box-shadow', label: 'Shadow', type: 'text' },
  { key: 'transform', label: 'Transform', type: 'text' },
  { key: 'filter', label: 'Filter', type: 'text' },
  { key: 'stroke', label: 'Stroke', type: 'color' },
  { key: 'stroke-width', label: 'Stroke width', type: 'length' },
  { key: 'fill', label: 'Fill', type: 'color' },
];

const OVERRIDE_ATTR = 'data-dialkit-css-override';

export function readCssValues(el: HTMLElement, defs: CssPropertyDef[] = CSS_INSPECTOR_PROPERTIES): Record<string, string> {
  const computed = getComputedStyle(el);
  const values: Record<string, string> = {};
  for (const def of defs) {
    if (def.key === 'stroke' || def.key === 'stroke-width' || def.key === 'fill') {
      if (el instanceof SVGElement || (el as Element & { ownerSVGElement?: SVGSVGElement }).ownerSVGElement) {
        values[def.key] = el.style.getPropertyValue(def.key) || computed.getPropertyValue(def.key) || '';
      }
      continue;
    }
    values[def.key] = el.style.getPropertyValue(def.key) || computed.getPropertyValue(def.key) || '';
  }
  return values;
}

export function applyCssOverride(el: HTMLElement, property: string, value: string): string {
  const previous = el.style.getPropertyValue(property);
  if (property === 'stroke' || property === 'fill' || property === 'stroke-width') {
    el.style.setProperty(property, value);
  } else {
    el.style.setProperty(property, value);
  }
  el.setAttribute(OVERRIDE_ATTR, 'true');
  return previous;
}

export function clearCssOverrides(el: HTMLElement): void {
  for (const def of CSS_INSPECTOR_PROPERTIES) {
    el.style.removeProperty(def.key);
  }
  el.removeAttribute(OVERRIDE_ATTR);
}

export function hasCssOverrides(el: HTMLElement): boolean {
  return el.hasAttribute(OVERRIDE_ATTR);
}
