const APP_URL = chrome.runtime.getURL('index.html');

chrome.action.onClicked.addListener(async (tab) => {
  const url = tab.url;
  if (url === APP_URL) return;
  await chrome.tabs.create({ url: APP_URL });
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.tabs.create({ url: APP_URL });
});
