const enabledEl = document.getElementById('enabled');
const projectEl = document.getElementById('project');

chrome.storage.sync.get(['enabled', 'projectKey'], (result) => {
  enabledEl.checked = Boolean(result.enabled);
  projectEl.value = result.projectKey || 'extension';
});

function save() {
  const enabled = enabledEl.checked;
  const projectKey = projectEl.value || 'extension';
  chrome.storage.sync.set({ enabled, projectKey }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'dialkit-toggle', enabled, projectKey });
      }
    });
  });
}

enabledEl.addEventListener('change', save);
projectEl.addEventListener('change', save);
