const HomePage = "html/sidepanel.html";

// Function to update side panel availability based on URL
async function updateSidePanelState(tabId, url) {
  if (url && (url.startsWith('chrome://newtab') || url.startsWith('about:newtab'))) {
    await chrome.sidePanel.setOptions({
      tabId: tabId,
      path: HomePage,
      enabled: true
    });
  } else {
    await chrome.sidePanel.setOptions({
      tabId: tabId,
      enabled: false
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    updateSidePanelState(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updateSidePanelState(activeInfo.tabId, tab.url);
  } catch (e) {
    console.error(e);
  }
});
