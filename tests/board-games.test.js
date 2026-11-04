// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');

const Chess = require('../games/chess/chess.logic.js');
const Ludo = require('../games/ludo/ludo.logic.js');
const Pool = require('../games/pool/pool.logic.js');
const Lane = require('../games/lanerush/lanerush.logic.js');
const Prism = require('../games/prismmatch/prismmatch.logic.js');
const Grid = require('../games/gridfit/gridfit.logic.js');
const Sentry = require('../games/sentrypath/sentrypath.logic.js');

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

// --- Chess ---
// Published move counts. Any mistake in castling, en passant, promotion or pins changes them.
test('chess: move generation matches the published perft counts', () => {
  const positions = [
    [Chess.START, [20, 400, 8902]],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ];
  for (const [fen, counts] of positions) {
    counts.forEach((expected, i) => assert.equal(Chess.perft(Chess.fromFEN(fen), i + 1), expected, `${fen} depth ${i + 1}`));
  }
});

const sq = (name) => (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97);
const moveOf = (s, from, to, promo) => Chess.legalMoves(s).find((m) => m.from === sq(from) && m.to === sq(to) && (!promo || m.promo === promo));

test('chess: checkmate, stalemate and the draw rules are all recognised', () => {
  let s = Chess.fromFEN(Chess.START);
  for (const [a, b] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) s = Chess.play(s, moveOf(s, a, b));
  assert.equal(Chess.status(s), 'checkmate');
  assert.equal(Chess.status(Chess.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), 'stalemate');
  assert.equal(Chess.status(Chess.fromFEN('7k/8/8/8/8/8/8/R5K1 w - - 100 90')), 'fifty');
  assert.equal(Chess.status(Chess.fromFEN('7k/8/8/8/8/8/8/6K1 w - - 0 1')), 'material');
  assert.equal(Chess.status(Chess.fromFEN('7k/8/8/8/8/8/8/5NK1 w - - 0 1')), 'material');
  assert.equal(Chess.status(Chess.fromFEN('5b1k/8/8/8/8/8/8/5BK1 w - - 0 1')), 'playing', 'bishops on opposite colours can still mate');
  assert.equal(Chess.status(Chess.fromFEN('6bk/8/8/8/8/8/8/5BK1 w - - 0 1')), 'material', 'bishops on one colour cannot');

  let r = Chess.fromFEN(Chess.START);
  const shuffle = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
  for (let i = 0; i < 2; i++) {
    assert.equal(Chess.status(r), 'playing');
    for (const [a, b] of shuffle) r = Chess.play(r, moveOf(r, a, b));
  }
  assert.equal(Chess.status(r), 'repetition');
});

test('chess: special moves change the board correctly', () => {
  // Castling both ways moves the rook and spends the rights.
  const c = Chess.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const short = Chess.makeMove(c, moveOf(c, 'e1', 'g1'));
  assert.equal(short.board[sq('f1')], 'R');
  assert.equal(short.board[sq('h1')], '');
  assert.equal(short.castle, 'kq');
  const long = Chess.makeMove(short, moveOf(short, 'e8', 'c8'));
  assert.equal(long.board[sq('d8')], 'r');
  assert.equal(long.castle, '');

  // Castling through an attacked square is not allowed.
  const blocked = Chess.fromFEN('4k3/8/8/8/8/8/5r2/4K2R w K - 0 1');
  assert.equal(moveOf(blocked, 'e1', 'g1'), undefined);

  // En passant removes the pawn that passed.
  const e = Chess.fromFEN('4k3/4p3/8/3P4/8/8/8/4K3 b - - 0 1');
  const pushed = Chess.makeMove(e, moveOf(e, 'e7', 'e5'));
  assert.equal(pushed.ep, sq('e6'));
  const taken = Chess.makeMove(pushed, moveOf(pushed, 'd5', 'e6'));
  assert.equal(taken.board[sq('e5')], '');
  assert.equal(taken.board[sq('e6')], 'P');

  // A pawn reaching the last rank offers all four promotions.
  const p = Chess.fromFEN('8/4P1k1/8/8/8/8/6K1/8 w - - 0 1');
  assert.equal(Chess.legalMoves(p).filter((m) => m.from === sq('e7')).length, 4);
  assert.equal(Chess.makeMove(p, moveOf(p, 'e7', 'e8', 'n')).board[sq('e8')], 'N');

  // A pinned piece may not leave the line to its king.
  const pinned = Chess.fromFEN('4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1');
  assert.equal(Chess.legalMoves(pinned).filter((m) => m.from === sq('e2')).length, 0);
});

