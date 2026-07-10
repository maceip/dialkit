/**
 * Extension inject stub for this sprint.
 * Full DialRoot + annotation toolbar wiring is deferred — see extension/NEXT-SPRINT.md.
 */

declare global {
  interface Window {
    __DIALKIT__?: {
      mount: (projectKey?: string) => () => void;
      disable: () => void;
      version: string;
    };
  }
}

function mountStub(_projectKey = 'extension'): () => void {
  console.info(
    '[dialkit] Extension inject is stubbed this sprint. Annotation toolbar ships in-app via DialRoot; see extension/NEXT-SPRINT.md',
  );
  return () => {};
}

function disableStub(): void {
  /* no-op */
}

if (typeof window !== 'undefined') {
  window.__DIALKIT__ = {
    mount: mountStub,
    disable: disableStub,
    version: '1.4.0-extension-stub',
  };
  window.postMessage({ type: 'dialkit-ready', stub: true }, '*');
}

export { mountStub as mountFullDialKit, disableStub as disableFullDialKit };
