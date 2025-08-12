# Offline Game Arcade 🎮

An offline-first browser extension that automatically redirects you to a hub of classic, playable games when your internet connection is down. Inspired by Chrome's Dino game, but with much more variety!



## Features

* **Automatic Offline Detection:** No need to do anything. If you try to visit a website while offline, you'll be taken to the game hub.
* **Variety of Games:** A collection of nine classic, self-contained games to pass the time.
* **Customizable Games:** Many games include options for speed, difficulty, or custom setups.
* **Lightweight and Fun:** Built with pure HTML, CSS, and JavaScript. No external libraries needed.

---

## Games Included

This arcade features 9 classic games:

1.  **Snake** 🐍
2.  **Pong** 🏓
3.  **Tetris** 🧱
4.  **Space Invaders** 👾
5.  **Platformer** 🏃‍♂️
6.  **Breakout** 💥
7.  **Minesweeper** 💣
8.  **Memory Match** 🧠
9.  **2048** 🔢

---

## How to Install and Run

Since this is an unpacked extension, you can load it directly into your browser for testing and development.

1.  **Download or Clone:** Download this repository's code to your local machine.
2.  **Open Chrome/Edge:** Navigate to the extensions page by typing `chrome://extensions` or `edge://extensions` in your address bar.
3.  **Enable Developer Mode:** Find the "Developer mode" toggle in the top-right corner and turn it on.
4.  **Load the Extension:**
    * Click the **"Load unpacked"** button.
    * In the file selection window, navigate to and select the main `offline-games-extension` folder (the one containing `manifest.json`).
5.  **Test It:** Turn off your internet connection and try to visit any website. You should be redirected to the game hub!

---

## Folder Structure

The project is organized with each game in its own self-contained folder.

```
offline-games-extension/
├── manifest.json         # The core extension file
├── background.js         # Handles offline detection
├── offline.html          # The main game hub page
├── offline.css           # Styles for the game hub
├── icons/                # Extension icons
└── games/                # Contains all game folders
    ├── snake/
    ├── pong/
    ├── tetris/
    └── ...and so on
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.