test('chess: the CPU mates in one, takes free pieces and beats random play', () => {
  const mate = Chess.fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  for (const level of ['medium', 'hard']) assert.equal(Chess.chooseMove(mate, level, seeded(1)).to, sq('a8'), level);
  const free = Chess.fromFEN('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
  assert.equal(Chess.chooseMove(free, 'medium', seeded(2)).to, sq('d5'));

  const rng = seeded(5);
  let s = Chess.fromFEN(Chess.START);
  for (let ply = 0; ply < 200 && Chess.status(s) === 'playing'; ply++) {
    const moves = Chess.legalMoves(s);
    const m = s.white ? Chess.chooseMove(s, 'medium', rng) : moves[Math.floor(rng() * moves.length)];
    assert.ok(moves.includes(m) || moves.some((x) => x.from === m.from && x.to === m.to));
    s = Chess.play(s, m);
  }
  assert.equal(Chess.status(s), 'checkmate');
  assert.equal(s.white, false, 'black was the side mated');
});

// --- Ludo ---
test('ludo: the board is one connected loop and each home column joins it', () => {
  assert.equal(Ludo.TRACK.length, 52);
  Ludo.TRACK.forEach((cell, i) => {
    const next = Ludo.TRACK[(i + 1) % 52];
    const gap = Math.abs(cell[0] - next[0]) + Math.abs(cell[1] - next[1]);
    // The only diagonal steps are where the track turns the corner around each arm.
    assert.ok(gap === 1 || (gap === 2 && Math.abs(cell[0] - next[0]) === 1), `${cell} to ${next}`);
  });
  for (const color of Ludo.COLORS) {
    const last = Ludo.cellOf(color, Ludo.LAST_TRACK);
    const first = Ludo.HOME_COLUMN[color][0];
    assert.equal(Math.abs(last[0] - first[0]) + Math.abs(last[1] - first[1]), 1, color);
  }
});

function ludoGame(fixedRolls = [], players = 4) {
  const rolls = [...fixedRolls];
  const random = seeded(3);
  // Each entry fixes one die: rng() returning (n - 1) / 6 + a little rolls n.
  return Ludo.create({ players, humans: 0, rng: () => (rolls.length ? (rolls.shift() - 1) / 6 + 0.01 : random()) });
}

test('ludo: only a six leaves base, and a six rolls again', () => {
  const s = ludoGame([3, 6, 4]);
  let r = Ludo.roll(s);
  assert.equal(r.die, 3);
  assert.equal(r.lost, 'no move');
  assert.equal(s.turn, 1);
  r = Ludo.roll(s);
  assert.equal(r.die, 6);
  assert.deepEqual(r.moves, [0, 1, 2, 3]);
  Ludo.move(s, 0);
  assert.equal(s.seats[1].tokens[0], 0);
  assert.equal(s.turn, 1, 'a six keeps the turn');
  r = Ludo.roll(s);
  assert.equal(r.die, 4);
  Ludo.move(s, 0);
  assert.equal(s.seats[1].tokens[0], 4);
  assert.equal(s.turn, 2);
});

test('ludo: three sixes lose the turn', () => {
  const s = ludoGame([6, 6, 6]);
  Ludo.roll(s);
  Ludo.move(s, 0);
  Ludo.roll(s);
  Ludo.move(s, 0);
  const r = Ludo.roll(s);
  assert.equal(r.lost, 'three sixes');
  assert.equal(s.turn, 1);
});

test('ludo: captures send a lone token home and pay a roll, safe squares and pairs are protected', () => {
  const s = ludoGame([2]);
  s.seats[0].tokens[0] = 15; // Red at absolute square 15
  s.seats[1].tokens[0] = 4; // Green at 13 + 4 = 17
  s.die = 2;
  s.phase = 'move';
  const events = Ludo.move(s, 0);
  assert.ok(events.includes('capture'));
  assert.equal(s.seats[1].tokens[0], Ludo.BASE);
  assert.equal(s.turn, 0, 'a capture pays another roll');

  const safe = ludoGame();
  safe.seats[0].tokens[0] = 5;
  safe.seats[1].tokens[0] = 8; // absolute 21, a star
  safe.seats[0].tokens[0] = 19;
  safe.die = 2;
  safe.phase = 'move';
  assert.ok(!Ludo.move(safe, 0).includes('capture'));
  assert.equal(safe.seats[1].tokens[0], 8);

  const pair = ludoGame();
  pair.seats[0].tokens[0] = 15;
  pair.seats[1].tokens[0] = 4;
  pair.seats[1].tokens[1] = 4;
  pair.die = 2;
  pair.phase = 'move';
  assert.ok(!Ludo.move(pair, 0).includes('capture'));
});

test('ludo: home needs the exact count, and the first to bring all four home wins', () => {
  const s = ludoGame();
  s.seats[0].tokens = [54, Ludo.HOME, Ludo.HOME, Ludo.HOME];
  s.die = 5;
  assert.deepEqual(Ludo.legalTokens(s), [], 'a five overshoots from two away');
  s.die = 2;
  s.phase = 'move';
  const events = Ludo.move(s, 0);
  assert.ok(events.includes('home') && events.includes('win'));
  assert.equal(s.winner, 0);
  assert.equal(s.phase, 'over');
});

test('ludo: full games between CPU players always finish with one winner', () => {
  for (const players of [2, 3, 4]) {
    for (let seed = 1; seed <= 6; seed++) {
      const s = Ludo.create({ players, humans: 0, rng: seeded(seed * 31 + players) });
      let turns = 0;
      while (s.phase !== 'over' && turns++ < 20000) {
        if (s.phase === 'roll') Ludo.roll(s);
        else {
          const before = Ludo.legalTokens(s);
          const pick = Ludo.chooseToken(s);
          assert.ok(before.includes(pick));
          assert.ok(Ludo.move(s, pick));
        }
        for (const seat of s.seats) for (const t of seat.tokens) assert.ok(t >= Ludo.BASE && t <= Ludo.HOME);
      }
      assert.equal(s.phase, 'over');
      assert.ok(s.seats[s.winner].tokens.every((t) => t === Ludo.HOME));
    }
  }
});

// --- Pool ---
function settle(s) {
  for (let i = 0; i < 60 * 60 && s.moving; i++) Pool.step(s, 1 / 60);
  assert.equal(s.moving, false, 'balls come to rest');
}
function tableWith(placed, options = {}) {
  const s = Pool.create({ twoPlayer: true, rng: seeded(1), ...options });
  s.isBreak = false;
  for (const b of s.balls) if (b.n !== 0) b.down = true;
  for (const [n, x, y] of placed) {
    const ball = s.balls.find((b) => b.n === n);
    ball.down = false;
    ball.x = x;
    ball.y = y;
  }
  return s;
}
const fireAt = (s, x, y, power = 900) => {
  const c = Pool.cue(s);
  Pool.shoot(s, Math.atan2(y - c.y, x - c.x), power);
};

test('pool: a collision conserves momentum and balls stay on the table', () => {
  const s = tableWith([[1, 450, 225]]);
  Pool.cue(s).x = 300;
  Pool.cue(s).y = 225;
  fireAt(s, 450, 225, 800);
  const [cueBall, one] = [Pool.cue(s), s.balls.find((b) => b.n === 1)];
  let collided = false;
  for (let i = 0; i < 60 && !collided; i++) {
    const before = cueBall.vx + one.vx;
    Pool.step(s, 1 / 240);
    if (one.vx !== 0) {
      collided = true;
      assert.ok(Math.abs(cueBall.vx + one.vx - before) < 3, 'momentum along the line is kept');
      assert.ok(one.vx > cueBall.vx, 'the struck ball leaves faster');
    }
  }
  assert.ok(collided);
  settle(s);
  for (const b of s.balls) {
    if (b.down) continue;
    assert.ok(b.x >= Pool.R && b.x <= Pool.W - Pool.R && b.y >= Pool.R && b.y <= Pool.H - Pool.R);
  }
});

test('pool: the rack is 15 balls with the 8 in the middle and no overlaps', () => {
  const s = Pool.create({ rng: seeded(2) });
  assert.equal(s.balls.length, 16);
  const eight = s.balls.find((b) => b.n === 8);
  assert.ok(Math.abs(eight.y - Pool.H / 2) < 0.01);
  for (const a of s.balls) {
    for (const b of s.balls) {
      if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 2 * Pool.R - 0.01);
    }
  }
});

