const boardEl = document.getElementById('board');
const flagBtn = document.getElementById('flagMode');
let state = MinesLogic.create(MinesLogic.PRESETS.easy);
let flagMode = false;
let focusIndex = 0;

const shell = Arcade.game({
  id: 'minesweeper',
  title: 'Minesweeper',
  scoreLabel: 'Time',
  stats: ['Mines'],
  format: (ms) => Arcade.formatTime(ms),
  lowerIsBetter: true,
  hideOnPause: true,
  how: 'Open every cell without a mine. The first click is always safe. Right-click, long-press or use the flag button to mark a mine. Click an opened number to open around it once its flags are placed. <kbd>Arrows</kbd> move, <kbd>Enter</kbd> opens, <kbd>F</kbd> flags.',
  options: [
    { id: 'level', label: 'Board', default: 'easy', choices: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['custom', 'Custom']] },
    { id: 'rows', label: 'Rows (5 to 30)', type: 'number', min: 5, max: 30, default: 12, showIf: (o) => o.level === 'custom' },
    { id: 'cols', label: 'Columns (5 to 40)', type: 'number', min: 5, max: 40, default: 12, showIf: (o) => o.level === 'custom' },
    { id: 'mines', label: 'Mines', type: 'number', min: 1, max: 1191, default: 24, showIf: (o) => o.level === 'custom' },
  ],
  bestKey: (o) => o.level,
  bestLabel: (o) => o.level[0].toUpperCase() + o.level.slice(1),
  keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'f', ' ', 'Enter'],
  onStart(opts) {
    const setup = MinesLogic.PRESETS[opts.level] || { rows: opts.rows, cols: opts.cols, mines: opts.mines };
    // A wide board does not fit a phone, so it is dealt tall there. The mine density is the same.
    const turned = window.innerWidth < 700 && setup.cols > setup.rows;
    state = MinesLogic.create(turned ? { ...setup, rows: setup.cols, cols: setup.rows } : setup);
    flagMode = false;
    focusIndex = 0;
    build();
    paint();
    if (matchMedia('(hover: hover)').matches) boardEl.children[0].focus();
  },
  onKey(key, down, repeat) {
    if (!down) return;
    const { cols, rows } = state;
    const r = Math.floor(focusIndex / cols);
    const c = focusIndex % cols;
    if (key === 'ArrowLeft' && c > 0) moveFocus(focusIndex - 1);
    if (key === 'ArrowRight' && c < cols - 1) moveFocus(focusIndex + 1);
    if (key === 'ArrowUp' && r > 0) moveFocus(focusIndex - cols);
    if (key === 'ArrowDown' && r < rows - 1) moveFocus(focusIndex + cols);
    if (repeat) return;
    if (key === 'f') flag(focusIndex);
    if (key === ' ' || key === 'Enter') open(focusIndex);
  },
});

function cellSize() {
  const box = boardEl.parentElement.getBoundingClientRect();
  const fit = Math.floor(Math.min((window.innerWidth - 16) / state.cols, (box.height || window.innerHeight) / state.rows));
  return Math.max(30, Math.min(40, fit));
}

function build() {
  boardEl.style.setProperty('--cols', state.cols);
  boardEl.style.setProperty('--cell', `${cellSize()}px`);
  boardEl.replaceChildren(...state.cells.map((_, i) => {
    const cell = Arcade.el('button', { type: 'button', className: 'cell', tabIndex: i === focusIndex ? 0 : -1 });
    cell.addEventListener('focus', () => { focusIndex = i; });
    cell.addEventListener('click', () => open(i));
    cell.addEventListener('contextmenu', (e) => { e.preventDefault(); flag(i); });
    let hold = 0;
    cell.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      hold = setTimeout(() => { hold = -1; flag(i); if (navigator.vibrate) navigator.vibrate(20); }, 420);
    });
    const cancel = () => { if (hold > 0) clearTimeout(hold); };
    cell.addEventListener('pointerup', cancel);
    cell.addEventListener('pointercancel', cancel);
    cell.addEventListener('pointermove', (e) => { if (e.movementX || e.movementY) cancel(); });
    cell.addEventListener('click', (e) => { if (hold === -1) { hold = 0; e.stopImmediatePropagation(); } }, { capture: true });
    return cell;
  }));
}

function moveFocus(index) {
  boardEl.children[focusIndex].tabIndex = -1;
  const cell = boardEl.children[index];
  cell.tabIndex = 0;
  cell.focus();
}

function label(cell, index) {
  const place = `Row ${Math.floor(index / state.cols) + 1}, column ${(index % state.cols) + 1}`;
  if (cell.open && cell.mine) return `${place}, mine`;
  if (cell.open) return `${place}, ${cell.count === 0 ? 'empty' : cell.count}`;
  return `${place}, ${cell.flag ? 'flagged' : 'covered'}`;
}

function paint() {
  const ended = state.status === 'lost' || state.status === 'won';
  state.cells.forEach((cell, i) => {
    const node = boardEl.children[i];
    let text = '';
    let cls = 'cell';
    if (cell.open && !cell.mine) {
      cls += ` open n${cell.count}`;
      text = cell.count || '';
    } else if (cell.flag) {
      cls += ended && !cell.mine ? ' wrong' : ' flagged';
      text = ended && !cell.mine ? '✕' : '⚑';
    } else if (ended && cell.mine) {
      cls += cell.open ? ' boom' : ' mine';
      text = '✹';
    }
    node.className = cls;
    node.textContent = text;
    node.setAttribute('aria-label', label(cell, i));
  });
  shell.stat('Mines', state.mines - state.flags);
  flagBtn.setAttribute('aria-pressed', String(flagMode));
}

function settle(previousStatus) {
  if (previousStatus === 'ready' && state.status !== 'ready') shell.startClock();
  paint();
  if (state.status === 'lost') shell.over({ title: 'Boom', text: 'That was a mine.' });
  if (state.status === 'won') {
    const ms = shell.clock();
    shell.stopClock();
    const custom = shell.opts.level === 'custom';
    const best = !custom && shell.record(ms);
    shell.over({ title: 'Board cleared', text: `${Arcade.formatTime(ms)}${best ? ', your best yet' : ''}.`, win: true });
  }
}

function open(index) {
  if (!shell.playing) return;
  if (flagMode) { flag(index); return; }
  const before = state.status;
  const cell = state.cells[index];
  if (cell.open) {
    if (MinesLogic.chord(state, index)) shell.sound('tap');
  } else if (!cell.flag) {
    MinesLogic.reveal(state, index);
    shell.sound('tap');
  }
  settle(before);
}

function flag(index) {
  if (!shell.playing) return;
  if (MinesLogic.toggleFlag(state, index)) {
    shell.sound('move');
    paint();
  }
}

flagBtn.addEventListener('click', () => {
  flagMode = !flagMode;
  flagBtn.setAttribute('aria-pressed', String(flagMode));
});
window.addEventListener('resize', () => boardEl.style.setProperty('--cell', `${cellSize()}px`));
