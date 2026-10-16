/*
 * Browser-side stand-in for the supabase-js UMD bundle, used ONLY by the e2e
 * tests. The test runner serves this file instead of the CDN script, so the
 * dashboard never talks to the real Supabase project during tests.
 *
 * Every database call is forwarded to the Node-side in-memory store through
 * the `window.__cloud(op)` binding (see cloud-store.js). Realtime events are
 * pushed back into the page via `window.__mockRealtimeDispatch(payload)`.
 */
(function () {
  'use strict';

  var TEST_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com' };
  var session = { user: TEST_USER, access_token: 'mock-token', expires_at: 4102444800 };

  function cloud(op) {
    if (typeof window.__cloud !== 'function') {
      return Promise.resolve({ data: null, error: { message: 'mock cloud binding missing', code: '' } });
    }
    return window.__cloud(op);
  }

  function Builder(table) {
    this.op = {
      table: table,
      action: 'select',
      columns: '*',
      filters: [],
      order: [],
      limit: null,
      single: null,
      values: null,
      onConflict: null,
      returning: false
    };
  }

  Builder.prototype.select = function (columns) {
    if (this.op.action === 'select') {
      this.op.columns = columns || '*';
    } else {
      this.op.returning = true;
    }
    return this;
  };
  Builder.prototype.insert = function (values) {
    this.op.action = 'insert';
    this.op.values = Array.isArray(values) ? values : [values];
    return this;
  };
  Builder.prototype.upsert = function (values, options) {
    this.op.action = 'upsert';
    this.op.values = Array.isArray(values) ? values : [values];
    this.op.onConflict = options && options.onConflict ? options.onConflict : null;
    return this;
  };
  Builder.prototype.update = function (values) {
    this.op.action = 'update';
    this.op.values = values;
    return this;
  };
  Builder.prototype.delete = function () {
    this.op.action = 'delete';
    return this;
  };
  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].forEach(function (name) {
    Builder.prototype[name] = function (col, val) {
      this.op.filters.push({ col: col, op: name, val: val });
      return this;
    };
  });
  Builder.prototype.in = function (col, vals) {
    this.op.filters.push({ col: col, op: 'in', val: vals });
    return this;
  };
  Builder.prototype.order = function (col, options) {
    this.op.order.push({ col: col, asc: !(options && options.ascending === false) });
    return this;
  };
  Builder.prototype.limit = function (n) {
    this.op.limit = n;
    return this;
  };
  Builder.prototype.single = function () {
    this.op.single = 'single';
    return this;
  };
  Builder.prototype.maybeSingle = function () {
    this.op.single = 'maybe';
    return this;
  };
  Builder.prototype.then = function (resolve, reject) {
    var op = JSON.parse(JSON.stringify(this.op));
    op.userId = session.user.id;
    return cloud(op).then(resolve, reject);
  };

  // ----- Realtime -----
  var channels = [];

  function Channel(name) {
    this.name = name;
    this.listeners = [];
    this.status = 'CLOSED';
  }
  Channel.prototype.on = function (type, filter, callback) {
    this.listeners.push({ type: type, filter: filter || {}, callback: callback });
    return this;
  };
  Channel.prototype.subscribe = function (statusCallback) {
    var self = this;
    channels.push(this);
    setTimeout(function () {
      self.status = 'SUBSCRIBED';
      if (statusCallback) statusCallback('SUBSCRIBED');
    }, 0);
    return this;
  };

  window.__mockRealtimeDispatch = function (payload) {
    channels.forEach(function (channel) {
      channel.listeners.forEach(function (listener) {
        if (listener.type !== 'postgres_changes') return;
        if (listener.filter.table && listener.filter.table !== payload.table) return;
        var event = listener.filter.event || '*';
        if (event !== '*' && event !== payload.eventType) return;
        try { listener.callback(payload); } catch (e) { console.error('[MockRealtime] listener error', e); }
      });
    });
  };
  window.__mockChannels = channels;

  var authListeners = [];
  var client = {
    from: function (table) { return new Builder(table); },
    channel: function (name) { return new Channel(name); },
    removeChannel: function (channel) {
      var idx = channels.indexOf(channel);
      if (idx >= 0) channels.splice(idx, 1);
      return Promise.resolve('ok');
    },
    auth: {
      getSession: function () {
        var delay = window.__mockAuthDelayMs || 0;
        return new Promise(function (resolve) {
          setTimeout(function () { resolve({ data: { session: session }, error: null }); }, delay);
        });
      },
      onAuthStateChange: function (callback) {
        authListeners.push(callback);
        setTimeout(function () { callback('INITIAL_SESSION', session); }, window.__mockAuthDelayMs || 0);
        return { data: { subscription: { unsubscribe: function () { } } } };
      },
      signOut: function () { return Promise.resolve({ error: null }); },
      signInWithPassword: function () { return Promise.resolve({ data: { session: session }, error: null }); },
      signUp: function () { return Promise.resolve({ data: { session: session }, error: null }); },
      signInWithOtp: function () { return Promise.resolve({ error: null }); }
    }
  };

  window.__mockCreateClientCalls = 0;
  window.supabase = {
    createClient: function () {
      window.__mockCreateClientCalls++;
      return client;
    }
  };
})();
