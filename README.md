# Offline Game Arcade

A Chrome and Edge extension with twenty games. When a page fails because the connection is down, the tab opens the game hub, with a link back to the page once the connection returns. The toolbar button opens the hub at any time.

Plain HTML, CSS and JavaScript: no libraries, no build step, no assets to download.

## Games

| Action | Board and strategy | Puzzle |
| --- | --- | --- |
| Snake | Chess (full rules, three CPU levels or two players) | Prism Match (match three, levels, special tiles) |
| Lane Rush (three-lane runner) | Ludo (2 to 4 players, CPU or pass and play) | Grid Fit (fit pieces, clear rows and columns) |
| Flipline (one-button gravity runner) | Pool (eight-ball, CPU or two players) | Sudoku (unique solutions, notes, hints) |
| Beacon Climb (five-stage platformer) | Reversi (three CPU levels or two players) | Relay (wire a generated grid back to its core) |
| Tetris | Sentry Path (tower defence, three maps) | Minesweeper (safe first click, custom boards) |
| Space Invaders | | Memory Match |
| Breakout | | 2048 |
| Pong | | |

Every game has keyboard and touch controls and a sound toggle, and action and timed games can be paused.

## Install

1. Open `chrome://extensions` or `edge://extensions` and turn on Developer mode.
2. Choose Load unpacked and select this folder.

Mobile Chrome does not load extensions. To play on a phone, serve the folder from any static host and open `offline.html`:

```bash
python -m http.server 8000
```

## Network use

The games make no requests. The extension asks only for the `webNavigation` permission.

Some failures, such as a DNS error, also happen while online. For those, `background.js` sends one empty request to `https://www.gstatic.com/generate_204` to tell a dropped connection from a mistyped address or a broken site. The tab only moves to the hub if that request fails too.

## Checks

```bash
node --test
```

Requires Node 20 or later and takes about a minute. The checks cover the rules of each game, including standard chess move counts, prove every Beacon Climb stage and every Flipline and Lane Rush run can be finished, and run `background.js` against stand-ins for the browser APIs.

## Layout

```
background.js      offline detection
offline.html       game hub
shared/            page shell: header, overlays, controls, scores, sound, frame loop
games/<name>/      <name>.logic.js holds the rules, <name>.js the page
tests/             node --test checks
```

## Trademarks

Tetris, Space Invaders, Pong and Breakout are trademarks of their owners. This project is not affiliated with them.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
