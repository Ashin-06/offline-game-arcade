const { SIZE, emptyGrid, slide, spawn, canMove, hasWon } = Merge2048Logic;
const boardEl = document.getElementById('board');
let grid = emptyGrid();
let score = 0;
let goalShown = false;

const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

const shell = Arcade.game({
  id: '2048',
  title: '2048',
  pausable: false,
  how: 'Slide with <kbd>Arrows</kbd> or by swiping. Equal tiles merge. Reach 2048, then keep going for as long as there is a move left.',
  keys: Object.keys(KEY_DIRS),
  onStart() {
    grid = emptyGrid();
    score = 0;
    goalShown = false;
    const spawned = [spawn(grid), spawn(grid)];
    render(spawned, []);
  },
  onKey(key, down, repeat) {
    if (down && !repeat) play(KEY_DIRS[key]);
  },
});

for (let i = 0; i < SIZE * SIZE; i++) boardEl.append(Arcade.el('div', { className: 'cell' }));
const tileLayer = Arcade.el('div', { className: 'tiles' });
boardEl.append(tileLayer);

function render(spawned, merged) {
  const isIn = (list, r, c) => list.some(([a, b]) => a === r && b === c);
  tileLayer.replaceChildren();
  const spoken = [];
  grid.forEach((row, r) => row.forEach((value, c) => {
    if (!value) return;
    spoken.push(value);
    const tile = Arcade.el('div', { className: 'tile', textContent: value });
    tile.dataset.value = value > 2048 ? 'big' : value;
    tile.style.setProperty('--r', r);
    tile.style.setProperty('--c', c);
    if (isIn(spawned, r, c)) tile.classList.add('new');
    if (isIn(merged, r, c)) tile.classList.add('merged');
    tileLayer.append(tile);
  }));
  boardEl.setAttribute('aria-label', `Tiles: ${spoken.join(', ')}`);
}

function play(dir) {
  if (!shell.playing) return;
  const result = slide(grid, dir);
  if (!result.moved) return;
  grid = result.grid;
  score += result.gained;
  shell.score(score);
  shell.sound(result.gained ? 'hit' : 'move');
  render([spawn(grid)], result.merged);
  if (!goalShown && hasWon(grid)) {
    goalShown = true;
    // A full board at 2048 has nothing to keep going with, so only offer it if a move remains.
    if (canMove(grid)) {
      shell.sound('win');
      shell.notice({
        title: 'You reached 2048',
        text: `Score ${score}. There is still room to go higher.`,
        actions: [
          { label: 'Keep going', run() {} },
          { label: 'New game', secondary: true, run() { shell.start(); } },
        ],
      });
      return;
    }
  }
  if (!canMove(grid)) shell.over({ title: 'No moves left', text: `Score ${score}.`, win: hasWon(grid) });
}

Arcade.swipe(boardEl, play, 26);