test('pool: potting picks the group and keeps the turn, a miss passes it', () => {
  const s = tableWith([[1, 870, 30], [9, 450, 300]]);
  Pool.cue(s).x = 700;
  Pool.cue(s).y = 200;
  // Straight along the line through ball 1 into the corner pocket.
  const p = Pool.POCKETS[2];
  const d = Math.hypot(p.x - 870, p.y - 30);
  fireAt(s, 870 - ((p.x - 870) / d) * Pool.R * 2, 30 - ((p.y - 30) / d) * Pool.R * 2, 900);
  settle(s);
  assert.equal(s.balls.find((b) => b.n === 1).down, true);
  assert.deepEqual(s.groups, ['solid', 'stripe']);
  assert.equal(s.turn, 0);

  // Player 0 now plays a safe tap on their own colour and pots nothing: turn passes, no foul.
  s.balls.find((b) => b.n === 2).down = false;
  Object.assign(s.balls.find((b) => b.n === 2), { x: 200, y: 225 });
  Object.assign(Pool.cue(s), { x: 100, y: 225 });
  fireAt(s, 200, 225, 200);
  settle(s);
  assert.equal(s.turn, 1);
  assert.equal(s.inHand, false);
});

test('pool: fouls give ball in hand, and a scratch brings the cue ball back', () => {
  // Hitting the wrong group first.
  const wrong = tableWith([[1, 450, 225], [9, 300, 225]]);
  wrong.groups = ['solid', 'stripe'];
  Object.assign(Pool.cue(wrong), { x: 150, y: 225 });
  fireAt(wrong, 300, 225, 500);
  settle(wrong);
  assert.equal(wrong.turn, 1);
  assert.equal(wrong.inHand, true);
  assert.match(wrong.foul, /first/);

  // Hitting nothing.
  const none = tableWith([[1, 450, 400]]);
  Object.assign(Pool.cue(none), { x: 100, y: 100 });
  Pool.shoot(none, Math.PI, 100);
  settle(none);
  assert.equal(none.turn, 1);
  assert.equal(none.inHand, true);

  // Sinking the cue ball.
  const scratch = tableWith([[1, 450, 225]]);
  Object.assign(Pool.cue(scratch), { x: 870, y: 30 });
  fireAt(scratch, 900, 0, 900);
  settle(scratch);
  assert.equal(scratch.turn, 1);
  assert.equal(scratch.inHand, true);
  assert.equal(Pool.cue(scratch).down, true);
  assert.equal(Pool.placeCue(scratch, 450, 225), false, 'not on top of another ball');
  assert.equal(Pool.placeCue(scratch, 300, 300), true);
  assert.equal(Pool.cue(scratch).down, false);
  assert.equal(scratch.inHand, false);
});

