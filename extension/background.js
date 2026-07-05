chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'capture-tab') return;
  chrome.tabs.captureVisibleTab(sender.tab?.windowId ?? null, { format: 'png' }, (dataUrl) => {
    sendResponse({ dataUrl: dataUrl ?? null });
  });
  return true;
});
