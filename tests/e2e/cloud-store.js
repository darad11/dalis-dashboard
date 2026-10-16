/*
 * Node-side in-memory stand-in for the Supabase/PostgREST backend used by the
 * e2e tests. It implements just enough PostgREST semantics for the dashboard:
 * filters, ordering, single()/maybeSingle(), insert/update/delete/upsert,
 * row-level security on user_id, the unique key and last-write-wins trigger of
 * step_entries, the time columns of goals (returned as "HH:MM:SS" like Postgres),
 * failure injection (incl. columns missing before a migration) and realtime change events.
 * healthUpload() plays the Edge Function "health-steps" + submit_health_steps() (upload
 * from the Apple Health Shortcut), so tests can check what the dashboard shows afterwards.
 */
'use strict';

const crypto = require('crypto');

const STEP_UNIQUE = ['user_id', 'date'];

function nowIso(ms) {
  return new Date(ms).toISOString().replace('Z', '+00:00');
}

class CloudStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.tables = {
      goals: [], habits: [], notes: [], kanban_tasks: [], backlog_tasks: [],
      lists: [], pomodoro_stats: [], settings: [], step_entries: [], step_upload_tokens: []
    };
    this.offline = false;
    this.failTables = new Set();
    this.missingTables = new Set();
    this.missingColumns = new Set(); // e.g. 'goals.start_time': database without that migration
    this.latencyMs = 5;
    this.log = [];
    this.clock = Date.parse('2026-01-04T12:00:00Z');
    this.listeners = new Set();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(payload) {
    for (const listener of this.listeners) {
      setTimeout(() => {
        try { listener(payload); } catch (e) { /* page may be gone */ }
      }, 15);
    }
  }

  nextCreatedAt() {
    this.clock += 1000;
    return nowIso(this.clock);
  }

  rows(table) {
    return this.tables[table].map(r => ({ ...r }));
  }

  seed(table, rows) {
    for (const row of rows) {
      this.tables[table].push(this.withDefaults(table, row));
    }
  }

  withDefaults(table, value) {
    const row = { id: crypto.randomUUID(), created_at: this.nextCreatedAt(), ...value };
    if (table === 'step_entries') {
      if (row.deleted === undefined) row.deleted = false;
      row.updated_at = row.updated_at ? nowIso(Date.parse(row.updated_at)) : nowIso(Date.now());
    }
    if (table === 'goals') {
      // time columns (migrations/2026-10-16_calendar_times.sql): NULL when not sent, "HH:MM:SS" out
      for (const col of ['start_time', 'end_time']) {
        const v = row[col];
        row[col] = typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v + ':00' : (v === undefined ? null : v);
      }
      if (row.calendar_id === undefined) row.calendar_id = null;
    }
    return row;
  }

  // PostgREST rejects columns the table does not have (before a migration)
  checkColumns(op, values) {
    for (const v of values) {
      for (const col of Object.keys(v)) {
        if (this.missingColumns.has(`${op.table}.${col}`)) {
          const err = new Error(`Could not find the '${col}' column of '${op.table}' in the schema cache`);
          err.code = 'PGRST204';
          throw err;
        }
      }
    }
  }

  async handle(op) {
    if (this.latencyMs) await new Promise(r => setTimeout(r, this.latencyMs));
    this.log.push({ table: op.table, action: op.action, filters: op.filters, n: op.values ? [].concat(op.values).length : 0 });

    if (this.offline) {
      return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, status: 0 };
    }
    if (this.missingTables.has(op.table) || !this.tables[op.table]) {
      return {
        data: null,
        error: { code: 'PGRST205', message: `Could not find the table 'public.${op.table}' in the schema cache`, details: null, hint: null },
        status: 404
      };
    }
    if (this.failTables.has(op.table)) {
      return { data: null, error: { code: '500', message: 'Internal server error (injected)' }, status: 500 };
    }

    try {
      switch (op.action) {
        case 'select': return this.select(op);
        case 'insert': return this.insert(op);
        case 'upsert': return this.upsert(op);
        case 'update': return this.update(op);
        case 'delete': return this.remove(op);
        default: return { data: null, error: { message: 'unknown action ' + op.action } };
      }
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code || '' } };
    }
  }

  visible(op) {
    return this.tables[op.table].filter(r => r.user_id === op.userId && this.matches(r, op.filters));
  }

  matches(row, filters) {
    return (filters || []).every(f => {
      const v = row[f.col];
      switch (f.op) {
        case 'eq': return v === f.val || String(v) === String(f.val);
        case 'neq': return String(v) !== String(f.val);
        case 'in': return f.val.map(String).includes(String(v));
        case 'gt': return v > f.val;
        case 'gte': return v >= f.val;
        case 'lt': return v < f.val;
        case 'lte': return v <= f.val;
        default: return true;
      }
    });
  }

  project(rows, columns) {
    if (!columns || columns === '*') return rows.map(r => ({ ...r }));
    const cols = columns.split(',').map(c => c.trim()).filter(Boolean);
    return rows.map(r => {
      const out = {};
      cols.forEach(c => { out[c] = r[c] === undefined ? null : r[c]; });
      return out;
    });
  }

  // Rows written by insert/upsert/update/delete, as PostgREST returns them (single() = one object)
  written(rows, op) {
    if (!op.returning) return { data: null, error: null };
    return op.single ? this.finish(this.project(rows, '*'), op) : { data: this.project(rows, '*'), error: null };
  }

  finish(rows, op) {
    if (op.single === 'single' || op.single === 'maybe') {
      if (rows.length === 1) return { data: rows[0], error: null };
      if (rows.length === 0 && op.single === 'maybe') return { data: null, error: null };
      return {
        data: null,
        error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` }
      };
    }
    return { data: rows, error: null };
  }

  select(op) {
    let rows = this.visible(op);
    for (const o of [...(op.order || [])].reverse()) {
      rows = rows.slice().sort((a, b) => {
        const av = a[o.col], bv = b[o.col];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return (av < bv ? -1 : 1) * (o.asc ? 1 : -1);
      });
    }
    if (op.limit) rows = rows.slice(0, op.limit);
    return this.finish(this.project(rows, op.columns), op);
  }

  checkRls(op, value) {
    if (value.user_id !== op.userId) {
      const err = new Error('new row violates row-level security policy for table "' + op.table + '"');
      err.code = '42501';
      throw err;
    }
  }

  checkUnique(table, row, ignoreRow) {
    if (table !== 'step_entries') return;
    const clash = this.tables[table].find(r => r !== ignoreRow && STEP_UNIQUE.every(c => r[c] === row[c]));
    if (clash) {
      const err = new Error('duplicate key value violates unique constraint "step_entries_user_date_key"');
      err.code = '23505';
      throw err;
    }
  }

  // BEFORE UPDATE trigger of step_entries: an older change never replaces a newer one.
  applyUpdate(table, row, values) {
    if (table === 'step_entries' && values.updated_at) {
      const incoming = Date.parse(values.updated_at);
      if (incoming < Date.parse(row.updated_at)) return false;
    }
    Object.assign(row, values);
    if (table === 'step_entries' && values.updated_at) row.updated_at = nowIso(Date.parse(values.updated_at));
    return true;
  }

  insert(op) {
    this.checkColumns(op, op.values);
    const created = op.values.map(v => {
      this.checkRls(op, v);
      return this.withDefaults(op.table, v);
    });
    created.forEach((row, i) => {
      this.checkUnique(op.table, row);
      created.slice(0, i).forEach(prev => {
        if (op.table === 'step_entries' && STEP_UNIQUE.every(c => prev[c] === row[c])) {
          const err = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
      });
    });
    created.forEach(row => {
      this.tables[op.table].push(row);
      this.emit({ eventType: 'INSERT', schema: 'public', table: op.table, new: { ...row }, old: {} });
    });
    return this.written(created, op);
  }

  upsert(op) {
    const conflict = (op.onConflict || 'id').split(',').map(s => s.trim());
    const affected = [];
    for (const v of op.values) {
      this.checkRls(op, v);
      const existing = this.tables[op.table].find(r => conflict.every(c => r[c] === v[c]));
      if (existing) {
        const before = { ...existing };
        if (this.applyUpdate(op.table, existing, { ...v })) {
          affected.push(existing);
          this.emit({ eventType: 'UPDATE', schema: 'public', table: op.table, new: { ...existing }, old: { id: before.id } });
        }
      } else {
        const row = this.withDefaults(op.table, v);
        this.checkUnique(op.table, row);
        this.tables[op.table].push(row);
        affected.push(row);
        this.emit({ eventType: 'INSERT', schema: 'public', table: op.table, new: { ...row }, old: {} });
      }
    }
    return this.written(affected, op);
  }

  update(op) {
    const rows = this.visible(op);
    const changed = [];
    for (const row of rows) {
      if (op.values.user_id && op.values.user_id !== op.userId) {
        const err = new Error('new row violates row-level security policy');
        err.code = '42501';
        throw err;
      }
      if (this.applyUpdate(op.table, row, { ...op.values })) {
        changed.push(row);
        this.emit({ eventType: 'UPDATE', schema: 'public', table: op.table, new: { ...row }, old: { id: row.id } });
      }
    }
    return this.written(changed, op);
  }

  // Server side of an Apple Health upload (migrations/2026-10-16_step_health_sync.sql):
  // the token's hash identifies the user, a lower count never replaces a higher one.
  healthUpload(token, date, steps, atIso) {
    const hash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    const key = this.tables.step_upload_tokens.find(t => t.token_hash === hash);
    if (!key) return { status: 401 };
    const at = atIso || nowIso(Date.now());
    key.last_used_at = at; // step_upload_tokens is not in the realtime publication
    const existing = this.tables.step_entries.find(r => r.user_id === key.user_id && r.date === date);
    if (existing && !existing.deleted && existing.steps >= steps) return { status: 200, steps: existing.steps, updated: false };
    if (existing) {
      const next = Math.max(Date.parse(at), Date.parse(existing.updated_at) + 1);
      Object.assign(existing, { steps, deleted: false, updated_at: nowIso(next) });
      this.emit({ eventType: 'UPDATE', schema: 'public', table: 'step_entries', new: { ...existing }, old: { id: existing.id } });
    } else {
      const row = this.withDefaults('step_entries', { user_id: key.user_id, date, steps, deleted: false, updated_at: at });
      this.tables.step_entries.push(row);
      this.emit({ eventType: 'INSERT', schema: 'public', table: 'step_entries', new: { ...row }, old: {} });
    }
    return { status: 200, steps, updated: true };
  }

  remove(op) {
    const rows = this.visible(op);
    this.tables[op.table] = this.tables[op.table].filter(r => !rows.includes(r));
    rows.forEach(row => this.emit({ eventType: 'DELETE', schema: 'public', table: op.table, new: {}, old: { id: row.id } }));
    return this.written(rows, op);
  }
}

module.exports = { CloudStore };
