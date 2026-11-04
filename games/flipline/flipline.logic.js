// Flipline: a one-button runner. You run along a rail and flip gravity to cross to the other one.
// Runs in fixed 60 Hz steps. The generator spaces obstacles from the flip time at the speed the
// player will have when reaching them, so a run can always be survived.
const FliplineLogic = (() => {
  const W = 800;
  const H = 400;
  const RAIL = 40;
  const SIZE = 24;
  const PLAYER_X = 150;
  const GRAVITY = 0.62;
  const START_SPEED = 5.2;
  const MAX_SPEED = 10.5;
  const RAMP = 0.0009;
  const BUFFER = 8;
  const INSET = 3;
  const FLOOR = H - RAIL - SIZE;
  const CEILING = RAIL;
  const FLIP_FRAMES = Math.ceil(Math.sqrt((2 * (FLOOR - CEILING)) / GRAVITY));
  const GATE_WINDOW = 190;
  const GATE_FROM = 1400;

  function create({ rng = Math.random } = {}) {
    const s = {
      rng,
      y: FLOOR,
      vy: 0,
      side: 1,
      attached: true,
      buffer: 0,
      speed: START_SPEED,
      distance: 0,
      shards: 0,
      obstacles: [],
      pickups: [],
      nextX: W + 200,
      lastSide: 1,
      over: false,
    };
    fill(s);
    return s;
  }

  const score = (s) => Math.floor(s.distance / 10) + s.shards * 25;

  // The speed the player will be running at when the world has scrolled by `ahead` pixels.
  function speedAt(s, ahead) {
    return Math.min(MAX_SPEED, s.speed + (RAMP * ahead) / s.speed);
  }

  function fill(s) {
    while (s.nextX - s.distance < W * 3) {
      const ahead = s.nextX - s.distance - PLAYER_X;
      const speed = speedAt(s, Math.max(0, ahead));
      const crossing = speed * (FLIP_FRAMES + 8) + SIZE;
      const roll = s.rng();

      if (s.nextX > GATE_FROM && roll < 0.14) {
        // A gate spans both rails and can only be passed in mid-flip.
        const w = 14;
        const top = (H - GATE_WINDOW) / 2 - RAIL;
        s.nextX += crossing;
        s.obstacles.push({ x: s.nextX, w, h: top, side: -1 }, { x: s.nextX, w, h: top, side: 1 });
        s.nextX += w + crossing;
        s.lastSide = 0;
        continue;
      }

      const side = s.rng() < 0.5 ? -1 : 1;
      const w = 36 + s.rng() * 50;
      const h = 70 + s.rng() * 60;
      // After a block on the other side the player has to cross over before reaching this one.
      const mustCross = s.lastSide !== side;
      const gap = mustCross ? crossing : speed * 16 + s.rng() * 120;
      s.nextX += gap;
      s.obstacles.push({ x: s.nextX, w, h, side });
      if (s.rng() < 0.45) {
        s.pickups.push({
          x: s.nextX + w / 2,
          y: side === 1 ? CEILING + SIZE / 2 : FLOOR + SIZE / 2,
          taken: false,
        });
      }
      s.nextX += w;
      s.lastSide = side;
    }
  }

  function hits(s, o) {
    const x = o.x - s.distance;
    if (PLAYER_X + SIZE - INSET <= x || PLAYER_X + INSET >= x + o.w) return false;
    const top = o.side === 1 ? H - RAIL - o.h : RAIL;
    return s.y + SIZE - INSET > top && s.y + INSET < top + o.h;
  }

  // Advances one step. Returns 'flip', 'shard', 'die' or null.
  function step(s, flipPressed = false, { generate = true } = {}) {
    if (s.over) return null;
    let event = null;
    if (flipPressed) s.buffer = BUFFER;
    else if (s.buffer > 0) s.buffer--;
    if (s.buffer > 0 && s.attached) {
      s.side = -s.side;
      s.attached = false;
      s.buffer = 0;
      event = 'flip';
    }

    if (!s.attached) {
      s.vy += GRAVITY * s.side;
      s.y += s.vy;
      const landed = s.side === 1 ? s.y >= FLOOR : s.y <= CEILING;
      if (landed) {
        s.y = s.side === 1 ? FLOOR : CEILING;
        s.vy = 0;
        s.attached = true;
      }
    }

    s.speed = Math.min(MAX_SPEED, s.speed + RAMP);
    s.distance += s.speed;

    for (const o of s.obstacles) {
      if (hits(s, o)) {
        s.over = true;
        return 'die';
      }
    }
    for (const p of s.pickups) {
      const dx = p.x - s.distance - (PLAYER_X + SIZE / 2);
      if (!p.taken && Math.abs(dx) < SIZE && Math.abs(p.y - (s.y + SIZE / 2)) < SIZE) {
        p.taken = true;
        s.shards++;
        event = 'shard';
      }
    }

    if (generate) {
      s.obstacles = s.obstacles.filter((o) => o.x + o.w - s.distance > -40);
      s.pickups = s.pickups.filter((p) => p.x - s.distance > -40);
      fill(s);
    }
    return event;
  }

  return { W, H, RAIL, SIZE, PLAYER_X, FLOOR, CEILING, FLIP_FRAMES, create, step, score };
})();
if (typeof module !== 'undefined') module.exports = FliplineLogic;
