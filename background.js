// A unique ID for our notification
const NOTIFICATION_ID = 'reconnect-notification';

// 1. Listen for when a web navigation error occurs
chrome.webNavigation.onErrorOccurred.addListener((details) => {
  const networkErrors = [
    "net::ERR_INTERNET_DISCONNECTED",
    "net::ERR_NAME_NOT_RESOLVED",
    "net::ERR_CONNECTION_RESET",
    "net::ERR_CONNECTION_TIMED_OUT"
  ];

  if (networkErrors.includes(details.error) && details.frameId === 0) {
    // UPDATED: Save the URL the user was trying to access
    if (details.url && !details.url.startsWith('chrome-extension://')) {
      chrome.storage.local.set({ lastUrl: details.url });
    }
    
    const offlinePageUrl = chrome.runtime.getURL("offline.html");
    chrome.tabs.update(details.tabId, { url: offlinePageUrl });
  }
}, {
  url: [{ schemes: ["http", "https"] }]
});


// 2. Listen for when the browser comes back online
self.addEventListener('online', () => {
  // NEW: Create a desktop notification
  chrome.storage.local.get('lastUrl', (data) => {
    let message = "You can now browse the web again.";
    if (data.lastUrl) {
      message = "Click 'Reconnect' to return to your last page.";
    }

    chrome.notifications.create(NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Internet Connection Restored!',
      message: message,
      buttons: [
        { title: 'Reconnect' } 
      ],
      priority: 2
    });
  });
});

// 3. Listen for when the "Reconnect" button on the notification is clicked
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === NOTIFICATION_ID && buttonIndex === 0) {
    chrome.storage.local.get('lastUrl', (data) => {
      if (data.lastUrl) {
        // Find the currently active tab (which is showing an offline page)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            // Update its URL to the one we saved
            chrome.tabs.update(tabs[0].id, { url: data.lastUrl });
            // Clean up
            chrome.storage.local.remove('lastUrl');
            chrome.notifications.clear(NOTIFICATION_ID);
          }
        });
      }
    });
  }
});