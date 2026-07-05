import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { DialRoot } from '../components/DialRoot';
import { DevSessionStore } from '../store/DevSessionStore';
import { unmountDevSessionHost } from '../dev-session/dev-session-host';
import { setExtensionScreenshotProvider } from '../dev-session/screenshot';

declare global {
  interface Window {
    __DIALKIT__?: {
      mount: (projectKey?: string) => () => void;
      disable: () => void;
      version: string;
    };
  }
}

let reactRoot: Root | null = null;
let mountEl: HTMLDivElement | null = null;
let cleanup: (() => void) | null = null;

function mountFullDialKit(projectKey = 'extension'): () => void {
  disableFullDialKit();

  if (!document.querySelector('.dialkit-root')) {
    mountEl = document.createElement('div');
    mountEl.id = 'dialkit-extension-root';
    document.body.appendChild(mountEl);
    reactRoot = createRoot(mountEl);
    reactRoot.render(
      createElement(DialRoot, {
        productionEnabled: true,
        devSession: { projectKey },
      }),
    );
  } else {
    DevSessionStore.configure(projectKey);
  }

  cleanup = () => disableFullDialKit();
  return cleanup;
}

function disableFullDialKit(): void {
  unmountDevSessionHost();
  reactRoot?.unmount();
  reactRoot = null;
  mountEl?.remove();
  mountEl = null;
  cleanup = null;
}

if (typeof window !== 'undefined') {
  setExtensionScreenshotProvider(async () => {
    return new Promise((resolve) => {
      window.postMessage({ type: 'dialkit-request-screenshot' }, '*');
      const handler = (event: MessageEvent) => {
        if (event.source !== window || event.data?.type !== 'dialkit-screenshot') return;
        window.removeEventListener('message', handler);
        resolve(event.data.dataUrl ?? null);
      };
      window.addEventListener('message', handler);
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 3000);
    });
  });

  window.__DIALKIT__ = {
    mount: mountFullDialKit,
    disable: disableFullDialKit,
    version: '1.4.0',
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'dialkit-dev-session-enable') {
      mountFullDialKit(event.data.projectKey ?? 'extension');
    }
    if (event.data?.type === 'dialkit-dev-session-disable') {
      disableFullDialKit();
    }
  });

  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('dialkit-dev') === '1'
    || window.localStorage.getItem('dialkit:dev-session:auto') === '1';

  if (enabled) {
    mountFullDialKit(params.get('dialkit-project') ?? 'extension');
  }
}

export { mountFullDialKit, disableFullDialKit };
