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

    // ===== SUPABASE DATABASE API =====
    const supabaseDB = {
        // ===== GOALS =====
        async getGoals(dateKey) {
            const { data, error } = await supabase
                .from('goals')
                .select('*')
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
            // Delete existing goals for this date
            await supabase.from('goals').delete().eq('date', dateKey);

            // Insert new goals
            if (goals.length > 0) {
                const rows = goals.map(function (g) {
                    return {
                        date: dateKey,
                        text: typeof g === 'string' ? g : g.text,
                        done: typeof g === 'string' ? false : (g.done || false),
                        rolled_from: g.rolledFrom || null
                    };
                });

                const { error } = await supabase.from('goals').insert(rows);
                if (error) console.error('Error saving goals:', error);
            }
        },

        async getAllGoals() {
            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                console.error('Error fetching all goals:', error);
                return {};
            }

            // Group by date
            const grouped = {};
            data.forEach(function (g) {
                if (!grouped[g.date]) grouped[g.date] = [];
                grouped[g.date].push({ text: g.text, done: g.done, rolledFrom: g.rolled_from, id: g.id });
            });
            return grouped;
        },

        // ===== HABITS =====
        async getHabits() {
            const { data, error } = await supabase
                .from('habits')
                .select('*')
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
            // For simplicity, we'll upsert all habits
            for (var i = 0; i < habits.length; i++) {
                var habit = habits[i];
                if (habit.id) {
                    // Update existing
                    var result = await supabase
                        .from('habits')
                        .update({ name: habit.name, color: habit.color, history: habit.history })
                        .eq('id', habit.id);
                    if (result.error) console.error('Error updating habit:', result.error);
                } else {
                    // Insert new
                    var insertResult = await supabase
                        .from('habits')
                        .insert({ name: habit.name, color: habit.color, history: habit.history || {} });
                    if (insertResult.error) console.error('Error inserting habit:', insertResult.error);
                }
            }
        },

        async addHabit(habit) {
            const { data, error } = await supabase
                .from('habits')
                .insert({ name: habit.name, color: habit.color, history: habit.history || {} })
                .select()
                .single();

            if (error) {
                console.error('Error adding habit:', error);
                return null;
            }
            return Object.assign({}, habit, { id: data.id });
        },

        async updateHabit(habit) {
            const { error } = await supabase
                .from('habits')
                .update({ name: habit.name, color: habit.color, history: habit.history })
                .eq('id', habit.id);

            if (error) console.error('Error updating habit:', error);
        },

        async deleteHabit(habitId) {
            const { error } = await supabase
                .from('habits')
                .delete()
                .eq('id', habitId);

            if (error) console.error('Error deleting habit:', error);
        },

        // ===== NOTES =====
        async getNotes(dateKey) {
            const { data, error } = await supabase
                .from('notes')
                .select('content')
                .eq('date', dateKey)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                console.error('Error fetching notes:', error);
            }
            return data ? data.content : '';
        },

        async setNotes(dateKey, content) {
            const { error } = await supabase
                .from('notes')
                .upsert({ date: dateKey, content: content }, { onConflict: 'date' });

            if (error) console.error('Error saving notes:', error);
        },

        // ===== KANBAN (Weekly) =====
        async getKanban(weekKey) {
            const { data, error } = await supabase
                .from('kanban_tasks')
                .select('*')
                .eq('week_key', weekKey)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error fetching kanban:', error);
                return {};
            }

            // Group by column
            var kanban = {};
            data.forEach(function (task) {
                if (!kanban[task.column_name]) kanban[task.column_name] = [];
                kanban[task.column_name].push(task.text);
            });
            return kanban;
        },

        async setKanban(weekKey, kanbanData) {
            // Delete existing for this week
            await supabase.from('kanban_tasks').delete().eq('week_key', weekKey);

            // Insert new
            var rows = [];
            Object.entries(kanbanData).forEach(function (entry) {
                var colName = entry[0];
                var tasks = entry[1];
                tasks.forEach(function (text, idx) {
                    rows.push({ week_key: weekKey, column_name: colName, text: text, sort_order: idx });
                });
            });

            if (rows.length > 0) {
                const { error } = await supabase.from('kanban_tasks').insert(rows);
                if (error) console.error('Error saving kanban:', error);
            }
        },

        // ===== BACKLOG =====
        async getBacklog() {
            const { data, error } = await supabase
                .from('backlog_tasks')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error fetching backlog:', error);
                return {};
            }

            var backlog = {};
            data.forEach(function (task) {
                if (!backlog[task.column_name]) backlog[task.column_name] = [];
                backlog[task.column_name].push(task.text);
            });
            return backlog;
        },

        async setBacklog(backlogData) {
            // Delete all existing
            await supabase.from('backlog_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');

            // Insert new
            var rows = [];
            Object.entries(backlogData).forEach(function (entry) {
                var colName = entry[0];
                var tasks = entry[1];
                tasks.forEach(function (text, idx) {
                    rows.push({ column_name: colName, text: text, sort_order: idx });
                });
            });

            if (rows.length > 0) {
                const { error } = await supabase.from('backlog_tasks').insert(rows);
                if (error) console.error('Error saving backlog:', error);
            }
        },

        // ===== LISTS (Shopping, Chores, Goals2026, Custom) =====
        async getList(listName) {
            const { data, error } = await supabase
                .from('lists')
                .select('*')
                .eq('name', listName)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching list:', error);
            }
            return data ? { items: data.items || [], icon: data.icon, id: data.id } : { items: [], icon: 'list' };
        },

        async setList(listName, items, icon) {
            icon = icon || 'list';
            const { error } = await supabase
                .from('lists')
                .upsert({ name: listName, items: items, icon: icon }, { onConflict: 'name' });

            if (error) console.error('Error saving list:', error);
        },

        async getAllLists() {
            const { data, error } = await supabase
                .from('lists')
                .select('*')
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
            const { error } = await supabase
                .from('lists')
                .delete()
                .eq('name', listName);

            if (error) console.error('Error deleting list:', error);
        },

        // ===== POMODORO STATS =====
        async getPomodoroCount(dateKey) {
            const { data, error } = await supabase
                .from('pomodoro_stats')
                .select('count')
                .eq('date', dateKey)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching pomo count:', error);
            }
            return data ? data.count : 0;
        },

        async setPomodoroCount(dateKey, count) {
            const { error } = await supabase
                .from('pomodoro_stats')
                .upsert({ date: dateKey, count: count }, { onConflict: 'date' });

            if (error) console.error('Error saving pomo count:', error);
        },

        async getAllPomodoroStats() {
            const { data, error } = await supabase
                .from('pomodoro_stats')
                .select('*')
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
            defaultValue = defaultValue || null;
            const { data, error } = await supabase
                .from('settings')
                .select('value')
                .eq('key', key)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching setting:', error);
            }
            return (data && data.value !== undefined) ? data.value : defaultValue;
        },

        async setSetting(key, value) {
            const { error } = await supabase
                .from('settings')
                .upsert({ key: key, value: value }, { onConflict: 'key' });

            if (error) console.error('Error saving setting:', error);
        }
    };

    // Export for use
    window.supabaseDB = supabaseDB;
    console.log('[Supabase] Connected to:', SUPABASE_URL);
})();
