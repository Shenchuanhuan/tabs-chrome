const sidePanelPorts = new Map(); // windowId -> port

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

// Track side panel connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    let windowId = null;
    port.onMessage.addListener((msg) => {
      if (msg.action === 'init' && msg.windowId) {
        windowId = msg.windowId;
        sidePanelPorts.set(windowId, port);
      }
    });
    port.onDisconnect.addListener(() => {
      if (windowId !== null) {
        sidePanelPorts.delete(windowId);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle_side_panel') {
    if (!sender.tab || !sender.tab.windowId) {
      sendResponse({ error: "No tab context" });
      return false;
    }

    const windowId = sender.tab.windowId;
    
    // CRITICAL: We must call chrome.sidePanel.open() synchronously 
    // to preserve the user gesture from the content script click.
    if (sidePanelPorts.has(windowId)) {
      // Panel is open, close it
      sidePanelPorts.get(windowId).postMessage({ action: 'close_side_panel' });
      sendResponse({ success: true, action: 'closed' });
    } else {
      // Panel is closed, open it
      chrome.sidePanel.open({ windowId: windowId })
        .then(() => sendResponse({ success: true, action: 'opened' }))
        .catch((err) => {
          console.error("Failed to open side panel:", err);
          sendResponse({ error: err.message });
        });
      return true; // Keep channel open for the .then() response
    }
  }
  return false;
});
