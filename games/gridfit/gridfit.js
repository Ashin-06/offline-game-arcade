const { SIZE, canPlace, create, place } = GridFitLogic;
const W = 480;
const CELL = 50;
const GRID_X = (W - CELL * SIZE) / 2;
const GRID_Y = 16;
const TRAY_Y = GRID_Y + CELL * SIZE + 18;
const TRAY_H = 150;
const H = TRAY_Y + TRAY_H + 8;
const TRAY_CELL = 22;
const COLORS = [null, '#ff6b81', '#ffb347', '#5fd38d', '#6bb4ff', '#c084ff', '#6be3c3'];
const canvas = document.getElementById('grid');
const ctx = Arcade.hidpi(canvas, W, H);

let state = create();
let held = null; // { index, x, y } while a piece is being carried
let chosen = 0;
let cursor = { r: 3, c: 3 };
let flash = [];
let usingKeys = false;

const shell = Arcade.game({
  id: 'gridfit',
  title: 'Grid Fit',
  pausable: false,
  how: 'Drag a piece onto the grid, or tap it and then a square. Full rows and columns clear, and clearing on back-to-back placements scores more. It ends when nothing in the tray fits. <kbd>1</kbd> to <kbd>3</kbd> pick, <kbd>Arrows</kbd> move, <kbd>Enter</kbd> places.',
  keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', '1', '2', '3'],
  onStart() {
    state = create();
    held = null;
    chosen = 0;
    flash = [];
    usingKeys = false;
    shell.say('Pieces ready');
  },
  onKey(key, down) {
    if (!down) return;
    usingKeys = true;
    if (key >= '1' && key <= '3') chosen = Number(key) - 1;
    if (key === 'ArrowLeft') cursor.c = Math.max(0, cursor.c - 1);
    if (key === 'ArrowRight') cursor.c = Math.min(SIZE - 1, cursor.c + 1);
    if (key === 'ArrowUp') cursor.r = Math.max(0, cursor.r - 1);
    if (key === 'ArrowDown') cursor.r = Math.min(SIZE - 1, cursor.r + 1);
    if (key === ' ' || key === 'Enter') tryPlace(chosen, cursor.r, cursor.c);
  },
});

const traySlotX = (i) => (W / 3) * i + W / 6;

function tryPlace(index, r, c) {
  const result = place(state, index, r, c);
  if (!result) {
    shell.sound('lock');
    return false;
  }
  shell.sound(result.lines ? 'clear' : 'tap');
  flash = result.cleared.map(([y, x]) => ({ r: y, c: x, life: 18 }));
  shell.score(state.score);
  if (result.lines) shell.say(`${result.lines} cleared, plus ${result.gained}`);
  if (!state.tray[chosen]) chosen = state.tray.findIndex(Boolean);
  if (chosen < 0) chosen = 0;
  if (state.over) shell.over({ title: 'No room left', text: `Score ${state.score}.` });
  return true;
}

// Touch hides whatever is under the finger, so a piece being dragged rides above it.
function gridSpot(x, y, shape, lifted) {
  const px = x - (shape[0].length * CELL) / 2;
  const py = y - (shape.length * CELL) / 2 - (lifted ? 70 : 0);
  return { r: Math.round((py - GRID_Y) / CELL), c: Math.round((px - GRID_X) / CELL), px, py };
}

let pressStart = null;
let pressKind = 'mouse';

canvas.addEventListener('pointerdown', (e) => {
  if (!shell.playing) return;
  usingKeys = false;
  canvas.setPointerCapture(e.pointerId);
  const p = Arcade.pointerPos(canvas, e, W, H);
  pressKind = e.pointerType;
  pressStart = p;
  if (p.y > TRAY_Y - 6) {
    const index = Math.floor(p.x / (W / 3));
    if (state.tray[index]) {
      chosen = index;
      held = { index, x: p.x, y: p.y };
      shell.sound('move');
    }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!held) return;
  const p = Arcade.pointerPos(canvas, e, W, H);
  held.x = p.x;
  held.y = p.y;
});
canvas.addEventListener('pointerup', (e) => {
  if (!shell.playing) return;
  const p = Arcade.pointerPos(canvas, e, W, H);
  const moved = pressStart && Math.hypot(p.x - pressStart.x, p.y - pressStart.y) > 12;
  if (held) {
    if (moved) {
      const spot = gridSpot(p.x, p.y, state.tray[held.index].shape, pressKind !== 'mouse');
      tryPlace(held.index, spot.r, spot.c);
    }
    held = null;
    return;
  }
  // Tap on the grid: put the chosen piece with its centre on that square.
  if (p.y < TRAY_Y - 6 && state.tray[chosen]) {
    const { shape } = state.tray[chosen];
    const r = Math.floor((p.y - GRID_Y) / CELL) - Math.floor((shape.length - 1) / 2);
    const c = Math.floor((p.x - GRID_X) / CELL) - Math.floor((shape[0].length - 1) / 2);
    tryPlace(chosen, r, c);
  }
});
canvas.addEventListener('pointercancel', () => { held = null; });

