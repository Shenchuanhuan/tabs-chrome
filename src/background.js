chrome.runtime.onInstalled.addListener(() => {
  console.log("Tabs Home installed");
});

// The background script can stay minimal for now as most logic is in the UI script
// which now runs in an iframe within the content script.
