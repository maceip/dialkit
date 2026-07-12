// =============================================================================
// Page theme detection: is the host page visually dark or light?
// =============================================================================

type Rgba = { r: number; g: number; b: number; a: number };

function parseColor(value: string): Rgba | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

function isDarkColor(c: Rgba): boolean {
  const luminance = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  return luminance < 0.5;
}

function opaqueBackground(el: Element): Rgba | null {
  const bg = parseColor(getComputedStyle(el).backgroundColor);
  return bg && bg.a > 0.1 ? bg : null;
}

/**
 * Detect whether the page renders dark. Signals, strongest first:
 * painted background of body/html, then the first opaque background walking
 * up from the viewport-center element, then the root color-scheme. Returns
 * null when nothing conclusive is found (caller falls back to system).
 */
export function detectPageIsDark(): boolean | null {
  if (typeof document === 'undefined' || !document.body) return null;

  for (const el of [document.body, document.documentElement]) {
    const bg = opaqueBackground(el);
    if (bg) return isDarkColor(bg);
  }

  let probe = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  while (probe && probe !== document.documentElement) {
    const bg = opaqueBackground(probe);
    if (bg) return isDarkColor(bg);
    probe = probe.parentElement;
  }

  const scheme = getComputedStyle(document.documentElement).colorScheme;
  if (/dark/.test(scheme) && !/light/.test(scheme)) return true;
  if (/light/.test(scheme) && !/dark/.test(scheme)) return false;

  return null;
}

/**
 * Re-run detection when the page's theme plausibly changed: class/style/
 * data-* flips on html or body (typical theme togglers), or the system
 * preference changes (for pages styled via media queries).
 */
export function watchPageTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let scheduled = 0;
  const schedule = () => {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      onChange();
    });
  };

  const observer = new MutationObserver(schedule);
  const options = { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-mode', 'data-color-scheme'] };
  observer.observe(document.documentElement, options);
  if (document.body) observer.observe(document.body, options);

  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  mq?.addEventListener?.('change', schedule);

  return () => {
    if (scheduled) cancelAnimationFrame(scheduled);
    observer.disconnect();
    mq?.removeEventListener?.('change', schedule);
  };
}