test('pool: the 8 wins only after the group is gone, and loses otherwise', () => {
  const pot8 = (setup) => {
    const s = tableWith([[8, 870, 30], ...setup.extra]);
    s.groups = setup.groups;
    Object.assign(Pool.cue(s), { x: 700, y: 200 });
    const p = Pool.POCKETS[2];
    const d = Math.hypot(p.x - 870, p.y - 30);
    fireAt(s, 870 - ((p.x - 870) / d) * Pool.R * 2, 30 - ((p.y - 30) / d) * Pool.R * 2, 900);
    settle(s);
    return s;
  };
  const won = pot8({ groups: ['solid', 'stripe'], extra: [] });
  assert.equal(won.winner, 0);
  const early = pot8({ groups: ['solid', 'stripe'], extra: [[2, 200, 225]] });
  assert.equal(early.winner, 1);
  assert.match(early.reason, /early|foul/);
});

test('pool: CPU players finish a whole match, shooting only legally placed cue balls', () => {
  for (let seed = 1; seed <= 3; seed++) {
    const s = Pool.create({ twoPlayer: true, level: 'hard', rng: seeded(seed * 13) });
    let shots = 0;
    let pots = 0;
    while (s.winner === null && shots++ < 400) {
      if (s.inHand) {
        const spot = Pool.chooseSpot(s);
        assert.ok(Pool.placeCue(s, spot.x, spot.y));
      }
      const before = s.balls.filter((b) => b.down).length;
      const shot = Pool.chooseShot(s);
      assert.ok(Pool.shoot(s, shot.angle, shot.power));
      settle(s);
      pots += s.balls.filter((b) => b.down).length - before;
    }
    assert.notEqual(s.winner, null, `seed ${seed} never ended`);
    assert.ok(pots >= 8, 'the CPU really does pot balls');
  }
});

