/*
 * Node-side in-memory stand-in for the Supabase/PostgREST backend used by the
 * e2e tests. It implements just enough PostgREST semantics for the dashboard:
 * filters, ordering, single()/maybeSingle(), insert/update/delete/upsert,
 * row-level security on user_id, the unique key and last-write-wins trigger of
 * step_entries, failure injection and realtime change events.
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
      lists: [], pomodoro_stats: [], settings: [], step_entries: []
    };
    this.offline = false;
    this.failTables = new Set();
    this.missingTables = new Set();
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
    return row;
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
    return { data: op.returning ? this.project(created, '*') : null, error: null };
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
    return { data: op.returning ? this.project(affected, '*') : null, error: null };
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
    return { data: op.returning ? this.project(changed, '*') : null, error: null };
  }

  remove(op) {
    const rows = this.visible(op);
    this.tables[op.table] = this.tables[op.table].filter(r => !rows.includes(r));
    rows.forEach(row => this.emit({ eventType: 'DELETE', schema: 'public', table: op.table, new: {}, old: { id: row.id } }));
    return { data: op.returning ? this.project(rows, '*') : null, error: null };
  }
}

module.exports = { CloudStore };
