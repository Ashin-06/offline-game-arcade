const boardEl = document.getElementById('board');
const SIZES = { small: 5, medium: 7, large: 9 };
let state = RelayLogic.create({ size: 5 });
let focusIndex = 0;
let tiles = [];

const shell = Arcade.game({
  id: 'relay',
  title: 'Relay',
  scoreLabel: 'Time',
  stats: ['Lit', 'Turns'],
  format: (ms) => Arcade.formatTime(ms),
  lowerIsBetter: true,
  hideOnPause: true,
  how: 'Every tile can turn. Wire the whole grid back to the core until all of it lights up. Click or tap to turn clockwise, right-click to turn back. <kbd>Arrows</kbd> move, <kbd>Space</kbd> turns.',
  options: [
    { id: 'size', label: 'Grid', default: 'small', choices: [['small', '5 × 5'], ['medium', '7 × 7'], ['large', '9 × 9']] },
  ],
  bestKey: (o) => o.size,
  bestLabel: (o) => `${SIZES[o.size]} × ${SIZES[o.size]}`,
  keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'q'],
  onStart(opts) {
    state = RelayLogic.create({ size: SIZES[opts.size] });
    focusIndex = 0;
    build();
    paint();
    shell.startClock();
    if (matchMedia('(hover: hover)').matches) tiles[0].focus();
  },
  onKey(key, down, repeat) {
    if (!down) return;
    const { size } = state;
    const r = Math.floor(focusIndex / size);
    const c = focusIndex % size;
    if (key === 'ArrowLeft' && c > 0) moveFocus(focusIndex - 1);
    if (key === 'ArrowRight' && c < size - 1) moveFocus(focusIndex + 1);
    if (key === 'ArrowUp' && r > 0) moveFocus(focusIndex - size);
    if (key === 'ArrowDown' && r < size - 1) moveFocus(focusIndex + size);
    if (repeat) return;
    if (key === ' ' || key === 'Enter') turn(focusIndex, 1);
    if (key === 'q') turn(focusIndex, -1);
  },
});

function tileSvg(mask, isCore) {
  const arms = [];
  if (mask & RelayLogic.N) arms.push('M50 50V0');
  if (mask & RelayLogic.E) arms.push('M50 50H100');
  if (mask & RelayLogic.S) arms.push('M50 50V100');
  if (mask & RelayLogic.W) arms.push('M50 50H0');
  const single = [1, 2, 4, 8].includes(mask);
  const node = isCore
    ? '<rect class="node core" x="26" y="26" width="48" height="48" rx="12"/>'
    : single ? '<circle class="node" cx="50" cy="50" r="17"/>' : '<circle class="joint" cx="50" cy="50" r="8"/>';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="wire" d="${arms.join('')}"/>${node}</svg>`;
}

function build() {
  boardEl.style.setProperty('--size', state.size);
  tiles = state.base.map((mask, i) => {
    const tile = Arcade.el('button', { type: 'button', className: 'tile', tabIndex: i === focusIndex ? 0 : -1, innerHTML: tileSvg(mask, i === state.core) });
    tile.addEventListener('focus', () => { focusIndex = i; });
    tile.addEventListener('click', () => turn(i, 1));
    tile.addEventListener('contextmenu', (e) => { e.preventDefault(); turn(i, -1); });
    return tile;
  });
  boardEl.replaceChildren(...tiles);
}

function moveFocus(index) {
  tiles[focusIndex].tabIndex = -1;
  tiles[index].tabIndex = 0;
  tiles[index].focus();
}

const DIR_NAMES = [[1, 'north'], [2, 'east'], [4, 'south'], [8, 'west']];

function paint() {
  const lit = RelayLogic.litCells(state);
  tiles.forEach((tile, i) => {
    tile.classList.toggle('lit', lit.has(i));
    tile.firstChild.style.transform = `rotate(${state.turns[i] * 90}deg)`;
    const mask = RelayLogic.currentMask(state, i);
    const links = DIR_NAMES.filter(([bit]) => mask & bit).map(([, name]) => name).join(' ');
    tile.setAttribute('aria-label', `Row ${Math.floor(i / state.size) + 1}, column ${(i % state.size) + 1}, ${i === state.core ? 'core, ' : ''}links ${links}, ${lit.has(i) ? 'lit' : 'dark'}`);
  });
  shell.stat('Lit', `${lit.size}/${state.size * state.size}`);
  shell.stat('Turns', state.moves);
}

function turn(index, dir) {
  if (!shell.playing) return;
  RelayLogic.rotate(state, index, dir);
  shell.sound('turn');
  paint();
  if (!RelayLogic.isSolved(state)) return;
  const ms = shell.clock();
  shell.stopClock();
  const best = shell.record(ms);
  shell.over({ title: 'All lit', text: `${Arcade.formatTime(ms)} in ${state.moves} turns${best ? ', your best yet' : ''}.`, win: true });
}
