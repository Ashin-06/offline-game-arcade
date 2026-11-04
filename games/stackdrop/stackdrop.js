const { ROWS, COLS } = StackDropLogic;
const CELL = 30;
const COLORS = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877F5'];
const canvas = document.getElementById('board');
const ctx = Arcade.hidpi(canvas, COLS * CELL, ROWS * CELL);
let state = StackDropLogic.create();
let sinceDrop = 0;

const shell = Arcade.game({
  id: 'stackdrop',
  title: 'Stack Drop',
  stats: ['Lines', 'Level'],
  how: 'Fill rows to clear them. <kbd>Left</kbd>/<kbd>Right</kbd> move, <kbd>Up</kbd> turns, <kbd>Down</kbd> drops one row and <kbd>Space</kbd> drops all the way. The pace rises every ten lines.',
  keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '],
  pad: [
    { key: 'ArrowLeft', label: '◀', name: 'Move left', repeat: true },
    { key: 'ArrowUp', label: '⟳', name: 'Turn' },
    { key: 'ArrowDown', label: '▼', name: 'Drop one row', repeat: true },
    { key: ' ', label: '⤓', name: 'Drop all the way' },
    { key: 'ArrowRight', label: '▶', name: 'Move right', repeat: true },
  ],
  onStart() {
    state = StackDropLogic.create();
    sinceDrop = 0;
    updateStats();
  },
  onKey(key, down) {
    if (!down) return;
    if (key === 'ArrowLeft' && StackDropLogic.move(state, -1)) shell.sound('move');
    if (key === 'ArrowRight' && StackDropLogic.move(state, 1)) shell.sound('move');
    if (key === 'ArrowUp' && StackDropLogic.turn(state)) shell.sound('turn');
    if (key === 'ArrowDown') { sinceDrop = 0; settled(StackDropLogic.drop(state)); }
    if (key === ' ') { sinceDrop = 0; settled(StackDropLogic.hardDrop(state)); }
  },
});

function updateStats() {
  shell.stat('Lines', state.lines);
  shell.stat('Level', StackDropLogic.level(state));
  shell.score(state.score);
}

function settled(cleared) {
  if (cleared === null) return;
  shell.sound(cleared > 0 ? 'clear' : 'lock');
  if (cleared > 0) shell.say(`${cleared} cleared, ${state.lines} lines`);
  updateStats();
  if (state.over) shell.over({ title: 'Game over', text: `${state.lines} lines cleared.` });
}

function drawCells(matrix, offsetX, offsetY) {
  matrix.forEach((row, y) => row.forEach((value, x) => {
    if (!value) return;
    ctx.fillStyle = COLORS[value];
    ctx.beginPath();
    ctx.roundRect((x + offsetX) * CELL + 1, (y + offsetY) * CELL + 1, CELL - 2, CELL - 2, 4);
    ctx.fill();
  }));
}

function render() {
  ctx.fillStyle = '#080b18';
  ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) { ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); }
  for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); }
  ctx.stroke();
  drawCells(state.board, 0, 0);
  if (!state.over) drawCells(state.piece.matrix, state.piece.x, state.piece.y);
}

Arcade.loop({
  running: () => shell.playing,
  step(dt) {
    sinceDrop += dt * 1000;
    if (sinceDrop >= StackDropLogic.interval(state)) {
      sinceDrop = 0;
      settled(StackDropLogic.drop(state));
    }
  },
  render,
});
