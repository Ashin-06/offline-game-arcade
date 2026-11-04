# Publishing to the Chrome Web Store

Everything except the account and the payment is ready in this repo.

## 1. Build the upload file

From the repo root:

```bash
mkdir -p dist && git archive --format=zip -o dist/offline-game-arcade.zip HEAD
```

`.gitattributes` keeps tests, docs and the README out of the package. Only committed files are included, so commit first.

## 2. Create the developer account

1. Open the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) and sign in with a Google account.
2. Accept the developer agreement and pay the one-time registration fee.

The account email cannot be changed later, and Google suggests using an address kept just for publishing.

## 3. Upload

Choose **Add new item** and upload `dist/offline-game-arcade.zip`.

## 4. Store listing tab

**Title:** Offline Game Arcade (filled in from the manifest)

**Category:** Games, or Entertainment if Games is not offered

**Language:** English

**Description:**

```
Your connection dropped? Your next game is already here.

Offline Game Arcade turns a failed page into a hub of twenty games that run with no internet at all. When a page cannot load because you are offline, the tab opens the arcade by itself, and when the connection returns you get a link straight back to your page. Click the toolbar button to play at any time.

ACTION
Snake, Lane Rush, Flipline, Beacon Climb, Stack Drop, Nova Siege, Brick Buster, Paddle Duel

BOARD AND STRATEGY
Chess, Ludo, Pool, Reversi, Sentry Path

PUZZLE
Prism Match, Grid Fit, Sudoku, Relay, Minesweeper, Memory Match, 2048

- Everything is built in, so nothing is downloaded while you play
- Play against the computer or with a friend on the same screen in Chess, Ludo, Pool and Reversi
- Keyboard, mouse and touch controls, pause, sound toggle and saved best scores
- No accounts, no ads and no tracking
```

**Images:** all in `docs/store/`

| Field | File |
| --- | --- |
| Screenshots | `screenshot-1-hub.png` to `screenshot-5-sentry-path.png` |
| Small promo tile | `promo-small-440x280.png` |
| Marquee promo tile (optional) | `promo-marquee-1400x560.png` |

The 128 px store icon comes from the package.

## 5. Privacy tab

**Single purpose:**

```
Provides a collection of games to play when the internet connection is down, opening them automatically when a page fails to load because the device is offline.
```

**Permission justification for webNavigation:**

```
Used only to detect when a page in a tab fails to load with a network error, so that the tab can open the built-in games if the device is offline. Page contents are not read and browsing history is not stored.
```

**Remote code:** No, I am not using remote code.

**Data usage:** tick none of the data types, then tick each certification statement.

**Privacy policy URL:**

```
https://github.com/Ashin-06/offline-game-arcade/blob/main/docs/privacy.md
```

## 6. Distribution tab

Choose **Free** and **Public**, and all regions.

## 7. Submit

Choose **Submit for review**. Google reviews it before it goes live, and the result arrives by email. Once approved, anyone can install it from its store page.

## Updating later

Raise `version` in `manifest.json`, commit, build the zip again and upload it to the same item as a new version.

## Microsoft Edge

The same zip can be submitted to [Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge/overview), which has its own registration.
