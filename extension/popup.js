const enabledEl = document.getElementById('enabled');
const projectEl = document.getElementById('project');
const statusEl = document.getElementById('status');

function setStatus(text) {
  statusEl.textContent = text;
}

function broadcastToTabs(enabled, projectKey) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id || !tab.url || tab.url.startsWith('chrome://')) continue;
      chrome.tabs.sendMessage(tab.id, {
        type: 'dialkit-toggle',
        enabled,
        projectKey,
      }).catch(() => {
        // Content script not ready on this tab yet; storage.onChanged will apply on next load.
      });
    }
  });
}

function save() {
  const enabled = enabledEl.checked;
  const projectKey = (projectEl.value || 'extension').trim() || 'extension';

  chrome.storage.sync.set({ enabled, projectKey }, () => {
    broadcastToTabs(enabled, projectKey);
    setStatus(enabled ? 'Enabled on all pages' : 'Disabled');
  });
}

chrome.storage.sync.get(['enabled', 'projectKey'], (result) => {
  enabledEl.checked = Boolean(result.enabled);
  projectEl.value = result.projectKey || 'extension';
  setStatus(result.enabled ? 'Enabled on all pages' : 'Disabled');
});

enabledEl.addEventListener('change', save);
projectEl.addEventListener('change', save);
