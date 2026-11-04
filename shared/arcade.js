// Shared page shell: header, overlays, on-screen controls, saved scores, sound and the frame loop.
// Classic script on purpose: it works from an extension page, a static server or file://.
const Arcade = (() => {
  const PREFIX = 'offline-arcade:';

  // localStorage throws in some private modes; the games must still run without it.
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* unsaved is fine */ }
    },
    remove(key) {
      try { localStorage.removeItem(PREFIX + key); } catch { /* nothing to remove */ }
    },
  };

  const ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    restart: '<path d="M5 12a7 7 0 1 0 2-5"/><path d="M4 4v5h5"/>',
    soundOn: '<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    soundOff: '<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 10l5 5M21 10l-5 5"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    for (const child of [].concat(children)) node.append(child);
    return node;
  }

  // --- Sound: small synthesised blips, so there are no audio files to load. ---
  const SOUNDS = {
    tap: [[520, 0.04, 'square']],
    move: [[300, 0.03, 'triangle']],
    turn: [[420, 0.05, 'triangle']],
    bounce: [[240, 0.05, 'square']],
    hit: [[620, 0.06, 'square']],
    coin: [[780, 0.05, 'triangle'], [1170, 0.09, 'triangle']],
    shoot: [[880, 0.07, 'sawtooth', 300]],
    jump: [[300, 0.12, 'triangle', 640]],
    lock: [[150, 0.06, 'square']],
    clear: [[523, 0.07, 'triangle'], [659, 0.07, 'triangle'], [784, 0.12, 'triangle']],
    hurt: [[200, 0.2, 'sawtooth', 70]],
    lose: [[392, 0.14, 'triangle'], [311, 0.14, 'triangle'], [233, 0.26, 'triangle']],
    win: [[523, 0.1, 'triangle'], [659, 0.1, 'triangle'], [784, 0.1, 'triangle'], [1047, 0.24, 'triangle']],
  };
  let audio = null;
  let muted = store.get('muted', false);

  // Created on the first gesture: earlier, browsers refuse to start it and log a warning.
  function unlockAudio() {
    if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audio = new Ctx();
  }

  function sound(name) {
    if (muted || !audio || !SOUNDS[name]) return;
    let at = audio.currentTime;
    for (const [freq, length, type, slideTo] of SOUNDS[name]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + length);
      gain.gain.setValueAtTime(0.05, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + length);
      at += length * 0.9;
    }
  }

  // --- Canvas helpers ---
  function hidpi(canvas, width, height) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    return ctx;
  }

  function pointerPos(canvas, event, width, height) {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * width,
      y: ((event.clientY - box.top) / box.height) * height,
    };
  }

  // One requestAnimationFrame chain per page. Restarting a game never starts another loop, and a
  // 120 Hz screen plays at the same speed as a 60 Hz one because logic runs in fixed steps.
  function loop({ step, render, running, hz = 60 }) {
    const stepMs = 1000 / hz;
    let last = performance.now();
    let pending = 0;
    function frame(now) {
      const elapsed = Math.min(now - last, 100);
      last = now;
      if (running()) {
        pending += elapsed;
        while (pending >= stepMs) { step(1 / hz); pending -= stepMs; }
      }
      render(pending / stepMs);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function swipe(target, onSwipe, minDistance = 24) {
    let start = null;
    target.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
    target.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) < minDistance) return;
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      start = { x: e.clientX, y: e.clientY };
    });
    for (const type of ['pointerup', 'pointercancel']) target.addEventListener(type, () => { start = null; });
  }

  const formatTime = (ms) => {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  // --- Page shell ---
  // cfg: id, title, how, options, stats, pad, padLayout, keys, pausable, hideOnPause, noBest,
  //      lowerIsBetter, scoreLabel, format, bestKey(opts), bestLabel(opts), onReady(api),
  //      onStart(opts), onKey(key, down, repeat), onPause(paused)
  function game(cfg) {
    const format = cfg.format || String;
    const savedOpts = store.get(`opts:${cfg.id}`, {});
    const opts = {};
    for (const o of cfg.options || []) {
      const saved = savedOpts[o.id];
      const known = o.type === 'number'
        ? Number.isFinite(saved)
        : o.choices.some(([value]) => value === saved);
      opts[o.id] = known ? saved : o.default;
    }

    const stage = document.querySelector('.stage');
    const stats = {};
    const stat = (label, value = '–') => {
      const output = el('b', { textContent: value });
      return { node: el('div', { className: 'stat' }, [el('span', { textContent: label }), output]), output };
    };

    const bar = el('header', { className: 'bar' });
    const back = el('a', { className: 'icon-btn', href: '../../offline.html', innerHTML: icon('back') });
    back.setAttribute('aria-label', 'Back to all games');
    back.title = 'All games';
    const statRow = el('div', { className: 'stats' });
    const scoreStat = stat(cfg.scoreLabel || 'Score', format(0));
    const bestStat = stat('Best');
    statRow.append(scoreStat.node);
    if (cfg.scoreLabel === 'Time') stats.Time = scoreStat;
    for (const label of cfg.stats || []) {
      stats[label] = stat(label);
      statRow.append(stats[label].node);
    }
    if (!cfg.noBest) statRow.append(bestStat.node);

    const iconButton = (name, label, onClick) => {
      const button = el('button', { type: 'button', className: 'icon-btn', innerHTML: icon(name), title: label });
      button.setAttribute('aria-label', label);
      button.addEventListener('click', (e) => {
        onClick();
        // A mouse click leaves focus on the button, where Space would press it again.
        if (e.detail > 0) button.blur();
      });
      return button;
    };
    const pauseBtn = iconButton('pause', 'Pause (P)', () => togglePause());
    const newBtn = iconButton('restart', 'New game (R)', () => openNewGame());
    const soundBtn = iconButton(muted ? 'soundOff' : 'soundOn', 'Sound (M)', () => toggleSound());
    soundBtn.setAttribute('aria-pressed', String(!muted));
    const tools = el('div', { className: 'tools' }, [soundBtn, newBtn]);
    if (cfg.pausable !== false) tools.prepend(pauseBtn);
    bar.append(back, el('h1', { textContent: cfg.title }), statRow, tools);
    document.body.prepend(bar);

    const live = el('div', { className: 'sr-only' });
    live.setAttribute('role', 'status');
    document.body.append(live);
    const say = (text) => { live.textContent = text; };

    // --- Overlay ---
    const overlay = el('div', { className: 'overlay', hidden: true });
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'overlay-title');
    const panel = el('div', { className: 'panel' });
    overlay.append(panel);
    stage.append(overlay);

    const saveOpts = () => store.set(`opts:${cfg.id}`, opts);
    function optionField(o) {
      if (o.type === 'number') {
        const input = el('input', { type: 'number', min: o.min, max: o.max, value: opts[o.id], id: `opt-${o.id}` });
        input.addEventListener('change', () => {
          const n = Math.round(Number(input.value));
          opts[o.id] = Math.min(o.max, Math.max(o.min, Number.isFinite(n) ? n : o.default));
          input.value = opts[o.id];
          saveOpts();
        });
        const label = el('label', { className: 'num-field', htmlFor: input.id, textContent: o.label });
        label.append(input);
        return label;
      }
      const group = el('fieldset', { className: 'choice' }, [el('legend', { textContent: o.label })]);
      for (const [value, text] of o.choices) {
        const input = el('input', { type: 'radio', name: o.id, value, checked: opts[o.id] === value });
        input.addEventListener('change', () => {
          opts[o.id] = value;
          saveOpts();
          renderOptions();
          showBest();
        });
        group.append(el('label', {}, [input, el('span', { textContent: text })]));
      }
      return group;
    }
    const optionBox = el('div', { className: 'options' });
    function renderOptions() {
      optionBox.replaceChildren(...(cfg.options || [])
        .filter((o) => !o.showIf || o.showIf(opts))
        .map(optionField));
    }

    // phase: menu (nothing running), playing, paused (overlay over a live game), over.
    let phase = 'menu';
    let menuOverLiveGame = false;
    const held = new Set();

    function show({ title, text, withOptions, withBest, actions, opaque }) {
      panel.replaceChildren();
      panel.append(el('h2', { id: 'overlay-title', textContent: title }));
      if (text) panel.append(el('p', { className: 'text', innerHTML: text }));
      if (withBest && bestValue() !== null) {
        panel.append(el('p', { className: 'best-line', textContent: `Best: ${format(bestValue())}` }));
      }
      if (withOptions && cfg.options) { renderOptions(); panel.append(optionBox); }
      const row = el('div', { className: 'actions' });
      actions.forEach(({ label, run, secondary }) => {
        const button = el('button', { type: 'button', textContent: label, className: secondary ? 'btn ghost' : 'btn' });
        button.addEventListener('click', run);
        row.append(button);
      });
      panel.append(row);
      overlay.classList.toggle('opaque', Boolean(opaque));
      overlay.hidden = false;
      row.querySelector('button').focus();
      held.clear();
    }
    function hide() {
      overlay.hidden = true;
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    }

    // --- Best scores ---
    const bestKey = () => `best:${cfg.id}${cfg.bestKey ? `:${cfg.bestKey(opts)}` : ''}`;
    const bestValue = () => store.get(bestKey(), null);
    const beats = (value, best) => best === null || (cfg.lowerIsBetter ? value < best : value > best);
    function showBest() {
      const best = bestValue();
      bestStat.output.textContent = best === null ? '–' : format(best);
    }
    // The hub reads this label for its card. Games with modes name the mode they saved.
    function record(value) {
      if (!beats(value, bestValue())) return false;
      store.set(bestKey(), value);
      const mode = cfg.bestKey ? `${cfg.bestLabel ? cfg.bestLabel(opts) : cfg.bestKey(opts)}: ` : 'Best ';
      store.set(`hub:${cfg.id}`, `${mode}${format(value)}`);
      showBest();
      return true;
    }

    let current = 0;
    function setScore(n) {
      current = n;
      scoreStat.output.textContent = format(n);
      // Saved as it climbs, so leaving mid-game keeps the score. Lower-is-better saves at the win.
      if (!cfg.lowerIsBetter && !cfg.noBest && n > 0) record(n);
    }

    // --- Clock (only advances while playing) ---
    let clockMs = 0;
    let clockOn = false;
    let clockLast = 0;
    const clockTick = () => {
      const now = performance.now();
      if (clockOn && phase === 'playing') {
        clockMs += now - clockLast;
        if (stats.Time) stats.Time.output.textContent = formatTime(clockMs);
      }
      clockLast = now;
    };
    setInterval(clockTick, 250);

    // --- Flow ---
    const setPauseIcon = () => { pauseBtn.innerHTML = icon(phase === 'paused' ? 'play' : 'pause'); };
    function enter(next) {
      phase = next;
      setPauseIcon();
    }
    function start() {
      hide();
      menuOverLiveGame = false;
      enter('playing');
      clockOn = false;
      clockMs = 0;
      current = 0;
      clockLast = performance.now();
      if (stats.Time) stats.Time.output.textContent = '0:00';
      saveOpts();
      showBest();
      scoreStat.output.textContent = format(0);
      unlockAudio();
      cfg.onStart(opts);
    }
    function pause() {
      if (phase !== 'playing' || cfg.pausable === false) return;
      clockTick();
      enter('paused');
      if (cfg.onPause) cfg.onPause(true);
      show({
        title: 'Paused',
        withBest: true,
        opaque: cfg.hideOnPause,
        actions: [
          { label: 'Resume', run: resume },
          { label: 'New game', run: openNewGame, secondary: true },
        ],
      });
    }
    function resume() {
      if (phase !== 'paused') return;
      menuOverLiveGame = false;
      hide();
      clockLast = performance.now();
      enter('playing');
      if (cfg.onPause) cfg.onPause(false);
    }
    function togglePause() {
      if (phase === 'playing') pause();
      else if (phase === 'paused') resume();
    }
    function openNewGame() {
      menuOverLiveGame = phase === 'playing' || phase === 'paused';
      if (phase === 'playing') {
        clockTick();
        enter('paused');
        if (cfg.onPause) cfg.onPause(true);
      }
      const actions = [{ label: 'Start', run: start }];
      if (menuOverLiveGame) actions.push({ label: 'Keep playing', secondary: true, run: resume });
      show({
        title: 'New game',
        text: menuOverLiveGame ? 'Starting again ends the current game.' : '',
        withOptions: true,
        actions,
        opaque: cfg.hideOnPause,
      });
    }
    function over({ title, text, win }) {
      clockTick();
      clockOn = false;
      enter('over');
      sound(win ? 'win' : 'lose');
      say(`${title}. ${text ? text.replace(/<[^>]+>/g, '') : ''}`);
      show({
        title,
        text,
        withBest: true,
        withOptions: true,
        actions: [{ label: 'Play again', run: start }],
      });
    }
    // A stop that keeps the game alive afterwards, such as passing a milestone.
    function notice({ title, text, actions }) {
      clockTick();
      enter('paused');
      show({
        title,
        text,
        actions: actions.map((a) => ({
          ...a,
          run: () => {
            hide();
            clockLast = performance.now();
            enter('playing');
            a.run();
          },
        })),
      });
    }
    function toggleSound() {
      muted = !muted;
      store.set('muted', muted);
      soundBtn.innerHTML = icon(muted ? 'soundOff' : 'soundOn');
      soundBtn.setAttribute('aria-pressed', String(!muted));
      unlockAudio();
    }

    // --- Input ---
    const gameKeys = new Set(cfg.keys || []);
    const normal = (key) => (key.length === 1 ? key.toLowerCase() : key);
    const typing = (target) => target.matches && target.matches('input:not([type=radio]), select, textarea');

    function press(key, repeat = false) {
      if (phase !== 'playing') return;
      if (!repeat) held.add(key);
      if (cfg.onKey) cfg.onKey(key, true, repeat);
    }
    function release(key) {
      held.delete(key);
      if (cfg.onKey) cfg.onKey(key, false, false);
    }

    document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
    document.addEventListener('keydown', (e) => {
      unlockAudio();
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = normal(e.key);
      if (key === 'p' || key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (key === 'r') { e.preventDefault(); if (overlay.hidden) openNewGame(); return; }
      if (key === 'm') { e.preventDefault(); toggleSound(); return; }
      if (!overlay.hidden) return;
      if (gameKeys.has(key)) {
        e.preventDefault();
        press(key, e.repeat);
      }
    });
    document.addEventListener('keyup', (e) => {
      const key = normal(e.key);
      if (gameKeys.has(key)) release(key);
    });

    if (cfg.pausable !== false) {
      document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
      window.addEventListener('blur', pause);
    }

    // --- On-screen controls ---
    if (cfg.pad) {
      const pad = el('div', { className: `pad ${cfg.padLayout || ''}` });
      pad.setAttribute('aria-label', 'On-screen controls');
      cfg.pad.forEach(({ key, label, name, repeat, area }) => {
        const button = el('button', { type: 'button', textContent: label });
        button.setAttribute('aria-label', name);
        if (area) button.style.gridArea = area;
        let timer = 0;
        const stop = () => {
          clearTimeout(timer);
          if (button.classList.contains('down')) release(key);
          button.classList.remove('down');
        };
        button.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          button.classList.add('down');
          press(key);
          if (repeat) {
            const tick = () => { press(key, true); timer = setTimeout(tick, 80); };
            timer = setTimeout(tick, 220);
          }
        });
        for (const type of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(type, stop);
        button.addEventListener('contextmenu', (e) => e.preventDefault());
        pad.append(button);
      });
      document.body.append(pad);
    }

    // --- Back online notice ---
    window.addEventListener('online', () => {
      let from = null;
      try { from = sessionStorage.getItem(`${PREFIX}from`); } catch { /* no session storage */ }
      const toast = el('div', { className: 'toast', textContent: 'Back online. ' });
      toast.setAttribute('role', 'status');
      if (from) toast.append(el('a', { href: from, textContent: 'Return to your page' }));
      document.body.append(toast);
      setTimeout(() => toast.remove(), 8000);
    });

    const api = {
      opts,
      keys: held,
      say,
      sound,
      record,
      score: setScore,
      getScore: () => current,
      stat: (label, value) => { stats[label].output.textContent = value; },
      over,
      notice,
      pause,
      start,
      resumeSaved() { hide(); enter('playing'); clockLast = performance.now(); },
      hub: (label) => store.set(`hub:${cfg.id}`, label),
      startClock() { if (!clockOn) { clockOn = true; clockLast = performance.now(); } },
      stopClock() { clockTick(); clockOn = false; },
      clock(ms) {
        if (ms === undefined) { clockTick(); return clockMs; }
        clockMs = ms;
        if (stats.Time) stats.Time.output.textContent = formatTime(ms);
        return ms;
      },
      get playing() { return phase === 'playing'; },
      get phase() { return phase; },
    };

    showBest();
    // Runs after the game's script has finished setting itself up.
    queueMicrotask(() => {
      show({
        title: cfg.title,
        text: cfg.how,
        withBest: true,
        withOptions: true,
        actions: [
          ...(cfg.savedGame && cfg.savedGame() ? [{ label: 'Continue', run: () => cfg.onContinue() }] : []),
          { label: 'Play', run: start, secondary: Boolean(cfg.savedGame && cfg.savedGame()) },
        ],
      });
    });
    return api;
  }

  return { game, store, sound, hidpi, pointerPos, loop, swipe, formatTime, el };
})();
