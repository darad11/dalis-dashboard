/*
 * Swipe left to delete, as in iOS lists (phones and tablets: the touch layout of js/mobile.js).
 *
 * SwipeActions.enable(row, { label, remove }) makes a row swipeable. remove() deletes the entry
 * where its section keeps it and returns a function that puts it back - or null when nothing
 * was deleted (the entry changed meanwhile, e.g. through a sync).
 *
 * - A short swipe to the left reveals a red "Delete" behind the row; a tap on it deletes.
 * - A long swipe (past 60 % of the row) deletes at once.
 * - A tap anywhere else, scrolling, or swiping the row back closes it. One row is open at a
 *   time, and a tap on a row while one is open only closes that one (nothing gets ticked).
 *   A drag that starts on the open "Delete" moves the row on, as from anywhere else on it.
 * - After a delete, "Deleted “…” · Undo" shows above the section bar for a few seconds.
 *
 * The row stays in place and its children move (separators stay, as in a grouped list); a
 * vertical drag still scrolls the page (touch-action in css/swipe.css). Rows in the week's day
 * pager on phones are left out: a horizontal swipe turns the day there. Touch and pen only -
 * with a mouse, and for VoiceOver and the keyboard, "Delete" stays in the "⋯" menus.
 *
 * SwipeActions.whenIdle(update) holds re-renders (a sync, Home) while a row is swiped or open.
 */
