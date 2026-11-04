// Formation shooter rules on a fixed 800 x 600 field. Units are pixels and seconds.
const InvadersLogic = (() => {
  const W = 800;
  const H = 600;
  const COLS = 14;
  const ROWS = 5;
  const ALIEN_W = 26;
  const ALIEN_H = 20;
  const PLAYER_W = 40;
  const PLAYER_H = 18;
  const PLAYER_Y = H - 50;
  const PLAYER_SPEED = 330;
  const SHOT_SPEED = 470;
  const BOMB_SPEED = 230;
  const MAX_SHOTS = 4;
  const SHOT_GAP = 0.24;
  const DROP = 16;
  const SPEEDS = { slow: { march: 26, fire: 0.7 }, normal: { march: 40, fire: 1 }, fast: { march: 58, fire: 1.4 } };

  function create({ speed = 'normal', rng = Math.random } = {}) {
    const aliens = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        aliens.push({ x: 40 + col * 45, y: 50 + row * 35, col, row });
      }
    }
    return {
      rng,
      setup: SPEEDS[speed],
      aliens,
      total: aliens.length,
      shots: [],
      bombs: [],
      player: W / 2,
      dir: 1,
      cooldown: 0,
      invulnerable: 0,
      lives: 3,
      score: 0,
      over: false,
      won: false,
    };
  }

  const overlaps = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  // Only the lowest alien in a column may fire: anything else would shoot through its neighbours.
  function shooter(s) {
    const lowest = new Map();
    for (const a of s.aliens) {
      if (!lowest.has(a.col) || lowest.get(a.col).y < a.y) lowest.set(a.col, a);
    }
    const options = [...lowest.values()];
    return options[Math.floor(s.rng() * options.length)];
  }

  // Advances by dt. `input` has left, right and fire booleans. Returns a list of events.
  function step(s, dt, input = {}) {
    if (s.over) return [];
    const events = [];
    if (input.left) s.player -= PLAYER_SPEED * dt;
    if (input.right) s.player += PLAYER_SPEED * dt;
    s.player = Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, s.player));
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.invulnerable = Math.max(0, s.invulnerable - dt);

    if (input.fire && s.cooldown === 0 && s.shots.length < MAX_SHOTS) {
      s.shots.push({ x: s.player, y: PLAYER_Y - 10 });
      s.cooldown = SHOT_GAP;
      events.push('shoot');
    }

    // The fewer aliens are left, the faster the march.
    const march = s.setup.march * (1 + 3 * (1 - s.aliens.length / s.total)) * dt * s.dir;
    const minX = Math.min(...s.aliens.map((a) => a.x));
    const maxX = Math.max(...s.aliens.map((a) => a.x)) + ALIEN_W;
    let shift = march;
    let turned = false;
    if (minX + march <= 0) { shift = -minX; turned = true; }
    if (maxX + march >= W) { shift = W - maxX; turned = true; }
    for (const a of s.aliens) {
      a.x += shift;
      if (turned) a.y += DROP;
    }
    if (turned) s.dir = -s.dir;

    if (s.rng() < s.setup.fire * dt) {
      const a = shooter(s);
      s.bombs.push({ x: a.x + ALIEN_W / 2, y: a.y + ALIEN_H });
    }

    for (const shot of s.shots) shot.y -= SHOT_SPEED * dt;
    for (const bomb of s.bombs) bomb.y += BOMB_SPEED * dt;

    s.shots = s.shots.filter((shot) => {
      if (shot.y < -12) return false;
      const hit = s.aliens.findIndex((a) => overlaps(shot.x - 2, shot.y, 4, 12, a.x, a.y, ALIEN_W, ALIEN_H));
      if (hit < 0) return true;
      s.score += 10 * (ROWS - s.aliens[hit].row);
      s.aliens.splice(hit, 1);
      events.push('kill');
      return false;
    });

    if (s.aliens.length === 0) {
      s.over = true;
      s.won = true;
      events.push('win');
      return events;
    }

    s.bombs = s.bombs.filter((bomb) => {
      if (bomb.y > H) return false;
      const hit = overlaps(bomb.x - 2, bomb.y, 4, 12, s.player - PLAYER_W / 2, PLAYER_Y, PLAYER_W, PLAYER_H);
      if (!hit || s.invulnerable > 0) return true;
      s.lives--;
      s.invulnerable = 1.5;
      events.push('hurt');
      return false;
    });

    const invaded = s.aliens.some((a) => a.y + ALIEN_H >= PLAYER_Y);
    if (s.lives <= 0 || invaded) {
      s.over = true;
      events.push('lose');
    }
    return events;
  }

  return { W, H, ALIEN_W, ALIEN_H, PLAYER_W, PLAYER_H, PLAYER_Y, create, step };
})();
if (typeof module !== 'undefined') module.exports = InvadersLogic;
