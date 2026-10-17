/*
 * Swipe left to delete, as in iOS lists (with a finger or pen on any device; a mouse drags rows
 * as before and never swipes).
 *
 * SwipeActions.enable(row, { label, remove }) makes a row swipeable. remove() deletes the entry
 * where its section keeps it and returns true - or false when it is gone already (a sync).
 *
 * As on the iPhone (iOS 26):
 * - While it is swiped, the row spans its card from edge to edge, as a cell spans its section.
 *   It slides left as one piece, rounded on its trailing side, and uncovers a red "Delete"
 *   capsule at the card's edge.
 * - Letting go past half of "Delete" - or flicking to the left - leaves it open; a tap on
 *   "Delete" deletes. Pulling on stretches the capsule; past 60 % of the card "Delete" moves
 *   next to the row (the full swipe), and letting go there deletes at once.
 * - The row slides out and the rows below close up. No confirmation and no Undo bar: iOS lists
 *   have neither (Reminders, Mail), Apple keeps undo to shaking and a three-finger swipe.
 * - A tap anywhere else, scrolling the page, or swiping back closes it. One row is open at a
 *   time, and a tap on a row while one is open only closes that one (nothing gets ticked). A
 *   row can be caught while it moves; a drag on the open "Delete" moves the row on. The page
 *   moving by itself (a section above redrawn) leaves it open, as in iOS.
 * - Opening, closing and sliding out follow a spring that starts at the finger's speed.
 *
 * Touch and pen only: with a mouse, VoiceOver and the keyboard "Delete" stays in the "⋯" menus.
 * Rows in the week's day pager on phones are left out: a sideways swipe turns the day there.
 * The haptic tap of the full swipe in iOS is not possible here (Safari has no vibration API).
 *
 * SwipeActions.whenIdle(update) holds re-renders (a sync, Home) while a row is swiped or open.
 */
