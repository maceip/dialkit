import { toPng } from 'html-to-image';
import type { ElementInfo } from '../utils/dom-inspect';

const MAX_PREVIEW_PX = 1200;

export async function captureElementPreview(el: Element): Promise<string | null> {
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  try {
    const pixelRatio = Math.min(2, MAX_PREVIEW_PX / Math.max(rect.width, rect.height, 1));
    return await toPng(el, {
      pixelRatio,
      cacheBust: true,
    });
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
