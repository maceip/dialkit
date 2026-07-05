import { mountDevSessionHost } from '../dev-session/dev-session-host';

declare global {
  interface Window {
    __DIALKIT_DEV_SESSION__?: {
      mount: typeof mountDevSessionHost;
      version: string;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__DIALKIT_DEV_SESSION__ = {
    mount: mountDevSessionHost,
    version: '1.4.0-dev.1',
  };

  let cleanup: (() => void) | null = null;

  const enable = (projectKey = 'extension') => {
    cleanup?.();
    cleanup = mountDevSessionHost({ projectKey });
  };

  const disable = () => {
    cleanup?.();
    cleanup = null;
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'dialkit-dev-session-enable') {
      enable(event.data.projectKey ?? 'extension');
    }
    if (event.data?.type === 'dialkit-dev-session-disable') {
      disable();
    }
  });

  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('dialkit-dev') === '1'
    || window.localStorage.getItem('dialkit:dev-session:auto') === '1';

  if (enabled && !document.querySelector('.dialkit-root')) {
    enable(params.get('dialkit-project') ?? 'extension');
  }
}

export { mountDevSessionHost };
