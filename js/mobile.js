/*
 * Phone, tablet and foldable support (iPhone, iPhone Duo folded and unfolded, iPad).
 *
 * - Touch layout on touch screens narrower than 1100 CSS px (html.touch-layout). The page is
 *   one continuous scroll (Today, Week, Health, Habits, Lists); the floating section bar at the
 *   bottom marks the section on screen and jumps to a section when tapped. The desktop layout
 *   (mouse/trackpad, or 1100px and wider) is not affected.
 * - App bar with "+" (new calendar event) and "⋯" (more), and menus anchored to the button
 *   that opened them (pull-down menus as in iOS). On touch screens of any width "⋯" menus
 *   replace hover-only buttons, double-click, right-click and drag & drop.
 * - Keeps the reading position when the width changes (fold/unfold, rotation, split view).
 * - Visible viewport above the iOS keyboard as CSS variables (--vv-top, --vv-height).
 * - The browser toolbar colour follows the theme.
 *
 * Safari does not report whether a foldable is open or closed, so nothing here depends on
 * the device: layouts follow the available width only. Loaded before js/app.js, which uses
 * window.MobileUI when it exists.
 */
(function () {
  'use strict';

  // Keep in sync with the inline script in index.html
  const TOUCH_LAYOUT_QUERY = '(pointer: coarse) and (max-width: 1099px)';
  const SECTIONS = ['today', 'week', 'health', 'habits', 'lists'];

  const root = document.documentElement;
  const layoutMedia = window.matchMedia(TOUCH_LAYOUT_QUERY);
  const touchMedia = window.matchMedia('(hover: none)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Read before js/steps.js removes the parameters from the address bar
  const openedWithStepsLink = /[?&]steps=/.test(window.location.search);

  function isTouchLayout() {
    return root.classList.contains('touch-layout');
  }

  function isTouch() {
    return touchMedia.matches;
  }

  function onMediaChange(media, handler) {
    if (media.addEventListener) media.addEventListener('change', handler);
    else if (media.addListener) media.addListener(handler);
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function focusWithoutScroll(node) {
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  // Shapes after SF Symbols, drawn as outlines like symbols in iOS menus (the section bar
  // uses filled shapes, inline in index.html, as the HIG recommends for tab bars)
  const ICONS = {
    more: '<circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/>',
    pencil: '<path d="M4 20l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M13.5 7.5l3 3"/>',
    flag: '<path d="M5.5 21V4.5"/><path d="M5.5 4.5c4-2 6.5 2 11 0v9c-4.5 2-7-2-11 0"/>',
    trash: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7"/><path d="M6.5 6.5l.9 12.6c.1 1 .9 1.9 2 1.9h5.2c1.1 0 1.9-.9 2-1.9l.9-12.6"/>',
    arrowUp: '<path d="M12 19.5v-15M6 10.5l6-6 6 6"/>',
    arrowDown: '<path d="M12 4.5v15M6 13.5l6 6 6-6"/>',
    moveTo: '<path d="M4 12h13M12 6l6 6-6 6"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.75" cy="6.5" r=".9"/><circle cx="4.75" cy="12" r=".9"/><circle cx="4.75" cy="17.5" r=".9"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    focus: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 9.4 4.6 4.6 0 0 0 7 18.5z"/>',
    signOut: '<path d="M14.5 4.5h-8a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8"/><path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5"/>',
    checkmark: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chevronRight: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    chevronLeft: '<path d="M14.5 5.5 8 12l6.5 6.5"/>'
  };

  function icon(name, cls) {
    const span = el('span', cls || 'menu-icon');
    span.setAttribute('aria-hidden', 'true');
    if (ICONS[name]) span.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>`;
    return span;
  }

  // ======================================================== Touch layout

  function applyTouchLayout() {
    const was = isTouchLayout();
    root.classList.toggle('touch-layout', layoutMedia.matches);
    if (was !== layoutMedia.matches) {
      syncThemeColor();
      window.dispatchEvent(new CustomEvent('dashboard:layoutchange', { detail: { touch: layoutMedia.matches } }));
      if (layoutMedia.matches) scheduleSpy();
    }
  }

  // ===================================================== Section bar + spy
  // The section on screen is the last one whose top edge passed a reading line a quarter
  // down the visible area (below the app bar). At the end of the page a section that is too
  // short to reach that line wins if it was chosen in the bar, else the last section.
  // While the page scrolls to a chosen section, the bar keeps showing that section.

  let activeSection = null;
  let spyTarget = null;   // section chosen in the bar, until the person scrolls themselves
  let spyLocked = false;  // a jump to spyTarget is running
  let spyFrame = 0;
  let unlockTimer = null;

  function sectionEl(name) {
    return document.getElementById('section-' + name);
  }

  function appBarBottom() {
    const bar = document.querySelector('.app-bar');
    return bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  }

  function tabbarTop() {
    const bar = document.getElementById('mobileTabbar');
    const r = bar ? bar.getBoundingClientRect() : null;
    return r && r.height ? r.top : window.innerHeight;
  }

  function computeSection() {
    const top = appBarBottom();
    const bottom = tabbarTop();
    const line = top + Math.max(0, bottom - top) * 0.25;
    const scroller = document.scrollingElement || root;
    const atEnd = window.scrollY + window.innerHeight >= scroller.scrollHeight - 2;
    if (atEnd && spyTarget) {
      const chosen = sectionEl(spyTarget);
      const r = chosen && chosen.getBoundingClientRect();
      if (r && r.height && r.top < bottom && r.bottom > top) return spyTarget;
    }
    let current = SECTIONS[0];
    for (const name of SECTIONS) {
      const section = sectionEl(name);
      if (!section) continue;
      const r = section.getBoundingClientRect();
      if (r.height === 0) continue;
      if (r.top <= line || (atEnd && r.top < bottom)) current = name;
    }
    return current;
  }

  function moveIndicator(animate) {
    const bar = document.getElementById('mobileTabbar');
    if (!bar || !isTouchLayout()) return;
    const indicator = bar.querySelector('.tabbar-indicator');
    const tab = bar.querySelector(`.mobile-tab[data-section="${activeSection}"]`);
    if (!indicator || !tab) return;
    const barBox = bar.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    if (tabBox.width === 0) return;
    indicator.classList.toggle('no-transition', !animate || reducedMotion.matches);
    indicator.style.width = `${tabBox.width}px`;
    indicator.style.transform = `translateX(${tabBox.left - barBox.left - bar.clientLeft}px)`;
    indicator.classList.add('ready');
  }

  function setActiveSection(name, animate) {
    if (!SECTIONS.includes(name)) return;
    const changed = name !== activeSection;
    activeSection = name;
    document.querySelectorAll('.mobile-tab').forEach(tab => {
      const active = tab.dataset.section === name;
      tab.classList.toggle('active', active);
      if (active) tab.setAttribute('aria-current', 'location');
      else tab.removeAttribute('aria-current');
    });
    moveIndicator(animate && changed);
    if (changed) window.dispatchEvent(new CustomEvent('dashboard:sectionchange', { detail: { section: name } }));
  }

  function updateSpy() {
    spyFrame = 0;
    if (!isTouchLayout() || spyLocked) return;
    setActiveSection(computeSection(), true);
  }

  function scheduleSpy() {
    if (!spyFrame) spyFrame = window.requestAnimationFrame(updateSpy);
  }

  // The jump ended (scrollend, or no scroll event for a moment): follow the content again
  function unlockSoon(delay) {
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      spyLocked = false;
      scheduleSpy();
    }, delay);
  }

  function onScroll() {
    if (spyLocked) unlockSoon(140);
    else scheduleSpy();
  }

  // The person scrolls or types: no chosen section any more
  function releaseSpy() {
    spyTarget = null;
    if (spyLocked) {
      spyLocked = false;
      clearTimeout(unlockTimer);
    }
    scheduleSpy();
  }

  /** Scrolls to a section (its start just below the app bar) and marks it in the section bar. */
  function scrollToSection(name, opts) {
    const section = sectionEl(name);
    if (!section) return;
    const options = opts || {};
    spyTarget = name;
    spyLocked = true;
    setActiveSection(name, true);
    const smooth = options.smooth !== false && !reducedMotion.matches;
    section.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    unlockSoon(smooth ? 600 : 60); // also when the page does not need to scroll at all
    if (options.focus) {
      // Keyboard and VoiceOver continue inside the section; tabindex only while it has focus
      section.setAttribute('tabindex', '-1');
      focusWithoutScroll(section);
      section.addEventListener('blur', () => section.removeAttribute('tabindex'), { once: true });
    }
  }

  function setupSections() {
    const bar = document.getElementById('mobileTabbar');
    if (bar) {
      bar.addEventListener('click', (e) => {
        const tab = e.target.closest('.mobile-tab');
        if (!tab) return;
        e.preventDefault(); // no "#section-…" in the address bar; the bar shows where we are
        scrollToSection(tab.dataset.section, { focus: true });
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', () => { if (spyLocked) unlockSoon(0); });
    window.addEventListener('resize', () => {
      scheduleSpy();
      window.requestAnimationFrame(() => moveIndicator(false));
    });
    // The person scrolls (or types) again: the bar follows the content again
    ['touchstart', 'wheel', 'pointerdown', 'keydown'].forEach(type =>
      window.addEventListener(type, releaseSpy, { passive: true, capture: true }));
    // Content can grow or shrink without scrolling (sync, collapsing a section)
    const container = document.getElementById('mainContainer');
    if (container && window.ResizeObserver) new ResizeObserver(scheduleSpy).observe(container);
    if (bar && window.ResizeObserver) new ResizeObserver(() => moveIndicator(false)).observe(bar);

    setActiveSection(SECTIONS[0], false);
    scheduleSpy();

    // Deep links: "#section-health", or the steps link of the iOS Shortcut (phones and
    // tablets). The sections fill in after the first render (js/app.js), so jump only then.
    const fromHash = /^#section-([a-z]+)$/.exec(window.location.hash || '');
    const hashTarget = fromHash && SECTIONS.includes(fromHash[1]) ? fromHash[1] : null;
    if (hashTarget || openedWithStepsLink) {
      window.addEventListener('dashboard:rendered', () => {
        if (hashTarget) scrollToSection(hashTarget, { smooth: false });
        else if (isTouchLayout()) scrollToSection('health', { smooth: false });
      }, { once: true });
    }
    // A "#section-…" link while the page is open (same document: no reload, no render)
    window.addEventListener('hashchange', () => {
      const m = /^#section-([a-z]+)$/.exec(window.location.hash || '');
      if (m && SECTIONS.includes(m[1])) scrollToSection(m[1], { smooth: false });
    });
  }

  // ===================================================== App bar actions

  function syncSubtitle() {
    const status = document.getElementById('syncStatus');
    const state = status ? status.dataset.syncState : '';
    if (state === 'error') return 'Sync problem';
    if (state === 'pending') return 'Changes waiting to upload';
    return '';
  }

  function moreMenu() {
    const call = (name) => () => { if (typeof window[name] === 'function') window[name](); };
    return {
      items: [
        // A setting that is on or off: checkmark (HIG Menus, toggled items)
        { id: 'dark-mode', label: 'Dark Mode', checked: document.body.classList.contains('dark'), role: 'menuitemcheckbox', onSelect: call('toggleDark') },
        '-',
        { id: 'focus-mode', label: 'Focus Mode', icon: 'focus', onSelect: call('enterFocusMode') },
        { id: 'sync', label: 'Sync & Backup', icon: 'cloud', subtitle: syncSubtitle(), onSelect: call('showSyncDetails') },
        '-',
        { id: 'sign-out', label: 'Sign Out', icon: 'signOut', destructive: true, onSelect: call('signOut') }
      ]
    };
  }

  function setupAppBar() {
    const add = document.getElementById('appBarAdd');
    if (add) add.addEventListener('click', () => { if (typeof window.quickCapture === 'function') window.quickCapture(); });
    const more = document.getElementById('appBarMore');
    if (more) more.addEventListener('click', () => showMenu(more, moreMenu()));
  }

  // ================================================================ Menus
  // Pull-down menu anchored to its button (iOS: a UIMenu from a "⋯" button). Modal while open:
  // a transparent layer takes the tap outside the menu, which only closes it.
  // config: { title, items: [item | '-'] }   ('-' separates groups)
  // item:   { id, label, subtitle, icon, checked, role, destructive, disabled, onSelect, submenu: config }

  let menuLayer = null;
  let menuCount = 0;
  let safeProbe = null;

  function safeInsets() {
    if (!safeProbe) return { top: 0, right: 0, bottom: 0, left: 0 };
    const cs = getComputedStyle(safeProbe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0
    };
  }

  function closeMenu() {
    if (!menuLayer) return;
    const layer = menuLayer;
    menuLayer = null;
    root.classList.remove('menu-open');
    document.removeEventListener('keydown', layer._onKey, true);
    window.removeEventListener('resize', layer._onResize);
    if (layer._anchor) layer._anchor.setAttribute('aria-expanded', 'false');
    layer.classList.remove('open');
    const restore = layer._anchor;
    const finish = () => {
      // Focus goes back to the button, unless the chosen action moved it (a dialog's field)
      const active = document.activeElement;
      const focusLost = !active || active === document.body || layer.contains(active);
      layer.remove();
      if (focusLost && restore && restore.isConnected) focusWithoutScroll(restore);
    };
    if (reducedMotion.matches) finish();
    else setTimeout(finish, 160);
  }

  function menuItems(menu) {
    return [...menu.querySelectorAll('.menu-item:not([disabled])')];
  }

  function positionMenu(layer) {
    const menu = layer.querySelector('.menu');
    const anchor = layer._anchor;
    if (!menu || !anchor || !anchor.isConnected) return;
    const margin = 8;
    const safe = safeInsets();
    const minX = margin + safe.left;
    const maxX = window.innerWidth - margin - safe.right;
    const minY = margin + safe.top;
    const maxY = window.innerHeight - margin - safe.bottom;
    const a = anchor.getBoundingClientRect();
    menu.style.maxHeight = `${Math.max(160, maxY - minY)}px`;
    const w = menu.offsetWidth;
    const h = Math.min(menu.scrollHeight, maxY - minY);
    // Trailing edges aligned when the button is in the right half, leading edges otherwise
    let x = a.left + a.width / 2 > window.innerWidth / 2 ? a.right - w : a.left;
    x = Math.max(minX, Math.min(x, maxX - w));
    const spaceBelow = maxY - (a.bottom + 6);
    const spaceAbove = (a.top - 6) - minY;
    let y;
    let origin;
    if (h <= spaceBelow || spaceBelow >= spaceAbove) {
      y = a.bottom + 6;
      origin = 'top';
    } else {
      y = a.top - 6 - h;
      origin = 'bottom';
    }
    // Inside the screen even if the button moved out of view (fold/unfold, rotation)
    y = Math.max(minY, Math.min(y, maxY - h));
    menu.style.left = `${Math.round(x)}px`;
    menu.style.top = `${Math.round(y)}px`;
    const ox = Math.max(0, Math.min(w, a.left + a.width / 2 - x));
    menu.style.transformOrigin = `${Math.round(ox)}px ${origin}`;
  }

  function focusFirst(menu, skipBack) {
    const items = menuItems(menu);
    const first = skipBack && items.length > 1 && items[0].classList.contains('menu-back') ? items[1] : items[0];
    if (first) focusWithoutScroll(first);
  }

  function buildMenu(layer, config, parent) {
    const menu = layer.querySelector('.menu');
    menu.textContent = '';
    menu.removeAttribute('aria-labelledby');
    menu.removeAttribute('aria-label');
    const items = (config.items || []).filter(Boolean);
    const leading = items.some(item => item !== '-' && (item.icon || item.checked !== undefined));

    if (parent) {
      // Submenu: its parent item as the header; tapping it goes back
      const back = el('button', 'menu-item menu-back');
      back.type = 'button';
      back.setAttribute('role', 'menuitem');
      back.appendChild(icon('chevronLeft'));
      back.appendChild(el('span', 'menu-text')).appendChild(el('span', 'menu-label', parent.label));
      back.addEventListener('click', () => {
        buildMenu(layer, parent.config, parent.grand);
        positionMenu(layer);
        focusFirst(menu, false);
      });
      menu.appendChild(back);
      menu.appendChild(el('div', 'menu-separator'));
      menu.setAttribute('aria-label', parent.label);
    } else if (config.title) {
      const title = el('div', 'menu-title', config.title);
      title.id = 'menuTitle' + (++menuCount);
      menu.setAttribute('aria-labelledby', title.id);
      menu.appendChild(title);
    } else {
      menu.setAttribute('aria-label', 'Actions');
    }

    items.forEach(item => {
      if (item === '-') {
        menu.appendChild(el('div', 'menu-separator'));
        return;
      }
      const btn = el('button', 'menu-item');
      btn.type = 'button';
      if (item.id) btn.dataset.action = item.id;
      if (item.destructive) btn.classList.add('destructive');
      if (item.disabled) btn.disabled = true;
      const role = item.role || (item.checked !== undefined ? 'menuitemradio' : 'menuitem');
      btn.setAttribute('role', role);
      if (role !== 'menuitem') btn.setAttribute('aria-checked', String(!!item.checked));
      // Leading column: checkmark for a selected option, else the item's symbol (or empty)
      if (leading) btn.appendChild(icon(item.checked ? 'checkmark' : (item.icon || '')));
      const text = el('span', 'menu-text');
      text.appendChild(el('span', 'menu-label', item.label));
      if (item.subtitle) text.appendChild(el('span', 'menu-subtitle', item.subtitle));
      btn.appendChild(text);
      if (item.submenu) {
        btn.setAttribute('aria-haspopup', 'menu');
        btn.appendChild(icon('chevronRight', 'menu-chevron'));
        btn.addEventListener('click', () => {
          buildMenu(layer, item.submenu, { label: item.label, config, grand: parent || null });
          positionMenu(layer);
          focusFirst(menu, true);
        });
      } else {
        btn.addEventListener('click', () => {
          closeMenu();
          // Run the action during the tap itself (not after the closing animation):
          // iOS opens the keyboard for a text field only within the user's gesture
          if (typeof item.onSelect === 'function') item.onSelect();
        });
      }
      menu.appendChild(btn);
    });
  }

  /** Opens a menu anchored to a button; actions run from the items' onSelect. */
  function showMenu(anchor, config) {
    if (menuLayer) closeMenu();
    const layer = el('div', 'menu-layer');
    layer.setAttribute('data-mobile-only', '');
    const backdrop = el('div', 'menu-backdrop');
    backdrop.addEventListener('click', closeMenu);
    const menu = el('div', 'menu');
    menu.setAttribute('role', 'menu');
    layer.append(backdrop, menu);
    layer._anchor = anchor;
    buildMenu(layer, config, null);

    layer._onKey = (e) => {
      const items = menuItems(menu);
      const index = items.indexOf(document.activeElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const back = menu.querySelector('.menu-back');
        if (back) back.click();
        else closeMenu();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        const next = items[(index + step + items.length) % items.length];
        if (next) focusWithoutScroll(next);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const next = e.key === 'Home' ? items[0] : items[items.length - 1];
        if (next) focusWithoutScroll(next);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        closeMenu();
      }
    };
    // After restoreAnchor() put the page back for the new width (next frames)
    layer._onResize = () => window.requestAnimationFrame(() => window.requestAnimationFrame(() => positionMenu(layer)));
    document.addEventListener('keydown', layer._onKey, true);
    window.addEventListener('resize', layer._onResize);
    document.body.appendChild(layer);
    menuLayer = layer;
    root.classList.add('menu-open');
    anchor.setAttribute('aria-expanded', 'true');
    positionMenu(layer);
    window.requestAnimationFrame(() => {
      layer.classList.add('open');
      focusFirst(menu, false);
    });
  }

  /** "⋯" button for a list item; only displayed on touch screens (css/mobile.css). */
  function moreButton(label, build) {
    const btn = el('button', 'item-more-btn');
    btn.type = 'button';
    btn.draggable = false;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.more}</svg>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showMenu(btn, build());
    });
    // The item's own double-click/right-click/drag handlers must not see these events
    ['dblclick', 'contextmenu', 'dragstart'].forEach(type => btn.addEventListener(type, (e) => e.stopPropagation()));
    return btn;
  }

  const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

  /** Menu item with a submenu to pick high/medium/low/none; onPick(valueOrNull). */
  function priorityMenu(current, onPick, label) {
    const title = label || 'Priority';
    return {
      id: title.toLowerCase(),
      label: title,
      icon: 'flag',
      subtitle: PRIORITY_LABELS[current] || 'None',
      submenu: {
        items: ['high', 'medium', 'low', null].map(value => ({
          id: 'priority-' + (value || 'none'),
          label: value ? PRIORITY_LABELS[value] : 'None',
          checked: (current || null) === value,
          onSelect: () => onPick(value)
        }))
      }
    };
  }

  // ============================================== Reading position on resize
  // When the width changes (unfolding an iPhone Duo, rotating, resizing a split view)
  // the layout reflows and the same scrollY points at different content. Remember the
  // first visible block while scrolling and put it back at the same screen position.

  const ANCHOR_SELECTOR = [
    '.page-section h2', '.glass-panel', '.gym-card', '.list-panel',
    '.kanban-column', '.habit-row', '.step-block', '.calendar-agenda'
  ].join(',');
  let anchor = null;
  let lastWidth = window.innerWidth;
  let captureTimer = null;

  // Prefers the first block that starts on screen (its top edge is what the eye follows);
  // falls back to the block that is cut off at the top edge (under the app bar).
  function captureAnchor() {
    anchor = null;
    let partial = null;
    const candidates = document.querySelectorAll(ANCHOR_SELECTOR);
    const viewHeight = window.innerHeight;
    const top = isTouchLayout() ? appBarBottom() : 0;
    for (let i = 0; i < candidates.length; i++) {
      const node = candidates[i];
      const r = node.getBoundingClientRect();
      if (r.height === 0 || r.bottom <= top + 8) continue;
      if (r.top >= top && r.top < viewHeight) {
        anchor = { el: node, top: r.top };
        return;
      }
      if (!partial && r.top < top) partial = { el: node, top: r.top };
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

  // ===================================================== Visible viewport
  // iOS keeps the layout viewport when the keyboard opens; alerts centre themselves in the
  // part that is still visible (css/mobile.css).

  function setupVisualViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
      root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  }

  // ============================================================ Theme colour

  function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta || !document.body) return;
    const dark = document.body.classList.contains('dark');
    // Touch layout: iOS grouped background; desktop: the dashboard background
    const color = isTouchLayout() ? (dark ? '#000000' : '#f2f2f7') : (dark ? '#0f172a' : '#f0f2f5');
    meta.setAttribute('content', color);
  }

  // ================================================================== Start

  function start() {
    // The floating mini timer sits inside the Today section in the HTML; as a direct child
    // of <body> it stays visible while scrolling through the other sections
    const pip = document.getElementById('pipTimer');
    if (pip && pip.parentElement !== document.body) document.body.appendChild(pip);
    // env(safe-area-inset-*) in px for placing menus (not readable from JS directly)
    safeProbe = el('div', 'safe-area-probe');
    safeProbe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(safeProbe);
    applyTouchLayout();
    onMediaChange(layoutMedia, applyTouchLayout);
    setupSections();
    setupAppBar();
    setupAnchoring();
    setupVisualViewport();
    syncThemeColor();
    new MutationObserver(syncThemeColor).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  window.MobileUI = {
    TOUCH_LAYOUT_QUERY: TOUCH_LAYOUT_QUERY,
    SECTIONS: SECTIONS,
    isTouchLayout: isTouchLayout,
    isTouch: isTouch,
    currentSection: () => activeSection,
    scrollToSection: scrollToSection,
    showMenu: showMenu,
    closeMenu: closeMenu,
    moreButton: moreButton,
    priorityMenu: priorityMenu,
    PRIORITY_LABELS: PRIORITY_LABELS
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
