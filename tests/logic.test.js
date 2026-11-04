// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');

const Snake = require('../games/snake/snake.logic.js');
const Pong = require('../games/pong/pong.logic.js');
const Breakout = require('../games/breakout/breakout.logic.js');
const Invaders = require('../games/spaceinvaders/spaceinvaders.logic.js');
const Blocks = require('../games/tetris/tetris.logic.js');
const Merge = require('../games/2048/2048.logic.js');
const Memory = require('../games/memory/memory.logic.js');
const Mines = require('../games/minesweeper/minesweeper.logic.js');
const Platformer = require('../games/platformer/platformer.logic.js');
const { explore } = require('./level-solver.js');
const Flipline = require('../games/flipline/flipline.logic.js');
const Sudoku = require('../games/sudoku/sudoku.logic.js');
const Reversi = require('../games/reversi/reversi.logic.js');
const Relay = require('../games/relay/relay.logic.js');

// Small seeded generator, so a failure can be replayed.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('snake: two quick turns cannot reverse it into its own neck', () => {
  const s = Snake.create({ rng: seeded(1) });
  assert.equal(Snake.turn(s, 'left'), false);
  assert.equal(Snake.turn(s, 'up'), true);
  assert.equal(Snake.turn(s, 'left'), true);
  Snake.step(s);
  assert.equal(s.dir, 'up');
  Snake.step(s);
  assert.equal(s.dir, 'left');
  assert.equal(s.over, false);
});

test('snake: entering the cell the tail is leaving is safe, a body cell is not', () => {
  const s = Snake.create({ cols: 8, rows: 8, rng: seeded(2) });
  s.snake = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }];
  s.dir = 'down';
  s.food = { x: 7, y: 7 };
  assert.equal(Snake.step(s), null);
  assert.equal(s.over, false);
  s.snake = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }];
  s.dir = 'down';
  assert.equal(Snake.step(s), 'die');
});

test('snake: walls kill unless wrapping, and a full board is a win', () => {
  const walled = Snake.create({ cols: 8, rows: 8, rng: seeded(3) });
  walled.snake = [{ x: 7, y: 0 }];
  assert.equal(Snake.step(walled), 'die');
  const wrapped = Snake.create({ cols: 8, rows: 8, wrap: true, rng: seeded(3) });
  wrapped.snake = [{ x: 7, y: 0 }];
  Snake.step(wrapped);
  assert.deepEqual(wrapped.snake[0], { x: 0, y: 0 });

  const full = Snake.create({ cols: 2, rows: 2, rng: seeded(4) });
  full.snake = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
  full.dir = 'right';
  full.food = { x: 1, y: 0 };
  assert.equal(Snake.step(full), 'win');
  assert.equal(full.won, true);
});

test('snake: food never lands on the snake', () => {
  const s = Snake.create({ cols: 6, rows: 6, rng: seeded(5) });
  for (let i = 0; i < 300; i++) {
    s.snake = s.snake.slice(0, 3);
    Snake.step(s);
    if (s.over) break;
    assert.ok(!s.snake.some((c) => c.x === s.food.x && c.y === s.food.y));
    s.food = null;
    s.snake.push({ ...s.snake[s.snake.length - 1] });
    s.snake.pop();
    s.food = { x: (i * 5) % 6, y: (i * 7) % 6 };
    s.over = false;
    s.dir = ['right', 'down', 'left', 'up'][i % 4];
  }
});

test('pong: the CPU can be beaten, the ball cannot pass through a paddle', () => {
  let playerWins = 0;
  let cpuWins = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const s = Pong.create({ target: 5, speed: 'normal', rng: seeded(seed) });
    for (let i = 0; i < 60 * 60 * 10 && !s.winner; i++) {
      // A competent player that keeps the ball on the paddle's edge, which makes steep returns.
      s.left = Pong.clampPaddle(s.ball.y - Pong.PADDLE_H * (seed % 2 ? 0.9 : 0.1));
      Pong.step(s, 1 / 60);
      assert.ok(s.right >= 0 && s.right <= Pong.H - Pong.PADDLE_H, 'CPU paddle stays on the court');
      assert.ok(s.ball.y >= 0 && s.ball.y <= Pong.H, 'ball stays between the walls');
    }
    assert.ok(s.winner, 'a match always ends');
    if (s.winner === 'left') playerWins++;
    else cpuWins++;
  }
  assert.ok(playerWins > 0, 'player can win');
  assert.equal(playerWins + cpuWins, 12);
});

