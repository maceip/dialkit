(function () {
  const FLAG = 'dialkit-dev-session-mounted';

  function injectScript() {
    if (document.documentElement.getAttribute(FLAG)) return;
    document.documentElement.setAttribute(FLAG, '1');

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles.css');
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.type = 'module';
    document.documentElement.appendChild(script);
  }

  chrome.storage.sync.get(['enabled'], (result) => {
    if (result.enabled) injectScript();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'dialkit-toggle') {
      if (message.enabled) {
        injectScript();
        window.postMessage({ type: 'dialkit-dev-session-enable', projectKey: message.projectKey ?? 'extension' }, '*');
      } else {
        window.postMessage({ type: 'dialkit-dev-session-disable' }, '*');
      }
    }
  });
})();
