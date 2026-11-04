// Sentry Path: tower defence on a 12 x 8 grid. Positions are in cells and time is in seconds.
const SentryLogic = (() => {
  const COLS = 12;
  const ROWS = 8;
  const START_GOLD = 130;
  const START_LIVES = 20;
  const WAVES = 15;
  const WAVE_GAP = 14;
  const EARLY_BONUS = 2;
  const SELL_RATE = 0.7;
  const MAX_LEVEL = 3;

  const TOWERS = {
    bolt: { name: 'Bolt', cost: 40, range: 2.4, damage: 10, rate: 0.55 },
    frost: { name: 'Frost', cost: 60, range: 2.1, damage: 3, rate: 0.8, slow: 0.5, slowTime: 1.6 },
    mortar: { name: 'Mortar', cost: 95, range: 3.2, damage: 26, rate: 1.7, splash: 1.15 },
  };
  const ENEMIES = {
    runner: { hp: 16, speed: 2.1, bounty: 4, damage: 1 },
    grunt: { hp: 34, speed: 1.25, bounty: 6, damage: 1 },
    brute: { hp: 120, speed: 0.85, bounty: 14, damage: 2 },
    boss: { hp: 620, speed: 0.6, bounty: 60, damage: 8 },
  };
  const MAPS = {
    switchback: { name: 'Switchback', path: [[-1, 1], [9, 1], [9, 3], [2, 3], [2, 5], [9, 5], [9, 6], [12, 6]] },
    canyon: { name: 'Canyon', path: [[1, -1], [1, 5], [4, 5], [4, 2], [7, 2], [7, 5], [10, 5], [10, 8]] },
    spiral: { name: 'Spiral', path: [[-1, 0], [11, 0], [11, 7], [1, 7], [1, 2], [8, 2], [8, 5], [5, 5]] },
  };

  // Every cell the path passes through, which is where towers may not stand.
  function pathCells(path) {
    const cells = new Set();
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= steps; k++) {
        const x = ax + Math.sign(bx - ax) * k;
        const y = ay + Math.sign(by - ay) * k;
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS) cells.add(y * COLS + x);
      }
    }
    return cells;
  }

  function create({ map = 'switchback', rng = Math.random } = {}) {
    const { path } = MAPS[map];
    const legs = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const length = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      legs.push({ from: path[i], to: path[i + 1], start: total, length });
      total += length;
    }
    return {
      rng, map, path, legs,
      pathLength: total,
      blocked: pathCells(path),
      gold: START_GOLD,
      lives: START_LIVES,
      wave: 0,
      spawning: [],
      spawnTimer: 0,
      nextWave: WAVE_GAP,
      enemies: [],
      towers: [],
      shots: [],
      nextId: 1,
      over: false,
      won: false,
      kills: 0,
    };
  }

  function waveList(n) {
    const list = [];
    if (n % 5 === 0) list.push(...new Array(Math.floor(n / 5)).fill('boss'));
    const grunts = 4 + n;
    const runners = n >= 2 ? Math.floor(n * 0.9) + 2 : 0;
    const brutes = n >= 4 ? Math.floor((n - 2) * 0.55) : 0;
    list.push(...new Array(grunts).fill('grunt'), ...new Array(runners).fill('runner'), ...new Array(brutes).fill('brute'));
    return list;
  }

  const hpScale = (n) => 1.14 ** (n - 1);

  function startWave(s) {
    if (s.over || s.wave >= WAVES) return false;
    // Calling a wave early pays for the seconds skipped, but only between waves, so that
    // pressing the button during a fight cannot be used to farm gold.
    const between = s.wave > 0 && s.spawning.length === 0 && s.enemies.length === 0;
    if (between && s.nextWave > 0) s.gold += Math.floor(s.nextWave * EARLY_BONUS);
    s.wave++;
    s.spawning.push(...waveList(s.wave).map((kind) => ({ kind, hpScale: hpScale(s.wave) })));
    s.spawnTimer = 0;
    s.nextWave = WAVE_GAP;
    return true;
  }

  function positionAt(s, along) {
    for (const leg of s.legs) {
      if (along <= leg.start + leg.length) {
        const t = (along - leg.start) / leg.length;
        return { x: leg.from[0] + (leg.to[0] - leg.from[0]) * t, y: leg.from[1] + (leg.to[1] - leg.from[1]) * t };
      }
    }
    return { x: s.path[s.path.length - 1][0], y: s.path[s.path.length - 1][1] };
  }

  const canBuild = (s, x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS
    && !s.blocked.has(y * COLS + x)
    && !s.towers.some((t) => t.x === x && t.y === y);

  function build(s, kind, x, y) {
    const type = TOWERS[kind];
    if (s.over || !type || s.gold < type.cost || !canBuild(s, x, y)) return null;
    s.gold -= type.cost;
    const tower = { id: s.nextId++, kind, x, y, level: 1, cooldown: 0, spent: type.cost, aim: 0 };
    s.towers.push(tower);
    return tower;
  }

  const upgradeCost = (t) => Math.round(TOWERS[t.kind].cost * 0.8 * t.level);

  function upgrade(s, tower) {
    if (s.over || tower.level >= MAX_LEVEL || s.gold < upgradeCost(tower)) return false;
    const cost = upgradeCost(tower);
    s.gold -= cost;
    tower.spent += cost;
    tower.level++;
    return true;
  }

  function sell(s, tower) {
    const index = s.towers.indexOf(tower);
    if (s.over || index < 0) return false;
    s.gold += Math.floor(tower.spent * SELL_RATE);
    s.towers.splice(index, 1);
    return true;
  }

  function statsOf(t) {
    const type = TOWERS[t.kind];
    const growth = 1 + (t.level - 1) * 0.65;
    return {
      range: type.range + (t.level - 1) * 0.3,
      damage: type.damage * growth,
      rate: type.rate * 0.92 ** (t.level - 1),
      slow: type.slow,
      slowTime: type.slowTime,
      splash: type.splash,
    };
  }

  function hurt(s, enemy, amount, events) {
    enemy.hp -= amount;
    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true;
      s.gold += ENEMIES[enemy.kind].bounty;
      s.kills++;
      events.push('kill');
    }
  }

  // Advances by dt and returns a list of events.
  function step(s, dt) {
    if (s.over) return [];
    const events = [];

    if (s.wave === 0) {
      s.nextWave -= dt;
      if (s.nextWave <= 0) { startWave(s); events.push('wave'); }
    } else if (s.spawning.length === 0 && s.enemies.length === 0) {
      if (s.wave >= WAVES) {
        s.over = true;
        s.won = true;
        events.push('win');
        return events;
      }
      s.nextWave -= dt;
      if (s.nextWave <= 0) {
        s.nextWave = 0;
        startWave(s);
        events.push('wave');
      }
    }

    s.spawnTimer -= dt;
    if (s.spawning.length && s.spawnTimer <= 0) {
      const { kind, hpScale: scale } = s.spawning.shift();
      const type = ENEMIES[kind];
      s.enemies.push({ id: s.nextId++, kind, hp: type.hp * scale, maxHp: type.hp * scale, along: 0, slowFor: 0, slowBy: 0, dead: false });
      s.spawnTimer = 0.55;
    }

    for (const e of s.enemies) {
      const speed = ENEMIES[e.kind].speed * (e.slowFor > 0 ? 1 - e.slowBy : 1);
      e.along += speed * dt;
      e.slowFor = Math.max(0, e.slowFor - dt);
      if (e.along >= s.pathLength) {
        e.dead = true;
        e.leaked = true;
        s.lives -= ENEMIES[e.kind].damage;
        events.push('leak');
      }
    }

    for (const t of s.towers) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.cooldown > 0) continue;
      const stats = statsOf(t);
      // Aims at whichever enemy in range is furthest along.
      let target = null;
      let targetPos = null;
      for (const e of s.enemies) {
        if (e.dead) continue;
        const pos = positionAt(s, e.along);
        if (Math.hypot(pos.x - t.x, pos.y - t.y) > stats.range) continue;
        if (!target || e.along > target.along) { target = e; targetPos = pos; }
      }
      if (!target) continue;
      t.cooldown = stats.rate;
      t.aim = Math.atan2(targetPos.y - t.y, targetPos.x - t.x);
      s.shots.push({ kind: t.kind, x1: t.x, y1: t.y, x2: targetPos.x, y2: targetPos.y, life: 0.14, splash: stats.splash || 0 });
      if (stats.splash) {
        for (const e of s.enemies) {
          if (e.dead) continue;
          const pos = positionAt(s, e.along);
          if (Math.hypot(pos.x - targetPos.x, pos.y - targetPos.y) <= stats.splash) hurt(s, e, stats.damage, events);
        }
      } else {
        hurt(s, target, stats.damage, events);
        if (stats.slow) {
          target.slowBy = Math.max(target.slowBy, stats.slow);
          target.slowFor = stats.slowTime;
        }
      }
      events.push('fire');
    }

    s.enemies = s.enemies.filter((e) => !e.dead);
    for (const shot of s.shots) shot.life -= dt;
    s.shots = s.shots.filter((shot) => shot.life > 0);

    if (s.lives <= 0) {
      s.lives = 0;
      s.over = true;
      events.push('lose');
    }
    return events;
  }

  return { COLS, ROWS, WAVES, MAX_LEVEL, WAVE_GAP, TOWERS, ENEMIES, MAPS, SELL_RATE, create, canBuild, build, upgrade, upgradeCost, sell, statsOf, startWave, step, positionAt, pathCells };
})();
if (typeof module !== 'undefined') module.exports = SentryLogic;
