/*
 * Phone, tablet and foldable support (iPhone, iPhone Duo folded and unfolded, iPad).
 *
 * - Section tabs on touch screens narrower than 1100 CSS px (html.tabs-on + html[data-tab]).
 *   All sections stay in the DOM; the tab only decides what is displayed. The desktop
 *   layout (mouse/trackpad, or 1100px and wider) is not affected.
 * - Action sheets: on touch screens they replace hover-only buttons, double-click,
 *   right-click and drag & drop (edit, priority, move, delete).
 * - Keeps the reading position when the width changes (fold/unfold, rotation, split view).
 * - The browser toolbar colour follows the dashboard theme.
 *
 * Safari does not report whether a foldable is open or closed, so nothing here depends on
 * the device: layouts follow the available width only. Loaded before js/app.js, which uses
 * window.MobileUI when it exists.
 */
(function () {
  'use strict';

  // Keep in sync with the inline script in index.html
  const TAB_MODE_QUERY = '(pointer: coarse) and (max-width: 1099px)';
  const TABS = ['today', 'week', 'health', 'habits', 'lists'];
  const TAB_KEY = 'dashboardTab';

  const root = document.documentElement;
  const tabMedia = window.matchMedia(TAB_MODE_QUERY);
  const touchMedia = window.matchMedia('(hover: none)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scrollByTab = {};

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode or full: tab is only a preference */ }
  }

  function isTabMode() {
    return root.classList.contains('tabs-on');
  }

  function isTouch() {
    return touchMedia.matches;
  }

  function currentTab() {
    const tab = root.getAttribute('data-tab');
    return TABS.includes(tab) ? tab : 'today';
  }

  // ===================================================================== Tabs

  function updateTabButtons() {
    const tab = currentTab();
    document.querySelectorAll('.mobile-tab').forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
  }

  function setTab(tab, opts) {
    opts = opts || {};
    if (!TABS.includes(tab)) return;
    const previous = currentTab();
    if (previous === tab && !opts.force) {
      // Same convention as iOS tab bars: tapping the active tab returns to the top
      if (isTabMode()) window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      return;
    }
    if (isTabMode()) scrollByTab[previous] = window.scrollY;
    root.setAttribute('data-tab', tab);
    writeStorage(TAB_KEY, tab);
    updateTabButtons();
    if (isTabMode()) {
      window.scrollTo(0, typeof opts.scrollTop === 'number' ? opts.scrollTop : (scrollByTab[tab] || 0));
      captureAnchor();
    }
    window.dispatchEvent(new CustomEvent('dashboard:tabchange', { detail: { tab: tab, previous: previous } }));
  }

  // Shows the tab that contains an element (e.g. after a link or a search hit)
  function revealElement(el) {
    if (!el || !isTabMode()) return;
    const section = el.closest('[data-tab-section]');
    if (section && section.dataset.tabSection !== currentTab()) setTab(section.dataset.tabSection, { scrollTop: 0 });
  }

  function applyTabMode() {
    const was = isTabMode();
    root.classList.toggle('tabs-on', tabMedia.matches);
    if (was !== tabMedia.matches) {
      updateTabButtons();
      window.dispatchEvent(new CustomEvent('dashboard:layoutchange', { detail: { tabs: tabMedia.matches } }));
    }
  }

  function setupTabs() {
    applyTabMode();
    updateTabButtons();
    const bar = document.getElementById('mobileTabbar');
    if (bar) {
      bar.addEventListener('click', (e) => {
        const btn = e.target.closest('.mobile-tab');
        if (btn) setTab(btn.dataset.tab);
      });
    }
    const onChange = () => applyTabMode();
    if (tabMedia.addEventListener) tabMedia.addEventListener('change', onChange);
    else if (tabMedia.addListener) tabMedia.addListener(onChange);
  }

  // ============================================== Reading position on resize
  // When the width changes (unfolding an iPhone Duo, rotating, resizing a split view)
  // the layout reflows and the same scrollY points at different content. Remember the
  // first visible block while scrolling and put it back at the same screen position.

  const ANCHOR_SELECTOR = [
    '[data-tab-section] > h2', '.glass-panel', '.gym-card', '.list-panel',
    '.kanban-column', '.habit-row', '.step-block', '.calendar-agenda'
  ].join(',');
  let anchor = null;
  let lastWidth = window.innerWidth;
  let captureTimer = null;

  // Prefers the first block that starts on screen (its top edge is what the eye follows);
  // falls back to the block that is cut off at the top edge.
  function captureAnchor() {
    anchor = null;
    let partial = null;
    const candidates = document.querySelectorAll(ANCHOR_SELECTOR);
    const viewHeight = window.innerHeight;
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.bottom <= 8) continue;
      if (r.top >= 0 && r.top < viewHeight) {
        anchor = { el: el, top: r.top };
        return;
      }
      if (!partial && r.top < 0) partial = { el: el, top: r.top };
    }
    anchor = partial;
  }

  function scheduleCapture() {
    clearTimeout(captureTimer);
    captureTimer = setTimeout(captureAnchor, 120);
  }

  function restoreAnchor() {
    const width = window.innerWidth;
    if (width === lastWidth) return; // iOS toolbars change only the height
    lastWidth = width;
    if (window.scrollY < 4) return; // at the top: nothing to keep
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return; // keyboard handles this
    const saved = anchor;
    if (!saved || !saved.el.isConnected) return;
    const r = saved.el.getBoundingClientRect();
    if (r.height === 0) return;
    window.scrollBy(0, Math.round(r.top - saved.top));
    captureAnchor();
  }

  function setupAnchoring() {
    window.addEventListener('scroll', scheduleCapture, { passive: true });
    window.addEventListener('resize', () => window.requestAnimationFrame(restoreAnchor));
    window.addEventListener('load', captureAnchor);
  }

  // ============================================================ Theme colour

  function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && document.body) meta.setAttribute('content', document.body.classList.contains('dark') ? '#0f172a' : '#f0f2f5');
  }

  // ========================================================== Action sheets

  let sheetLayer = null;
  let sheetClosing = null;

  const ICONS = {
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>'
  };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function closeActionSheet(result) {
    if (!sheetLayer) return Promise.resolve();
    const layer = sheetLayer;
    sheetLayer = null;
    root.classList.remove('sheet-open');
    layer.classList.remove('open');
    document.removeEventListener('keydown', layer._onKey, true);
    if (layer._resolve) layer._resolve(result == null ? null : result);
    const restore = layer._restoreFocus;
    sheetClosing = new Promise(resolve => {
      const finish = () => {
        // Give focus back to the "⋯" button, unless the chosen action moved it
        // somewhere else meanwhile (a dialog's text field, a second sheet)
        const active = document.activeElement;
        const focusLost = !active || active === document.body || layer.contains(active);
        layer.remove();
        if (focusLost && restore && restore.isConnected && typeof restore.focus === 'function') {
          try { restore.focus({ preventScroll: true }); } catch (e) { restore.focus(); }
        }
        resolve();
      };
      if (reducedMotion.matches) finish();
      else setTimeout(finish, 180);
    });
    return sheetClosing;
  }

  /**
   * Shows a bottom sheet with actions.
   * config: { title, message, returnFocus, actions: [{ id, label, icon, hint, destructive, checked, disabled, onSelect }] }
   * Resolves with the chosen action id, or null when cancelled.
   */
  function showActionSheet(config) {
    if (sheetLayer) closeActionSheet(null);
    const actions = (config.actions || []).filter(Boolean);
    return new Promise(resolve => {
      const layer = el('div', 'action-sheet-layer');
      layer.setAttribute('data-mobile-only', '');
      const backdrop = el('div', 'action-sheet-backdrop');
      const sheet = el('div', 'action-sheet');
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      const panel = el('div', 'action-sheet-panel');

      if (config.title || config.message) {
        const header = el('div', 'action-sheet-header');
        if (config.title) {
          const title = el('div', 'action-sheet-title', config.title);
          title.id = 'actionSheetTitle';
          sheet.setAttribute('aria-labelledby', title.id);
          header.appendChild(title);
        }
        if (config.message) header.appendChild(el('div', 'action-sheet-message', config.message));
        panel.appendChild(header);
      } else {
        sheet.setAttribute('aria-label', 'Actions');
      }

      actions.forEach(action => {
        const btn = el('button', 'action-sheet-btn');
        btn.type = 'button';
        if (action.destructive) btn.classList.add('destructive');
        if (action.disabled) btn.disabled = true;
        if (action.id) btn.dataset.action = action.id;
        if (action.icon) {
          const icon = el('span', 'action-sheet-icon', action.icon);
          icon.setAttribute('aria-hidden', 'true');
          btn.appendChild(icon);
        }
        btn.appendChild(el('span', 'action-sheet-label', action.label));
        if (action.checked) {
          btn.setAttribute('aria-current', 'true');
          const check = el('span', 'action-sheet-check', '✓');
          check.setAttribute('aria-hidden', 'true');
          btn.appendChild(check);
        }
        if (action.hint) btn.appendChild(el('span', 'action-sheet-hint', action.hint));
        btn.addEventListener('click', () => {
          closeActionSheet(action.id || action.label);
          // Run the action during the tap itself (not after the closing animation):
          // iOS opens the keyboard for a text field only within the user's gesture
          if (typeof action.onSelect === 'function') action.onSelect();
        });
        panel.appendChild(btn);
      });

      const cancel = el('button', 'action-sheet-btn action-sheet-cancel', config.cancelLabel || 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', () => closeActionSheet(null));
      backdrop.addEventListener('click', () => closeActionSheet(null));

      sheet.append(panel, cancel);
      layer.append(backdrop, sheet);
      layer._resolve = resolve;
      // Taps do not focus buttons on iOS, so the opener is passed in explicitly
      layer._restoreFocus = config.returnFocus || document.activeElement;
      layer._onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeActionSheet(null);
        } else if (e.key === 'Tab') {
          const focusables = [...sheet.querySelectorAll('button:not([disabled])')];
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', layer._onKey, true);
      document.body.appendChild(layer);
      sheetLayer = layer;
      root.classList.add('sheet-open');
      window.requestAnimationFrame(() => {
        layer.classList.add('open');
        const first = sheet.querySelector('.action-sheet-btn:not([disabled])');
        if (first) {
          try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
        }
      });
    });
  }

  /** "⋯" button for a list item; only displayed on touch screens (css/mobile.css). */
  function moreButton(label, buildSheet) {
    const btn = el('button', 'item-more-btn');
    btn.type = 'button';
    btn.draggable = false;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = ICONS.more;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showActionSheet(Object.assign({ returnFocus: btn }, buildSheet()));
    });
    // The item's own double-click/right-click/drag handlers must not see these events
    ['dblclick', 'contextmenu', 'dragstart'].forEach(type => btn.addEventListener(type, (e) => e.stopPropagation()));
    return btn;
  }

  const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

  /** Sheet config to pick high/medium/low/none; onPick(valueOrNull). */
  function prioritySheet(title, current, onPick) {
    return {
      title: title,
      actions: ['high', 'medium', 'low', null].map(value => ({
        id: 'priority-' + (value || 'none'),
        label: value ? PRIORITY_LABELS[value] : 'None',
        checked: (current || null) === value,
        onSelect: () => onPick(value)
      }))
    };
  }

  // ================================================================== Start

  function start() {
    // The floating mini timer sits inside the Today section in the HTML; as a direct child
    // of <body> it stays visible on the other tabs (position: fixed, so nothing else moves)
    const pip = document.getElementById('pipTimer');
    if (pip && pip.parentElement !== document.body) document.body.appendChild(pip);
    setupTabs();
    setupAnchoring();
    syncThemeColor();
    if (document.body) {
      new MutationObserver(syncThemeColor).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  window.MobileUI = {
    TAB_MODE_QUERY: TAB_MODE_QUERY,
    isTabMode: isTabMode,
    isTouch: isTouch,
    currentTab: currentTab,
    setTab: setTab,
    revealElement: revealElement,
    showActionSheet: showActionSheet,
    closeActionSheet: closeActionSheet,
    moreButton: moreButton,
    prioritySheet: prioritySheet,
    PRIORITY_LABELS: PRIORITY_LABELS
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
