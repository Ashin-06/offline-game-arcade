// Lane Rush: a three-lane runner. Z is distance ahead of the player, in metres; time is in seconds.
// Rows of obstacles are spaced from the speed the player will have on reaching them, and every
// row leaves a way through, so a run is always survivable.
const LaneRushLogic = (() => {
  const LANES = 3;
  const START_SPEED = 15;
  const MAX_SPEED = 32;
  const RAMP = 0.16;
  const SWITCH_RATE = 9;
  const JUMP_V = 7.6;
  const GRAVITY = 24;
  const SLIDE_TIME = 0.55;
  const CLEAR_HEIGHT = 0.7;
  const BODY_DEPTH = 0.8;
  const HIT_WIDTH = 0.62;
  const AIR_TIME = (2 * JUMP_V) / GRAVITY;
  const ROW_TIME_START = 1.05;
  const ROW_TIME_END = 0.78;

  function create({ rng = Math.random } = {}) {
    const s = {
      rng,
      lane: 1,
      x: 1,
      y: 0,
      vy: 0,
      slide: 0,
      speed: START_SPEED,
      distance: 0,
      coins: 0,
      obstacles: [],
      pickups: [],
      nextRow: 40,
      lastFree: 1,
      over: false,
    };
    fill(s);
    return s;
  }

  const score = (s) => Math.floor(s.distance) + s.coins * 10;

  function speedAt(s, ahead) {
    return Math.min(MAX_SPEED, Math.sqrt(s.speed * s.speed + 2 * RAMP * ahead));
  }

  function addRow(s) {
    const z = s.nextRow;
    const free = Math.floor(s.rng() * LANES);
    const progress = Math.min(1, z / 2500);
    for (let lane = 0; lane < LANES; lane++) {
      if (lane === free) continue;
      const roll = s.rng();
      // Later rows are fuller, leaving fewer ways through.
      if (roll > 0.55 + progress * 0.35) continue;
      const pick = s.rng();
      const kind = pick < 0.34 ? 'wall' : pick < 0.67 ? 'low' : 'high';
      s.obstacles.push({ z, lane, kind });
    }
    // A trail of coins leads along the free lane towards the gap.
    if (s.rng() < 0.6) {
      for (let i = 1; i <= 4; i++) s.pickups.push({ z: z - i * 3, lane: free, taken: false });
    }
    s.lastFree = free;
    const speed = speedAt(s, z - s.distance);
    const rowTime = ROW_TIME_START + (ROW_TIME_END - ROW_TIME_START) * Math.min(1, (speed - START_SPEED) / (MAX_SPEED - START_SPEED));
    s.nextRow = z + speed * (rowTime + s.rng() * 0.25);
  }

  function fill(s) {
    while (s.nextRow - s.distance < 140) addRow(s);
  }

  // Which way each kind of obstacle can be passed.
  function blocks(s, o) {
    if (o.kind === 'wall') return true;
    if (o.kind === 'low') return s.y < CLEAR_HEIGHT;
    return s.slide <= 0;
  }

  // Advances by dt. `input` may hold left, right, jump, slide as one-shot presses.
  // Returns 'jump', 'slide', 'turn', 'coin', 'die' or null.
  function step(s, dt, input = {}, { generate = true } = {}) {
    if (s.over) return null;
    let event = null;
    if (input.left && s.lane > 0) { s.lane--; event = 'turn'; }
    if (input.right && s.lane < LANES - 1) { s.lane++; event = 'turn'; }
    if (input.jump && s.y === 0) {
      s.vy = JUMP_V;
      s.slide = 0;
      event = 'jump';
    }
    if (input.slide) {
      // A slide from the air drops straight down, which makes it a quick way back to the ground.
      if (s.y > 0) s.vy = Math.min(s.vy, -JUMP_V);
      s.slide = SLIDE_TIME;
      event = 'slide';
    }

    const towards = Math.sign(s.lane - s.x);
    s.x += towards * Math.min(Math.abs(s.lane - s.x), SWITCH_RATE * dt);
    if (s.y > 0 || s.vy > 0) {
      s.vy -= GRAVITY * dt;
      s.y += s.vy * dt;
      if (s.y <= 0) { s.y = 0; s.vy = 0; }
    }
    if (s.slide > 0) s.slide = Math.max(0, s.slide - dt);

    s.speed = Math.min(MAX_SPEED, s.speed + RAMP * dt);
    s.distance += s.speed * dt;

    for (const o of s.obstacles) {
      const ahead = o.z - s.distance;
      if (ahead > BODY_DEPTH / 2 || ahead < -BODY_DEPTH / 2) continue;
      if (Math.abs(o.lane - s.x) < HIT_WIDTH && blocks(s, o)) {
        s.over = true;
        return 'die';
      }
    }
    for (const p of s.pickups) {
      if (p.taken) continue;
      const ahead = p.z - s.distance;
      if (Math.abs(ahead) < 1.2 && Math.abs(p.lane - s.x) < 0.6 && s.y < 1.4) {
        p.taken = true;
        s.coins++;
        event = 'coin';
      }
    }
    if (generate) {
      s.obstacles = s.obstacles.filter((o) => o.z - s.distance > -3);
      s.pickups = s.pickups.filter((p) => p.z - s.distance > -3);
      fill(s);
    }
    return event;
  }

  return { LANES, START_SPEED, MAX_SPEED, CLEAR_HEIGHT, AIR_TIME, create, step, score };
})();
if (typeof module !== 'undefined') module.exports = LaneRushLogic;
