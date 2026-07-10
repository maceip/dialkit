import { parseTranslate, applyTranslate } from './transform-utils';

export { parseTranslate, applyTranslate };

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
