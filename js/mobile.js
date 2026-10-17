/*
 * Phone, tablet and foldable support (iPhone, iPhone Duo folded and unfolded, iPad).
 *
 * - Touch layout on touch screens narrower than 1100 CSS px (html.touch-layout). The page is
 *   one continuous scroll (Week, Today, Health, Habits, Lists - the calendar first, the focus
 *   timer after today's goals); the floating section bar at the bottom marks the section on
 *   screen and jumps to a section when tapped. A finger on the bar lifts the selection into a
 *   glass lens that can be dragged to a section (as in iOS 26).
 *   The desktop layout (mouse/trackpad, or 1100px and wider) is not affected.
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
  // In the order of the page in the touch layout (placeTouchOrder), the only layout with the
  // section bar
  const SECTIONS = ['week', 'today', 'health', 'habits', 'lists'];

  const root = document.documentElement;
  const layoutMedia = window.matchMedia(TOUCH_LAYOUT_QUERY);
  const touchMedia = window.matchMedia('(hover: none)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
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

  // On phones and tablets the Step Challenge comes first in the Health Hub, above the hero
  // row; on the desktop it stays below it. The card is moved in the DOM rather than reordered
  // with CSS `order`, so VoiceOver and the keyboard follow the order on screen.
  function placeStepCard() {
    const card = document.getElementById('stepChallenge');
    const header = document.querySelector('#section-health .gym-hub-header');
    const content = document.getElementById('gymHubContent');
    if (!card || !header || !content) return;
    const focused = card.contains(document.activeElement) ? document.activeElement : null;
    if (isTouchLayout()) {
      if (header.nextElementSibling !== card) header.after(card);
    } else if (content.previousElementSibling !== card) {
      content.before(card);
    }
    // Moving a node takes the focus out of it
    if (focused && document.activeElement !== focused) focusWithoutScroll(focused);
  }

  // Phones and tablets: Calendar, Weekly Overview, Today's Goals, Focus. The order is set by
  // window.placePageOrder (inline in index.html, so it is right before the first paint); this
  // keeps it when the layout changes. Moving a node takes the focus out of it.
  function placeTouchOrder() {
    if (typeof window.placePageOrder !== 'function') return;
    const focused = document.activeElement;
    window.placePageOrder();
    if (focused && focused !== document.body && document.activeElement !== focused) focusWithoutScroll(focused);
  }

  function applyTouchLayout() {
    const was = isTouchLayout();
    root.classList.toggle('touch-layout', layoutMedia.matches);
    placeStepCard();
    placeTouchOrder();
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

  // The selection pill reaches this far past its item on both sides: at the ends of the bar
  // up to the bar's padding, as in the iOS 26 tab bar (the items are inset by as much)
  const PILL_OUTSET = 4;

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
    indicator.style.width = `${tabBox.width + 2 * PILL_OUTSET}px`;
    indicator.style.transform = `translateX(${tabBox.left - barBox.left - bar.clientLeft - PILL_OUTSET}px)`;
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
    // An open sheet holds the page (lockPage): its scroll position is not where the person
    // reads, and the bar keeps the section from before
    if (!isTouchLayout() || spyLocked || pageLocked()) return;
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

  // =================================================== Section bar: glass lens
  // As in the iOS 26 tab bar, a finger on the bar lifts the selection into a Liquid Glass lens:
  // it follows the finger, magnifies the items under it and refracts at its rim, while the bar
  // swells a little and lights up under the finger. On release it drops onto the nearest
  // section. A tap still selects through the link's click (as the keyboard, VoiceOver and
  // Switch Control do); a drag selects on release. Apple says Liquid Glass reacts to touch in
  // real time but documents neither this lens nor numbers for it: sizes and timings below are
  // measured from a screen recording of an iOS 26 tab bar.
  // The lens shows copies of the items (aria-hidden, css/mobile.css) and is moved by springs
  // integrated per frame; with Reduce Motion they settle without overshoot, stretch or swell.

  const LENS = {
    grow: 1.22,        // lifted lens: 1.22 x the width of the selection ...
    overhang: 3.5,     // ... and 3.5px taller than the bar above and below
    magnify: 0.15,     // items under the lens: 1.15 x
    rimWidth: 0.1,     // rim: 10% of the lens height; items seen through it ...
    rimShrink: 0.08,   // ... 0.92 x (so the bar's edge and the page beyond it show in the rim),
    dispersion: 0.045, // ... with the colour channels 4.5% apart
    swell: 14,         // the bar grows by about 14px in width while touched
    slop: 8            // px a finger moves before a touch counts as a drag
  };
  // [response (s), damping fraction], as SwiftUI's spring(response:dampingFraction:).
  // A tap takes about 0.3s from touch to resting selection, as in the recording.
  const SPRINGS = {
    lead: [0.12, 0.82],    // the edge on the side the lens moves to ...
    trail: [0.22, 0.86],   // ... and the other one: the lens stretches, then catches up
    dragLead: [0.07, 0.9], // under a moving finger: close behind it
    dragTrail: [0.14, 0.9],
    rest: [0.18, 0.82],
    lift: [0.16, 0.7],     // lifting overshoots a little
    drop: [0.2, 0.9],
    reduced: [0.12, 1]
  };
  const SPRING_STEP = 1 / 240;

  const lens = {
    bar: null, items: null, node: null, glow: null, views: [],
    geo: null,          // layout of the bar, measured on the first touch
    active: false,      // lens on screen (lifted, moving or dropping)
    pressed: false, dragging: false, dropping: false,
    pointerId: null, startX: 0, fingerX: 0, touched: null,
    pendingTap: null, pendingTimer: 0, suppressClick: false, suppressTimer: 0,
    left: { x: 0, v: 0 }, right: { x: 0, v: 0 }, lift: { x: 0, v: 0 },
    scale: 1,           // swelling of the bar
    releasedAt: 0, frame: 0, last: 0, candidate: null
  };

  function springTo(state, target, spec, dt) {
    const stiffness = Math.pow(2 * Math.PI / spec[0], 2);
    const damping = 4 * Math.PI * spec[1] / spec[0];
    state.v += (stiffness * (target - state.x) - damping * state.v) * dt;
    state.x += state.v * dt;
  }

  // Copy of the items for the lens, laid out like the real ones. Seen through the rim, the
  // copies also show the bar's edge and the page around the bar (refracted into the lens).
  function lensCopy(cls) {
    const view = el('span', cls ? 'tabbar-lens-view ' + cls : 'tabbar-lens-view');
    if (cls) view.append(el('span', 'tabbar-lens-page'), el('span', 'tabbar-lens-edge'));
    const copy = el('span', 'tabbar-items-copy');
    lens.items.querySelectorAll('.mobile-tab').forEach(tab => {
      const item = el('span', 'tabbar-lens-tab');
      item.dataset.section = tab.dataset.section;
      tab.childNodes.forEach(n => item.appendChild(n.cloneNode(true)));
      copy.appendChild(item);
    });
    view.appendChild(copy);
    return view;
  }

  function buildLens(bar) {
    lens.items = bar.querySelector('.tabbar-items');
    if (!lens.items) return;
    lens.bar = bar;
    lens.glow = el('span', 'tabbar-glow');
    lens.glow.setAttribute('aria-hidden', 'true');
    bar.insertBefore(lens.glow, lens.items);
    const node = el('span', 'tabbar-lens');
    node.setAttribute('aria-hidden', 'true');
    const ring = el('span', 'tabbar-lens-ring');
    const core = el('span', 'tabbar-lens-core');
    lens.views = ['r', 'g', 'b'].map(channel => ({ node: ring.appendChild(lensCopy('channel-' + channel)), channel }));
    lens.views.push({ node: core.appendChild(lensCopy()), channel: null });
    node.append(el('span', 'tabbar-lens-pill'), el('span', 'tabbar-lens-fill'), ring, core, el('span', 'tabbar-lens-rim'));
    bar.appendChild(node);
    lens.node = node;
    bar.classList.add('lens-ready');
  }

  // Layout in px of the bar's padding box, without the swelling
  function measureLens() {
    const bar = lens.bar;
    const box = bar.getBoundingClientRect();
    if (!box.width) return null;
    const scale = lens.scale;
    const style = getComputedStyle(bar);
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const x = v => (v - box.left) / scale - borderLeft;
    const y = v => (v - box.top) / scale - borderTop;
    const tabs = [];
    lens.items.querySelectorAll('.mobile-tab').forEach(tab => {
      const r = tab.getBoundingClientRect();
      if (r.width) tabs.push({ name: tab.dataset.section, center: x(r.left + r.width / 2), width: r.width / scale });
    });
    if (!tabs.length) return null;
    const items = lens.items.getBoundingClientRect();
    const height = box.height / scale - borderTop - (parseFloat(style.borderBottomWidth) || 0);
    const width = box.width / scale - borderLeft - (parseFloat(style.borderRightWidth) || 0);
    const indicator = bar.querySelector('.tabbar-indicator');
    const pillW = tabs[0].width + 2 * PILL_OUTSET;
    const geo = {
      tabs, width, height, borderLeft, cy: height / 2,
      outerWidth: box.width / scale, outerHeight: box.height / scale,
      pillW, pillH: indicator && indicator.offsetHeight ? indicator.offsetHeight : height - 8,
      lensW: pillW * LENS.grow, lensH: height + 2 * LENS.overhang,
      items: { left: x(items.left), top: y(items.top), width: items.width / scale, height: items.height / scale }
    };
    const place = (node, left, top, w, h) => {
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
    };
    lens.views.forEach(v => {
      place(v.node.querySelector('.tabbar-items-copy'), geo.items.left, geo.items.top, geo.items.width, geo.items.height);
      v.node.querySelectorAll('.tabbar-lens-page, .tabbar-lens-edge').forEach(n =>
        place(n, -borderLeft, -borderTop, geo.outerWidth, geo.outerHeight));
    });
    return geo;
  }

  function lensTab(name) {
    return lens.geo.tabs.find(t => t.name === name) || lens.geo.tabs[0];
  }

  function nearestLensTab(x) {
    return lens.geo.tabs.reduce((best, t) => (Math.abs(t.center - x) < Math.abs(best.center - x) ? t : best));
  }

  // Lens centre for a finger position: over the items, with a little give past both ends
  function dragCenter(x) {
    const tabs = lens.geo.tabs;
    const first = tabs[0].center;
    const last = tabs[tabs.length - 1].center;
    const give = d => 18 * d / (d + 54);
    if (x < first) return first - give(first - x);
    if (x > last) return last + give(x - last);
    return x;
  }

  function lensTarget() {
    if (lens.pressed) return lens.dragging ? dragCenter(lens.fingerX) : lensTab(lens.touched).center;
    return lensTab(lens.pendingTap || activeSection).center;
  }

  function renderLens() {
    const g = lens.geo;
    const lift = Math.max(0, lens.lift.x);
    const lifted = Math.min(lift, 1);
    const left = lens.left.x;
    const width = Math.max(1, lens.right.x - left);
    const center = left + width / 2;
    // Stretched by the springs: a little flatter (not with Reduce Motion)
    const stretch = reducedMotion.matches ? 0
      : Math.min(Math.max(width / (g.pillW + (g.lensW - g.pillW) * lifted) - 1, -0.3), 0.6);
    const height = (g.pillH + (g.lensH - g.pillH) * lift) * (1 - 0.18 * stretch);
    const top = g.cy - height / 2;
    // Reduce Transparency: a frosted lens without the see-through rim (css/mobile.css)
    const rim = reducedTransparency.matches ? 0 : height * LENS.rimWidth * lifted;
    const bar = lens.bar;
    bar.style.setProperty('--lift', lifted.toFixed(4));
    lens.scale = reducedMotion.matches ? 1 : 1 + LENS.swell / g.width * lift;
    bar.style.transform = lens.scale === 1 ? '' : `translateX(-50%) scale(${lens.scale})`;
    const node = lens.node.style;
    node.width = `${width}px`;
    node.height = `${height}px`;
    node.transform = `translate(${left}px, ${top}px)`;
    node.setProperty('--lw', `${width}px`);
    node.setProperty('--lh', `${height}px`);
    node.setProperty('--rw', `${rim}px`);
    // A point p of the bar appears at  (centre of the layer) + scale * (p - centre of the lens)
    const magnify = 1 + LENS.magnify * lift;
    const shrink = 1 - LENS.rimShrink * lifted;
    const spread = LENS.dispersion * lifted;
    lens.views.forEach(v => {
      const scale = !v.channel ? magnify : shrink + (v.channel === 'r' ? -spread : v.channel === 'b' ? spread : 0);
      const cx = v.channel ? width / 2 : width / 2 - rim;  // the middle layer is inset by the rim
      const cy = v.channel ? height / 2 : height / 2 - rim;
      v.node.style.transform = `translate(${cx - scale * center}px, ${cy - scale * g.cy}px) scale(${scale})`;
    });
    const items = lens.items.style;
    items.setProperty('--hole-x', `${left - g.items.left}px`);
    items.setProperty('--hole-y', `${top - g.items.top}px`);
    items.setProperty('--hole-w', `${width}px`);
    items.setProperty('--hole-h', `${height}px`);
    lens.glow.style.setProperty('--glow-x', `${lens.pressed ? lens.fingerX : center}px`);
    // Selected look: while dragging the item under the lens, else the item it is heading for
    const candidate = lens.dragging ? nearestLensTab(center).name
      : lens.pressed ? lens.touched : lens.pendingTap || activeSection;
    if (candidate !== lens.candidate) {
      lens.candidate = candidate;
      lens.node.querySelectorAll('.tabbar-lens-core .tabbar-lens-tab').forEach(t =>
        t.classList.toggle('candidate', t.dataset.section === candidate));
    }
  }

  function lensFrame(now) {
    lens.frame = 0;
    if (!lens.active) return;
    const dt = Math.min(0.05, Math.max(0, (now - lens.last) / 1000));
    lens.last = now;
    const g = lens.geo;
    const reduced = reducedMotion.matches;
    const target = lensTarget();
    const current = (lens.left.x + lens.right.x) / 2;
    // After release the lens stays up until it (nearly) arrived, then drops into the selection
    if (!lens.pressed && !lens.dropping && (Math.abs(target - current) < 2 || now - lens.releasedAt > 160)) lens.dropping = true;
    const liftTarget = lens.dropping ? 0 : 1;
    const half = (g.pillW + (g.lensW - g.pillW) * Math.min(Math.max(lens.lift.x, 0), 1)) / 2;
    const toward = target - current;
    const leads = lens.dragging ? SPRINGS.dragLead : SPRINGS.lead;
    const trails = lens.dragging ? SPRINGS.dragTrail : SPRINGS.trail;
    const edge = side => (reduced ? SPRINGS.reduced
      : Math.abs(toward) < 2 ? SPRINGS.rest : side * toward > 0 ? leads : trails);
    const leftSpring = edge(-1);
    const rightSpring = edge(1);
    const liftSpring = reduced ? SPRINGS.reduced : liftTarget > lens.lift.x ? SPRINGS.lift : SPRINGS.drop;
    for (let t = dt; t > 0; t -= SPRING_STEP) {
      const h = Math.min(SPRING_STEP, t);
      springTo(lens.left, target - half, leftSpring, h);
      springTo(lens.right, target + half, rightSpring, h);
      springTo(lens.lift, liftTarget, liftSpring, h);
    }
    renderLens();
    const settled = lens.dropping && Math.abs(lens.lift.x) < 0.002 && Math.abs(lens.lift.v) < 0.02 &&
      Math.abs(lens.left.x - (target - half)) < 0.2 && Math.abs(lens.right.x - (target + half)) < 0.2 &&
      Math.abs(lens.left.v) < 4 && Math.abs(lens.right.v) < 4;
    if (settled) endLens();
    else lens.frame = window.requestAnimationFrame(lensFrame);
  }

  function startLens() {
    if (!lens.active) {
      // Starts as the resting selection
      const home = lensTab(activeSection);
      lens.left = { x: home.center - lens.geo.pillW / 2, v: 0 };
      lens.right = { x: home.center + lens.geo.pillW / 2, v: 0 };
      lens.lift = { x: 0, v: 0 };
      lens.candidate = null;
      lens.active = true;
      renderLens();
      lens.bar.classList.remove('lens-settling');
      lens.bar.classList.add('lens-active');
    }
    if (!lens.frame) {
      lens.last = performance.now();
      lens.frame = window.requestAnimationFrame(lensFrame);
    }
  }

  // Back to the resting selection, exactly where the lens dropped
  function endLens() {
    if (lens.frame) window.cancelAnimationFrame(lens.frame);
    lens.frame = 0;
    lens.pressed = false;
    lens.dragging = false;
    if (!lens.active) return;
    lens.active = false;
    lens.dropping = false;
    const bar = lens.bar;
    bar.classList.add('lens-settling'); // the real item takes the selection colour at once
    bar.classList.remove('lens-active');
    bar.style.removeProperty('transform');
    bar.style.removeProperty('--lift');
    lens.scale = 1;
    moveIndicator(false);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (!lens.active) bar.classList.remove('lens-settling');
    }));
  }

  // The bar changed size (rotation, fold, split view): measure again on the next touch.
  // Window resizes that leave the bar as it is (Safari's toolbar) do not interrupt the lens.
  function resetLens(force) {
    if (!lens.geo) return;
    const bar = lens.bar;
    if (force !== true && Math.abs(bar.offsetWidth - lens.geo.outerWidth) < 1 &&
        Math.abs(bar.offsetHeight - lens.geo.outerHeight) < 1) return;
    lens.geo = null;
    endLens();
  }

  function lensX(e) {
    return (e.clientX - lens.bar.getBoundingClientRect().left) / lens.scale - lens.geo.borderLeft;
  }

  function onLensDown(e) {
    if (!isTouchLayout() || lens.pressed || !e.isPrimary || e.button !== 0) return;
    if (!lens.geo) lens.geo = measureLens();
    if (!lens.geo) return;
    clearTimeout(lens.pendingTimer);
    clearTimeout(lens.suppressTimer);
    lens.pendingTap = null;
    lens.suppressClick = false;
    const tab = e.target.closest('.mobile-tab');
    lens.pressed = true;
    lens.dragging = false;
    lens.dropping = false;
    lens.pointerId = e.pointerId;
    lens.startX = lens.fingerX = lensX(e);
    lens.touched = tab ? tab.dataset.section : nearestLensTab(lens.fingerX).name;
    startLens();
  }

  function onLensMove(e) {
    if (!lens.pressed || e.pointerId !== lens.pointerId) return;
    lens.fingerX = lensX(e);
    if (!lens.dragging && Math.abs(lens.fingerX - lens.startX) > LENS.slop) {
      lens.dragging = true;
      // Keep the moves coming when the finger leaves the bar
      try { lens.bar.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    }
  }

  function onLensUp(e) {
    if (!lens.pressed || e.pointerId !== lens.pointerId) return;
    lens.fingerX = lensX(e);
    lens.pressed = false;
    lens.releasedAt = performance.now();
    if (lens.dragging) {
      lens.dragging = false;
      // A drag selects on release; a click the browser may still send is not a second choice
      lens.suppressClick = true;
      lens.suppressTimer = setTimeout(() => { lens.suppressClick = false; }, 500);
      const name = nearestLensTab(dragCenter(lens.fingerX)).name;
      if (name !== activeSection) scrollToSection(name, { focus: true });
    } else {
      // A tap selects through the click that follows; until then the lens heads for the tab
      lens.pendingTap = lens.touched;
      lens.pendingTimer = setTimeout(() => { lens.pendingTap = null; }, 400);
    }
  }

  // The system took the touch (or the window lost focus): back to the selection, no choice
  function onLensCancel(e) {
    if (!lens.pressed || (e && e.pointerId !== undefined && e.pointerId !== lens.pointerId)) return;
    lens.pressed = false;
    lens.dragging = false;
    lens.releasedAt = performance.now();
  }

  function setupLens(bar) {
    buildLens(bar);
    if (!lens.bar) return;
    bar.addEventListener('pointerdown', onLensDown);
    bar.addEventListener('pointermove', onLensMove);
    bar.addEventListener('pointerup', onLensUp);
    bar.addEventListener('pointercancel', onLensCancel);
    bar.addEventListener('lostpointercapture', (e) => { if (e.target === bar) onLensCancel(e); });
    // Long press: no link menu (Android) while the lens is up
    bar.addEventListener('contextmenu', (e) => { if (lens.pressed) e.preventDefault(); });
    window.addEventListener('blur', () => onLensCancel());
    document.addEventListener('visibilitychange', () => { if (document.hidden) endLens(); });
    window.addEventListener('dashboard:layoutchange', () => resetLens(true));
  }

  // A click between the items or at the rounded ends of the bar counts for the nearest item
  function clickedTab(bar, e) {
    const tab = e.target.closest('.mobile-tab');
    if (tab) return tab;
    let nearest = null;
    let distance = Infinity;
    bar.querySelectorAll('.tabbar-items > .mobile-tab').forEach(t => {
      const r = t.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - e.clientX);
      if (d < distance) {
        nearest = t;
        distance = d;
      }
    });
    return nearest;
  }

  function setupSections() {
    const bar = document.getElementById('mobileTabbar');
    if (bar) {
      bar.addEventListener('click', (e) => {
        const tab = clickedTab(bar, e);
        if (!tab) return;
        e.preventDefault(); // no "#section-…" in the address bar; the bar shows where we are
        if (lens.suppressClick) { // the drag already chose
          lens.suppressClick = false;
          return;
        }
        lens.pendingTap = null;
        scrollToSection(tab.dataset.section, { focus: true });
      });
      setupLens(bar);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', () => { if (spyLocked) unlockSoon(0); });
    window.addEventListener('resize', () => {
      scheduleSpy();
      resetLens();
      window.requestAnimationFrame(() => moveIndicator(false));
    });
    // The person scrolls (or types) again: the bar follows the content again
    ['touchstart', 'wheel', 'pointerdown', 'keydown'].forEach(type =>
      window.addEventListener(type, releaseSpy, { passive: true, capture: true }));
    // Content can grow or shrink without scrolling (sync, collapsing a section)
    const container = document.getElementById('mainContainer');
    if (container && window.ResizeObserver) new ResizeObserver(scheduleSpy).observe(container);
    if (bar && window.ResizeObserver) {
      new ResizeObserver(() => {
        resetLens();
        moveIndicator(false);
      }).observe(bar);
    }

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

  // ================================================== Page held behind a sheet
  // While a sheet is open the page behind it keeps its place (js/calendar-ui.js holds it).
  // overflow: hidden only stops the person from scrolling it, not the browser: iOS scrolls the
  // page to reveal a focused field, and that scroll stayed after the sheet closed (another
  // section on screen). A fixed body (css/mobile.css) has nothing to scroll; --page-lock-top
  // keeps it where it was on screen, and its scroll position comes back on release. Touch
  // layout only: the desktop dialog has no keyboard to make room for.

  let lockedScroll = null;

  function lockPage() {
    if (lockedScroll !== null || !isTouchLayout()) return;
    lockedScroll = window.scrollY;
    root.style.setProperty('--page-lock-top', `${-lockedScroll}px`);
    root.classList.add('page-locked');
  }

  function unlockPage() {
    if (lockedScroll === null) return;
    const y = lockedScroll;
    lockedScroll = null;
    root.classList.remove('page-locked');
    root.style.removeProperty('--page-lock-top');
    window.scrollTo(0, y);
  }

  function pageLocked() {
    return lockedScroll !== null;
  }

  // The page's scroll position, also while it is held
  function pageScrollY() {
    return pageLocked() ? lockedScroll : window.scrollY;
  }

  function scrollPageBy(dy) {
    if (!pageLocked()) {
      window.scrollBy(0, dy);
      return;
    }
    const max = Math.max(0, document.body.scrollHeight - window.innerHeight);
    lockedScroll = Math.min(max, Math.max(0, lockedScroll + dy));
    root.style.setProperty('--page-lock-top', `${-lockedScroll}px`);
  }

  // ============================================== Reading position on resize
  // When the width changes (unfolding an iPhone Duo, rotating, resizing a split view)
  // the layout reflows and the same scrollY points at different content. Remember the
  // first visible block while scrolling and put it back at the same screen position
  // (also behind a sheet: the page is held, so only this code moves it).

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
      // Not the cards scrolled out sideways (the week's day cards on phones): the eye
      // follows the day on screen
      if (r.right <= 0 || r.left >= window.innerWidth) continue;
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
    if (pageScrollY() < 4) return; // at the top: nothing to keep
    const active = document.activeElement;
    // A field on the page: the keyboard handles this (a held page has its fields in the sheet)
    if (!pageLocked() && active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    const saved = anchor;
    if (!saved || !saved.el.isConnected) return;
    const r = saved.el.getBoundingClientRect();
    if (r.height === 0) return;
    scrollPageBy(Math.round(r.top - saved.top));
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
    lockPage: lockPage,
    unlockPage: unlockPage,
    showMenu: showMenu,
    closeMenu: closeMenu,
    moreButton: moreButton,
    priorityMenu: priorityMenu,
    PRIORITY_LABELS: PRIORITY_LABELS
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
