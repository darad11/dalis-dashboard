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

    // Initialize Supabase client
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Helper to get current user ID
    function getUserId() {
        return window.currentUserId || null;
    }

    // ===== SUPABASE DATABASE API =====
    const supabaseDB = {
        // ===== GOALS =====
        async getGoals(dateKey) {
            const userId = getUserId();
            if (!userId) return [];

            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', userId)
                .eq('date', dateKey)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching goals:', error);
                return [];
            }
            return data.map(function (g) {
                return { text: g.text, done: g.done, rolledFrom: g.rolled_from, id: g.id };
            });
        },

        async setGoals(dateKey, goals) {
            const userId = getUserId();
            if (!userId) return;

            // Delete existing goals for this date and user
            await supabase.from('goals').delete().eq('user_id', userId).eq('date', dateKey);

            // Insert new goals
            if (goals.length > 0) {
                const rows = goals.map(function (g) {
                    return {
                        user_id: userId,
                        date: dateKey,
                        text: typeof g === 'string' ? g : g.text,
                        done: typeof g === 'string' ? false : (g.done || false),
                        rolled_from: g.rolledFrom || null
                    };
                });

                const { error } = await supabase.from('goals').insert(rows);
                if (error) {
                    console.error('Error saving goals:', error);
                    return error;
                }
            }
            return null;
        },

        async getAllGoals() {
            const userId = getUserId();
            if (!userId) return {};

            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false });

            if (error) {
                console.error('Error fetching all goals:', error);
                return {};
            }

            // Group by date
            var grouped = {};
            data.forEach(function (g) {
                if (!grouped[g.date]) grouped[g.date] = [];

                // Deduplication: Prevent duplicate tasks (same text)
                const isDuplicate = grouped[g.date].some(existing => existing.text === g.text);

                if (!isDuplicate) {
                    grouped[g.date].push({
                        text: g.text,
                        done: g.done,
                        urgency: g.urgency,
                        priority: g.priority
                    });
                }
            });
            return grouped;
        },

        // ===== HABITS =====
        async getHabits() {
            const userId = getUserId();
            if (!userId) return [];

            const { data, error } = await supabase
                .from('habits')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching habits:', error);
                return [];
            }
            return data.map(function (h) {
                return { id: h.id, name: h.name, color: h.color, history: h.history || {} };
            });
        },

        async setHabits(habits) {
            const userId = getUserId();
            if (!userId) return;

            // 1. Get current cloud IDs to detect deletions
            const { data: existing } = await supabase
                .from('habits')
                .select('id')
                .eq('user_id', userId);

            const currentIds = existing ? existing.map(h => h.id) : [];
            const newIds = habits.map(h => h.id).filter(id => id); // Valid IDs only

            // 2. Delete habits that are missing from the new list
            const idsToDelete = currentIds.filter(id => !newIds.includes(id));
            if (idsToDelete.length > 0) {
                await supabase.from('habits').delete().in('id', idsToDelete).eq('user_id', userId);
            }

            // 3. Upsert (Insert/Update)
            for (var i = 0; i < habits.length; i++) {
                var habit = habits[i];
                var payload = {
                    user_id: userId,
                    name: habit.name,
                    color: habit.color,
                    history: habit.history || {}
                };

                if (habit.id) {
                    await supabase.from('habits').update(payload).eq('id', habit.id).eq('user_id', userId);
                } else {
                    await supabase.from('habits').insert(payload);
                }
            }
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
            if (!userId) return '';

            const { data, error } = await supabase
                .from('notes')
                .select('content')
                .eq('user_id', userId)
                .eq('date', dateKey)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                console.error('Error fetching notes:', error);
            }
            return data ? data.content : '';
        },

        async setNotes(dateKey, content) {
            const userId = getUserId();
            if (!userId) return;

            // First try to update, then insert if needed
            const { data: existing } = await supabase
                .from('notes')
                .select('id')
                .eq('user_id', userId)
                .eq('date', dateKey)
                .single();

            if (existing) {
                const { error } = await supabase
                    .from('notes')
                    .update({ content: content })
                    .eq('id', existing.id);
                if (error) { console.error('Error saving notes:', error); return error; }
            } else {
                const { error } = await supabase
                    .from('notes')
                    .insert({ user_id: userId, date: dateKey, content: content });
                if (error) { console.error('Error saving notes:', error); return error; }
            }
            return null;
        },

        // ===== KANBAN (Weekly) =====
        async getKanban(weekKey) {
            const userId = getUserId();
            if (!userId) return {};

            const { data, error } = await supabase
                .from('kanban_tasks')
                .select('*')
                .eq('user_id', userId)
                .eq('week_key', weekKey)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error fetching kanban:', error);
                return {};
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

        async setKanban(weekKey, kanbanData) {
            const userId = getUserId();
            if (!userId) return;

            // Delete existing for this week and user
            await supabase.from('kanban_tasks').delete().eq('user_id', userId).eq('week_key', weekKey);

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
        },

        // ===== BACKLOG =====
        async getBacklog() {
            const userId = getUserId();
            if (!userId) return {};

            const { data, error } = await supabase
                .from('backlog_tasks')
                .select('*')
                .eq('user_id', userId)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error fetching backlog:', error);
                return {};
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

        async setBacklog(backlogData) {
            const userId = getUserId();
            if (!userId) return;

            // Delete all existing for this user
            await supabase.from('backlog_tasks').delete().eq('user_id', userId);

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
        },

        // ===== LISTS (Shopping, Chores, Goals2026, Custom) =====
        async getList(listName) {
            const userId = getUserId();
            if (!userId) return { items: [], icon: 'list' };

            const { data, error } = await supabase
                .from('lists')
                .select('*')
                .eq('user_id', userId)
                .eq('name', listName)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching list:', error);
            }
            return data ? { items: data.items || [], icon: data.icon, id: data.id } : { items: [], icon: 'list' };
        },

        async setList(listName, items, icon) {
            const userId = getUserId();
            if (!userId) return;

            icon = icon || 'list';

            // Check if list exists
            const { data: existing } = await supabase
                .from('lists')
                .select('id')
                .eq('user_id', userId)
                .eq('name', listName)
                .single();

            if (existing) {
                const { error } = await supabase
                    .from('lists')
                    .update({ items: items, icon: icon })
                    .eq('id', existing.id);
                if (error) console.error('Error saving list:', error);
            } else {
                const { error } = await supabase
                    .from('lists')
                    .insert({ user_id: userId, name: listName, items: items, icon: icon });
                if (error) console.error('Error saving list:', error);
            }
        },

        async getAllLists() {
            const userId = getUserId();
            if (!userId) return [];

            const { data, error } = await supabase
                .from('lists')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching all lists:', error);
                return [];
            }
            return data.map(function (l) {
                return { name: l.name, items: l.items || [], icon: l.icon };
            });
        },

        async deleteList(listName) {
            const userId = getUserId();
            if (!userId) return;

            const { error } = await supabase
                .from('lists')
                .delete()
                .eq('user_id', userId)
                .eq('name', listName);

            if (error) console.error('Error deleting list:', error);
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
        async getSetting(key, defaultValue) {
            const userId = getUserId();
            if (!userId) return defaultValue || null;

            defaultValue = defaultValue || null;
            const { data, error } = await supabase
                .from('settings')
                .select('value')
                .eq('user_id', userId)
                .eq('key', key)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching setting:', error);
            }
            return (data && data.value !== undefined) ? data.value : defaultValue;
        },

        async setSetting(key, value) {
            const userId = getUserId();
            if (!userId) return;

            // Check if exists
            const { data: existing } = await supabase
                .from('settings')
                .select('id')
                .eq('user_id', userId)
                .eq('key', key)
                .single();

            if (existing) {
                const { error } = await supabase
                    .from('settings')
                    .update({ value: value })
                    .eq('id', existing.id);
                if (error) console.error('Error saving setting:', error);
            } else {
                const { error } = await supabase
                    .from('settings')
                    .insert({ user_id: userId, key: key, value: value });
                if (error) console.error('Error saving setting:', error);
            }
        }
    };

    // Export for use
    window.supabaseDB = supabaseDB;
    console.log('[Supabase] Connected to:', SUPABASE_URL);
})();