// --- Lane Rush ---
test('lane rush: the generator never builds an impossible run', () => {
  const dt = 1 / 60;
  const frames = 60 * 110;
  for (let seed = 1; seed <= 5; seed++) {
    const master = Lane.create({ rng: seeded(seed) });
    // A ghost gives the same layout a player would meet: nothing it does changes what is built.
    const obstacles = new Set(master.obstacles);
    const distances = [];
    for (let i = 0; i < frames; i++) {
      master.over = false;
      Lane.step(master, dt);
      master.over = false;
      distances.push(master.distance);
      for (const o of master.obstacles) obstacles.add(o);
    }
    assert.ok(master.speed > 30, 'tested near top speed');
    const all = [...obstacles].sort((a, b) => a.z - b.z);
    const options = [{}, { left: true }, { right: true }, { jump: true }, { slide: true }];
    let from = 0;
    const startState = Lane.create({ rng: seeded(seed) });
    let reachable = new Map([['start', { ...startState, pickups: [], obstacles: [] }]]);
    for (let i = 0; i < frames; i++) {
      while (from < all.length && all[from].z < distances[i] - 2) from++;
      const near = all.slice(from, from + 12);
      const next = new Map();
      // Decisions every sixth frame are well within what a thumb can do.
      const moves = i % 6 === 0 ? options : [{}];
      for (const state of reachable.values()) {
        for (const input of moves) {
          const copy = { ...state, obstacles: near };
          Lane.step(copy, dt, input, { generate: false });
          if (copy.over) continue;
          next.set(`${copy.lane}|${copy.x.toFixed(1)}|${copy.y.toFixed(1)}|${copy.vy.toFixed(0)}|${copy.slide.toFixed(1)}`, copy);
        }
      }
      reachable = next;
      assert.ok(reachable.size > 0, `seed ${seed} has no way through at ${Math.round(distances[i])} m`);
    }
  }
});

test('lane rush: each obstacle is passed only the right way', () => {
  const run = (kind, input) => {
    const s = Lane.create({ rng: seeded(1) });
    s.obstacles = [{ z: s.distance + 12, lane: 1, kind }];
    s.pickups = [];
    s.nextRow = 1e9;
    let dead = false;
    for (let i = 0; i < 120 && !dead; i++) {
      const ahead = s.obstacles.length ? s.obstacles[0].z - s.distance : 99;
      const press = input && ahead < 5 ? input : {};
      if (press.done) continue;
      dead = Lane.step(s, 1 / 60, press === input ? input : {}, { generate: false }) === 'die';
    }
    return dead;
  };
  assert.equal(run('wall', {}), true, 'a wall stops you');
  assert.equal(run('wall', { jump: true }), true, 'a wall cannot be jumped');
  assert.equal(run('wall', { left: true }), false, 'a wall can be walked around');
  assert.equal(run('low', {}), true);
  assert.equal(run('low', { jump: true }), false);
  assert.equal(run('high', {}), true);
  assert.equal(run('high', { slide: true }), false);
  assert.equal(run('high', { jump: true }), true, 'a gate cannot be jumped');
});

test('lane rush: lanes stay on the road, speed rises, coins pay', () => {
  const s = Lane.create({ rng: seeded(2) });
  s.obstacles = [];
  s.nextRow = 1e9;
  Lane.step(s, 1 / 60, { left: true }, { generate: false });
  Lane.step(s, 1 / 60, { left: true }, { generate: false });
  assert.equal(s.lane, 0);
  s.pickups = [{ z: s.distance + 1, lane: 0, taken: false }];
  for (let i = 0; i < 30; i++) Lane.step(s, 1 / 60, {}, { generate: false });
  assert.equal(s.coins, 1);
  assert.ok(s.speed > Lane.START_SPEED);
  assert.ok(Lane.score(s) >= 10);
});

// --- Prism Match ---
test('prism: boards start settled with a move available, and refills keep it that way', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = Prism.create({ rng: seeded(seed) });
    assert.equal(Prism.findRuns(s.board).length, 0);
    assert.ok(Prism.hasMove(s));
  }
});

function board(rows) {
  const s = Prism.create({ rng: seeded(99) });
  s.board = rows.map((row) => row.map((c) => (typeof c === 'object' ? { id: s.nextId++, ...c } : { id: s.nextId++, c, special: null })));
  return s;
}
const chequer = (r, c) => (r + c) % 2 ? (r % 3) + 3 : (c % 3);

