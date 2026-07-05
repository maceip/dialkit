(function () {
  const FLAG = 'dialkit-extension-mounted';
  const SCRIPT_ID = 'dialkit-extension-inject';
  const STYLE_ID = 'dialkit-extension-styles';

  let activeProjectKey = 'extension';
  let activeOnPage = false;
  let readyListener = null;

  function injectScript() {
    if (document.getElementById(SCRIPT_ID)) return;

    if (!document.getElementById(STYLE_ID)) {
      const link = document.createElement('link');
      link.id = STYLE_ID;
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
    const key = projectKey || activeProjectKey || 'extension';
    activeProjectKey = key;
    if (window.__DIALKIT__) {
      window.__DIALKIT__.mount(key);
      return;
    }
    window.postMessage({ type: 'dialkit-dev-session-enable', projectKey: key }, '*');
  }

  function waitForReady(projectKey) {
    if (readyListener) {
      window.removeEventListener('message', readyListener);
      readyListener = null;
    }

    const onReady = (event) => {
      if (event.source !== window || event.data?.type !== 'dialkit-ready') return;
      window.removeEventListener('message', onReady);
      readyListener = null;
      mountDialKit(projectKey);
    };

    readyListener = onReady;
    window.addEventListener('message', onReady);
    setTimeout(() => {
      if (!readyListener) return;
      window.removeEventListener('message', onReady);
      readyListener = null;
      mountDialKit(projectKey);
    }, 5000);
  }

  function enable(projectKey) {
    activeProjectKey = projectKey || activeProjectKey || 'extension';
    injectScript();
    document.documentElement.setAttribute(FLAG, '1');
    activeOnPage = true;

    if (window.__DIALKIT__) {
      mountDialKit(activeProjectKey);
      return;
    }

    waitForReady(activeProjectKey);
  }

  function disable() {
    if (readyListener) {
      window.removeEventListener('message', readyListener);
      readyListener = null;
    }

    if (window.__DIALKIT__) {
      window.__DIALKIT__.disable();
    } else {
      window.postMessage({ type: 'dialkit-dev-session-disable' }, '*');
    }

    document.documentElement.removeAttribute(FLAG);
    activeOnPage = false;
  }

  function applySettings(enabled, projectKey) {
    activeProjectKey = projectKey || activeProjectKey || 'extension';
    if (enabled) enable(activeProjectKey);
    else disable();
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
    if (event.data?.type !== 'dialkit-request-screenshot') return;

    const rect = event.data.rect;
    chrome.runtime.sendMessage({ type: 'capture-tab' }, (response) => {
      const dataUrl = response?.dataUrl ?? null;
      const finish = (cropped) => {
        window.postMessage({ type: 'dialkit-screenshot', dataUrl: cropped }, '*');
      };
      if (dataUrl && rect) {
        cropDataUrlToRect(dataUrl, rect).then(finish);
        return;
      }
      finish(dataUrl);
    });
  });

  chrome.storage.sync.get(['enabled', 'projectKey'], (result) => {
    applySettings(Boolean(result.enabled), result.projectKey || 'extension');
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!changes.enabled && !changes.projectKey) return;

    chrome.storage.sync.get(['enabled', 'projectKey'], (result) => {
      applySettings(Boolean(result.enabled), result.projectKey || 'extension');
    });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'dialkit-toggle') return;
    applySettings(Boolean(message.enabled), message.projectKey || 'extension');
  });
})();
