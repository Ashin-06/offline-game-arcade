// Sends a tab to the game hub when a page fails because the connection is down.
const DISCONNECTED = 'net::ERR_INTERNET_DISCONNECTED';
// These also happen online: a mistyped address, one broken site. They only count once a probe
// confirms that the wider internet is unreachable too.
const MAYBE_OFFLINE = new Set([
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_TIMED_OUT',
  'net::ERR_ADDRESS_UNREACHABLE',
  'net::ERR_NETWORK_CHANGED',
  'net::ERR_NETWORK_IO_SUSPENDED',
]);
const PROBE_URL = 'https://www.gstatic.com/generate_204';
const PROBE_TIMEOUT_MS = 4000;
const PROBE_ATTEMPTS = 2;
const BACK_BUTTON_WINDOW_MS = 15000;

async function isOffline(error) {
  if (error === DISCONNECTED || !navigator.onLine) return true;
  if (!MAYBE_OFFLINE.has(error)) return false;
  // A single request can stall on a healthy connection, so one failure proves nothing.
  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt++) {
    try {
      await fetch(PROBE_URL, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      return false;
    } catch { /* try again, then give up */ }
  }
  return true;
}

// Pressing Back on the hub reloads the failed page. Sending that straight back to the hub again
// would trap the user, so the same page in the same tab only redirects once in a short while.
const lastRedirect = new Map();

chrome.webNavigation.onErrorOccurred.addListener(async ({ frameId, tabId, url, error }) => {
  if (frameId !== 0 || !(await isOffline(error))) return;
  const previous = lastRedirect.get(tabId);
  if (previous && previous.url === url && Date.now() - previous.at < BACK_BUTTON_WINDOW_MS) return;
  lastRedirect.set(tabId, { url, at: Date.now() });
  const hub = `${chrome.runtime.getURL('offline.html')}?from=${encodeURIComponent(url)}`;
  chrome.tabs.update(tabId, { url: hub }).catch(() => { /* the tab has closed */ });
}, { url: [{ schemes: ['http', 'https'] }] });

chrome.tabs.onRemoved.addListener((tabId) => lastRedirect.delete(tabId));

// The toolbar button opens the arcade at any time, online or not.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('offline.html') });
});