function blankRows() {
  return Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => chequer(r, c)));
}

test('prism: a swap with no match is refused and costs nothing', () => {
  const s = board(blankRows());
  const before = JSON.stringify(s.board);
  const moves = s.moves;
  assert.equal(Prism.trySwap(s, [0, 0], [0, 1]), null);
  assert.equal(JSON.stringify(s.board), before);
  assert.equal(s.moves, moves);
  assert.equal(Prism.trySwap(s, [0, 0], [3, 3]), null, 'only neighbours swap');
});

test('prism: a match clears, scores, drops and refills', () => {
  const rows = blankRows();
  rows[7][0] = 5;
  rows[7][1] = 5;
  rows[6][2] = 5;
  rows[7][2] = 0;
  const s = board(rows);
  const moves = s.moves;
  const result = Prism.trySwap(s, [6, 2], [7, 2]);
  assert.ok(result);
  assert.equal(s.moves, moves - 1);
  assert.ok(result.steps[0].cleared.length >= 3);
  assert.ok(s.score >= 30);
  assert.ok(s.board.flat().every(Boolean), 'no holes after refilling');
  assert.equal(Prism.findRuns(s.board).length, 0, 'the board has settled');
});

test('prism: runs of four and five make special tiles, and they fire', () => {
  const four = blankRows();
  four[7][0] = 5; four[7][1] = 5; four[7][3] = 5; four[6][2] = 5; four[7][2] = 0;
  const f = board(four);
  Prism.trySwap(f, [6, 2], [7, 2]);
  assert.ok(f.board.flat().some((t) => t.special === 'row'));

  const five = blankRows();
  five[7][0] = 5; five[7][1] = 5; five[7][3] = 5; five[7][4] = 5; five[6][2] = 5; five[7][2] = 0;
  const g = board(five);
  Prism.trySwap(g, [6, 2], [7, 2]);
  assert.ok(g.board.flat().some((t) => t.special === 'star'));

  const line = blankRows();
  line[3][4] = { c: 5, special: 'row' }; line[3][5] = 5; line[3][7] = 5; line[2][6] = 5; line[3][6] = 0;
  const h = board(line);
  const result = Prism.trySwap(h, [2, 6], [3, 6]);
  assert.ok(result.steps[0].cleared.filter(([r]) => r === 3).length === 8, 'the whole row goes');

  const star = blankRows();
  star[4][4] = { c: 0, special: 'star' };
  star[4][5] = 2;
  const k = board(star);
  const colourCount = k.board.flat().filter((t) => t.c === 2 && !t.special).length;
  const fired = Prism.trySwap(k, [4, 4], [4, 5]);
  assert.ok(fired.steps[0].cleared.length >= colourCount, 'every tile of that colour goes');
});

test('prism: a board with no moves reshuffles, and running out of moves ends the game', () => {
  const s = Prism.create({ rng: seeded(4) });
  Prism.reshuffle(s);
  assert.ok(Prism.hasMove(s));
  assert.equal(Prism.findRuns(s.board).length, 0);
  assert.equal(s.board.flat().length, 64);

  const rng = seeded(8);
  const game = Prism.create({ rng });
  let safety = 0;
  while (!game.over && safety++ < 20000) {
    const r = Math.floor(rng() * 8);
    const c = Math.floor(rng() * 8);
    Prism.trySwap(game, [r, c], rng() < 0.5 && c < 7 ? [r, c + 1] : [Math.min(7, r + 1), c]);
  }
  assert.equal(game.over, true);
  assert.equal(game.moves, 0);
});

test('prism: a fair player clears the first levels on a typical board', () => {
  let reachedLevelTwo = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const rng = seeded(seed * 3);
    const s = Prism.create({ rng });
    let guard = 0;
    while (!s.over && s.level === 1 && guard++ < 500) {
      // Plays the first legal move it finds, with no planning at all.
      let done = false;
      for (let r = 0; r < 8 && !done; r++) {
        for (let c = 0; c < 8 && !done; c++) {
          for (const to of [[r, c + 1], [r + 1, c]]) {
            if (to[0] > 7 || to[1] > 7) continue;
            if (Prism.trySwap(s, [r, c], to)) { done = true; break; }
          }
        }
      }
    }
    if (s.level > 1) reachedLevelTwo++;
  }
  assert.ok(reachedLevelTwo >= 8, `${reachedLevelTwo} of 20 reached level 2`);
});