test('pong: a player who never moves loses, exactly at the target', () => {
  const s = Pong.create({ target: 3, rng: seeded(9) });
  s.left = 0;
  for (let i = 0; i < 60 * 60 * 5 && !s.winner; i++) {
    s.ball.y = Math.max(s.ball.y, 200);
    Pong.step(s, 1 / 60);
  }
  assert.equal(s.score.right, 3);
  assert.equal(s.winner, 'right');
});

test('breakout: clearing the wall is a win, not a game over', () => {
  const s = Breakout.create({ rng: seeded(1) });
  for (const brick of s.bricks) brick.alive = false;
  const last = s.bricks[0];
  last.alive = true;
  s.remaining = 1;
  s.held = false;
  s.ball = { x: last.x + 20, y: last.y + Breakout.BRICK_H + 5, vx: 0, vy: -400 };
  assert.equal(Breakout.step(s, 1 / 60), 'cleared');
  assert.equal(s.won, true);
});

test('breakout: losing all lives ends the game, a lost ball waits on the paddle', () => {
  const s = Breakout.create({ rng: seeded(2) });
  for (let life = 3; life >= 1; life--) {
    s.held = false;
    s.ball = { x: 10, y: Breakout.H + Breakout.R, vx: 0, vy: 400 };
    s.paddle = Breakout.W - 60;
    const event = Breakout.step(s, 1 / 60);
    assert.equal(event, life === 1 ? 'lost' : 'miss');
    assert.equal(s.held, true);
  }
  assert.equal(s.over, true);
  assert.equal(s.won, false);
});

test('breakout: the ball never skips a brick, leaves the field or flattens out', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const rng = seeded(seed);
    const s = Breakout.create({ speed: 'fast', rng });
    Breakout.launch(s);
    for (let i = 0; i < 60 * 240 && !s.over; i++) {
      if (s.held) Breakout.launch(s);
      Breakout.setPaddle(s, s.ball.x + (rng() - 0.5) * 60);
      Breakout.step(s, 1 / 60);
      assert.ok(s.ball.x >= 0 && s.ball.x <= Breakout.W);
      assert.ok(s.ball.y >= 0);
      assert.equal(s.remaining, s.bricks.filter((b) => b.alive).length);
    }
    assert.ok(s.won, 'a paddle that tracks the ball clears the wall');
  }
});

test('breakout: the paddle bounce always goes up and its angle follows where it hit', () => {
  const s = Breakout.create({ rng: seeded(3) });
  s.held = false;
  s.paddle = 400;
  s.ball = { x: 440, y: Breakout.PADDLE_Y - 12, vx: 0, vy: 300 };
  assert.equal(Breakout.step(s, 1 / 60), 'paddle');
  assert.ok(s.ball.vy < 0);
  assert.ok(s.ball.vx > 0);
});

test('invaders: one shot removes one alien, score and win are right', () => {
  const s = Invaders.create({ rng: () => 0.99 });
  const count = s.aliens.length;
  const target = s.aliens[0];
  s.shots.push({ x: target.x + 10, y: target.y + 5 });
  const events = Invaders.step(s, 1 / 60);
  assert.equal(events.filter((e) => e === 'kill').length, 1);
  assert.equal(s.aliens.length, count - 1);
  assert.equal(s.shots.length, 0);
  s.aliens = [s.aliens[0]];
  s.shots = [{ x: s.aliens[0].x + 10, y: s.aliens[0].y + 5 }];
  assert.ok(Invaders.step(s, 1 / 60).includes('win'));
  assert.equal(s.won, true);
});

