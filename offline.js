// Hub page: online state, a way back to the page that failed, and saved bests on each card.
const PREFIX = 'offline-arcade:';
const headline = document.getElementById('headline');
const subline = document.getElementById('subline');
const returnBox = document.getElementById('return');

// The page that failed comes in the query string, so only a real web address may become a link.
function failedPage() {
  const raw = new URLSearchParams(location.search).get('from');
  if (raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        try { sessionStorage.setItem(`${PREFIX}from`, url.href); } catch { /* still usable below */ }
        return url.href;
      }
    } catch { /* not a URL */ }
  }
  try { return sessionStorage.getItem(`${PREFIX}from`); } catch { return null; }
}

function showConnection() {
  const from = failedPage();
  if (!navigator.onLine) {
    headline.textContent = 'You are offline';
    subline.textContent = 'Pick a game while the connection is down.';
  } else {
    headline.textContent = 'Offline Game Arcade';
    subline.textContent = 'Twenty games that need no connection.';
  }
  returnBox.hidden = !(from && navigator.onLine);
  if (from && navigator.onLine) {
    const link = document.createElement('a');
    link.href = from;
    link.textContent = new URL(from).hostname;
    returnBox.replaceChildren('You are back online. Return to ', link);
  }
}

for (const card of document.querySelectorAll('[data-game]')) {
  let label = null;
  try { label = JSON.parse(localStorage.getItem(`${PREFIX}hub:${card.dataset.game}`)); } catch { /* no saves */ }
  if (label) card.querySelector('em').textContent = label;
}

window.addEventListener('online', showConnection);
window.addEventListener('offline', showConnection);
showConnection();