// --- Grid Fit ---
test('grid fit: pieces land only in free squares, rows and columns clear together', () => {
  const s = Grid.create({ rng: seeded(1) });
  s.tray = [{ shape: [[1, 1]], color: 1 }, null, { shape: [[1]], color: 2 }];
  assert.equal(Grid.place(s, 0, 0, 8), null, 'runs off the board');
  assert.ok(Grid.place(s, 0, 0, 0));
  assert.equal(s.tray[0], null);
  assert.equal(Grid.place(s, 2, 0, 0), null, 'square is taken');

  const x = Grid.create({ rng: seeded(2) });
  for (let i = 0; i < Grid.SIZE; i++) {
    if (i !== 4) { x.board[4][i] = 1; x.board[i][4] = 1; }
  }
  x.tray = [{ shape: [[1]], color: 3 }, { shape: [[1]], color: 3 }, null];
  const result = Grid.place(x, 0, 4, 4);
  assert.equal(result.lines, 2);
  assert.ok(x.board.flat().every((v) => v === 0), 'the crossing cell is cleared with both');
  assert.equal(result.gained, 1 + 2 * 2 * 18);
});

test('grid fit: an empty tray refills, back-to-back clears pay more, and stuck ends the game', () => {
  const s = Grid.create({ rng: seeded(3) });
  s.tray = [{ shape: [[1]], color: 1 }, null, null];
  Grid.place(s, 0, 0, 0);
  assert.equal(s.tray.filter(Boolean).length, 3);

  const pay = Grid.create({ rng: seeded(4) });
  for (let i = 0; i < 8; i++) { pay.board[0][i] = 1; pay.board[1][i] = 1; }
  pay.tray = [{ shape: [[1]], color: 1 }, { shape: [[1]], color: 1 }, { shape: [[1]], color: 1 }];
  const a = Grid.place(pay, 0, 0, 8);
  const b = Grid.place(pay, 1, 1, 8);
  assert.ok(b.gained > a.gained, 'a streak pays more');

  const stuck = Grid.create({ rng: seeded(5) });
  stuck.board = stuck.board.map((row, r) => row.map((_, c) => ((r + c) % 2 ? 1 : 0)));
  stuck.tray = [{ shape: [[1, 1, 1, 1, 1]], color: 1 }, { shape: [[1]], color: 1 }, null];
  Grid.place(stuck, 1, 0, 0);
  assert.equal(stuck.over, true, 'nothing left in the tray fits');
});

test('grid fit: random play always ends, with a fresh tray that fits whenever one can', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const rng = seeded(seed * 7);
    const s = Grid.create({ rng });
    let moves = 0;
    while (!s.over && moves < 3000) {
      const index = s.tray.findIndex((p) => p && Grid.fitsAnywhere(s, p.shape));
      assert.ok(index >= 0);
      let placed = false;
      while (!placed) placed = Boolean(Grid.place(s, index, Math.floor(rng() * Grid.SIZE), Math.floor(rng() * Grid.SIZE)));
      moves++;
    }
    assert.equal(s.over, true);
  }
});

// --- Sentry Path ---
test('sentry: every map has a connected path and room to build', () => {
  for (const [id, map] of Object.entries(Sentry.MAPS)) {
    map.path.forEach((point, i) => {
      if (i === 0) return;
      const prev = map.path[i - 1];
      assert.ok(point[0] === prev[0] || point[1] === prev[1], `${id} leg ${i} runs along the grid`);
    });
    const s = Sentry.create({ map: id });
    assert.ok(s.blocked.size > 10);
    assert.ok(Sentry.COLS * Sentry.ROWS - s.blocked.size > 30);
  }
});

test('sentry: build, upgrade and sell handle gold and the rules', () => {
  const s = Sentry.create({ map: 'switchback', rng: seeded(1) });
  assert.equal(Sentry.build(s, 'bolt', 0, 1), null, 'not on the path');
  const t = Sentry.build(s, 'bolt', 5, 2);
  assert.ok(t);
  assert.equal(s.gold, 130 - 40);
  assert.equal(Sentry.build(s, 'bolt', 5, 2), null, 'not on another tower');
  const damage = Sentry.statsOf(t).damage;
  assert.ok(Sentry.upgrade(s, t));
  assert.ok(Sentry.statsOf(t).damage > damage);
  const goldBefore = s.gold;
  const spent = t.spent;
  assert.ok(Sentry.sell(s, t));
  assert.equal(s.gold, goldBefore + Math.floor(spent * Sentry.SELL_RATE));
  assert.equal(s.towers.length, 0);
  s.gold = 10;
  assert.equal(Sentry.build(s, 'mortar', 5, 2), null, 'not without the gold');
});