function block(x, y, size, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, size - 2, size - 2, Math.max(3, size * 0.14));
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x + size * 0.14, y + size * 0.1, size * 0.72, Math.max(2, size * 0.09));
  ctx.globalAlpha = 1;
}

function ghost(shape, r, c, color) {
  const fits = canPlace(state, shape, r, c);
  shape.forEach((row, y) => row.forEach((on, x) => {
    const nr = r + y;
    const nc = c + x;
    if (on && nr >= 0 && nc >= 0 && nr < SIZE && nc < SIZE) {
      if (fits) block(GRID_X + nc * CELL, GRID_Y + nr * CELL, CELL, color, 0.42);
      else {
        ctx.fillStyle = 'rgba(255, 107, 129, 0.3)';
        ctx.fillRect(GRID_X + nc * CELL + 2, GRID_Y + nr * CELL + 2, CELL - 4, CELL - 4);
      }
    }
  }));
}

function render() {
  ctx.fillStyle = '#080b18';
  ctx.fillRect(0, 0, W, H);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      // Shading every third band gives the eye a guide across nine squares.
      const band = (Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 0;
      ctx.fillStyle = band ? '#1f2645' : '#181e3a';
      ctx.beginPath();
      ctx.roundRect(GRID_X + c * CELL + 1, GRID_Y + r * CELL + 1, CELL - 2, CELL - 2, 5);
      ctx.fill();
      if (state.board[r][c]) block(GRID_X + c * CELL, GRID_Y + r * CELL, CELL, COLORS[state.board[r][c]]);
    }
  }
  for (const f of flash) {
    ctx.fillStyle = `rgba(255,255,255,${f.life / 18})`;
    ctx.fillRect(GRID_X + f.c * CELL, GRID_Y + f.r * CELL, CELL, CELL);
    f.life--;
  }
  flash = flash.filter((f) => f.life > 0);

  // Tray.
  state.tray.forEach((piece, i) => {
    if (!piece || (held && held.index === i)) return;
    const w = piece.shape[0].length * TRAY_CELL;
    const h = piece.shape.length * TRAY_CELL;
    const x = traySlotX(i) - w / 2;
    const y = TRAY_Y + (TRAY_H - h) / 2;
    if (i === chosen && (usingKeys || !held)) {
      ctx.strokeStyle = '#6be3c3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(traySlotX(i) - W / 6 + 8, TRAY_Y + 4, W / 3 - 16, TRAY_H - 8, 12);
      ctx.stroke();
    }
    const usable = GridFitLogic.fitsAnywhere(state, piece.shape);
    piece.shape.forEach((row, py) => row.forEach((on, px) => {
      if (on) block(x + px * TRAY_CELL, y + py * TRAY_CELL, TRAY_CELL, COLORS[piece.color], usable ? 1 : 0.32);
    }));
  });

  if (usingKeys && state.tray[chosen] && shell.playing) {
    ghost(state.tray[chosen].shape, cursor.r, cursor.c, COLORS[state.tray[chosen].color]);
  }
  if (held && state.tray[held.index]) {
    const piece = state.tray[held.index];
    const lifted = pressKind !== 'mouse';
    const spot = gridSpot(held.x, held.y, piece.shape, lifted);
    ghost(piece.shape, spot.r, spot.c, COLORS[piece.color]);
    piece.shape.forEach((row, y) => row.forEach((on, x) => {
      if (on) block(spot.px + x * CELL, spot.py + y * CELL, CELL, COLORS[piece.color], 0.9);
    }));
  }
}

Arcade.loop({ running: () => shell.playing, step() {}, render });
