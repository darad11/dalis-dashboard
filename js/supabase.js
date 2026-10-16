// ===== SUPABASE CLIENT =====
(function () {
    'use strict';

    const SUPABASE_URL = 'https://jbkufpyyfmbxjeswagli.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impia3VmcHl5Zm1ieGplc3dhZ2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MjgyMjYsImV4cCI6MjA4MzEwNDIyNn0.vmi9FErxUI2bZy_0vEqoCwoZ8RMgH7uRAtJ8QAhU8VY';

    // Check if Supabase library is loaded
    if (typeof window.supabase === 'undefined') {
        console.error('[Supabase] Library not loaded. Make sure the CDN script is included before this file.');
        return;
    }

    // Reuse the client created by auth.js: two clients on the same storage key
    // would refresh the session token independently and can race each other.
    const supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Helper to get current user ID
    function getUserId() {
        return window.currentUserId || null;
    }

    // Serialize writes per data key. Several writes (delete + insert, or
    // select + insert) must not interleave for the same key, otherwise rows get
    // duplicated or deleted entries come back.
    const writeLocks = new Map();
    function withLock(lockKey, task) {
        const previous = writeLocks.get(lockKey) || Promise.resolve();
        const next = previous.catch(function () { }).then(task);
        writeLocks.set(lockKey, next);
        next.finally(function () {
            if (writeLocks.get(lockKey) === next) writeLocks.delete(lockKey);
        }).catch(function () { });
        return next;
    }

    // Older data may contain duplicate rows for one key. Prefer the last row
    // returned (most recently written in practice) instead of failing.
    function lastRow(rows) {
        return rows && rows.length ? rows[rows.length - 1] : null;
    }

    // Calendar entry times are stored in time columns (migrations/2026-10-16_calendar_times.sql);
    // Postgres returns them as "HH:MM:SS", the dashboard uses "HH:MM".
    function timeOrNull(value) {
        return typeof value === 'string' && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : null;
    }

    // Row -> entry. Times and calendar only when set, like entries created on this device.
    function goalFromRow(g, withId) {
        const goal = {
            text: g.text,
            done: g.done,
            priority: g.priority,
            urgency: g.urgency
        };
        if (withId) {
            goal.rolledFrom = g.rolled_from;
            goal.id = g.id;
        }
        const start = timeOrNull(g.start_time);
        const end = timeOrNull(g.end_time);
        if (start) goal.start = start;
        if (end) goal.end = end;
        if (g.calendar_id) goal.calendarId = g.calendar_id;
        return goal;
    }

    // Entries of one day that count as the same (window.DataUtils.goalIdentity in the browser)
    function goalIdentity(goal) {
        if (window.DataUtils && window.DataUtils.goalIdentity) return window.DataUtils.goalIdentity(goal);
        return [goal.text, goal.start || '', goal.end || '', goal.calendarId || ''].join('|');
    }

    // Update all rows matching the filter; insert one row when none exists.
    async function updateOrInsert(table, match, values) {
        let query = supabase.from(table).update(values);
        Object.keys(match).forEach(function (col) { query = query.eq(col, match[col]); });
        const { data: updated, error: updateError } = await query.select('id');
        if (updateError) return updateError;
        if (updated && updated.length > 0) return null;

        const { error: insertError } = await supabase.from(table).insert(Object.assign({}, match, values));
        return insertError || null;
    }

    // ===== SUPABASE DATABASE API =====
    // Getters return null when the request failed, so callers can tell
    // "cloud is empty" apart from "cloud not reachable".
    const supabaseDB = {
        // ===== GOALS =====
        async getGoals(dateKey) {
            const userId = getUserId();
            if (!userId) return null;

            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', userId)
                .eq('date', dateKey)
                .order('position', { ascending: true });

            if (error) {
                console.error('Error fetching goals:', error);
                return null;
            }
            return data.map(function (g) { return goalFromRow(g, true); });
        },

        setGoals(dateKey, goals) {
            return withLock('goals:' + dateKey, async function () {
                const userId = getUserId();
                if (!userId) {
                    console.error('[Supabase] setGoals failed: Not logged in');
                    return { error: 'Not logged in' };
                }

                // Delete existing goals for this date and user
                const { error: deleteError } = await supabase.from('goals').delete().eq('user_id', userId).eq('date', dateKey);
                if (deleteError) {
                    console.error('[Supabase] setGoals delete failed:', deleteError);
                    return deleteError; // Return early - don't insert if delete failed
                }

                // Insert new goals with position to preserve order
                if (goals.length > 0) {
                    const rows = goals.map(function (g, index) {
                        const row = {
                            user_id: userId,
                            date: dateKey,
                            text: typeof g === 'string' ? g : g.text,
                            done: typeof g === 'string' ? false : (g.done || false),
                            rolled_from: g.rolledFrom || null,
                            priority: g.priority || null,
                            urgency: g.urgency || null,
                            position: index
                        };
                        // Only sent when set: entries without times work with or without the
                        // calendar_times migration; entries with times need it
                        if (typeof g === 'object' && g) {
                            const start = timeOrNull(g.start);
                            const end = timeOrNull(g.end);
                            if (start) row.start_time = start;
                            if (end) row.end_time = end;
                            if (g.calendarId) row.calendar_id = g.calendarId;
                        }
                        return row;
                    });

                    const { error } = await supabase.from('goals').insert(rows);
                    if (error) {
                        console.error('Error saving goals:', error);
                        return error;
                    }
                }
                return null;
            });
        },

        async getAllGoals() {
            const userId = getUserId();
            if (!userId) return null;

            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false })
                .order('position', { ascending: true });

            if (error) {
                console.error('Error fetching all goals:', error);
                return null;
            }

            // Group by date
            var grouped = {};
            var seen = {};
            data.forEach(function (g) {
                if (!grouped[g.date]) {
                    grouped[g.date] = [];
                    seen[g.date] = new Set();
                }
                const goal = goalFromRow(g, false);

                // Deduplication: rows of old concurrent writes (same text, time and calendar)
                const identity = goalIdentity(goal);
                if (seen[g.date].has(identity)) return;
                seen[g.date].add(identity);
                grouped[g.date].push(goal);
            });
            return grouped;
        },

        // ===== HABITS =====
        async getHabits() {
            const userId = getUserId();
            if (!userId) return null;

            const { data, error } = await supabase
                .from('habits')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching habits:', error);
                return null;
            }
            return data.map(function (h) {
                return { id: h.id, name: h.name, color: h.color, history: h.history || {} };
            });
        },

        // Habits inserted without id get the new cloud id written onto the
        // passed objects, so the caller can store it locally.
        setHabits(habits) {
            return withLock('habits', async function () {
                const userId = getUserId();
                if (!userId) return { error: 'Not logged in' };

                try {
                    // Normalize habits: convert strings to objects
                    const normalizedHabits = habits.map(h => {
                        if (typeof h === 'string') {
                            return { name: h, color: '#6366f1', history: {} };
                        }
                        return h;
                    });

                    // 1. Get current cloud IDs to detect deletions
                    const { data: existing, error: selectError } = await supabase
                        .from('habits')
                        .select('id')
                        .eq('user_id', userId);
                    if (selectError) return selectError;

                    const currentIds = existing ? existing.map(h => h.id) : [];
                    const newIds = normalizedHabits.map(h => h.id).filter(id => id); // Valid IDs only

                    // 2. Delete habits that are missing from the new list
                    const idsToDelete = currentIds.filter(id => !newIds.includes(id));
                    if (idsToDelete.length > 0) {
                        const { error } = await supabase.from('habits').delete().in('id', idsToDelete).eq('user_id', userId);
                        if (error) return error;
                    }

                    // 3. Upsert (Insert/Update)
                    for (var i = 0; i < normalizedHabits.length; i++) {
                        var habit = normalizedHabits[i];
                        var payload = {
                            user_id: userId,
                            name: habit.name,
                            color: habit.color || '#6366f1',
                            history: habit.history || {}
                        };

                        if (habit.id) {
                            const { error } = await supabase.from('habits').update(payload).eq('id', habit.id).eq('user_id', userId);
                            if (error) return error;
                        } else {
                            const { data, error } = await supabase.from('habits').insert(payload).select('id').single();
                            if (error) return error;
                            if (data && data.id) habit.id = data.id;
                        }
                    }
                    return null; // Success
                } catch (e) {
                    console.error('Error in setHabits:', e);
                    return { error: e.message };
                }
            });
        },

        async addHabit(habit) {
            const userId = getUserId();
            if (!userId) return null;

            const { data, error } = await supabase
                .from('habits')
                .insert({ user_id: userId, name: habit.name, color: habit.color, history: habit.history || {} })
                .select()
                .single();

            if (error) {
                console.error('Error adding habit:', error);
                return null;
            }
            return Object.assign({}, habit, { id: data.id });
        },

        async updateHabit(habit) {
            const userId = getUserId();
            if (!userId) return;

            const { error } = await supabase
                .from('habits')
                .update({ name: habit.name, color: habit.color, history: habit.history })
                .eq('id', habit.id)
                .eq('user_id', userId);

            if (error) console.error('Error updating habit:', error);
        },

        async deleteHabit(habitId) {
            const userId = getUserId();
            if (!userId) return;

            const { error } = await supabase
                .from('habits')
                .delete()
                .eq('id', habitId)
                .eq('user_id', userId);

            if (error) console.error('Error deleting habit:', error);
        },

        // ===== NOTES =====
        async getNotes(dateKey) {
            const userId = getUserId();
            if (!userId) return null;

            const { data, error } = await supabase
                .from('notes')
                .select('content')
                .eq('user_id', userId)
                .eq('date', dateKey);

            if (error) {
                console.error('Error fetching notes:', error);
                return null;
            }
            const row = lastRow(data);
            return row ? (row.content || '') : '';
        },

        setNotes(dateKey, content) {
            return withLock('notes:' + dateKey, async function () {
                const userId = getUserId();
                if (!userId) return { error: 'Not logged in' };

                const error = await updateOrInsert('notes', { user_id: userId, date: dateKey }, { content: content });
                if (error) console.error('Error saving notes:', error);
                return error;
            });
        },

        // ===== KANBAN (Weekly) =====
        async getKanban(weekKey) {
            const userId = getUserId();
            if (!userId) return null;

            const { data, error } = await supabase
                .from('kanban_tasks')
                .select('*')
                .eq('user_id', userId)
                .eq('week_key', weekKey)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error fetching kanban:', error);
                return null;
            }

            // Group by column - parse JSON if stored as object
            var kanban = {};
            data.forEach(function (task) {
                if (!kanban[task.column_name]) kanban[task.column_name] = [];
                // Try to parse as JSON if it looks like an object
                var taskData = task.text;
                if (typeof taskData === 'string' && taskData.startsWith('{')) {
                    try { taskData = JSON.parse(taskData); } catch (e) { /* keep as string */ }
                }
                kanban[task.column_name].push(taskData);
            });
            return kanban;
        },

        setKanban(weekKey, kanbanData) {
            return withLock('week:' + weekKey, async function () {
                const userId = getUserId();
                if (!userId) return { error: 'Not logged in' };

                // Delete existing for this week and user
                const { error: deleteError } = await supabase.from('kanban_tasks').delete().eq('user_id', userId).eq('week_key', weekKey);
                if (deleteError) {
                    console.error('[Supabase] setKanban delete failed:', deleteError);
                    return deleteError;
                }

                // Insert new
                var rows = [];
                Object.entries(kanbanData).forEach(function (entry) {
                    var colName = entry[0];
                    var tasks = entry[1];
                    tasks.forEach(function (task, idx) {
                        // If task is an object, stringify it; otherwise store as-is
                        var text = typeof task === 'object' ? JSON.stringify(task) : task;
                        rows.push({ user_id: userId, week_key: weekKey, column_name: colName, text: text, sort_order: idx });
                    });
                });

                if (rows.length > 0) {
                    const { error } = await supabase.from('kanban_tasks').insert(rows);
                    if (error) {
                        console.error('Error saving kanban:', error);
                        return error;
                    }
                }
                return null;
            });
        },

        // ===== BACKLOG =====
        async getBacklog() {
            const userId = getUserId();
            if (!userId) return null;

            const { data, error } = await supabase
                .from('backlog_tasks')
                .select('*')
                .eq('user_id', userId)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error fetching backlog:', error);
                return null;
            }

            var backlog = {};
            data.forEach(function (task) {
                if (!backlog[task.column_name]) backlog[task.column_name] = [];
                // Try to parse as JSON if it looks like an object
                var taskData = task.text;
                if (typeof taskData === 'string' && taskData.startsWith('{')) {
                    try { taskData = JSON.parse(taskData); } catch (e) { /* keep as string */ }
                }
                backlog[task.column_name].push(taskData);
            });
            return backlog;
        },

        setBacklog(backlogData) {
            return withLock('backlog', async function () {
                const userId = getUserId();
                if (!userId) return { error: 'Not logged in' };

                // Delete all existing for this user
                const { error: deleteError } = await supabase.from('backlog_tasks').delete().eq('user_id', userId);
                if (deleteError) {
                    console.error('[Supabase] setBacklog delete failed:', deleteError);
                    return deleteError;
                }

                // Insert new
                var rows = [];
                Object.entries(backlogData).forEach(function (entry) {
                    var colName = entry[0];
                    var tasks = entry[1];
                    tasks.forEach(function (task, idx) {
                        // If task is an object, stringify it; otherwise store as-is
                        var text = typeof task === 'object' ? JSON.stringify(task) : task;
                        rows.push({ user_id: userId, column_name: colName, text: text, sort_order: idx });
                    });
                });

                if (rows.length > 0) {
                    const { error } = await supabase.from('backlog_tasks').insert(rows);
                    if (error) { console.error('Error saving backlog:', error); return error; }
                }
                return null;
            });
        },

        // ===== LISTS (Shopping, Chores, Goals2026, Custom) =====
        async getList(listName) {
            const userId = getUserId();
            if (!userId) return null;

            const { data, error } = await supabase
                .from('lists')
                .select('*')
                .eq('user_id', userId)
                .eq('name', listName);

            if (error) {
                console.error('Error fetching list:', error);
                return null;
            }
            const row = lastRow(data);
            return row ? { items: row.items || [], icon: row.icon, id: row.id } : { items: [], icon: 'list' };
        },

        setList(listName, items, icon) {
            return withLock('list:' + listName, async function () {
                const userId = getUserId();
                if (!userId) return { error: 'Not logged in' };

                try {
                    const error = await updateOrInsert('lists', { user_id: userId, name: listName }, { items: items, icon: icon || 'list' });
                    if (error) console.error('Error saving list:', error);
                    return error;
                } catch (e) {
                    console.error('Error in setList:', e);
                    return { error: e.message };
                }
            });
        },

        async getAllLists() {
            const userId = getUserId();
            if (!userId) return null;

            const { data, error } = await supabase
                .from('lists')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching all lists:', error);
                return null;
            }
            return data.map(function (l) {
                return { name: l.name, items: l.items || [], icon: l.icon };
            });
        },

        deleteList(listName) {
            return withLock('list:' + listName, async function () {
                const userId = getUserId();
                if (!userId) return { error: 'Not logged in' };

                const { error } = await supabase
                    .from('lists')
                    .delete()
                    .eq('user_id', userId)
                    .eq('name', listName);

                if (error) console.error('Error deleting list:', error);
                return error || null;
            });
        },

        // ===== POMODORO STATS =====
        async getPomodoroCount(dateKey) {
            const userId = getUserId();
            if (!userId) return 0;

            const { data, error } = await supabase
                .from('pomodoro_stats')
                .select('count')
                .eq('user_id', userId)
                .eq('date', dateKey)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching pomo count:', error);
            }
            return data ? data.count : 0;
        },

        async setPomodoroCount(dateKey, count) {
            const userId = getUserId();
            if (!userId) return;

            // Check if exists
            const { data: existing } = await supabase
                .from('pomodoro_stats')
                .select('id')
                .eq('user_id', userId)
                .eq('date', dateKey)
                .single();

            if (existing) {
                const { error } = await supabase
                    .from('pomodoro_stats')
                    .update({ count: count })
                    .eq('id', existing.id);
                if (error) console.error('Error saving pomo count:', error);
            } else {
                const { error } = await supabase
                    .from('pomodoro_stats')
                    .insert({ user_id: userId, date: dateKey, count: count });
                if (error) console.error('Error saving pomo count:', error);
            }
        },

        async getAllPomodoroStats() {
            const userId = getUserId();
            if (!userId) return {};

            const { data, error } = await supabase
                .from('pomodoro_stats')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false });

            if (error) {
                console.error('Error fetching all pomo stats:', error);
                return {};
            }

            var stats = {};
            data.forEach(function (s) { stats[s.date] = s.count; });
            return stats;
        },

        // ===== SETTINGS =====
        // Returns null when the request failed, defaultValue when no row exists.
        async getSetting(key, defaultValue) {
            const result = await this.fetchSetting(key);
            if (!result.ok) return null;
            if (!result.exists) return defaultValue === undefined ? null : defaultValue;
            return result.value;
        },

        // Unambiguous variant: { ok, exists, value, error }
        async fetchSetting(key) {
            const userId = getUserId();
            if (!userId) return { ok: false, error: { message: 'Not logged in' } };

            const { data, error } = await supabase
                .from('settings')
                .select('value')
                .eq('user_id', userId)
                .eq('key', key);

            if (error) {
                console.error('Error fetching setting:', key, error);
                return { ok: false, error: error };
            }
            if (data.length > 1) console.warn('[Supabase] Duplicate settings rows for', key, '- using the last one');
            const row = lastRow(data);
            return { ok: true, exists: !!row, value: row ? row.value : null };
        },

        setSetting(key, value) {
            return withLock('setting:' + key, async function () {
                const userId = getUserId();
                if (!userId) return { error: 'Not logged in' };

                try {
                    const error = await updateOrInsert('settings', { user_id: userId, key: key }, { value: value });
                    if (error) console.error('Error saving setting:', error);
                    return error;
                } catch (e) {
                    console.error('Error in setSetting:', e);
                    return { error: e.message };
                }
            });
        },

        // ===== STEP ENTRIES (migrations/2026-10-16_step_entries.sql) =====
        // Low-level access; js/steps.js owns the merge rules. Returns { data, error }.
        async getStepEntries() {
            const userId = getUserId();
            if (!userId) return { data: null, error: { message: 'Not logged in' } };

            return supabase
                .from('step_entries')
                .select('date, steps, deleted, updated_at')
                .eq('user_id', userId)
                .order('date', { ascending: true });
        },

        // rows: [{ date: 'YYYY-MM-DD', steps, deleted, updated_at: ISO }]
        // A database trigger ignores rows older than the stored version; only
        // rows that were actually written come back in data.
        upsertStepEntries(rows) {
            return withLock('step_entries', async function () {
                const userId = getUserId();
                if (!userId) return { data: null, error: { message: 'Not logged in' } };

                const payload = rows.map(function (r) {
                    return { user_id: userId, date: r.date, steps: r.steps, deleted: !!r.deleted, updated_at: r.updated_at };
                });
                return supabase
                    .from('step_entries')
                    .upsert(payload, { onConflict: 'user_id,date' })
                    .select('date, steps, deleted, updated_at');
            });
        },

        subscribeToStepEntries(onChange) {
            const userId = getUserId();
            if (!userId) return null;

            return supabase
                .channel('steps-sync')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'step_entries', filter: `user_id=eq.${userId}` },
                    (payload) => { if (onChange) onChange(payload); }
                )
                .subscribe((status) => {
                    console.log('[Realtime] Steps subscription status:', status);
                });
        },

        // ===== REALTIME SUBSCRIPTIONS =====
        subscribeToChanges(onGoalsChange, onHabitsChange, onKanbanChange, onSettingsChange) {
            const userId = getUserId();
            if (!userId) {
                console.warn('[Realtime] Cannot subscribe - not logged in');
                return null;
            }

            console.log('[Realtime] Setting up subscriptions for user:', userId);

            // Create a channel for all tables
            const channel = supabase
                .channel('dashboard-sync')
                // Goals changes (calendar events + today's goals)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('[Realtime] Goals change detected:', payload.eventType);
                        if (onGoalsChange) onGoalsChange(payload);
                    }
                )
                // Habits changes
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('[Realtime] Habits change detected:', payload.eventType);
                        if (onHabitsChange) onHabitsChange(payload);
                    }
                )
                // Notes changes
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('[Realtime] Notes change detected:', payload.eventType);
                        if (onSettingsChange) onSettingsChange(payload);
                    }
                )
                // Kanban tasks changes
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'kanban_tasks', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('[Realtime] Kanban change detected:', payload.eventType);
                        if (onKanbanChange) onKanbanChange(payload);
                    }
                )
                // Backlog tasks changes
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'backlog_tasks', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('[Realtime] Backlog change detected:', payload.eventType);
                        if (onKanbanChange) onKanbanChange(payload);
                    }
                )
                // Lists changes
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'lists', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('[Realtime] Lists change detected:', payload.eventType);
                        if (onSettingsChange) onSettingsChange(payload);
                    }
                )
                // Pomodoro stats changes
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'pomodoro_stats', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('[Realtime] Pomodoro stats change detected:', payload.eventType);
                        if (onSettingsChange) onSettingsChange(payload);
                    }
                )
                // Settings changes
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'settings', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('[Realtime] Settings change detected:', payload.eventType);
                        if (onSettingsChange) onSettingsChange(payload);
                    }
                )
                .subscribe((status) => {
                    console.log('[Realtime] Subscription status:', status);
                });

            return channel;
        },

        unsubscribeFromChanges(channel) {
            if (channel) {
                supabase.removeChannel(channel);
                console.log('[Realtime] Unsubscribed from changes');
            }
        }
    };

    // Export for use
    window.supabaseDB = supabaseDB;
    window.supabaseClient = supabase; // Export for realtime access
    console.log('[Supabase] Connected to:', SUPABASE_URL);
})();
