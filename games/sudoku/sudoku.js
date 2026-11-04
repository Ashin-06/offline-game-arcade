const { PEERS, conflicts, isComplete, generate } = SudokuLogic;
const SAVE_KEY = 'sudoku:save';
const boardEl = document.getElementById('board');
const padEl = document.getElementById('numbers');
const notesBtn = document.getElementById('notes');
const undoBtn = document.getElementById('undo');
const hintBtn = document.getElementById('hint');
const eraseBtn = document.getElementById('erase');

let game = null; // { level, given, cells, notes, solution, hints }
let selected = 40;
let noteMode = false;
let history = [];

const shell = Arcade.game({
  id: 'sudoku',
  title: 'Sudoku',
  scoreLabel: 'Time',
  format: (ms) => Arcade.formatTime(ms),
  lowerIsBetter: true,
  hideOnPause: true,
  how: 'Fill the grid so every row, column and box has 1 to 9. <kbd>Arrows</kbd> move, digits place, <kbd>Backspace</kbd> erases, <kbd>N</kbd> notes, <kbd>U</kbd> undoes, <kbd>H</kbd> gives a hint. A game with hints does not count as a best time.',
  options: [
    { id: 'level', label: 'Difficulty', default: 'easy', choices: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']] },
  ],
  bestKey: (o) => o.level,
  bestLabel: (o) => o.level[0].toUpperCase() + o.level.slice(1),
  keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'n', 'u', 'h', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  savedGame: () => Arcade.store.get(SAVE_KEY, null),
  onContinue() {
    const save = Arcade.store.get(SAVE_KEY, null);
    if (!save) return;
    game = save.game;
    history = [];
    selected = save.selected;
    shell.opts.level = game.level;
    shell.resumeSaved();
    shell.clock(save.ms);
    shell.startClock();
    paint();
  },
  onStart(opts) {
    const { puzzle, solution } = generate(opts.level);
    game = {
      level: opts.level,
      given: puzzle.map(Boolean),
      cells: puzzle.slice(),
      notes: new Array(81).fill(0),
      solution,
      hints: 0,
    };
    selected = 40;
    noteMode = false;
    history = [];
    shell.startClock();
    save();
    paint();
  },
  onKey(key, down, repeat) {
    if (!down) return;
    const r = Math.floor(selected / 9);
    const c = selected % 9;
    if (key === 'ArrowLeft' && c > 0) select(selected - 1);
    if (key === 'ArrowRight' && c < 8) select(selected + 1);
    if (key === 'ArrowUp' && r > 0) select(selected - 9);
    if (key === 'ArrowDown' && r < 8) select(selected + 9);
    if (repeat) return;
    if (key >= '1' && key <= '9') place(Number(key));
    if (key === '0' || key === 'Backspace' || key === 'Delete') place(0);
    if (key === 'n') toggleNotes();
    if (key === 'u') undo();
    if (key === 'h') hint();
  },
});

function save() {
  if (game) Arcade.store.set(SAVE_KEY, { game, selected, ms: shell.clock() });
}

// --- Board ---
const cellEls = Array.from({ length: 81 }, (_, i) => {
  const button = Arcade.el('button', { type: 'button', className: 'cell', tabIndex: -1 });
  button.addEventListener('click', () => select(i));
  boardEl.append(button);
  return button;
});
for (let d = 1; d <= 9; d++) {
  const button = Arcade.el('button', { type: 'button', textContent: d });
  button.addEventListener('click', () => place(d));
  padEl.append(button);
}

function select(index) {
  selected = index;
  paint();
  cellEls[index].focus({ preventScroll: true });
}

function paint() {
  if (!game) return;
  const bad = conflicts(game.cells);
  const peers = new Set(PEERS[selected]);
  const value = game.cells[selected];
  const counts = new Array(10).fill(0);
  game.cells.forEach((v, i) => {
    counts[v]++;
    const cell = cellEls[i];
    cell.tabIndex = i === selected ? 0 : -1;
    cell.className = 'cell';
    if (game.given[i]) cell.classList.add('given');
    if (peers.has(i)) cell.classList.add('peer');
    if (value && v === value) cell.classList.add('same');
    if (i === selected) cell.classList.add('selected');
    if (bad.has(i)) cell.classList.add('bad');
    const row = Math.floor(i / 9) + 1;
    const col = (i % 9) + 1;
    if (v) {
      cell.textContent = v;
      cell.setAttribute('aria-label', `Row ${row}, column ${col}, ${v}${game.given[i] ? ', given' : ''}${bad.has(i) ? ', conflict' : ''}`);
    } else if (game.notes[i]) {
      const marks = Arcade.el('span', { className: 'marks' });
      const digits = [];
      for (let d = 1; d <= 9; d++) {
        const on = game.notes[i] & (1 << d);
        if (on) digits.push(d);
        marks.append(Arcade.el('i', { textContent: on ? d : '' }));
      }
      cell.replaceChildren(marks);
      cell.setAttribute('aria-label', `Row ${row}, column ${col}, notes ${digits.join(' ')}`);
    } else {
      cell.textContent = '';
      cell.setAttribute('aria-label', `Row ${row}, column ${col}, empty`);
    }
  });
  [...padEl.children].forEach((button, i) => {
    const digit = i + 1;
    button.classList.toggle('used', counts[digit] >= 9);
    button.setAttribute('aria-label', `Enter ${digit}, ${9 - counts[digit]} left`);
  });
  notesBtn.setAttribute('aria-pressed', String(noteMode));
  undoBtn.disabled = history.length === 0;
}

function remember() {
  history.push({ index: selected, cells: game.cells.slice(), notes: game.notes.slice() });
  if (history.length > 200) history.shift();
}

function place(digit) {
  if (!shell.playing || !game || game.given[selected]) return;
  if (noteMode && digit) {
    if (game.cells[selected]) return;
    remember();
    game.notes[selected] ^= 1 << digit;
    shell.sound('move');
    save();
    paint();
    return;
  }
  if (game.cells[selected] === digit && !game.notes[selected]) return;
  remember();
  game.cells[selected] = digit;
  game.notes[selected] = 0;
  if (digit) {
    // A placed digit is no longer a candidate anywhere it can see.
    for (const p of PEERS[selected]) game.notes[p] &= ~(1 << digit);
  }
  shell.sound(digit ? 'tap' : 'move');
  afterChange();
}

function afterChange() {
  save();
  paint();
  if (!isComplete(game.cells)) return;
  const ms = shell.clock();
  shell.stopClock();
  Arcade.store.remove(SAVE_KEY);
  const best = game.hints === 0 && shell.record(ms);
  const hints = game.hints ? ` with ${game.hints} ${game.hints === 1 ? 'hint' : 'hints'}` : '';
  shell.over({ title: 'Solved', text: `${Arcade.formatTime(ms)}${hints}${best ? ', your best yet' : ''}.`, win: true });
}

function toggleNotes() {
  noteMode = !noteMode;
  paint();
}

function undo() {
  if (!shell.playing || history.length === 0) return;
  const last = history.pop();
  game.cells = last.cells;
  game.notes = last.notes;
  selected = last.index;
  shell.sound('move');
  save();
  paint();
}

function hint() {
  if (!shell.playing || !game) return;
  // Prefer the selected cell. If it is already right, use the first cell that is empty or wrong.
  let target = selected;
  if (game.given[target] || game.cells[target] === game.solution[target]) {
    target = game.cells.findIndex((v, i) => v !== game.solution[i]);
  }
  if (target < 0) return;
  selected = target;
  game.hints++;
  remember();
  game.cells[target] = game.solution[target];
  game.notes[target] = 0;
  for (const p of PEERS[target]) game.notes[p] &= ~(1 << game.cells[target]);
  shell.sound('coin');
  afterChange();
}

notesBtn.addEventListener('click', toggleNotes);
undoBtn.addEventListener('click', undo);
hintBtn.addEventListener('click', hint);
eraseBtn.addEventListener('click', () => place(0));
window.addEventListener('pagehide', save);
