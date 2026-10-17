/*
 * Calendar entry editor and calendar list (own calendars with colours).
 *
 * Phones and tablets: sheets that slide up from the bottom (iOS page sheet: close and confirm
 * buttons in the header, swipe down to dismiss, "Discard Changes" when something was edited).
 * Desktop: the same content as a centred dialog. Both use the native <dialog> element (focus
 * stays inside, Escape closes, the page behind is inert) and native form controls, so iOS shows
 * its own date and time pickers, pop-up menus and switch.
 *
 * Data rules: js/calendar-core.js. Saving and rendering: saveCalendarEntry,
 * deleteCalendarEntry and db.getCalendars/setCalendars in js/app.js.
 */
(function () {
  'use strict';

  const Core = window.CalendarCore;
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const SVG = {
    xmark: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    checkmark: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chevronLeft: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    chevronRight: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    upDown: '<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };

  let uid = 0;
  const nextId = (prefix) => `${prefix}-${++uid}`;

  function svg(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SVG[name]}</svg>`;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach(child => { if (child) node.appendChild(child); });
    return node;
  }

  function focusWithoutScroll(node) {
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  function toInputDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function fromInputDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) || d.getDate() !== Number(m[3]) ? null : d;
  }

  // A calendar's colour as --dot; data-color names it, so css/calendar.css can give white an
  // edge on white
  function colorName(color) {
    return Core.COLORS.includes(color) ? color : Core.DEFAULT_CALENDAR.color;
  }

  function colorAttrs(color) {
    return { style: `--dot: var(--cal-${colorName(color)})`, 'data-color': colorName(color) };
  }

  function isTouchLayout() {
    return !!(window.MobileUI && window.MobileUI.isTouchLayout());
  }

  // ================================================================ Sheet
  // <dialog> with a header (leading button, title, trailing button), a scrolling body and an
  // inline confirmation (an action sheet inside the sheet: a separate overlay would sit
  // behind the dialog, which is in the browser's top layer).

  function createSheet(opts) {
    const titleId = nextId('sheet-title');
    const dialog = el('dialog', { class: `sheet-dialog ${opts.className || ''}`, 'aria-labelledby': titleId });
    const form = el('form', { class: 'sheet', novalidate: true });
    const grabber = el('div', { class: 'sheet-grabber', 'aria-hidden': 'true' });
    const leading = el('button', { type: 'button', class: 'sheet-btn sheet-leading' });
    const title = el('h2', { class: 'sheet-title', id: titleId });
    const trailing = el('button', { type: 'submit', class: 'sheet-btn sheet-trailing prominent' });
    const header = el('header', { class: 'sheet-header' }, [leading, title, trailing]);
    const body = el('div', { class: 'sheet-body' });

    const confirmMessage = el('p', { class: 'sheet-confirm-message', id: nextId('sheet-confirm-msg') });
    const confirmAction = el('button', { type: 'button', class: 'sheet-confirm-btn destructive' });
    const confirmCancel = el('button', { type: 'button', class: 'sheet-confirm-btn sheet-confirm-cancel' });
    const confirmPanel = el('div', {
      class: 'sheet-confirm-panel', role: 'alertdialog', 'aria-modal': 'true', 'aria-describedby': confirmMessage.id
    }, [el('div', { class: 'sheet-confirm-group' }, [confirmMessage, confirmAction]), confirmCancel]);
    const confirm = el('div', { class: 'sheet-confirm', hidden: true }, [confirmPanel]);

    form.append(grabber, header, body, confirm);
    dialog.appendChild(form);
    document.body.appendChild(dialog);

    const sheet = { dialog, form, header, title, body, leading, trailing, confirm, opener: null, closing: null };

    sheet.setButton = (btn, kind, label) => {
      // iOS 26 sheets: symbol buttons (xmark / checkmark / chevron); label for VoiceOver
      btn.innerHTML = svg(kind) + `<span class="sheet-btn-label">${label}</span>`;
      btn.setAttribute('aria-label', label);
      btn.dataset.kind = kind;
    };

    sheet.ask = (message, actionLabel, cancelLabel) => new Promise(resolve => {
      confirmMessage.textContent = message;
      confirmAction.textContent = actionLabel;
      confirmCancel.textContent = cancelLabel || 'Cancel';
      confirm.hidden = false;
      dialog.classList.add('confirming');
      const done = (result) => {
        confirm.hidden = true;
        dialog.classList.remove('confirming');
        confirmAction.onclick = confirmCancel.onclick = confirm.onclick = null;
        sheet.answer = null;
        resolve(result);
      };
      sheet.answer = done;
      confirmAction.onclick = () => done(true);
      confirmCancel.onclick = () => done(false);
      confirm.onclick = (e) => { if (e.target === confirm) done(false); };
      focusWithoutScroll(confirmCancel);
    });

    // Escape: close the confirmation first, then ask the owner (it may want to confirm)
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (sheet.answer) sheet.answer(false);
      else if (sheet.onDismiss) sheet.onDismiss();
    });
    // Tap on the dimmed page next to the desktop dialog
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog && !sheet.answer && sheet.onDismiss) sheet.onDismiss();
    });
    enableSwipeToDismiss(sheet, grabber, header);
    return sheet;
  }

  function openSheet(sheet, opener) {
    if (sheet.dialog.open) return;
    sheet.opener = opener || document.activeElement;
    sheet.confirm.hidden = true;
    sheet.dialog.classList.remove('confirming', 'open');
    sheet.dialog.style.transform = '';
    if (window.MobileUI) window.MobileUI.closeMenu();
    sheet.dialog.showModal();
    sheet.body.scrollTop = 0;
    root.classList.add('dialog-open');
    // Next frame: the slide-in transition starts from the closed position
    window.requestAnimationFrame(() => sheet.dialog.classList.add('open'));
  }

  function closeSheet(sheet) {
    if (!sheet.dialog.open) return Promise.resolve();
    if (sheet.closing) return sheet.closing;
    sheet.dialog.classList.remove('open');
    sheet.dialog.style.transform = '';
    let resolveClosed;
    const closed = new Promise(resolve => { resolveClosed = resolve; });
    // Set before finish() can run: without the animation it runs right away and clears it
    sheet.closing = closed;
    const finish = () => {
      sheet.dialog.close();
      sheet.closing = null;
      if (!document.querySelector('dialog[open]')) root.classList.remove('dialog-open');
      // Taps do not focus buttons on iOS: give focus back to the opener explicitly. The
      // browser returns it only to an opener that is still there; until its focus fixup the
      // focus may still sit in the closed dialog (the opener was rebuilt meanwhile)
      const active = document.activeElement;
      if ((!active || active === document.body || sheet.dialog.contains(active)) && sheet.opener && sheet.opener.isConnected) {
        focusWithoutScroll(sheet.opener);
      }
      resolveClosed();
    };
    if (reducedMotion.matches || !isTouchLayout()) finish();
    else setTimeout(finish, 280);
    return closed;
  }

  // Drag the sheet down by its grabber or header to dismiss it (touch layout only)
  function enableSwipeToDismiss(sheet, ...handles) {
    let startY = null;
    let startTime = 0;
    let lastY = 0;
    const onDown = (e) => {
      if (!isTouchLayout() || e.button > 0 || sheet.answer) return;
      if (e.target.closest('button, input, select, textarea, a')) return;
      startY = e.clientY;
      lastY = e.clientY;
      startTime = Date.now();
      sheet.dialog.classList.add('dragging');
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    };
    const onMove = (e) => {
      if (startY === null) return;
      lastY = e.clientY;
      const dy = Math.max(0, lastY - startY);
      sheet.dialog.style.transform = `translateY(${dy}px)`;
    };
    const onUp = () => {
      if (startY === null) return;
      const dy = Math.max(0, lastY - startY);
      const velocity = dy / Math.max(1, Date.now() - startTime);
      startY = null;
      sheet.dialog.classList.remove('dragging');
      sheet.dialog.style.transform = '';
      if ((dy > 120 || (dy > 40 && velocity > 0.6)) && sheet.onDismiss) sheet.onDismiss();
    };
    handles.forEach(handle => {
      handle.addEventListener('pointerdown', onDown);
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  }

  // Form rows (inset grouped list in the touch layout)
  function group(...rows) {
    return el('div', { class: 'form-group' }, rows);
  }

  function row(labelText, control, extra) {
    const field = control.matches('input, select, textarea') ? control : control.querySelector('input, select, textarea');
    const id = field.id || (field.id = nextId('field'));
    const label = el('label', { class: 'form-label', for: id, text: labelText });
    return el('div', Object.assign({ class: 'form-row' }, extra || {}), [label, control]);
  }

  // Pop-up button (HIG): a native <select>, iOS opens its own menu with a checkmark
  function popup(select, dot) {
    return el('span', { class: 'form-popup' }, [dot, select, el('span', { class: 'form-popup-icon', html: svg('upDown') })]);
  }

  // ========================================================= Entry editor

  let editor = null;

  function buildEditor() {
    const sheet = createSheet({ className: 'event-editor' });
    const f = {};
    f.title = el('input', {
      class: 'form-input', type: 'text', name: 'title', placeholder: 'Title', 'aria-label': 'Title',
      autocomplete: 'off', enterkeyhint: 'done', maxlength: '500'
    });
    f.allDay = el('input', { class: 'form-switch', type: 'checkbox', switch: true, name: 'allDay', role: 'switch' });
    f.date = el('input', { class: 'form-control', type: 'date', name: 'date', required: true });
    f.start = el('input', { class: 'form-control', type: 'time', name: 'start' });
    f.end = el('input', { class: 'form-control', type: 'time', name: 'end' });
    f.calendarDot = el('span', { class: 'calendar-dot', 'aria-hidden': 'true' });
    f.calendar = el('select', { class: 'form-select', name: 'calendar' });
    f.priority = el('select', { class: 'form-select', name: 'priority' });
    [['', 'None'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']].forEach(([value, text]) =>
      f.priority.appendChild(el('option', { value, text })));
    f.endError = el('p', { class: 'form-message', id: nextId('end-error'), role: 'alert', hidden: true, text: 'The end time is before the start time.' });
    f.delete = el('button', { type: 'button', class: 'form-row form-row-button destructive', text: 'Delete Event' });
    f.startRow = row('Starts', f.start, { 'data-timed': '' });
    f.endRow = row('Ends', f.end, { 'data-timed': '' });
    f.deleteGroup = group(f.delete);

    sheet.body.append(
      group(el('div', { class: 'form-row' }, [f.title])),
      group(row('All-day', f.allDay), row('Date', f.date), f.startRow, f.endRow),
      f.endError,
      group(row('Calendar', popup(f.calendar, f.calendarDot)), row('Priority', popup(f.priority, null))),
      f.deleteGroup
    );
    sheet.setButton(sheet.leading, 'xmark', 'Cancel');
    editor = { sheet, f, state: null };

    f.title.addEventListener('input', updateEditor);
    // Touch keyboards: "Done" only hides the keyboard (time and calendar may follow)
    f.title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && isTouchLayout()) {
        e.preventDefault();
        f.title.blur();
      }
    });
    f.allDay.addEventListener('change', () => {
      if (!f.allDay.checked && (!Core.normalizeTime(f.start.value) || !Core.normalizeTime(f.end.value))) {
        const times = Core.defaultTimes(fromInputDate(f.date.value) || new Date(), new Date());
        f.start.value = times.start;
        f.end.value = times.end;
      }
      editor.state.lastStart = f.start.value;
      updateEditor();
    });
    f.start.addEventListener('change', () => {
      // Moving the start keeps the duration (as in Apple Calendar)
      const shifted = Core.shiftEnd(editor.state.lastStart, f.end.value, f.start.value);
      if (shifted) f.end.value = shifted;
      editor.state.lastStart = f.start.value;
      updateEditor();
    });
    [f.date, f.end, f.priority].forEach(control => control.addEventListener('change', updateEditor));
    f.end.addEventListener('input', updateEditor);
    f.calendar.addEventListener('change', updateEditor);
    sheet.form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveEditor();
    });
    sheet.leading.addEventListener('click', dismissEditor);
    sheet.onDismiss = dismissEditor;
    f.delete.addEventListener('click', async () => {
      const ok = await sheet.ask(`“${editor.state.original.text}” will be deleted.`, 'Delete Event');
      if (!ok) return;
      deleteCalendarEntry(editor.state.fromDate, editor.state.index, editor.state.original);
      closeSheet(sheet);
    });
  }

  function readEditor() {
    const f = editor.f;
    return {
      text: f.title.value,
      allDay: f.allDay.checked,
      date: f.date.value,
      start: f.start.value,
      end: f.end.value,
      calendarId: f.calendar.value,
      priority: f.priority.value || null
    };
  }

  function snapshot(values) {
    // Times of an all-day entry do not count as a change
    const v = Object.assign({}, values);
    v.text = (v.text || '').trim();
    if (v.allDay) { v.start = ''; v.end = ''; }
    return JSON.stringify(v);
  }

  function checkEditor() {
    const values = readEditor();
    const date = fromInputDate(values.date);
    const built = Core.buildEntry(values, editor.state.original);
    return { values, date, built, ok: !!date && built.ok };
  }

  function updateEditor() {
    const f = editor.f;
    const timed = !f.allDay.checked;
    f.startRow.hidden = !timed;
    f.endRow.hidden = !timed;
    const calendars = db.getCalendars();
    const calendar = calendars.find(c => c.id === f.calendar.value) || calendars[0];
    f.calendarDot.style.setProperty('--dot', `var(--cal-${colorName(calendar.color)})`);
    f.calendarDot.dataset.color = colorName(calendar.color);
    const check = checkEditor();
    const endWrong = timed && check.built.error === 'end' && !!Core.normalizeTime(f.end.value);
    f.end.setAttribute('aria-invalid', String(endWrong));
    f.endError.hidden = !endWrong;
    if (endWrong) f.end.setAttribute('aria-describedby', f.endError.id);
    else f.end.removeAttribute('aria-describedby');
    editor.sheet.trailing.disabled = !check.ok;
  }

  /**
   * Opens the editor. opts: { date, index?, entry? } - without index a new entry for that day.
   * Must run inside the tap/click handler: iOS opens the keyboard only during the gesture.
   */
  function openEditor(opts) {
    if (!editor) buildEditor();
    const { sheet, f } = editor;
    const date = opts && opts.date instanceof Date ? opts.date : new Date();
    const isNew = !opts || opts.index === undefined || opts.index === null;
    const original = isNew ? null : Object.assign({}, typeof opts.entry === 'string' ? { text: opts.entry, done: false, priority: null } : opts.entry);
    editor.state = { fromDate: isNew ? null : date, index: isNew ? null : opts.index, original };

    const calendars = db.getCalendars();
    f.calendar.textContent = '';
    calendars.forEach(c => f.calendar.appendChild(el('option', { value: c.id, text: c.name })));
    const calendar = original ? Core.calendarOf(calendars, original) : calendars[0];
    f.calendar.value = calendar.id;

    f.title.value = original ? original.text : '';
    f.date.value = toInputDate(date);
    const timed = !!(original && Core.isTimed(original));
    f.allDay.checked = !timed;
    if (timed) {
      f.start.value = Core.normalizeTime(original.start);
      f.end.value = Core.normalizeTime(original.end) || Core.shiftEnd(null, null, original.start);
    } else {
      f.start.value = '';
      f.end.value = '';
    }
    editor.state.lastStart = f.start.value;
    f.priority.value = (original && original.priority) || '';
    f.deleteGroup.hidden = isNew;
    sheet.title.textContent = isNew ? 'New Event' : 'Edit Event';
    sheet.setButton(sheet.trailing, 'checkmark', isNew ? 'Add' : 'Done');
    updateEditor();
    editor.state.initial = snapshot(readEditor());

    openSheet(sheet, opts && opts.returnFocus);
    // New entry: straight into the title, as in Apple Calendar. Editing on a touch screen
    // does not open the keyboard by itself; with a keyboard the title is ready to type.
    if (isNew || !isTouchLayout()) f.title.focus();
  }

  async function dismissEditor() {
    const { sheet } = editor;
    if (!sheet.dialog.open || sheet.answer) return;
    if (snapshot(readEditor()) !== editor.state.initial) {
      const discard = await sheet.ask('Do you want to discard your changes?', 'Discard Changes', 'Keep Editing');
      if (!discard) return;
    }
    closeSheet(sheet);
  }

  function saveEditor() {
    const check = checkEditor();
    if (!check.ok) {
      updateEditor();
      if (!check.values.text.trim()) editor.f.title.focus();
      return;
    }
    const { state, sheet } = editor;
    saveCalendarEntry({ fromDate: state.fromDate, index: state.index, original: state.original, date: check.date, entry: check.built.entry });
    closeSheet(sheet);
  }

  // ========================================================= Calendar list

  let manager = null;

  function countEntries(calendarId) {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('cal-')) continue;
      try {
        const tasks = JSON.parse(localStorage.getItem(key)) || [];
        n += tasks.filter(t => t && typeof t === 'object' && t.calendarId === calendarId).length;
      } catch (e) { /* skip unreadable day */ }
    }
    return n;
  }

  function buildManager() {
    const sheet = createSheet({ className: 'calendar-manager' });
    const list = el('div', { class: 'form-group calendar-list', role: 'list' });
    const add = el('button', { type: 'button', class: 'form-row form-row-button tinted', html: `${svg('plus')}<span>Add Calendar</span>` });
    const listView = el('div', { class: 'sheet-view' }, [list, group(add)]);

    const name = el('input', { class: 'form-input', type: 'text', name: 'name', placeholder: 'Calendar Name', 'aria-label': 'Calendar name', autocomplete: 'off', maxlength: '60', enterkeyhint: 'done' });
    const colors = el('div', { class: 'form-group color-list', role: 'radiogroup', 'aria-label': 'Color' });
    const del = el('button', { type: 'button', class: 'form-row form-row-button destructive', text: 'Delete Calendar' });
    const delGroup = group(del);
    const editView = el('div', { class: 'sheet-view', hidden: true }, [
      group(el('div', { class: 'form-row' }, [name])),
      el('h3', { class: 'form-group-title', text: 'Color', 'aria-hidden': 'true' }),
      colors,
      delGroup
    ]);
    Core.COLORS.forEach(color => {
      const radio = el('input', { type: 'radio', name: 'color', value: color, class: 'color-radio' });
      colors.appendChild(el('label', { class: 'form-row color-row' }, [
        radio,
        el('span', Object.assign({ class: 'calendar-dot', 'aria-hidden': 'true' }, colorAttrs(color))),
        el('span', { class: 'color-name', text: Core.COLOR_LABELS[color] }),
        el('span', { class: 'row-check', html: svg('checkmark') })
      ]));
    });
    sheet.body.append(listView, editView);
    manager = { sheet, list, listView, editView, name, colors, del, delGroup, editing: null };

    add.addEventListener('click', () => showCalendarForm(null));
    name.addEventListener('input', updateManager);
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && isTouchLayout()) {
        e.preventDefault();
        name.blur();
      }
    });
    colors.addEventListener('change', updateManager);
    sheet.leading.addEventListener('click', () => (manager.editing ? leaveCalendarForm() : closeSheet(sheet)));
    sheet.onDismiss = () => (manager.editing ? leaveCalendarForm() : closeSheet(sheet));
    sheet.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (manager.editing) saveCalendarForm();
      else closeSheet(sheet);
    });
    del.addEventListener('click', async () => {
      const cal = manager.editing.calendar;
      const n = countEntries(cal.id);
      const fallback = db.getCalendars()[0].name;
      const message = n
        ? `“${cal.name}” will be deleted. Its ${n} ${n === 1 ? 'event moves' : 'events move'} to “${fallback}”.`
        : `“${cal.name}” will be deleted.`;
      if (!(await sheet.ask(message, 'Delete Calendar'))) return;
      // Entries keep the id; an unknown calendar id means the default calendar (calendar-core.js)
      db.setCalendars(db.getCalendars().filter(c => c.id !== cal.id));
      refreshCalendarViews();
      showCalendarList();
    });
  }

  function refreshCalendarViews() {
    try { renderCalendar(); } catch (e) { console.error(e); }
    try { renderKanban(); } catch (e) { console.error(e); }
  }

  function showCalendarList() {
    const { sheet, list } = manager;
    manager.editing = null;
    manager.listView.hidden = false;
    manager.editView.hidden = true;
    sheet.title.textContent = 'Calendars';
    sheet.setButton(sheet.leading, 'xmark', 'Close');
    sheet.setButton(sheet.trailing, 'checkmark', 'Done');
    sheet.trailing.disabled = false;
    sheet.leading.hidden = true; // one way out, as in Apple Calendar: Done
    list.textContent = '';
    db.getCalendars().forEach(cal => {
      const btn = el('button', { type: 'button', class: 'form-row calendar-row', role: 'listitem', 'data-calendar': cal.id }, [
        el('span', Object.assign({ class: 'calendar-dot', 'aria-hidden': 'true' }, colorAttrs(cal.color))),
        el('span', { class: 'calendar-row-name', text: cal.name }),
        el('span', { class: 'calendar-row-color', text: Core.COLOR_LABELS[cal.color] }),
        el('span', { class: 'row-chevron', html: svg('chevronRight') })
      ]);
      btn.setAttribute('aria-label', `${cal.name}, ${Core.COLOR_LABELS[cal.color]}. Edit`);
      btn.addEventListener('click', () => showCalendarForm(cal));
      list.appendChild(btn);
    });
  }

  function showCalendarForm(calendar) {
    const { sheet, name, colors } = manager;
    const used = db.getCalendars().map(c => c.color);
    // A new calendar gets the first colour not used yet
    const color = calendar ? calendar.color : (Core.COLORS.find(c => !used.includes(c)) || Core.COLORS[0]);
    manager.editing = { calendar, initial: JSON.stringify([calendar ? calendar.name : '', color]) };
    manager.listView.hidden = true;
    manager.editView.hidden = false;
    sheet.title.textContent = calendar ? 'Edit Calendar' : 'Add Calendar';
    sheet.leading.hidden = false;
    sheet.setButton(sheet.leading, 'chevronLeft', 'Calendars');
    sheet.setButton(sheet.trailing, 'checkmark', 'Done');
    name.value = calendar ? calendar.name : '';
    colors.querySelectorAll('.color-radio').forEach(radio => { radio.checked = radio.value === color; });
    manager.delGroup.hidden = !calendar || calendar.id === Core.DEFAULT_ID;
    sheet.body.scrollTop = 0;
    updateManager();
    if (!calendar) name.focus();
  }

  function formValues() {
    const checked = manager.colors.querySelector('.color-radio:checked');
    return { name: manager.name.value.trim(), color: checked ? checked.value : Core.DEFAULT_CALENDAR.color };
  }

  function updateManager() {
    if (!manager.editing) return;
    manager.sheet.trailing.disabled = !formValues().name;
  }

  async function leaveCalendarForm() {
    const { sheet } = manager;
    if (sheet.answer) return;
    const v = formValues();
    if (JSON.stringify([v.name, v.color]) !== manager.editing.initial) {
      if (!(await sheet.ask('Do you want to discard your changes?', 'Discard Changes', 'Keep Editing'))) return;
    }
    showCalendarList();
  }

  function saveCalendarForm() {
    const v = formValues();
    if (!v.name) return;
    const calendars = db.getCalendars();
    const editing = manager.editing.calendar;
    if (editing) {
      const cal = calendars.find(c => c.id === editing.id);
      if (cal) Object.assign(cal, v);
      else calendars.push(Object.assign({ id: editing.id }, v)); // deleted on another device meanwhile
    } else {
      calendars.push(Object.assign({ id: Core.newCalendarId(calendars) }, v));
    }
    db.setCalendars(calendars);
    refreshCalendarViews();
    showCalendarList();
    focusWithoutScroll(manager.sheet.trailing);
  }

  function openCalendars(opts) {
    if (!manager) buildManager();
    showCalendarList();
    openSheet(manager.sheet, opts && opts.returnFocus);
  }

  window.CalendarUI = { openEditor, openCalendars };
  // The same sheets and form rows for other editors (js/matrix-ui.js)
  window.SheetUI = { createSheet, openSheet, closeSheet, group, row, popup, el, svg, isTouchLayout, nextId };
})();
