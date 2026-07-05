(function () {
  const FLAG = 'dialkit-extension-mounted';
  const SCRIPT_ID = 'dialkit-extension-inject';

  function injectScript() {
    if (document.getElementById(SCRIPT_ID)) return;
    document.documentElement.setAttribute(FLAG, '1');

    if (!document.getElementById('dialkit-extension-styles')) {
      const link = document.createElement('link');
      link.id = 'dialkit-extension-styles';
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('styles.css');
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = chrome.runtime.getURL('inject.js');
    script.type = 'module';
    document.documentElement.appendChild(script);
  }

  function mountDialKit(projectKey) {
    const key = projectKey ?? 'extension';
    if (window.__DIALKIT__) {
      window.__DIALKIT__.mount(key);
      return;
    }
    window.postMessage({ type: 'dialkit-dev-session-enable', projectKey: key }, '*');
  }

  function enable(projectKey) {
    injectScript();
    if (window.__DIALKIT__) {
      mountDialKit(projectKey);
      return;
    }

    const onReady = (event) => {
      if (event.source !== window || event.data?.type !== 'dialkit-ready') return;
      window.removeEventListener('message', onReady);
      mountDialKit(projectKey);
    };
    window.addEventListener('message', onReady);
    setTimeout(() => {
      window.removeEventListener('message', onReady);
      mountDialKit(projectKey);
    }, 5000);
  }

  function disableScript() {
    if (window.__DIALKIT__) {
      window.__DIALKIT__.disable();
    } else {
      window.postMessage({ type: 'dialkit-dev-session-disable' }, '*');
    }
    document.documentElement.removeAttribute(FLAG);
  }

  function cropDataUrlToRect(dataUrl, rect) {
    if (!dataUrl || !rect || rect.width <= 0 || rect.height <= 0) {
      return Promise.resolve(dataUrl);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        const sx = Math.max(0, Math.round(rect.x * dpr));
        const sy = Math.max(0, Math.round(rect.y * dpr));
        const sw = Math.min(Math.round(rect.width * dpr), img.width - sx);
        const sh = Math.min(Math.round(rect.height * dpr), img.height - sy);
        if (sw <= 0 || sh <= 0) {
          resolve(dataUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'dialkit-request-screenshot') {
      const rect = event.data.rect;
      chrome.runtime.sendMessage({ type: 'capture-tab' }, (response) => {
        const dataUrl = response?.dataUrl ?? null;
        const finish = (cropped) => {
          window.postMessage({
            type: 'dialkit-screenshot',
            dataUrl: cropped,
          }, '*');
        };
        if (dataUrl && rect) {
          cropDataUrlToRect(dataUrl, rect).then(finish);
        } else {
          finish(dataUrl);
        }
      });
    }
  });

  chrome.storage.sync.get(['enabled', 'projectKey'], (result) => {
    if (result.enabled) enable(result.projectKey);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'dialkit-toggle') {
      if (message.enabled) enable(message.projectKey);
      else disableScript();
    }
  });
})();
