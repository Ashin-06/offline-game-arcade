// Beacon Climb: tile map physics, hazards and level flow. Runs in fixed 60 Hz steps.
const PlatformerLogic = (() => {
  const T = 32;
  const VIEW_W = 800;
  const VIEW_H = 480;
  const P_W = 22;
  const P_H = 30;
  const ACCEL = 0.7;
  const FRICTION = 0.72;
  const MAX_RUN = 4.3;
  const GRAVITY = 0.55;
  const JUMP = -11.2;
  const SPRING = -15.5;
  const MAX_FALL = 12;
  const COYOTE = 6;
  const BUFFER = 7;
  const E_W = 26;
  const E_H = 22;
  const E_SPEED = 1.2;

  // # solid, = one-way ledge, ^ spikes, s spring, o spark, e patroller, P start, D beacon.
  const LEVELS = [
    { name: 'First Light', rows: [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '                                o o',
      '                               =====',
      '',
      '              o o          o',
      '             =====       =====         o o',
      '  P      o               e       ^^         e       D',
      '########################################  ################',
      '########################################  ################',
    ] },
    { name: 'Broken Bridge', rows: [
      '',
      '',
      '',
      '',
      '',
      '',
      '                         o o o',
      '                        =======',
      '',
      '              o                       o                 o',
      '             ===          ===        ===       ===     ===',
      '',
      '  P    o                                                   o   D',
      '###########   ####  ####      ###    ####   ###     ####  ########',
      '###########   ####  ####      ###    ####   ###     ####  ########',
    ] },
    { name: 'Spring Works', rows: [
      '',
      '',
      '',
      '                   o o o',
      '                =========                                 D',
      '                                                         #############',
      '                                                   ===   #############',
      '            ===                              o o         #############',
      '                                            =====        #############',
      '                              o                          #############',
      '                      ###    ====     e                  #############',
      '    o                 ###           ======               #############',
      '  P      s     ^^^    ###^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^#############',
      '######################################################################',
      '######################################################################',
    ] },
    { name: 'The Long Climb', rows: [
      '                                  D',
      '                              =========',
      '                        o',
      '                       ===',
      '                 o              o',
      '                ===            ===',
      '           e                           ===',
      '        ======       o                     ',
      '                    ===          ===      o',
      '  o                                      ===',
      ' ===        ===          e',
      '                     =======        s',
      '  P      o        o               #####',
      '##########  ##########  ^^^  ##########^^^^##',
      '##########  ##########  ###  ##########  ####',
    ] },
    { name: 'Last Beacon', rows: [
      '',
      '                                                                          D',
      '                                  o o o                              ========',
      '                                 =======             o           o',
      '                        ===                         ===         ===',
      '                  o                                       ===',
      '                 ===                    e',
      '                                     ======',
      '           ===         o                        s',
      '   o                  ===                      ###',
      '  ===                         ====             ###',
      '        e                                      ###',
      '  P     o   s      e       ^^      ^^^    ^^^  ###  e',
      '##############  #########  ##  #########################  ####  ################',
      '##############  #########  ##  #########################  ####  ################',
    ] },
  ];

  function parse(def) {
    const width = Math.max(...def.rows.map((r) => r.length));
    const level = { name: def.name, w: width, h: def.rows.length, coins: [], enemies: [], start: null };
    level.grid = def.rows.map((raw, r) => {
      const row = raw.padEnd(width, ' ').split('');
      row.forEach((ch, c) => {
        if (ch === 'P') { level.start = { x: c * T + (T - P_W) / 2, y: (r + 1) * T - P_H }; row[c] = ' '; }
        if (ch === 'o') { level.coins.push({ c, r, taken: false }); row[c] = ' '; }
        if (ch === 'e') { level.enemies.push({ x: c * T, y: (r + 1) * T - E_H, dir: -1, alive: true }); row[c] = ' '; }
      });
      return row;
    });
    return level;
  }

  // Beyond the sides is wall and beyond the bottom is open air.
  function tile(level, c, r) {
    if (c < 0 || c >= level.w) return '#';
    if (r < 0 || r >= level.h) return ' ';
    return level.grid[r][c];
  }

  function newPlayer(level) {
    return { x: level.start.x, y: level.start.y, vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0, wasJump: false, facing: 1, jumped: false, rising: false };
  }

  // Moves the player one step. Returns 'dead', 'door' or null. Sets p.jumped and p.sprung for sound.
  function advance(level, p, input) {
    p.jumped = false;
    p.sprung = false;
    const wish = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (wish) {
      p.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, p.vx + wish * ACCEL));
      p.facing = wish;
    } else {
      p.vx *= FRICTION;
      if (Math.abs(p.vx) < 0.05) p.vx = 0;
    }

    const pressed = input.jump && !p.wasJump;
    p.wasJump = Boolean(input.jump);
    p.buffer = pressed ? BUFFER : Math.max(0, p.buffer - 1);
    p.coyote = p.grounded ? COYOTE : Math.max(0, p.coyote - 1);
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = JUMP;
      p.buffer = 0;
      p.coyote = 0;
      p.grounded = false;
      p.jumped = true;
      p.rising = true;
    }
    // Letting go early cuts a jump short, so tap and hold give different heights. Only a jump:
    // the lift from a spring or a stomp does not depend on holding the button.
    if (p.vy >= 0) p.rising = false;
    if (p.rising && !input.jump && p.vy < -4) p.vy = -4;
    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);

    p.x += p.vx;
    const top = Math.floor(p.y / T);
    const bottom = Math.floor((p.y + P_H - 0.01) / T);
    if (p.vx > 0) {
      const c = Math.floor((p.x + P_W) / T);
      for (let r = top; r <= bottom; r++) {
        if (tile(level, c, r) === '#') { p.x = c * T - P_W - 0.01; p.vx = 0; break; }
      }
    } else if (p.vx < 0) {
      const c = Math.floor(p.x / T);
      for (let r = top; r <= bottom; r++) {
        if (tile(level, c, r) === '#') { p.x = (c + 1) * T + 0.01; p.vx = 0; break; }
      }
    }

    const oldBottom = p.y + P_H;
    p.y += p.vy;
    p.grounded = false;
    const left = Math.floor(p.x / T);
    const right = Math.floor((p.x + P_W - 0.01) / T);
    if (p.vy > 0) {
      const r = Math.floor((p.y + P_H) / T);
      for (let c = left; c <= right; c++) {
        const ch = tile(level, c, r);
        const ledge = ch === '=' && oldBottom <= r * T + 0.01;
        if (ch === '#' || ledge) {
          p.y = r * T - P_H;
          p.vy = 0;
          p.grounded = true;
          break;
        }
      }
    } else if (p.vy < 0) {
      const r = Math.floor(p.y / T);
      for (let c = left; c <= right; c++) {
        if (tile(level, c, r) === '#') { p.y = (r + 1) * T; p.vy = 0; break; }
      }
    }

    if (p.y > level.h * T + 40) return 'dead';

    let outcome = null;
    const r0 = Math.floor(p.y / T);
    const r1 = Math.floor((p.y + P_H - 0.01) / T);
    const c0 = Math.floor(p.x / T);
    const c1 = Math.floor((p.x + P_W - 0.01) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = tile(level, c, r);
        if (ch === 'D') outcome = 'door';
        // Spike hit box is the lower part of the tile and narrower than it, so grazes are fair.
        if (ch === '^' && p.y + P_H > r * T + 16 && p.x + P_W > c * T + 6 && p.x < (c + 1) * T - 6) return 'dead';
        if (ch === 's' && p.vy >= 0 && p.y + P_H > r * T + 14) {
          p.vy = SPRING;
          p.grounded = false;
          p.rising = false;
          p.sprung = true;
        }
      }
    }
    return outcome;
  }

  function loadLevel(s, index) {
    s.index = index;
    s.level = parse(LEVELS[index]);
    s.p = newPlayer(s.level);
    s.frames = 0;
    s.grace = 60;
  }

  function create(levelIndex = 0) {
    const s = { score: 0, lives: 3, over: false, won: false };
    loadLevel(s, levelIndex);
    return s;
  }

  function touchesCoin(p, coin) {
    const cx = (coin.c + 0.5) * T;
    const cy = (coin.r + 0.5) * T;
    return cx > p.x - 8 && cx < p.x + P_W + 8 && cy > p.y - 8 && cy < p.y + P_H + 8;
  }

  function stepEnemies(s) {
    for (const e of s.level.enemies) {
      if (!e.alive) continue;
      const nextX = e.x + e.dir * E_SPEED;
      const frontC = Math.floor((e.dir > 0 ? nextX + E_W : nextX) / T);
      const feetR = Math.floor((e.y + E_H) / T);
      const midR = Math.floor((e.y + E_H / 2) / T);
      const below = tile(s.level, frontC, feetR);
      if (tile(s.level, frontC, midR) === '#' || (below !== '#' && below !== '=')) e.dir = -e.dir;
      else e.x = nextX;
    }
  }

  function hurt(s, events) {
    s.lives--;
    events.push('hurt');
    if (s.lives <= 0) {
      s.over = true;
      events.push('lose');
      return;
    }
    s.p = newPlayer(s.level);
    s.grace = 60;
  }

  // Advances one 60 Hz step and returns a list of events.
  function step(s, input) {
    if (s.over) return [];
    const events = [];
    s.frames++;
    s.grace = Math.max(0, s.grace - 1);
    const p = s.p;
    const outcome = advance(s.level, p, input);
    if (p.jumped) events.push('jump');
    if (p.sprung) events.push('spring');
    stepEnemies(s);

    if (outcome === 'dead') {
      hurt(s, events);
      return events;
    }

    for (const coin of s.level.coins) {
      if (!coin.taken && touchesCoin(p, coin)) {
        coin.taken = true;
        s.score += 10;
        events.push('coin');
      }
    }

    for (const e of s.level.enemies) {
      if (!e.alive || p.x >= e.x + E_W || p.x + P_W <= e.x || p.y >= e.y + E_H || p.y + P_H <= e.y) continue;
      // Coming down on top counts as a stomp, anything else is a hit.
      if (p.vy > 0 && p.y + P_H - p.vy <= e.y + 10) {
        e.alive = false;
        p.vy = input.jump ? JUMP * 0.9 : JUMP * 0.6;
        p.rising = false;
        s.score += 25;
        events.push('stomp');
      } else if (s.grace === 0) {
        hurt(s, events);
        return events;
      }
    }

    if (outcome === 'door') {
      const seconds = s.frames / 60;
      s.score += 100 + Math.max(0, Math.round(60 - seconds)) * 2;
      if (s.index === LEVELS.length - 1) {
        s.over = true;
        s.won = true;
        events.push('win');
      } else {
        loadLevel(s, s.index + 1);
        events.push('level');
      }
    }
    return events;
  }

  return { T, VIEW_W, VIEW_H, P_W, P_H, E_W, E_H, LEVELS, parse, tile, create, step, advance, newPlayer, touchesCoin };
})();
if (typeof module !== 'undefined') module.exports = PlatformerLogic;
