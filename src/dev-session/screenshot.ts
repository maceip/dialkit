import type { ElementInfo } from '../utils/dom-inspect';

export async function captureElementPreview(el: Element): Promise<string | null> {
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 800 / Math.max(rect.width, 1));
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const data = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${rect.width}px;height:${rect.height}px;background:#fff;">
            ${el.outerHTML.replace(/#/g, '%23')}
          </div>
        </foreignObject>
      </svg>`;
    const img = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg render failed'));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function setExtensionScreenshotProvider(
  provider: ((info: ElementInfo) => Promise<string | null>) | null,
): void {
  if (typeof window === 'undefined') return;
  (window as Window & { __DIALKIT_SCREENSHOT__?: typeof provider }).__DIALKIT_SCREENSHOT__ = provider ?? undefined;
}

export async function requestScreenshot(info: ElementInfo, el?: Element | null): Promise<string | null> {
  const provider = typeof window !== 'undefined'
    ? (window as Window & { __DIALKIT_SCREENSHOT__?: (info: ElementInfo) => Promise<string | null> }).__DIALKIT_SCREENSHOT__
    : undefined;
  if (provider) return provider(info);
  if (el) return captureElementPreview(el);
  return null;
}
