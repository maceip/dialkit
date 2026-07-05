export function parseTranslate(transform: string): { x: number; y: number } {
  if (!transform || transform === 'none') return { x: 0, y: 0 };

  const translateMatch = transform.match(/translate(?:3d)?\(([^)]+)\)/);
  if (translateMatch) {
    const parts = translateMatch[1].split(',').map((p) => parseFloat(p.trim()));
    return { x: parts[0] || 0, y: parts[1] || 0 };
  }

  const matrixMatch = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (matrixMatch) {
    const parts = matrixMatch[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length === 6) {
      return { x: parts[4] || 0, y: parts[5] || 0 };
    }
    if (parts.length === 16) {
      return { x: parts[12] || 0, y: parts[13] || 0 };
    }
  }

  return { x: 0, y: 0 };
}

export function applyTranslate(el: HTMLElement, x: number, y: number): void {
  const inline = el.style.transform?.trim() ?? '';
  const translate = `translate(${x}px, ${y}px)`;

  if (!inline || inline === 'none') {
    el.style.transform = translate;
    return;
  }

  if (/translate(?:3d)?\([^)]+\)/.test(inline)) {
    el.style.transform = inline.replace(/translate(?:3d)?\([^)]+\)/, translate);
    return;
  }

  el.style.transform = `${inline} ${translate}`;
}
