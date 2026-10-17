/*
 * Matrix in the Lists section: four areas (to do, up next, waiting, ideas) with tasks.
 *
 * Panel: the title (touch screens: "⋯" with Move Up / Move Down, like a list; desktop: drag it
 * like a list) and the areas as cards in two columns. A card: its title (opens the area), "+"
 * (new task) and its open tasks; a circle ticks a task off, the text opens it.
 * Area sheet: the title with a pencil to rename it, the open tasks, done ones under
 * "Completed", and a large "Add Task" button in the area's colour.
 * Task sheet: text, note, due date (Today / Tomorrow / Custom), repeat; when editing also the
 * area and Delete. Sheets: window.SheetUI (js/calendar-ui.js) - iOS page sheets on phones and
 * tablets, a dialog on the desktop.
 *
 * Data rules: js/matrix-core.js. Storage, order and sync in js/app.js: the items of list
 * "matrix" (getListItems/setListItems) and its entry in the list order (listMeta/saveListMeta,
 * moveList).
 */
(function () {
  'use strict';

  const Core = window.MatrixCore;
  const S = window.SheetUI;
  const el = S.el;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const CARD_LIMIT = 6; // open tasks shown on a card; all of them in the area sheet

  // Shapes after SF Symbols: flame, calendar and bolt filled, the rest as outlines
  const ICONS = {
    todo: '<path class="fill" d="M12.4 2.2c.5 2.7-.9 4.4-2.4 6C8.4 9.9 7 11.6 7 14.4 7 18 9.5 21 12.6 21c3.3 0 5.7-2.8 5.7-6.4 0-2.4-1.1-4.4-2.7-5.9-.2 1.4-.9 2.4-2 3 .5-3.6-.2-7.1-1.2-9.5z"/>',
    next: '<path class="fill" d="M8 2.25a1 1 0 0 1 1 1V4h6v-.75a1 1 0 1 1 2 0V4h.75A3.25 3.25 0 0 1 21 7.25V9H3V7.25A3.25 3.25 0 0 1 6.25 4H7v-.75a1 1 0 0 1 1-1zM3 10.5h18v7.25A3.25 3.25 0 0 1 17.75 21H6.25A3.25 3.25 0 0 1 3 17.75V10.5zm4 2.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5z"/>',
    waiting: '<path class="fill" d="M13.6 2.1 4.8 13.4c-.4.5 0 1.2.6 1.2h5.4l-1.4 7c-.1.7.8 1.1 1.2.5l8.6-11.4c.4-.5 0-1.2-.6-1.2h-5.3l1.6-6.9c.2-.7-.8-1.1-1.3-.5z"/>',
    ideas: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle class="fill" cx="4.75" cy="6.5" r="1.1"/><circle class="fill" cx="4.75" cy="12" r="1.1"/><circle class="fill" cx="4.75" cy="17.5" r="1.1"/>',
    matrix: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    pencil: '<path d="M4 20l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M13.5 7.5l3 3"/>',
    repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11.5V10a4 4 0 0 1 4-4h12"/><path d="M7 21l-3-3 3-3"/><path d="M20 12.5V14a4 4 0 0 1-4 4H4"/>',
    note: '<path d="M5 6.5h14M5 12h14M5 17.5h9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    sunrise: '<path d="M7.5 17.5a4.5 4.5 0 0 1 9 0"/><path d="M3 21h18M3.5 17.5h1.5M19 17.5h1.5M6 11.5l1 1M18 11.5l-1 1M12 3v6M9.5 5.5 12 3l2.5 2.5"/>',
    calendarPlus: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13.5v4.5M9.75 15.75h4.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'
  };

  function icon(name, cls) {
    return el('span', { class: cls || 'matrix-icon', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" focusable="false">${ICONS[name]}</svg>` });
  }

  // ===================================================================== Data

  function today() {
    return Core.dayKey(new Date());
  }

  function entry() {
    return listMeta().find(Core.isMatrix) || Core.defaultEntry();
  }

  function tasks() {
    return Core.normalizeTasks(getListItems(Core.MATRIX_ID));
  }

  // The matrix is stored in the list order with its first change (until then it is shown at
  // the top without being stored, so a new device takes the order from the cloud)
  function keepEntry() {
    if (!db.get('customListsMeta', []).some(Core.isMatrix)) saveListMeta(listMeta());
  }

  function saveTasks(next) {
    keepEntry();
    setListItems(Core.MATRIX_ID, next);
    refresh();
  }

  function saveEntry(next) {
    saveListMeta(listMeta().map(e => (Core.isMatrix(e) ? next : e)));
    refresh();
  }

  function areaTitle(areaId) {
    return Core.areaTitle(entry(), areaId);
  }

  function countLabel(n) {
    return n === 1 ? '1 open task' : `${n} open tasks`;
  }

  // ==================================================================== Panel

  let panelState = { index: 0, count: 1 };

  /** The panel for the list grid (js/app.js renderUnifiedLists); index/count place it. */
  function panel(matrixEntry, index, count) {
    panelState = { index, count };
    const node = el('section', { class: 'matrix-panel', 'data-list-id': Core.MATRIX_ID, 'aria-labelledby': 'matrixTitle' });
    fillPanel(node, Core.normalizeEntry(matrixEntry));
    // A sync re-renders the lists: an open area sheet shows the new state too
    if (area && area.sheet.dialog.open && !area.editing) fillArea();
    return node;
  }

  function fillPanel(node, matrixEntry) {
    const all = tasks();
    const head = el('header', { class: 'matrix-head' }, [
      el('div', { class: 'list-drag-handle', title: 'Drag to reorder', text: '⋮⋮', 'aria-hidden': 'true' }),
      el('h3', { class: 'matrix-title', id: 'matrixTitle' }, [icon('matrix'), el('span', { text: matrixEntry.title })])
    ]);
    if (window.MobileUI) {
      const { index, count } = panelState;
      const more = MobileUI.moreButton(`Actions for ${matrixEntry.title}`, () => ({
        title: matrixEntry.title,
        items: [
          { id: 'up', label: 'Move Up', icon: 'arrowUp', disabled: index === 0, onSelect: () => moveList(Core.MATRIX_ID, -1) },
          { id: 'down', label: 'Move Down', icon: 'arrowDown', disabled: index === count - 1, onSelect: () => moveList(Core.MATRIX_ID, 1) }
        ]
      }));
      more.classList.add('matrix-more-btn');
      head.appendChild(more);
    }
    const grid = el('div', { class: 'matrix-grid' }, matrixEntry.areas.map(area => areaCard(area, all)));
    node.replaceChildren(head, grid);
  }

  function areaCard(area, all) {
    const open = Core.openTasks(all, area.id);
    const name = el('span', { class: 'matrix-area-name', text: area.title });
    const opener = el('button', {
      type: 'button', class: 'matrix-area-open', 'aria-haspopup': 'dialog',
      'aria-label': `${area.title}, ${countLabel(open.length)}`, 'data-focus': `open-${area.id}`
    }, [icon(area.id, 'matrix-area-icon'), name, icon('chevron', 'matrix-chevron')]);
    opener.addEventListener('click', () => openArea(area.id, opener));
    const add = el('button', {
      type: 'button', class: 'matrix-area-add', 'aria-label': `Add task to ${area.title}`, 'data-focus': `add-${area.id}`,
      html: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS.plus}</svg>`
    });
    add.addEventListener('click', () => openTask({ area: area.id, returnFocus: add }));
    const list = el('ul', { class: 'matrix-tasks' }, open.slice(0, CARD_LIMIT).map(taskRow));
    const card = el('section', { class: 'matrix-area', 'data-area': area.id, 'aria-label': area.title }, [
      el('div', { class: 'matrix-area-head' }, [opener, add]),
      list
    ]);
    if (open.length > CARD_LIMIT) {
      const more = el('button', { type: 'button', class: 'matrix-show-all', 'aria-haspopup': 'dialog', text: `${open.length - CARD_LIMIT} more` });
      more.addEventListener('click', () => openArea(area.id, more));
      card.appendChild(more);
    }
    return card;
  }

  // A task: the circle ticks it off, the rest opens it
  function taskRow(task) {
    const due = Core.dueInfo(task.due, today());
    const check = el('button', {
      type: 'button', class: 'matrix-check', role: 'checkbox', 'aria-checked': String(task.done),
      'aria-label': task.text, 'data-focus': `check-${task.id}`
    });
    check.addEventListener('click', () => toggleTask(task.id, check));
    const meta = el('span', { class: 'matrix-task-meta' });
    if (due) meta.appendChild(el('span', { class: `matrix-due${due.overdue ? ' is-overdue' : ''}${due.today ? ' is-today' : ''}`, text: due.label }));
    if (task.repeat) meta.appendChild(el('span', { class: 'matrix-repeat', title: Core.REPEAT_LABELS[task.repeat] }, [icon('repeat', 'matrix-meta-icon'), el('span', { class: 'sheet-btn-label', text: Core.REPEAT_LABELS[task.repeat] })]));
    if (task.note) meta.appendChild(icon('note', 'matrix-meta-icon'));
    const main = el('button', { type: 'button', class: 'matrix-task-main', 'aria-haspopup': 'dialog', 'data-focus': `edit-${task.id}` }, [
      el('span', { class: 'matrix-task-text', text: task.text }),
      meta.childNodes.length ? meta : null
    ]);
    main.addEventListener('click', () => openTask({ task, returnFocus: main }));
    const row = el('li', { class: `matrix-task${task.done ? ' done' : ''}`, 'data-task-id': task.id }, [check, main]);
    if (window.SwipeActions) window.SwipeActions.enable(row, { label: task.text, remove: () => swipeRemove(task.id) });
    return row;
  }

  // Swipe to delete (js/swipe.js): the same as "Delete Task" in the task's sheet; false when
  // the task is gone already
  function swipeRemove(id) {
    const list = tasks();
    if (!list.some(t => t.id === id)) return false;
    saveTasks(Core.removeTask(list, id));
    return true;
  }

  // Rebuilds the panel and an open area sheet after a change; the focus stays on the same
  // control, or moves to the next task / the area's "+" when its task left the list
  function refresh(focusFallback) {
    const node = document.querySelector('.matrix-panel');
    const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focus : null;
    if (node) {
      const meta = listMeta();
      panelState = { index: meta.findIndex(Core.isMatrix), count: meta.length };
      fillPanel(node, Core.normalizeEntry(entry()));
    }
    if (area && area.sheet.dialog.open) fillArea();
    const scope = area && area.sheet.dialog.open ? area.sheet.dialog : node;
    if (!scope || (document.activeElement && document.activeElement !== document.body && document.activeElement.isConnected)) return;
    const target = (focusKey && scope.querySelector(`[data-focus="${focusKey}"]`)) ||
      (focusFallback && scope.querySelector(`[data-focus="${focusFallback}"]`));
    if (target) target.focus({ preventScroll: true });
  }

  // =================================================================== Ticking

  function toggleTask(id, check) {
    const row = check.closest('.matrix-task');
    if (!row || row.classList.contains('completing')) return;
    const current = tasks().find(t => t.id === id);
    if (!current) return;
    const result = Core.toggle(current, today());
    const leaves = !current.done; // open task: done or moved on to its next day
    if (leaves && typeof sounds !== 'undefined') sounds.success(); // js/app.js
    // Next control to focus when this row leaves the list
    const next = row.nextElementSibling && row.nextElementSibling.querySelector('.matrix-check');
    const areaEl = check.closest('[data-area]');
    const fallback = next ? next.dataset.focus : (areaEl ? `add-${areaEl.dataset.area}` : null);
    const apply = () => {
      const fresh = tasks();
      if (!fresh.some(t => t.id === id)) return refresh(fallback);
      saveTasksKeepingFocus(Core.replaceTask(fresh, Object.assign({}, result.task)), fallback);
    };
    if (!leaves || reducedMotion.matches) return apply();
    row.classList.add('completing');
    check.setAttribute('aria-checked', 'true');
    setTimeout(apply, 350);
  }

  function saveTasksKeepingFocus(next, fallback) {
    keepEntry();
    setListItems(Core.MATRIX_ID, next);
    refresh(fallback);
  }

  // A change rebuilds the panel: a sheet that closes gives the focus back to the same control
  // in the new panel, or to the add button of the area when that control is gone
  function retarget(sheet, areaId) {
    const inArea = area && area.sheet !== sheet && area.sheet.dialog.open;
    const scope = inArea ? area.sheet.dialog : document;
    const key = sheet.opener && sheet.opener.dataset ? sheet.opener.dataset.focus : null;
    const fresh = (key && scope.querySelector(`[data-focus="${key}"]`)) ||
      scope.querySelector(`[data-focus="${inArea ? 'add-big' : `add-${areaId}`}"]`);
    if (fresh) sheet.opener = fresh;
  }

  // ================================================================ Area sheet

  let area = null;

  function buildArea() {
    const sheet = S.createSheet({ className: 'matrix-sheet matrix-area-sheet' });
    sheet.setButton(sheet.leading, 'xmark', 'Close');
    sheet.trailing.hidden = true;
    sheet.leading.addEventListener('click', () => S.closeSheet(sheet));
    sheet.onDismiss = () => S.closeSheet(sheet);
    sheet.form.addEventListener('submit', (e) => e.preventDefault());

    const titleIcon = el('span', { class: 'matrix-sheet-icon', 'aria-hidden': 'true' });
    const title = el('h3', { class: 'matrix-sheet-title' });
    const input = el('input', {
      class: 'matrix-sheet-input', type: 'text', maxlength: String(Core.MAX_TITLE), 'aria-label': 'Area name',
      autocomplete: 'off', enterkeyhint: 'done', hidden: true
    });
    const count = el('span', { class: 'matrix-count' });
    const rename = el('button', {
      type: 'button', class: 'matrix-rename', 'data-focus': 'rename',
      html: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS.pencil}</svg>`
    });
    const openList = el('ul', { class: 'matrix-tasks matrix-sheet-list' });
    const empty = el('p', { class: 'matrix-empty', text: 'No open tasks' });
    const doneTitle = el('h4', { class: 'form-group-title matrix-done-title', text: 'Completed' });
    const clear = el('button', { type: 'button', class: 'matrix-clear', text: 'Clear', 'data-focus': 'clear' });
    const doneList = el('ul', { class: 'matrix-tasks matrix-sheet-list matrix-done-list' });
    const doneGroup = el('div', { class: 'matrix-done' }, [el('div', { class: 'matrix-done-head' }, [doneTitle, clear]), doneList]);
    const addBig = el('button', { type: 'button', class: 'matrix-add-big', 'data-focus': 'add-big' }, [icon('plus', 'matrix-add-icon'), el('span', { text: 'Add Task' })]);
    const footer = el('div', { class: 'matrix-sheet-footer' }, [addBig]);
    sheet.body.append(el('div', { class: 'matrix-sheet-head' }, [titleIcon, title, input, count, rename]), openList, empty, doneGroup);
    sheet.form.insertBefore(footer, sheet.confirm);

    area = { sheet, areaId: null, titleIcon, title, input, count, rename, openList, empty, doneGroup, doneList, clear, addBig, editing: false };

    rename.addEventListener('click', startRename);
    title.addEventListener('click', startRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishRename(true);
      } else if (e.key === 'Escape') {
        e.preventDefault(); // cancels the rename, not the sheet
        e.stopPropagation();
        finishRename(false);
      }
    });
    input.addEventListener('blur', () => finishRename(true));
    addBig.addEventListener('click', () => openTask({ area: area.areaId, returnFocus: addBig }));
    clear.addEventListener('click', async () => {
      const n = Core.doneTasks(tasks(), area.areaId).length;
      const ok = await sheet.ask(n === 1 ? 'The completed task will be deleted.' : `The ${n} completed tasks will be deleted.`, 'Clear Completed');
      if (ok) saveTasksKeepingFocus(Core.clearDone(tasks(), area.areaId), 'add-big');
    });
  }

  function fillArea() {
    const a = area;
    const all = tasks();
    const name = areaTitle(a.areaId);
    const open = Core.openTasks(all, a.areaId);
    const done = Core.doneTasks(all, a.areaId);
    a.sheet.dialog.dataset.area = a.areaId;
    a.sheet.title.textContent = name;
    a.titleIcon.replaceChildren(icon(a.areaId, 'matrix-area-icon'));
    if (!a.editing) a.title.textContent = name;
    a.count.textContent = String(open.length);
    a.count.setAttribute('aria-label', countLabel(open.length));
    a.rename.setAttribute('aria-label', `Rename ${name}`);
    a.openList.replaceChildren(...open.map(taskRow));
    a.empty.hidden = open.length > 0;
    a.doneGroup.hidden = done.length === 0;
    a.doneList.replaceChildren(...done.map(taskRow));
    a.addBig.setAttribute('aria-label', `Add task to ${name}`);
  }

  function openArea(areaId, opener) {
    if (!area) buildArea();
    area.areaId = areaId;
    area.editing = false;
    area.input.hidden = true;
    area.title.hidden = false;
    fillArea();
    S.openSheet(area.sheet, opener);
  }

  function startRename() {
    if (area.editing) return;
    area.editing = true;
    area.input.value = areaTitle(area.areaId);
    area.title.hidden = true;
    area.rename.hidden = true;
    area.input.hidden = false;
    area.input.focus();
    area.input.select();
  }

  function finishRename(save) {
    if (!area.editing) return;
    area.editing = false;
    const renamed = save ? Core.renameArea(entry(), area.areaId, area.input.value) : null;
    area.input.hidden = true;
    area.title.hidden = false;
    area.rename.hidden = false;
    if (renamed && Core.areaTitle(renamed, area.areaId) !== areaTitle(area.areaId)) saveEntry(renamed);
    else fillArea();
    area.rename.focus({ preventScroll: true });
  }

  // ================================================================ Task sheet

  let editor = null;

  function buildEditor() {
    const sheet = S.createSheet({ className: 'matrix-sheet matrix-task-sheet' });
    const f = {};
    f.titleIcon = el('span', { class: 'matrix-sheet-icon', 'aria-hidden': 'true' });
    f.titleText = el('span');
    sheet.title.replaceChildren(f.titleIcon, f.titleText);
    f.text = el('input', {
      class: 'form-input', type: 'text', name: 'text', placeholder: 'Enter a task', 'aria-label': 'Task',
      autocomplete: 'off', enterkeyhint: 'done', maxlength: String(Core.MAX_TEXT)
    });
    f.note = el('textarea', { class: 'form-input matrix-note', name: 'note', placeholder: 'Note (optional)', 'aria-label': 'Note', rows: '3' });
    f.chips = ['today', 'tomorrow', 'custom'].map(kind => {
      const labels = { today: ['sun', 'Today'], tomorrow: ['sunrise', 'Tomorrow'], custom: ['calendarPlus', 'Custom'] };
      const chip = el('button', { type: 'button', class: 'matrix-chip', 'aria-pressed': 'false', 'data-chip': kind }, [icon(labels[kind][0], 'matrix-chip-icon'), el('span', { text: labels[kind][1] })]);
      chip.addEventListener('click', () => pickDue(kind));
      return chip;
    });
    f.date = el('input', { class: 'form-control', type: 'date', name: 'due' });
    f.dateRow = S.row('Date', f.date);
    f.repeat = el('input', { class: 'form-switch', type: 'checkbox', switch: true, name: 'repeat', role: 'switch' });
    f.every = el('select', { class: 'form-select', name: 'every' });
    Core.REPEATS.forEach(r => f.every.appendChild(el('option', { value: r, text: Core.REPEAT_LABELS[r] })));
    f.everyRow = S.row('Frequency', S.popup(f.every, null));
    f.area = el('select', { class: 'form-select', name: 'area' });
    f.areaGroup = S.group(S.row('Area', S.popup(f.area, null)));
    f.delete = el('button', { type: 'button', class: 'form-row form-row-button destructive', text: 'Delete Task' });
    f.deleteGroup = S.group(f.delete);
    const dueHead = el('div', { class: 'form-row matrix-due-head' }, [icon('calendar', 'matrix-row-icon'), el('span', { class: 'form-label', id: S.nextId('due-label'), text: 'Due Date' })]);
    const chipRow = el('div', { class: 'matrix-chips', role: 'group', 'aria-labelledby': dueHead.lastChild.id }, f.chips);
    sheet.body.append(
      S.group(el('div', { class: 'form-row' }, [f.text])),
      S.group(el('div', { class: 'form-row matrix-note-row' }, [f.note])),
      el('div', { class: 'form-group matrix-due-group' }, [dueHead, chipRow, f.dateRow]),
      S.group(el('div', { class: 'form-row' }, [icon('repeat', 'matrix-row-icon'), el('label', { class: 'form-label', for: f.repeat.id || (f.repeat.id = S.nextId('repeat')), text: 'Repeat' }), f.repeat]), f.everyRow),
      f.areaGroup,
      f.deleteGroup
    );
    sheet.setButton(sheet.leading, 'xmark', 'Cancel');
    editor = { sheet, f, state: null };

    f.text.addEventListener('input', updateEditor);
    f.text.addEventListener('keydown', (e) => {
      // Touch keyboards: "Done" only hides the keyboard (note and date may follow)
      if (e.key === 'Enter' && S.isTouchLayout()) {
        e.preventDefault();
        f.text.blur();
      }
    });
    f.note.addEventListener('input', updateEditor);
    f.date.addEventListener('change', updateEditor);
    f.repeat.addEventListener('change', () => {
      if (f.repeat.checked && !Core.isDayKey(editor.state.due)) editor.state.due = today(); // repeating needs a day
      updateEditor();
    });
    f.every.addEventListener('change', updateEditor);
    f.area.addEventListener('change', updateEditor);
    sheet.form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveEditor();
    });
    sheet.leading.addEventListener('click', dismissEditor);
    sheet.onDismiss = dismissEditor;
    f.delete.addEventListener('click', async () => {
      const ok = await sheet.ask(`“${editor.state.task.text}” will be deleted.`, 'Delete Task');
      if (!ok) return;
      const { id, area: areaId } = editor.state.task;
      saveTasks(Core.removeTask(tasks(), id));
      retarget(sheet, areaId);
      S.closeSheet(sheet);
    });
  }

  // The due day: chips set it, "Custom" shows the date field
  function pickDue(kind) {
    const s = editor.state;
    const current = chipOf(s.due, s.custom);
    if (kind === current) {
      s.due = null; // tapping the selected chip again: no due date
      s.custom = false;
    } else if (kind === 'today') {
      s.due = today();
      s.custom = false;
    } else if (kind === 'tomorrow') {
      s.due = Core.addDays(today(), 1);
      s.custom = false;
    } else {
      s.custom = true;
      if (!Core.isDayKey(s.due)) s.due = Core.addDays(today(), 2);
    }
    if (!s.due) editor.f.repeat.checked = false;
    updateEditor();
    if (kind === 'custom' && s.custom) editor.f.date.focus();
  }

  function chipOf(due, custom) {
    if (!Core.isDayKey(due)) return null;
    if (custom) return 'custom';
    if (due === today()) return 'today';
    if (due === Core.addDays(today(), 1)) return 'tomorrow';
    return 'custom';
  }

  function readEditor() {
    const { f, state } = editor;
    if (state.custom && Core.isDayKey(f.date.value)) state.due = f.date.value;
    return {
      text: f.text.value,
      note: f.note.value,
      due: state.due || '',
      repeat: f.repeat.checked ? f.every.value : '',
      area: f.area.value || state.area
    };
  }

  function snapshot(values) {
    const v = Object.assign({}, values);
    v.text = (v.text || '').trim();
    v.note = (v.note || '').trim();
    return JSON.stringify(v);
  }

  function updateEditor() {
    const { f, state, sheet } = editor;
    const values = readEditor();
    const chip = chipOf(state.due, state.custom);
    f.chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.chip === chip)));
    f.dateRow.hidden = chip !== 'custom';
    if (chip === 'custom' && f.date.value !== state.due) f.date.value = state.due;
    if (!state.due) f.repeat.checked = false;
    f.everyRow.hidden = !f.repeat.checked;
    const areaId = values.area;
    sheet.dialog.dataset.area = areaId;
    f.titleIcon.replaceChildren(icon(areaId, 'matrix-area-icon'));
    f.titleText.textContent = areaTitle(areaId);
    sheet.trailing.disabled = !values.text.trim();
  }

  function openTask(opts) {
    if (!editor) buildEditor();
    const { sheet, f } = editor;
    const task = opts.task || null;
    const areaId = task ? task.area : opts.area;
    editor.state = { task, area: areaId, due: task && task.due ? task.due : null, custom: false };
    editor.state.custom = chipOf(editor.state.due, false) === 'custom';
    f.text.value = task ? task.text : '';
    f.note.value = task && task.note ? task.note : '';
    f.date.value = editor.state.due || '';
    f.repeat.checked = !!(task && task.repeat);
    f.every.value = task && task.repeat ? task.repeat : 'weekly';
    f.area.replaceChildren(...entry().areas.map(a => el('option', { value: a.id, text: a.title })));
    f.area.value = areaId;
    f.areaGroup.hidden = !task;
    f.deleteGroup.hidden = !task;
    sheet.setButton(sheet.trailing, 'checkmark', task ? 'Done' : 'Add');
    updateEditor();
    editor.state.initial = snapshot(readEditor());
    // New task: straight into the text; editing on a touch screen does not open the keyboard
    S.openSheet(sheet, opts.returnFocus, !task || !S.isTouchLayout() ? f.text : null);
  }

  async function dismissEditor() {
    const { sheet } = editor;
    if (!sheet.dialog.open || sheet.answer) return;
    if (snapshot(readEditor()) !== editor.state.initial) {
      const discard = await sheet.ask('Do you want to discard your changes?', 'Discard Changes', 'Keep Editing');
      if (!discard) return;
    }
    S.closeSheet(sheet);
  }

  function saveEditor() {
    const values = readEditor();
    const built = Core.buildTask(values, editor.state.task, today(), Date.now());
    if (!built.ok) {
      updateEditor();
      editor.f.text.focus();
      return;
    }
    saveTasks(Core.replaceTask(tasks(), built.task));
    retarget(editor.sheet, built.task.area);
    S.closeSheet(editor.sheet);
  }

  // areaIcon: the symbol of an area for other views (Home, js/home-ui.js)
  window.MatrixUI = { panel, refresh, openArea, openTask, areaIcon: (areaId, cls) => icon(areaId, cls) };
})();