(function () {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SLOP = 10;          // px a finger moves before it counts as a swipe or a scroll
  const INSET = 6;          // px around "Delete": from the row's top and bottom and the card's edge
  const PAD = 14;           // px beside the label inside the capsule
  const FULL = 0.6;         // share of the card's width past which "Delete" takes the row
  const FULL_BACK = 0.52;   // ...and below which it lets go again (no flicker at the threshold)
  const PROJECT_MS = 120;   // how far the finger's speed carries a release (open or closed)
  const REST_MS = 60;       // a finger still for this long before letting go has no speed left
  const LIFT_RADIUS = 26;   // px, at most, rounding the row's trailing side while it is swiped
  // Spring as SwiftUI's spring(response:dampingFraction:); sliding out is quicker
  const SPRING = { response: 0.38, damping: 0.86 };
  const SPRING_OUT = { response: 0.26, damping: 1 };
  const SLIDE_MS = 200;     // the rows below start to close up while the row slides out
  const COLLAPSE_MS = 240;  // ...and take this long

  const rows = new WeakMap(); // row -> { label, remove }
  const removing = new Set(); // rows sliding out
  let gesture = null;
  let openRow = null;
  let suppressClick = false;
  let suppressTimer = 0;

  function enable(row, opts) {
    if (!row || !opts || typeof opts.remove !== 'function') return;
    rows.set(row, opts);
    row.classList.add('swipe-row');
  }

  function swipeable(row) {
    return !!row && rows.has(row) && row.isConnected && root.classList.contains('touch-layout') &&
      !row.closest('.week-kanban.is-pager');
  }

  // ===== The card the row sits on =====
  function parseColor(value) {
    const m = /rgba?\(([^)]+)\)/.exec(value || '');
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || p.some(Number.isNaN)) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }

  function background(el) {
    return parseColor(getComputedStyle(el).backgroundColor);
  }

  // A row drawn as its own rounded tile is its own cell (the gym goals); any other row belongs
  // to the first ancestor with a background - its card. (A row's pressed background has no
  // rounding, so it does not count.)
  function cellOf(row) {
    const own = background(row);
    if (own && own[3] > 0 && parseFloat(getComputedStyle(row).borderTopRightRadius) > 0) return row;
    for (let n = row.parentElement; n && n !== document.body; n = n.parentElement) {
      const bg = background(n);
      if (bg && bg[3] > 0) return n;
    }
    return row.parentElement || row;
  }

  // The colour the cell shows: its background over whatever lies below it
  function opaqueColor(el) {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = background(n);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
    }
    let out = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) {
      const [r, g, b, a] = layers[i];
      out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
    }
    return `rgb(${out.map(Math.round).join(', ')})`;
  }

  // "Delete" (an element of its own: the rows' styles for their spans never reach it) and the
  // lifted row behind the content. Hidden from VoiceOver and the keyboard, which use the menu.
  function partsOf(row) {
    let action = row.querySelector(':scope > .swipe-action');
    if (!action) {
      action = document.createElement('swipe-action');
      action.className = 'swipe-action';
      action.setAttribute('aria-hidden', 'true');
      const label = document.createElement('swipe-label');
      label.textContent = 'Delete';
      action.appendChild(label);
      const lift = document.createElement('swipe-lift');
      lift.className = 'swipe-lift';
      lift.setAttribute('aria-hidden', 'true');
      row.append(lift, action);
    }
    return action;
  }

  // Measures the row in its card when a swipe starts: the card's edges, its colour, the size
  // of "Delete". Returns the distances the swipe works with.
  function prepare(row) {
    const action = partsOf(row);
    const cell = cellOf(row);
    const r = row.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    const cs = getComputedStyle(cell);
    const own = cell === row;
    const bleedL = own ? 0 : Math.max(0, r.left - (c.left + parseFloat(cs.borderLeftWidth)));
    const bleedR = own ? 0 : Math.max(0, c.right - parseFloat(cs.borderRightWidth) - r.right);
    const width = r.width + bleedL + bleedR;
    const set = (name, value) => row.style.setProperty(name, value);
    set('--swipe-bleed-l', `${bleedL}px`);
    set('--swipe-bleed-r', `${bleedR}px`);
    set('--swipe-cell', `${width}px`);
    set('--swipe-surface', opaqueColor(cell));
    set('--swipe-lift-r', `${Math.min(LIFT_RADIUS, r.height / 2)}px`);
    set('--swipe-inset', `${INSET}px`);
    set('--swipe-pad', `${PAD}px`);
    row.classList.add('swipe-shifted');
    cell.classList.add('swipe-cell-host');
    // A capsule around its label, at least round
    const capsule = Math.max(Math.ceil(action.firstElementChild.offsetWidth) + 2 * PAD, r.height - 2 * INSET);
    set('--swipe-capsule', `${capsule}px`);
    return { cell, width, reveal: capsule + 2 * INSET };
  }

  function release(row, cell) {
    row.classList.remove('swipe-shifted', 'swipe-animate', 'swipe-full', 'swipe-open', 'swipe-dragging');
    if (cell && cell !== row && !cell.querySelector('.swipe-shifted')) cell.classList.remove('swipe-cell-host');
    if (cell === row) row.classList.remove('swipe-cell-host');
  }

  // ===== Movement =====
  // Where the row is now, also in the middle of an animation (--swipe-x is registered)
  function currentX(row) {
    if (!row.classList.contains('swipe-shifted')) return 0;
    return parseFloat(getComputedStyle(row).getPropertyValue('--swipe-x')) || 0;
  }

  function setX(row, x) {
    row.classList.remove('swipe-animate');
    row.style.setProperty('--swipe-x', `${Math.round(x)}px`);
  }

  const linearEasing = !!(window.CSS && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)'));

  // A damped spring from 0 to 1 that starts at velocity v (per second, relative to the
  // distance), sampled into a CSS linear() curve; and how long it takes to settle
  function springCurve(spring, v) {
    const w = 2 * Math.PI / spring.response;
    const z = Math.min(spring.damping, 0.999);
    const wd = w * Math.sqrt(1 - z * z);
    const b = (v - z * w) / wd;
    const settle = Math.log(Math.hypot(1, b) / 0.001) / (z * w);
    const duration = Math.max(0.12, Math.min(1.2, settle));
    const points = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = duration * i / n;
      const y = Math.exp(-z * w * t) * (-Math.cos(wd * t) + b * Math.sin(wd * t));
      points.push(i === n ? 1 : +(1 + y).toFixed(4));
    }
    return { easing: `linear(${points.join(', ')})`, ms: Math.round(duration * 1000) };
  }

  // Animates the row to x, starting at the finger's speed vx (px/ms); then() when it is there.
  // Returns how long it takes (ms).
  function animateTo(row, x, vx, spring, then) {
    const from = currentX(row);
    const distance = x - from;
    clearTimeout(row._swipeTimer);
    if (reducedMotion.matches || Math.abs(distance) < 0.5) {
      setX(row, x);
      if (then) then();
      return 0;
    }
    let curve = { easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)', ms: 300 };
    if (linearEasing) {
      const v = Math.max(-30, Math.min(30, (vx || 0) * 1000 / distance));
      curve = springCurve(spring, v);
    }
    row.style.setProperty('--swipe-ease', curve.easing);
    row.style.setProperty('--swipe-dur', `${curve.ms}ms`);
    row.classList.add('swipe-animate');
    row.style.setProperty('--swipe-x', `${Math.round(x)}px`);
    row._swipeTimer = setTimeout(() => {
      row.classList.remove('swipe-animate');
      if (then) then();
    }, curve.ms);
    return curve.ms;
  }

  function open(row, geo, vx) {
    if (openRow && openRow !== row) close(openRow);
    row.classList.remove('swipe-full');
    row.classList.add('swipe-open');
    row._swipeGeo = geo;
    openRow = row;
    animateTo(row, -geo.reveal, vx, SPRING);
  }

  function close(row, vx) {
    if (!row) return;
    if (openRow === row) openRow = null;
    const geo = row._swipeGeo;
    row.classList.remove('swipe-open', 'swipe-full');
    animateTo(row, 0, vx, SPRING, () => {
      if (row.classList.contains('swipe-open') || (gesture && gesture.row === row) || removing.has(row)) return;
      release(row, geo && geo.cell);
    });
  }

  // "Delete" takes the row, the row slides out and folds up; then the entry is deleted (its
  // section re-renders)
  function remove(row, vx) {
    const opts = rows.get(row);
    if (!opts || removing.has(row)) return;
    if (openRow === row) openRow = null;
    const geo = row._swipeGeo || prepare(row);
    removing.add(row);
    row.classList.remove('swipe-open');
    row.classList.add('swipe-full', 'swipe-removing');
    const run = () => {
      removing.delete(row);
      let done = false;
      try {
        done = opts.remove() === true;
      } catch (err) {
        console.error('[Swipe] Delete failed', err);
      }
      if (!done && row.isConnected) {
        // Nothing deleted (gone already): the row comes back
        row.classList.remove('swipe-removing', 'swipe-collapse');
        row.style.height = '';
        close(row);
      }
    };
    if (reducedMotion.matches) {
      run();
      return;
    }
    const slide = animateTo(row, -geo.width, vx, SPRING_OUT);
    setTimeout(() => {
      row.style.height = `${row.offsetHeight}px`;
      void row.offsetHeight; // fold from the current height
      row.classList.add('swipe-collapse');
      setTimeout(run, COLLAPSE_MS);
    }, Math.min(slide, SLIDE_MS));
  }

  function suppressNextClick() {
    suppressClick = true;
    clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => { suppressClick = false; }, 500);
  }

  // ===== Pointer events (document, capture: before the rows' own handlers) =====
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    // A new touch: a click held back belonged to the one before
    suppressClick = false;
    clearTimeout(suppressTimer);
    const row = e.target.closest ? e.target.closest('.swipe-row') : null;
    if (openRow && !openRow.isConnected) openRow = null;
    if (openRow && row !== openRow) {
      // A touch elsewhere only closes the open row; on another row it ticks nothing
      close(openRow);
      if (row) suppressNextClick();
      return;
    }
    if (!swipeable(row) || removing.has(row)) return;
    gesture = {
      row, id: e.pointerId, x0: e.clientX, y0: e.clientY,
      // On the open row's "Delete" a tap deletes (onClick); a drag moves the row on
      onAction: row === openRow && !!e.target.closest('.swipe-action'),
      wasOpen: row === openRow,
      decided: null, base: 0, x: 0, geo: null, full: false,
      lastX: e.clientX, lastT: e.timeStamp, vx: 0
    };
  }

  function onPointerMove(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.decided) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // Sideways to the left (or back, on a row that is out) is a swipe; anything else scrolls
      const shifted = g.row.classList.contains('swipe-shifted');
      if (Math.abs(dx) > Math.abs(dy) && (dx < 0 || shifted)) {
        g.decided = 'swipe';
        try { g.row.setPointerCapture(g.id); } catch (err) { /* the pointer is gone */ }
        if (openRow && openRow !== g.row) close(openRow);
        // Caught in the middle of an animation: it goes on from where it is
        g.base = currentX(g.row);
        clearTimeout(g.row._swipeTimer);
        g.geo = prepare(g.row);
        g.row._swipeGeo = g.geo;
        g.full = g.row.classList.contains('swipe-full');
        g.row.classList.add('swipe-dragging');
        // Measured from here on, so the row does not jump by the slop
        g.x0 = e.clientX;
      } else {
        g.decided = 'scroll';
        // Scrolling the page from the open row closes it
        if (g.wasOpen) close(g.row);
        return;
      }
    }
    if (g.decided !== 'swipe') return;
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.vx = 0.8 * ((e.clientX - g.lastX) / dt) + 0.2 * g.vx;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    const width = g.geo.width;
    g.x = Math.max(-width, Math.min(0, g.base + (e.clientX - g.x0)));
    setX(g.row, g.x);
    // Past the threshold "Delete" moves next to the row; back below a little less it returns
    const pulled = -g.x / width;
    if (!g.full && pulled > FULL) g.full = true;
    else if (g.full && pulled < FULL_BACK) g.full = false;
    g.row.classList.toggle('swipe-full', g.full);
  }

  function onPointerUp(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    gesture = null;
    g.row.classList.remove('swipe-dragging');
    if (g.decided !== 'swipe') {
      // A tap on an open row closes it and ticks nothing (a tap on its "Delete" deletes)
      if (g.wasOpen && !g.decided && !g.onAction) {
        close(g.row);
        suppressNextClick();
      }
      return;
    }
    suppressNextClick();
    // A finger that rested before letting go has no speed left
    if (e.timeStamp - g.lastT > REST_MS) g.vx = 0;
    if (g.full) {
      remove(g.row, g.vx);
      return;
    }
    // Where the finger's speed would carry the row decides
    const projected = g.x + g.vx * PROJECT_MS;
    if (projected < -g.geo.reveal / 2) open(g.row, g.geo, g.vx);
    else close(g.row, g.vx);
  }

  function onPointerCancel(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    gesture = null;
    g.row.classList.remove('swipe-dragging');
    if (g.decided !== 'swipe') return;
    if (g.wasOpen) open(g.row, g.geo, 0);
    else close(g.row, 0);
  }

  function onClick(e) {
    if (suppressClick) {
      // The click of a swipe, or of the tap that closed a row
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const action = e.target.closest ? e.target.closest('.swipe-action') : null;
    if (action && rows.has(action.parentElement)) {
      e.preventDefault();
      e.stopPropagation();
      remove(action.parentElement, 0);
    }
  }

  // ===== Updates wait for the finger =====
  // A list rebuilt while a finger is on one of its rows, or while "Delete" stands open, would
  // take the row away under the finger or right before the tap. Such updates (a sync, Home's
  // refresh) wait until the row is let go and closed.
  function isBusy(container) {
    if (!container) return false;
    if (openRow && !openRow.isConnected) openRow = null;
    return (!!gesture && container.contains(gesture.row)) ||
      (!!openRow && container.contains(openRow)) ||
      [...removing].some(row => container.contains(row));
  }

  const waiting = new Map(); // update -> timer
  function whenIdle(update, container) {
    clearTimeout(waiting.get(update));
    waiting.delete(update);
    if (!isBusy(container || document.documentElement)) {
      update();
      return;
    }
    waiting.set(update, setTimeout(() => whenIdle(update, container), 300));
  }

  // ===== Start =====
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('pointercancel', onPointerCancel, true);
  document.addEventListener('click', onClick, true);
  // Scrolling by the person (a touch elsewhere closes it already, see onPointerDown; here a
  // trackpad or mouse wheel), a new window size or leaving the app closes an open row. A scroll
  // the page makes by itself does not: a section above that is redrawn shifts the page.
  const closeOpen = () => { if (openRow && !gesture) close(openRow); };
  window.addEventListener('wheel', closeOpen, { passive: true, capture: true });
  window.addEventListener('resize', closeOpen);
  document.addEventListener('visibilitychange', closeOpen);

  window.SwipeActions = {
    enable,
    close: closeOpen,
    // update() now, or once no row inside container (default: the page) is swiped, open or
    // sliding out; repeated calls with the same function run it once
    whenIdle
  };
})();