(function () {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SLOP = 10;      // px a finger moves before it counts as a swipe or a scroll
  const REVEAL = 88;    // px the row stays open (the width of "Delete")
  const OPEN_AT = 44;   // px past which a release keeps the row open
  const FULL = 0.6;     // share of the row's width past which a release deletes
  const FLICK = -0.5;   // px/ms: a quick flick to the left opens the row too
  const UNDO_MS = 6000;

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

  // --swipe-x moves the row's children (css/swipe.css); registered with @property there, so it
  // animates, and the red "Delete" grows with it
  function setX(row, x, animate) {
    row.classList.toggle('swipe-animate', !!animate && !reducedMotion.matches);
    row.style.setProperty('--swipe-x', `${Math.round(x)}px`);
    if (x < 0) row.classList.add('swipe-shifted');
  }

  // Not a button: rows can be buttons themselves. An element of its own (phrasing content, so
  // valid inside a button row): the rows' styles for their spans and divs never reach it. Hidden
  // from VoiceOver and the keyboard, which use "Delete" in the "⋯" menu.
  function actionOf(row) {
    let action = row.querySelector(':scope > .swipe-action');
    if (!action) {
      action = document.createElement('swipe-action');
      action.className = 'swipe-action';
      action.setAttribute('aria-hidden', 'true');
      action.textContent = 'Delete';
      row.appendChild(action);
    }
    return action;
  }

  function open(row) {
    if (openRow && openRow !== row) close(openRow);
    actionOf(row);
    row.classList.remove('swipe-full');
    row.classList.add('swipe-open');
    setX(row, -REVEAL, true);
    openRow = row;
  }

  function close(row) {
    if (!row) return;
    if (openRow === row) openRow = null;
    row.classList.remove('swipe-open', 'swipe-full');
    setX(row, 0, true);
    const settle = () => {
      if (row.classList.contains('swipe-open') || (gesture && gesture.row === row)) return;
      row.classList.remove('swipe-shifted', 'swipe-animate');
    };
    if (reducedMotion.matches) settle();
    else setTimeout(settle, 300);
  }

  // The row slides out and folds up, then the entry is deleted (its section re-renders)
  function remove(row) {
    const opts = rows.get(row);
    if (!opts || removing.has(row)) return;
    if (openRow === row) openRow = null;
    // Taken now: a re-render meanwhile takes the row out of its sheet
    const host = row.closest('dialog[open]');
    removing.add(row);
    actionOf(row);
    row.classList.add('swipe-removing', 'swipe-full');
    const run = () => {
      removing.delete(row);
      let undo = null;
      try {
        undo = opts.remove();
      } catch (err) {
        console.error('[Swipe] Delete failed', err);
      }
      if (typeof undo === 'function') {
        offerUndo(opts.label, undo, host);
      } else if (row.isConnected) {
        // Nothing deleted: the row comes back
        row.classList.remove('swipe-removing', 'swipe-collapse');
        row.style.height = '';
        close(row);
      }
    };
    if (reducedMotion.matches) {
      run();
      return;
    }
    setX(row, -row.offsetWidth, true);
    setTimeout(() => {
      row.style.height = `${row.offsetHeight}px`;
      void row.offsetHeight; // start the fold from the current height
      row.classList.add('swipe-collapse');
      setTimeout(run, 200);
    }, 200);
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
    if (!swipeable(row)) return;
    const base = row === openRow ? -REVEAL : 0;
    gesture = {
      row, id: e.pointerId, x0: e.clientX, y0: e.clientY, base, x: base,
      // On the open row's "Delete" a tap deletes (onClick); a drag moves the row on, as from
      // anywhere else on it
      onAction: base < 0 && !!e.target.closest('.swipe-action'),
      decided: null, lastX: e.clientX, lastT: e.timeStamp, vx: 0
    };
  }

  function onPointerMove(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.decided) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // Sideways to the left (or back, on an open row) is a swipe; anything else scrolls the page
      if (Math.abs(dx) > Math.abs(dy) && (dx < 0 || g.base < 0)) {
        g.decided = 'swipe';
        try { g.row.setPointerCapture(g.id); } catch (err) { /* the pointer is gone */ }
        if (openRow && openRow !== g.row) close(openRow);
        actionOf(g.row);
        g.row.classList.add('swipe-dragging');
      } else {
        g.decided = 'scroll';
        return;
      }
    }
    if (g.decided !== 'swipe') return;
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.vx = 0.8 * ((e.clientX - g.lastX) / dt) + 0.2 * g.vx;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    const width = g.row.offsetWidth;
    g.x = Math.max(-width, Math.min(0, g.base + dx));
    setX(g.row, g.x, false);
    g.row.classList.toggle('swipe-full', -g.x > width * FULL);
  }

  function onPointerUp(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    gesture = null;
    g.row.classList.remove('swipe-dragging');
    if (g.decided !== 'swipe') {
      // A tap on an open row closes it and ticks nothing (a tap on its "Delete" deletes)
      if (g.base < 0 && !g.decided && !g.onAction) {
        close(g.row);
        suppressNextClick();
      }
      return;
    }
    suppressNextClick();
    const width = g.row.offsetWidth;
    if (-g.x > width * FULL) remove(g.row);
    else if (-g.x > OPEN_AT || (g.vx < FLICK && g.x < 0)) open(g.row);
    else close(g.row);
  }

  function onPointerCancel(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    gesture = null;
    g.row.classList.remove('swipe-dragging');
    if (g.decided === 'swipe') {
      if (g.base < 0) open(g.row);
      else close(g.row);
    }
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
      remove(action.parentElement);
    }
  }

  // ===== Undo =====
  // Shown in the open sheet when the entry was deleted there: everything outside a modal
  // dialog is inert, also what lies above it
  let toast = null;
  let toastTimer = 0;

  function buildToast() {
    toast = document.createElement('div');
    toast.className = 'swipe-undo';
    toast.setAttribute('role', 'status');
    toast.hidden = true;
    // Deleted “…”: a long title is shortened inside the quotes, "Deleted" stays
    const text = document.createElement('span');
    text.className = 'swipe-undo-text';
    const title = document.createElement('span');
    title.className = 'swipe-undo-title';
    text.append('Deleted “', title, '”');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swipe-undo-btn';
    button.textContent = 'Undo';
    toast.append(text, button);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    if (toast) toast.hidden = true;
  }

  function offerUndo(label, undo, host) {
    if (!toast) buildToast();
    hideToast();
    const parent = host && host.open ? host : document.body;
    if (toast.parentNode !== parent) parent.appendChild(toast);
    // The sheet closes before the time is up: Undo stays, on the page
    if (parent !== document.body) {
      parent.addEventListener('close', () => {
        if (toast.parentNode === parent) document.body.appendChild(toast);
      }, { once: true });
    }
    toast.querySelector('.swipe-undo-title').textContent = label;
    toast.querySelector('.swipe-undo-btn').onclick = () => {
      hideToast();
      try {
        undo();
      } catch (err) {
        console.error('[Swipe] Undo failed', err);
      }
    };
    toast.hidden = false;
    toastTimer = setTimeout(hideToast, UNDO_MS);
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
  // Scrolling, a layout change or leaving the app closes an open row (as in iOS)
  const closeOpen = () => { if (openRow && !gesture) close(openRow); };
  window.addEventListener('scroll', closeOpen, { passive: true, capture: true });
  window.addEventListener('resize', closeOpen);
  window.addEventListener('dashboard:layoutchange', closeOpen);
  document.addEventListener('visibilitychange', closeOpen);

  window.SwipeActions = {
    enable,
    close: closeOpen,
    // update() now, or once no row inside container (default: the page) is swiped, open or
    // sliding out; repeated calls with the same function run it once
    whenIdle,
    offerUndo
  };
})();