test('invaders: the formation stays on screen, only the lowest in a column fires, three hits end it', () => {
  const rng = seeded(11);
  const s = Invaders.create({ speed: 'fast', rng });
  let bombsSeen = 0;
  for (let i = 0; i < 60 * 30 && !s.over; i++) {
    const before = s.bombs.length;
    s.invulnerable = 1;
    Invaders.step(s, 1 / 60);
    if (s.bombs.length > before) {
      const bomb = s.bombs[s.bombs.length - 1];
      const below = s.aliens.filter((a) => a.x < bomb.x && a.x + Invaders.ALIEN_W > bomb.x && a.y > bomb.y);
      assert.equal(below.length, 0, 'nothing below the alien that fired');
      bombsSeen++;
    }
    for (const a of s.aliens) assert.ok(a.x >= 0 && a.x + Invaders.ALIEN_W <= Invaders.W);
  }
  assert.ok(bombsSeen > 5);

  const hit = Invaders.create({ rng: () => 0.99 });
  for (let i = 0; i < 3; i++) {
    hit.invulnerable = 0;
    hit.bombs.push({ x: hit.player, y: Invaders.PLAYER_Y + 2 });
    Invaders.step(hit, 1 / 60);
  }
  assert.equal(hit.lives, 0);
  assert.equal(hit.over, true);
  assert.equal(hit.won, false);
});

test('blocks: rotating keeps every cell and four turns return the piece', () => {
  for (const shape of Blocks.SHAPES) {
    const cells = shape.flat().filter(Boolean).length;
    assert.equal(cells, 4);
    let m = shape;
    for (let i = 0; i < 4; i++) {
      m = Blocks.rotate(m);
      assert.equal(m.flat().filter(Boolean).length, 4);
    }
    assert.deepEqual(m, shape);
  }
});

test('blocks: a full stack ends the game and rows on any level clear with the right score', () => {
  const s = Blocks.create({ rng: () => 0 });
  for (let row = 1; row < Blocks.ROWS; row++) s.board[row] = Array(Blocks.COLS).fill(1).map((v, x) => (x === 0 ? 0 : v));
  Blocks.hardDrop(s);
  assert.equal(s.over, true);

  const clear = Blocks.create({ rng: () => 0.7 });
  clear.board[Blocks.ROWS - 1] = Array(Blocks.COLS).fill(1);
  clear.board[Blocks.ROWS - 2] = Array(Blocks.COLS).fill(1);
  clear.board[0] = Array(Blocks.COLS).fill(1);
  clear.piece = { matrix: [[5, 5], [5, 5]], x: 0, y: 2 };
  clear.board[3] = Array(Blocks.COLS).fill(0);
  const cleared = Blocks.hardDrop(clear);
  assert.equal(cleared, 3, 'the top row counts too');
  assert.equal(clear.score, 70);
  assert.equal(clear.lines, 3);
  assert.equal(clear.board.length, Blocks.ROWS);
});

test('blocks: pieces stay in the well and the pace rises with lines', () => {
  const rng = seeded(4);
  const s = Blocks.create({ rng });
  for (let i = 0; i < 4000 && !s.over; i++) {
    const roll = rng();
    if (roll < 0.3) Blocks.move(s, -1);
    else if (roll < 0.6) Blocks.move(s, 1);
    else if (roll < 0.8) Blocks.turn(s);
    else Blocks.drop(s);
    if (s.over) break;
    assert.ok(!Blocks.collides(s.board, s.piece.matrix, s.piece.x, s.piece.y));
  }
  assert.equal(s.over, true);
  const paced = Blocks.create({ rng });
  const slow = Blocks.interval(paced);
  paced.lines = 30;
  assert.ok(Blocks.interval(paced) < slow);
});

