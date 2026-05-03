const sidePanelPorts = new Map(); // windowId -> port

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    port.onMessage.addListener((msg) => {
      if (msg.action === 'init' && msg.windowId) {
        sidePanelPorts.set(msg.windowId, port);
        port.onDisconnect.addListener(() => {
          sidePanelPorts.delete(msg.windowId);
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle_side_panel') {
    const windowId = sender.tab.windowId;
    if (sidePanelPorts.has(windowId)) {
      // Send message to the specific port to close
      sidePanelPorts.get(windowId).postMessage({ action: 'close_side_panel' });
    } else {
      chrome.sidePanel.open({ windowId: windowId });
    }
  }
});