test('sentry: towers hit in range only, frost slows, mortar splashes, leaks cost lives', () => {
  const s = Sentry.create({ map: 'switchback', rng: seeded(2) });
  s.wave = 1;
  s.nextWave = 999;
  const enemy = (along, kind = 'brute') => ({ id: s.nextId++, kind, hp: 500, maxHp: 500, along, slowFor: 0, slowBy: 0, dead: false });
  const near = enemy(4);
  s.enemies = [near];
  s.towers = [{ id: 1, kind: 'bolt', x: 5, y: 2, level: 1, cooldown: 0, spent: 40, aim: 0 }];
  Sentry.step(s, 1 / 60);
  assert.ok(near.hp < 500);

  const far = enemy(30);
  s.enemies = [far];
  s.towers[0].cooldown = 0;
  Sentry.step(s, 1 / 60);
  assert.equal(far.hp, 500);

  const slowed = enemy(5);
  s.enemies = [slowed];
  s.towers = [{ id: 2, kind: 'frost', x: 5, y: 2, level: 1, cooldown: 0, spent: 60, aim: 0 }];
  Sentry.step(s, 1 / 60);
  assert.ok(slowed.slowFor > 0);

  const a = enemy(5);
  const b = enemy(5.5);
  s.enemies = [a, b];
  s.towers = [{ id: 3, kind: 'mortar', x: 5, y: 2, level: 1, cooldown: 0, spent: 95, aim: 0 }];
  Sentry.step(s, 1 / 60);
  assert.ok(a.hp < 500 && b.hp < 500);

  const lives = s.lives;
  s.enemies = [enemy(s.pathLength - 0.001)];
  s.towers = [];
  Sentry.step(s, 1 / 60);
  assert.ok(s.lives < lives);
  assert.equal(s.enemies.length, 0);
});

function sentryGame(map, build) {
  const s = Sentry.create({ map, rng: seeded(6) });
  let frames = 0;
  while (!s.over && frames++ < 60 * 60 * 30) {
    if (build && frames % 30 === 0) build(s);
    Sentry.step(s, 1 / 60);
  }
  return s;
}

// Spends gold the plain way a new player would: cover the most path, then upgrade.
function plainBuilder(s) {
  const open = [];
  for (let y = 0; y < Sentry.ROWS; y++) {
    for (let x = 0; x < Sentry.COLS; x++) {
      if (!Sentry.canBuild(s, x, y)) continue;
      let cover = 0;
      for (let along = 0; along < s.pathLength; along += 0.5) {
        const p = Sentry.positionAt(s, along);
        if (Math.hypot(p.x - x, p.y - y) <= 2.4) cover++;
      }
      open.push({ x, y, cover });
    }
  }
  open.sort((a, b) => b.cover - a.cover);
  const count = s.towers.length;
  if (count >= 8) {
    const weakest = s.towers.filter((t) => t.level < Sentry.MAX_LEVEL).sort((a, b) => a.level - b.level)[0];
    if (weakest) Sentry.upgrade(s, weakest);
  }
  const kind = count % 4 === 3 ? 'frost' : count % 4 === 2 ? 'mortar' : 'bolt';
  if (open.length && count < 12) Sentry.build(s, kind, open[0].x, open[0].y);
}

test('sentry: no towers loses, a plain build holds every map to the end', () => {
  assert.equal(sentryGame('switchback', null).won, false);
  for (const map of Object.keys(Sentry.MAPS)) {
    const s = sentryGame(map, plainBuilder);
    assert.equal(s.over, true);
    assert.equal(s.won, true, `${map}: fell on wave ${s.wave} with ${s.towers.length} towers`);
    assert.equal(s.wave, Sentry.WAVES);
  }
});

test('sentry: calling a wave early pays only between waves', () => {
  const s = Sentry.create({ map: 'canyon', rng: seeded(7) });
  Sentry.startWave(s);
  const gold = s.gold;
  Sentry.startWave(s);
  assert.equal(s.gold, gold, 'no pay while enemies are still coming');
  s.spawning = [];
  s.enemies = [];
  s.nextWave = 10;
  const before = s.gold;
  Sentry.startWave(s);
  assert.equal(s.gold, before + 20);
});
