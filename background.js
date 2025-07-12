const HomePage = "./html/sidepanel.html";

chrome.runtime.onInstalled.addListener(() => {
  // Allow users to open side panel by clicking on the action toolbar icon
  chrome.sidePanel
    .setOptions({ path: HomePage })
    .catch((error) => console.error(error));
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
  chrome.commands.onCommand.addListener((command) => {
    if (command === "open-side-panel") {
      chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.id !== undefined) {
          chrome.sidePanel
            .setOptions({
              tabId: tabs[0].id,
              path: HomePage,
              enabled: true,
            })
            .then((tab) => {
              chrome.sidePanel.open({ tabId: tab.id });
            });
        }
      });
    }
  });
});
