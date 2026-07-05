(function () {
  const FLAG = 'dialkit-extension-mounted';

  function injectScript() {
    if (document.documentElement.getAttribute(FLAG)) return;
    document.documentElement.setAttribute(FLAG, '1');

    if (!document.getElementById('dialkit-extension-styles')) {
      const link = document.createElement('link');
      link.id = 'dialkit-extension-styles';
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('styles.css');
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.type = 'module';
    document.documentElement.appendChild(script);
  }

  function disableScript() {
    window.postMessage({ type: 'dialkit-dev-session-disable' }, '*');
    document.documentElement.removeAttribute(FLAG);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'dialkit-request-screenshot') {
      chrome.runtime.sendMessage({ type: 'capture-tab' }, (response) => {
        window.postMessage({
          type: 'dialkit-screenshot',
          dataUrl: response?.dataUrl ?? null,
        }, '*');
      });
    }
  });

  chrome.storage.sync.get(['enabled', 'projectKey'], (result) => {
    if (result.enabled) injectScript();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'dialkit-toggle') {
      if (message.enabled) {
        injectScript();
        window.postMessage({
          type: 'dialkit-dev-session-enable',
          projectKey: message.projectKey ?? 'extension',
        }, '*');
      } else {
        disableScript();
      }
    }
  });
})();
