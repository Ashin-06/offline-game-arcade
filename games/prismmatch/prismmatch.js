const { SIZE, create, trySwap, targetFor, neighbours } = PrismLogic;
const boardEl = document.getElementById('board');
const COLOR_NAMES = ['red', 'amber', 'green', 'blue', 'violet', 'white'];
// Each colour also has its own shape, so the board reads without colour vision.
const SHAPES = [
  '<circle cx="50" cy="50" r="30"/>',
  '<path d="M50 16 L84 76 H16 Z"/>',
  '<rect x="22" y="22" width="56" height="56" rx="9"/>',
  '<path d="M50 14 L84 50 L50 86 L16 50 Z"/>',
  '<path d="M50 14 L60 40 L88 40 L66 58 L74 86 L50 70 L26 86 L34 58 L12 40 L40 40 Z"/>',
  '<path d="M32 18 H68 L86 50 L68 82 H32 L14 50 Z"/>',
];

let state = create();
let picked = null;
let cursor = [0, 0];
let busy = false;
let token = 0;
const tiles = new Map();

const shell = Arcade.game({
  id: 'prismmatch',
  title: 'Prism Match',
  stats: ['Level', 'Goal', 'Moves'],
  how: 'Swap two neighbours to line up three or more. A run of four makes a line tile that clears its row or column. A run of five makes a star: swap it with any colour to clear that colour. Reach the goal before your moves run out. Tap two tiles or swipe, or use <kbd>Arrows</kbd> and <kbd>Enter</kbd>.',
  pausable: false,
  keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '],
  onStart() {
    token++;
    state = create();
    picked = null;
    cursor = [0, 0];
    busy = false;
    tiles.clear();
    boardEl.replaceChildren();
    paint();
    updateStats();
  },
  onKey(key, down) {
    if (!down) return;
    const [r, c] = cursor;
    if (key === 'ArrowLeft' && c > 0) moveCursor(r, c - 1);
    if (key === 'ArrowRight' && c < SIZE - 1) moveCursor(r, c + 1);
    if (key === 'ArrowUp' && r > 0) moveCursor(r - 1, c);
    if (key === 'ArrowDown' && r < SIZE - 1) moveCursor(r + 1, c);
    if (key === ' ' || key === 'Enter') choose(r, c);
  },
});

function updateStats() {
  shell.score(state.score);
  shell.stat('Level', state.level);
  shell.stat('Goal', `${state.levelScore}/${targetFor(state.level)}`);
  shell.stat('Moves', state.moves);
}

function moveCursor(r, c) {
  cursor = [r, c];
  const tile = state.board[r][c];
  paint();
  tiles.get(tile.id).focus();
}

function tileElement(tile) {
  let node = tiles.get(tile.id);
  if (node) return node;
  node = Arcade.el('button', { type: 'button', className: 'tile fresh' });
  node.style.setProperty('--hue', tile.c);
  node.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${SHAPES[tile.c]}</svg>`;
  node.addEventListener('click', () => {
    const at = locate(tile.id);
    if (at) choose(at[0], at[1]);
  });
  tiles.set(tile.id, node);
  boardEl.append(node);
  return node;
}

function locate(id) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (state.board[r][c].id === id) return [r, c];
  }
  return null;
}

function paint() {
  const alive = new Set();
  state.board.forEach((row, r) => row.forEach((tile, c) => {
    alive.add(tile.id);
    const node = tileElement(tile);
    node.style.setProperty('--r', r);
    node.style.setProperty('--c', c);
    node.dataset.color = tile.c;
    node.dataset.special = tile.special || '';
    node.classList.toggle('picked', Boolean(picked && picked[0] === r && picked[1] === c));
    node.tabIndex = cursor[0] === r && cursor[1] === c ? 0 : -1;
    const special = tile.special === 'star' ? 'star tile' : tile.special === 'row' ? `${COLOR_NAMES[tile.c]}, clears its row` : tile.special === 'col' ? `${COLOR_NAMES[tile.c]}, clears its column` : COLOR_NAMES[tile.c];
    node.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${special}`);
  }));
  for (const [id, node] of tiles) {
    if (!alive.has(id)) {
      node.remove();
      tiles.delete(id);
    }
  }
  requestAnimationFrame(() => { for (const node of tiles.values()) node.classList.remove('fresh'); });
}

function choose(r, c) {
  if (!shell.playing || busy) return;
  cursor = [r, c];
  if (!picked) {
    picked = [r, c];
    shell.sound('tap');
    paint();
    return;
  }
  if (picked[0] === r && picked[1] === c) {
    picked = null;
    paint();
    return;
  }
  if (!neighbours(picked, [r, c])) {
    picked = [r, c];
    shell.sound('tap');
    paint();
    return;
  }
  attempt(picked, [r, c]);
}

function attempt(a, b) {
  picked = null;
  const before = state.score;
  const result = trySwap(state, a, b);
  if (!result) {
    shell.sound('lock');
    const node = tiles.get(state.board[a[0]][a[1]].id);
    node.classList.remove('nope');
    void node.offsetWidth;
    node.classList.add('nope');
    paint();
    return;
  }
  busy = true;
  const run = token;
  const gained = state.score - before;
  shell.sound(result.steps.length > 1 ? 'clear' : 'coin');
  shell.say(`${gained} points`);
  paint();
  updateStats();
  // The move is already settled in the rules; this only leaves time to watch the tiles fall.
  setTimeout(() => {
    if (run !== token) return;
    busy = false;
    if (result.levelUp) {
      shell.sound('win');
      shell.say(`Level ${state.level}`);
    }
    if (state.over) shell.over({ title: 'Out of moves', text: `Level ${state.level}, score ${state.score}.` });
  }, Math.min(500, 180 + result.steps.length * 60));
}

// A swipe on a tile swaps it with the neighbour in that direction.
let swipeFrom = null;
boardEl.addEventListener('pointerdown', (e) => {
  const button = e.target.closest('.tile');
  swipeFrom = button ? { x: e.clientX, y: e.clientY, at: [Number(button.style.getPropertyValue('--r')), Number(button.style.getPropertyValue('--c'))] } : null;
});
boardEl.addEventListener('pointerup', (e) => {
  if (!swipeFrom || !shell.playing || busy) return;
  const dx = e.clientX - swipeFrom.x;
  const dy = e.clientY - swipeFrom.y;
  if (Math.hypot(dx, dy) < 22) return;
  const [r, c] = swipeFrom.at;
  const to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
  swipeFrom = null;
  if (to[0] >= 0 && to[1] >= 0 && to[0] < SIZE && to[1] < SIZE) attempt([r, c], to);
});