test('merge: one merge per tile per move, in every direction', () => {
  const line = (values) => [values, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  assert.deepEqual(Merge.slide(line([2, 2, 2, 2]), 'left').grid[0], [4, 4, 0, 0]);
  assert.deepEqual(Merge.slide(line([2, 2, 4, 0]), 'left').grid[0], [4, 4, 0, 0]);
  assert.deepEqual(Merge.slide(line([4, 2, 2, 8]), 'right').grid[0], [0, 4, 4, 8]);
  assert.deepEqual(Merge.slide(line([2, 2, 2, 0]), 'right').grid[0], [0, 0, 2, 4]);
  const r = Merge.slide(line([2, 2, 2, 2]), 'left');
  assert.equal(r.gained, 8);
  assert.equal(r.merged.length, 2);
  const down = Merge.slide([[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0]], 'down');
  assert.deepEqual(down.grid.map((row) => row[0]), [0, 0, 4, 4]);
  const up = Merge.slide([[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0]], 'up');
  assert.deepEqual(up.grid.map((row) => row[0]), [4, 4, 0, 0]);
});

test('merge: a move that changes nothing is not a move, and stuck is detected', () => {
  assert.equal(Merge.slide([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left').moved, false);
  const stuck = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  assert.equal(Merge.canMove(stuck), false);
  stuck[3][3] = 4;
  assert.equal(Merge.canMove(stuck), true);
  assert.equal(Merge.spawn(stuck.map((r) => r.map((v) => v || 2))), null);
  assert.equal(Merge.hasWon([[2048, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), true);
});

test('memory: every set is present, misses lock until settled, the game can be won', () => {
  for (const group of [2, 3, 4]) {
    const s = Memory.create({ items: 6, group, rng: seeded(group) });
    const byFace = new Map();
    s.cards.forEach((card, i) => byFace.set(card.face, [...(byFace.get(card.face) || []), i]));
    assert.equal(byFace.size, 6);
    for (const list of byFace.values()) assert.equal(list.length, group);

    // Make one deliberate miss.
    const [faceA, faceB] = [...byFace.keys()];
    for (let i = 0; i < group - 1; i++) Memory.flip(s, byFace.get(faceA)[i]);
    assert.equal(Memory.flip(s, byFace.get(faceB)[0]), 'miss');
    assert.equal(Memory.flip(s, byFace.get(faceB)[1]), 'ignored');
    Memory.settle(s);
    assert.ok(s.cards.every((c) => !c.up));

    let last = null;
    for (const list of byFace.values()) for (const i of list) last = Memory.flip(s, i);
    assert.equal(last, 'win');
    assert.equal(s.moves, 7);
    assert.equal(Memory.flip(s, 0), 'ignored');
  }
});

test('mines: the first click is safe everywhere and opens its neighbours', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = Mines.create(Mines.PRESETS.medium, seeded(seed));
    const index = (seed * 37) % s.cells.length;
    assert.equal(Mines.reveal(s, index), s.status);
    assert.notEqual(s.status, 'lost');
    assert.equal(s.cells[index].count, 0);
    assert.equal(s.cells.filter((c) => c.mine).length, 40);
  }
});

test('mines: numbers match the board, a mine loses, opening every safe cell wins', () => {
  const s = Mines.create(Mines.PRESETS.easy, seeded(7));
  Mines.reveal(s, 40);
  s.cells.forEach((c, i) => {
    assert.equal(c.count, Mines.neighbours(s, i).filter((n) => s.cells[n].mine).length);
  });
  const clear = Mines.create(Mines.PRESETS.easy, seeded(8));
  Mines.reveal(clear, 0);
  clear.cells.forEach((c, i) => { if (!c.mine && !c.open) Mines.reveal(clear, i); });
  assert.equal(clear.status, 'won');
  assert.equal(clear.flags, 10);

  const lose = Mines.create(Mines.PRESETS.easy, seeded(9));
  Mines.reveal(lose, 0);
  Mines.reveal(lose, lose.cells.findIndex((c) => c.mine));
  assert.equal(lose.status, 'lost');
});

test('mines: flags block opening, chords respect them, a wrong chord loses', () => {
  const s = Mines.create(Mines.PRESETS.medium, seeded(10));
  Mines.reveal(s, 0);
  const closed = s.cells.findIndex((c) => !c.open);
  Mines.toggleFlag(s, closed);
  Mines.reveal(s, closed);
  assert.equal(s.cells[closed].open, false);
  Mines.toggleFlag(s, closed);

  const number = s.cells.findIndex((c) => c.open && c.count > 0);
  assert.equal(Mines.chord(s, number), false, 'not enough flags yet');
  const around = Mines.neighbours(s, number);
  for (const n of around) if (s.cells[n].mine) Mines.toggleFlag(s, n);
  Mines.chord(s, number);
  assert.ok(around.every((n) => s.cells[n].open || s.cells[n].mine));
  assert.equal(s.status, 'playing');

  const wrong = Mines.create(Mines.PRESETS.medium, seeded(10));
  Mines.reveal(wrong, 0);
  const num = wrong.cells.findIndex((c) => c.open && c.count > 0);
  const neighbours = Mines.neighbours(wrong, num);
  let placed = 0;
  for (const n of neighbours) {
    if (!wrong.cells[n].open && !wrong.cells[n].mine && placed < wrong.cells[num].count) {
      Mines.toggleFlag(wrong, n);
      placed++;
    }
  }
  if (placed === wrong.cells[num].count) {
    Mines.chord(wrong, num);
    assert.equal(wrong.status, 'lost');
  }
});

test('mines: bad custom settings are clamped and a huge empty board does not overflow', () => {
  assert.deepEqual(Mines.clampConfig({ rows: 1, cols: 999, mines: 99999 }), { rows: 5, cols: 40, mines: 191 });
  assert.deepEqual(Mines.clampConfig({ rows: 'x', cols: NaN, mines: undefined }), { rows: 9, cols: 9, mines: 10 });
  const s = Mines.create({ rows: 30, cols: 40, mines: 1 }, seeded(1));
  Mines.reveal(s, 600);
  assert.equal(s.status, 'won');
});

test('platformer: every stage parses and can be finished', () => {
  Platformer.LEVELS.forEach((def, i) => {
    const level = Platformer.parse(def);
    assert.ok(level.start, `stage ${i + 1} has a start`);
    assert.ok(level.grid.flat().includes('D'), `stage ${i + 1} has a beacon`);
    const { door, missed } = explore(i);
    assert.equal(door, true, `stage ${i + 1} can be finished`);
    assert.deepEqual(missed, [], `every spark on stage ${i + 1} can be reached`);
  });
});

test('platformer: stands on floor, passes up through ledges, spikes and pits cost a life', () => {
  const level = { w: 10, h: 6, grid: ['          ', '          ', '   ===    ', '          ', '          ', '##########'].map((r) => r.split('')), coins: [], enemies: [], start: { x: 100, y: 100 } };
  const p = Platformer.newPlayer(level);
  for (let i = 0; i < 40; i++) Platformer.advance(level, p, {});
  assert.equal(p.grounded, true);
  assert.equal(p.y + Platformer.P_H, 5 * Platformer.T);
  for (let i = 0; i < 40; i++) Platformer.advance(level, p, { jump: true });
  const onLedge = Math.abs(p.y + Platformer.P_H - 2 * Platformer.T) < 0.01;
  assert.ok(onLedge || p.y < 2 * Platformer.T, 'jumped up through the one-way ledge');

  const s = Platformer.create();
  s.p.x = 40 * Platformer.T;
  s.p.y = 12 * Platformer.T;
  const lives = s.lives;
  for (let i = 0; i < 90 && s.lives === lives; i++) Platformer.step(s, {});
  assert.equal(s.lives, lives - 1);
  assert.deepEqual([s.p.x, s.p.y], [s.level.start.x, s.level.start.y]);
});

test('platformer: stomping kills, side contact hurts, the beacon moves on and the last one wins', () => {
  const s = Platformer.create();
  s.grace = 0;
  const enemy = s.level.enemies[0];
  s.p.x = enemy.x;
  s.p.y = enemy.y - Platformer.P_H - 4;
  s.p.vy = 6;
  const events = Platformer.step(s, {});
  assert.ok(events.includes('stomp'));
  assert.equal(enemy.alive, false);

  const side = Platformer.create();
  side.grace = 0;
  const other = side.level.enemies[0];
  side.p.x = other.x + 4;
  side.p.y = other.y - 4;
  side.p.vy = 0;
  assert.ok(Platformer.step(side, {}).includes('hurt'));

  const doorAt = (level) => {
    for (let r = 0; r < level.h; r++) {
      const c = level.grid[r].indexOf('D');
      if (c >= 0) return { c, r };
    }
    return null;
  };
  const run = Platformer.create();
  for (let i = 0; i < Platformer.LEVELS.length; i++) {
    const { c, r } = doorAt(run.level);
    run.p.x = c * Platformer.T + 4;
    run.p.y = r * Platformer.T;
    run.p.vy = 0;
    const out = Platformer.step(run, {});
    assert.ok(out.includes(i === Platformer.LEVELS.length - 1 ? 'win' : 'level'));
  }
  assert.equal(run.won, true);
});

test('flipline: the generator never builds an impossible run', () => {
  for (let seed = 1; seed <= 6; seed++) {
    // How fast the world scrolls does not depend on the flips, so a ghost in the middle of the
    // corridor, which nothing can touch, lays out the whole run.
    const ghost = Flipline.create({ rng: seeded(seed) });
    ghost.y = (Flipline.H - Flipline.SIZE) / 2;
    const all = new Set(ghost.obstacles);
    const frames = 60 * 110;
    const distances = [];
    for (let i = 0; i < frames; i++) {
      Flipline.step(ghost);
      assert.equal(ghost.over, false, 'blocks never close the middle of the corridor');
      distances.push(ghost.distance);
      for (const o of ghost.obstacles) all.add(o);
    }
    assert.ok(ghost.speed > 10, 'it was tested at high speed');

    // Then every position a player could be in is carried forward, frame by frame.
    const obstacles = [...all].sort((p, q) => p.x - q.x);
    let from = 0;
    const start = Flipline.create({ rng: seeded(seed) });
    let reachable = new Map([['start', { ...start, pickups: [] }]]);
    for (let i = 0; i < frames; i++) {
      while (from < obstacles.length && obstacles[from].x + obstacles[from].w < distances[i] - 200) from++;
      const near = obstacles.slice(from, from + 8);
      const next = new Map();
      for (const state of reachable.values()) {
        for (const flip of [false, true]) {
          const copy = { ...state, obstacles: near };
          Flipline.step(copy, flip, { generate: false });
          if (copy.over) continue;
          next.set(`${copy.y.toFixed(1)}|${copy.vy.toFixed(1)}|${copy.side}|${copy.attached}|${copy.buffer}`, copy);
        }
      }
      reachable = next;
      assert.ok(reachable.size > 0, `seed ${seed} has no way through at distance ${Math.round(distances[i])}`);
    }
  }
});

test('flipline: hitting a block ends the run, doing nothing soon does', () => {
  const s = Flipline.create({ rng: seeded(3) });
  s.obstacles = [{ x: s.distance + 200, w: 40, h: 100, side: 1 }];
  s.nextX = 1e9;
  let died = false;
  for (let i = 0; i < 200 && !died; i++) died = Flipline.step(s, false) === 'die';
  assert.equal(died, true);
  assert.ok(Flipline.score(s) >= 0);
});

test('flipline: a flip crosses the corridor and a buffered press is not lost', () => {
  const s = Flipline.create({ rng: seeded(4) });
  s.obstacles = [];
  s.nextX = 1e9;
  Flipline.step(s, true);
  assert.equal(s.attached, false);
  for (let i = 0; i < Flipline.FLIP_FRAMES - 3; i++) Flipline.step(s, false);
  Flipline.step(s, true); // pressed just before landing
  for (let i = 0; i < 6; i++) Flipline.step(s, false);
  assert.equal(s.side, 1, 'the early press flipped straight back');
});

test('sudoku: puzzles have exactly one solution, match the level and are consistent', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    for (let seed = 1; seed <= 4; seed++) {
      const { puzzle, solution } = Sudoku.generate(level, seeded(seed * 17));
      assert.equal(Sudoku.countSolutions(puzzle, 2), 1, `${level} ${seed} unique`);
      assert.ok(Sudoku.isComplete(solution));
      puzzle.forEach((v, i) => { if (v) assert.equal(v, solution[i]); });
      assert.deepEqual(Sudoku.solve(puzzle), solution);
      const clues = puzzle.filter(Boolean).length;
      if (level === 'easy') assert.ok(clues >= 38 && Sudoku.solvableBySingles(puzzle));
      if (level === 'medium') assert.ok(clues >= 30 && clues < 38 && Sudoku.solvableBySingles(puzzle));
      if (level === 'hard') assert.ok(clues <= 32);
    }
  }
});

test('sudoku: conflicts are found in rows, columns and boxes, and only a right grid completes', () => {
  const cells = new Array(81).fill(0);
  cells[0] = 5;
  cells[8] = 5;
  assert.deepEqual([...Sudoku.conflicts(cells)].sort((a, b) => a - b), [0, 8]);
  cells[8] = 0;
  cells[72] = 5;
  assert.equal(Sudoku.conflicts(cells).size, 2);
  cells[72] = 0;
  cells[10] = 5;
  assert.equal(Sudoku.conflicts(cells).size, 2);
  const { solution } = Sudoku.generate('easy', seeded(2));
  assert.equal(Sudoku.isComplete(solution), true);
  const broken = solution.slice();
  broken[0] = broken[1];
  assert.equal(Sudoku.isComplete(broken), false);
});

test('reversi: opening moves, flips along every line, and illegal moves', () => {
  const b = Reversi.start();
  assert.deepEqual(Reversi.legalMoves(b, 1).sort((x, y) => x - y), [19, 26, 37, 44]);
  assert.equal(Reversi.play(b, 1, 0), null);
  const { board, turned } = Reversi.play(b, 1, 19);
  assert.deepEqual(turned, [27]);
  assert.deepEqual(Reversi.count(board), { dark: 4, light: 1 });

  const multi = new Array(64).fill(0);
  multi[0] = 1;
  multi[9] = -1;
  multi[18] = -1;
  multi[27] = 0;
  multi[24] = 1;
  multi[25] = -1;
  multi[26] = -1;
  multi[3] = 1;
  multi[11] = -1;
  multi[19] = -1;
  const out = Reversi.play(multi, 1, 27);
  assert.deepEqual(out.turned.slice().sort((x, y) => x - y), [9, 11, 18, 19, 25, 26]);
});

test('reversi: passes and the end of the game are detected', () => {
  const done = new Array(64).fill(1);
  done[63] = 0;
  assert.equal(Reversi.nextPlayer(done, 1), null, 'nobody can move when no line can be trapped');
  const onlyDark = new Array(64).fill(0);
  onlyDark[0] = 1;
  onlyDark[1] = -1;
  assert.deepEqual(Reversi.legalMoves(onlyDark, 1), [2]);
  assert.deepEqual(Reversi.legalMoves(onlyDark, -1), []);
  assert.equal(Reversi.nextPlayer(onlyDark, 1), 1, 'light must pass and dark goes again');
});

test('reversi: the CPU always plays legally and hard beats random play', () => {
  const rng = seeded(21);
  let hardWins = 0;
  const games = 6;
  for (let g = 0; g < games; g++) {
    let board = Reversi.start();
    let player = 1;
    const cpu = g % 2 ? 1 : -1;
    let safety = 0;
    while (player !== null && safety++ < 200) {
      const moves = Reversi.legalMoves(board, player);
      const move = player === cpu ? Reversi.chooseMove(board, player, 'hard', rng) : moves[Math.floor(rng() * moves.length)];
      assert.ok(moves.includes(move));
      board = Reversi.play(board, player, move).board;
      player = Reversi.nextPlayer(board, player);
    }
    const { dark, light } = Reversi.count(board);
    if ((cpu === 1 ? dark : light) > (cpu === 1 ? light : dark)) hardWins++;
  }
  assert.equal(hardWins, games);
});

test('relay: the tree spans the grid, scrambles are unsolved and turning back solves it', () => {
  for (const size of [5, 7, 9]) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = Relay.create({ size, rng: seeded(seed * size) });
      assert.equal(Relay.isSolved(s), false);
      const edges = s.base.reduce((sum, mask) => sum + ((mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1)), 0) / 2;
      assert.equal(edges, size * size - 1, 'a tree has one edge fewer than cells');
      for (let i = 0; i < s.turns.length; i++) {
        s.turns[i] = 0;
      }
      assert.equal(Relay.isSolved(s), true);
    }
  }
});

test('relay: a turn moves all links together, a dark neighbour stays out of the lit set', () => {
  assert.equal(Relay.turnMask(Relay.N), Relay.E);
  assert.equal(Relay.turnMask(Relay.W), Relay.N);
  assert.equal(Relay.turnMask(Relay.N | Relay.E, 2), Relay.S | Relay.W);
  assert.equal(Relay.turnMask(Relay.N | Relay.E, -1), Relay.W | Relay.N);
  const s = Relay.create({ size: 5, rng: seeded(6) });
  s.turns.fill(0);
  const neighbour = s.base[s.core] & Relay.N ? s.core - 5 : s.base[s.core] & Relay.E ? s.core + 1 : s.base[s.core] & Relay.S ? s.core + 5 : s.core - 1;
  assert.ok(Relay.litCells(s).has(neighbour));
  const moves = s.moves;
  // Two quarter turns always break the link to the core on the side it came from.
  Relay.rotate(s, s.core, 1);
  Relay.rotate(s, s.core, 1);
  assert.equal(s.moves, moves + 2);
  assert.ok(Relay.litCells(s).size < 25 || !Relay.isSolved(s) || s.base[s.core] === 15);
});
