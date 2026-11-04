// Static checks on the pages: what would break the extension's content security policy,
// offline use or the hub. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const games = fs.readdirSync(path.join(root, 'games'));
const pages = ['offline.html', ...games.map((g) => `games/${g}/${g}.html`)];

test('every page loads local files only and has no inline script', () => {
  for (const page of pages) {
    const html = read(page);
    assert.ok(html.includes('name="viewport"'), `${page} has a viewport`);
    assert.ok(/<html lang="/.test(html), `${page} declares a language`);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), `${page} has no inline script`);
    assert.ok(!/\son[a-z]+\s*=/i.test(html), `${page} has no inline handlers`);
    for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      assert.ok(!/^(https?:)?\/\//.test(url), `${page} does not fetch ${url}`);
      if (!url.startsWith('#')) {
        assert.ok(fs.existsSync(path.join(root, path.dirname(page), url)), `${page} links to missing ${url}`);
      }
    }
  }
});

test('game code reaches for no network', () => {
  const files = ['offline.js', 'shared/arcade.js', ...games.flatMap((g) => fs.readdirSync(path.join(root, 'games', g))
    .filter((f) => f.endsWith('.js')).map((f) => `games/${g}/${f}`))];
  for (const file of files) {
    assert.ok(!/\bfetch\(|XMLHttpRequest|WebSocket|https?:\/\//.test(read(file)), `${file} stays offline`);
  }
});

test('the hub links every game', () => {
  const hub = read('offline.html');
  for (const game of games) assert.ok(hub.includes(`games/${game}/${game}.html`), `hub lists ${game}`);
  assert.equal((hub.match(/class="card"/g) || []).length, games.length);
});

test('the manifest points at files that exist and asks for little', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.deepEqual(manifest.permissions, ['webNavigation']);
  assert.equal(manifest.host_permissions, undefined);
  assert.ok(fs.existsSync(path.join(root, manifest.background.service_worker)));
  for (const icon of Object.values(manifest.icons)) assert.ok(fs.existsSync(path.join(root, icon)));
});

// Runs background.js against stand-ins for the browser APIs.
function loadBackground({ onLine = true, probeOk = true, probeFailures = 0 } = {}) {
  let probes = 0;
  const listeners = {};
  const updates = [];
  const created = [];
  const sandbox = {
    navigator: { onLine },
    AbortSignal,
    Date,
    Map,
    Set,
    encodeURIComponent,
    fetch: async () => {
      probes++;
      if (!probeOk || probes <= probeFailures) throw new Error('no route');
      return {};
    },
    chrome: {
      runtime: { getURL: (p) => `chrome-extension://abc/${p}` },
      webNavigation: { onErrorOccurred: { addListener: (fn) => { listeners.error = fn; } } },
      tabs: {
        update: async (id, props) => { updates.push({ id, ...props }); },
        create: (props) => created.push(props),
        onRemoved: { addListener: () => {} },
      },
      action: { onClicked: { addListener: (fn) => { listeners.click = fn; } } },
    },
  };
  vm.runInNewContext(read('background.js'), sandbox);
  return { listeners, updates, created };
}
const failure = (error, extra = {}) => ({ frameId: 0, tabId: 7, url: 'https://example.com/a?b=1', error, ...extra });

test('extension: a dropped connection opens the hub and remembers the page', async () => {
  const { listeners, updates } = loadBackground({ onLine: false });
  await listeners.error(failure('net::ERR_INTERNET_DISCONNECTED'));
  assert.equal(updates.length, 1);
  assert.equal(updates[0].url, `chrome-extension://abc/offline.html?from=${encodeURIComponent('https://example.com/a?b=1')}`);
});

test('extension: a mistyped address while online does not hijack the tab', async () => {
  const { listeners, updates } = loadBackground({ onLine: true, probeOk: true });
  await listeners.error(failure('net::ERR_NAME_NOT_RESOLVED'));
  assert.equal(updates.length, 0);
});

test('extension: Wi-Fi with no internet is caught by the probe', async () => {
  const { listeners, updates } = loadBackground({ onLine: true, probeOk: false });
  await listeners.error(failure('net::ERR_NAME_NOT_RESOLVED'));
  assert.equal(updates.length, 1);
});

test('extension: one stalled probe on a healthy connection does not count as offline', async () => {
  const { listeners, updates } = loadBackground({ onLine: true, probeFailures: 1 });
  await listeners.error(failure('net::ERR_NAME_NOT_RESOLVED'));
  assert.equal(updates.length, 0);
});

test('extension: unrelated errors and sub-frames are ignored', async () => {
  const { listeners, updates } = loadBackground({ onLine: true, probeOk: false });
  await listeners.error(failure('net::ERR_ABORTED'));
  await listeners.error(failure('net::ERR_CONNECTION_REFUSED'));
  await listeners.error(failure('net::ERR_INTERNET_DISCONNECTED', { frameId: 3 }));
  assert.equal(updates.length, 0);
});

test('extension: Back from the hub does not bounce straight back to it', async () => {
  const { listeners, updates } = loadBackground({ onLine: false });
  await listeners.error(failure('net::ERR_INTERNET_DISCONNECTED'));
  await listeners.error(failure('net::ERR_INTERNET_DISCONNECTED'));
  assert.equal(updates.length, 1);
  await listeners.error(failure('net::ERR_INTERNET_DISCONNECTED', { url: 'https://example.org/' }));
  assert.equal(updates.length, 2);
});

test('extension: the toolbar button opens the hub', () => {
  const { listeners, created } = loadBackground();
  listeners.click();
  assert.equal(created[0].url, 'chrome-extension://abc/offline.html');
});
