# Privacy policy

Offline Game Arcade collects no personal data. It has no accounts, no analytics, no ads and no server.

## What stays on your device

Best scores, game settings and any saved game are kept in your browser's local storage on your device. They are never sent anywhere, and removing the extension deletes them.

When a page fails to load, its address is passed to the game hub in the same browser tab so the hub can offer a link back to it. It is not stored after you close the tab and is never sent anywhere.

## The one network request

The games make no network requests. Some page failures, such as a DNS error, also happen while the internet is working. Only after one of those failures, the extension requests `https://www.gstatic.com/generate_204`, a small empty file served by Google, to find out whether the connection is really down. It may retry once.

That request contains nothing about you or the page that failed. As with any web request, Google's server sees your IP address, under [Google's privacy policy](https://policies.google.com/privacy).

## Permissions

The extension asks only for `webNavigation`, which tells it when a page in a tab has failed to load. It does not read page contents or keep your browsing history.

## Contact

Questions can be raised at <https://github.com/Ashin-06/offline-game-arcade/issues>.
