export interface MeasureOverlay {
  el: HTMLDivElement;
  cleanup: () => void;
}

export function showMeasureOverlay(target: HTMLElement): MeasureOverlay {
  const rect = target.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'dialkit-dev-measure';
  el.innerHTML = `
    <span>${Math.round(rect.width)} × ${Math.round(rect.height)}</span>
    <span>${Math.round(rect.x)}, ${Math.round(rect.y)}</span>
  `;
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  document.body.appendChild(el);

  const onScroll = () => {
    const r = target.getBoundingClientRect();
    el.style.left = `${r.left}px`;
    el.style.top = `${r.top}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
    const spans = el.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
    if (spans[1]) spans[1].textContent = `${Math.round(r.x)}, ${Math.round(r.y)}`;
  };

  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);

  return {
    el,
    cleanup: () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      el.remove();
    },
  };
}

export function parseTranslate(transform: string): { x: number; y: number } {
  const match = transform.match(/translate(?:3d)?\(([^)]+)\)/);
  if (!match) return { x: 0, y: 0 };
  const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
  return { x: parts[0] || 0, y: parts[1] || 0 };
}

export function applyTranslate(el: HTMLElement, x: number, y: number): void {
  el.style.transform = `translate(${x}px, ${y}px)`;
}

export function alignElement(el: HTMLElement, alignment: 'left' | 'center' | 'right'): void {
  if (alignment === 'left') {
    el.style.marginLeft = '0';
    el.style.marginRight = 'auto';
  } else if (alignment === 'center') {
    el.style.marginLeft = 'auto';
    el.style.marginRight = 'auto';
  } else {
    el.style.marginLeft = 'auto';
    el.style.marginRight = '0';
  }
  el.style.display = el.style.display || 'block';
}

export class MoveTool {
  private target: HTMLElement | null = null;
  private startX = 0;
  private startY = 0;
  private originX = 0;
  private originY = 0;
  private onMove: (e: MouseEvent) => void;
  private onUp: () => void;

  constructor() {
    this.onMove = (e: MouseEvent) => {
      if (!this.target) return;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      applyTranslate(this.target, this.originX + dx, this.originY + dy);
    };
    this.onUp = () => this.stop();
  }

  start(target: HTMLElement, e: MouseEvent): void {
    this.stop();
    this.target = target;
    this.startX = e.clientX;
    this.startY = e.clientY;
    const t = parseTranslate(target.style.transform || getComputedStyle(target).transform);
    this.originX = t.x;
    this.originY = t.y;
    document.addEventListener('mousemove', this.onMove, true);
    document.addEventListener('mouseup', this.onUp, true);
    document.body.style.cursor = 'move';
  }

  stop(): void {
    document.removeEventListener('mousemove', this.onMove, true);
    document.removeEventListener('mouseup', this.onUp, true);
    document.body.style.cursor = '';
    this.target = null;
  }
}
