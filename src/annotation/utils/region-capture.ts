// =============================================================================
// Drag-a-rectangle region capture: overlay selection + tab capture + crop
// =============================================================================

export type CaptureRect = { x: number; y: number; width: number; height: number };

const MIN_SIZE = 12;
const MAX_EDGE = 1600; // cap stored image dimensions to keep localStorage sane

/**
 * Draw a selection rectangle over the page. Resolves with the viewport rect,
 * or null when cancelled (Escape / too-small drag).
 */
export function selectRegion(): Promise<CaptureRect | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dk-capture-overlay';
    overlay.setAttribute('data-dialkit-annotation-toolbar', '');

    const box = document.createElement('div');
    box.className = 'dk-capture-box';
    box.hidden = true;
    overlay.appendChild(box);

    const hint = document.createElement('div');
    hint.className = 'dk-capture-hint';
    hint.textContent = 'Drag to capture a region — Esc cancels';
    overlay.appendChild(hint);

    let startX = 0;
    let startY = 0;
    let dragging = false;

    const currentRect = (e: MouseEvent): CaptureRect => ({
      x: Math.min(startX, e.clientX),
      y: Math.min(startY, e.clientY),
      width: Math.abs(e.clientX - startX),
      height: Math.abs(e.clientY - startY),
    });

    const cleanup = () => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      resolve(null);
    };

    overlay.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      hint.hidden = true;
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const r = currentRect(e);
      box.hidden = false;
      box.style.left = `${r.x}px`;
      box.style.top = `${r.y}px`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
    });

    overlay.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      const r = currentRect(e);
      cleanup();
      resolve(r.width >= MIN_SIZE && r.height >= MIN_SIZE ? r : null);
    });

    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
  });
}

/**
 * Capture the current tab via getDisplayMedia and crop to the viewport rect.
 * Returns a webp (png fallback) data URL, or null if the user denies capture.
 * Chromium-only in practice; callers should feature-check `supportsCapture()`.
 */
export async function captureRegion(rect: CaptureRect): Promise<string | null> {
  if (!supportsCapture()) return null;

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 1 },
      audio: false,
      // Chromium hints: offer the current tab first, don't offer audio surfaces
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      monitorTypeSurfaces: 'exclude',
    } as MediaStreamConstraints);

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Give the compositor a frame to settle so the selection overlay is gone.
    await new Promise((r) => setTimeout(r, 150));

    const scaleX = video.videoWidth / window.innerWidth;
    const scaleY = video.videoHeight / window.innerHeight;

    const srcW = rect.width * scaleX;
    const srcH = rect.height * scaleY;
    const outScale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcW * outScale));
    canvas.height = Math.max(1, Math.round(srcH * outScale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      video,
      rect.x * scaleX,
      rect.y * scaleY,
      srcW,
      srcH,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const webp = canvas.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
  } catch {
    return null; // permission denied or capture aborted
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

export function supportsCapture(): boolean {
  return typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getDisplayMedia);
}
