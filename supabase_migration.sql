-- ============================================
-- SUPABASE DATABASE MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Add user_id column to all tables
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE backlog_tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE lists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE pomodoro_stats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 2: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_user_id ON kanban_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_backlog_tasks_user_id ON backlog_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_stats_user_id ON pomodoro_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- Step 3: Drop existing RLS policies
DROP POLICY IF EXISTS "Allow all" ON goals;
DROP POLICY IF EXISTS "Allow all" ON habits;
DROP POLICY IF EXISTS "Allow all" ON notes;
DROP POLICY IF EXISTS "Allow all" ON kanban_tasks;
DROP POLICY IF EXISTS "Allow all" ON backlog_tasks;
DROP POLICY IF EXISTS "Allow all" ON lists;
DROP POLICY IF EXISTS "Allow all" ON pomodoro_stats;
DROP POLICY IF EXISTS "Allow all" ON settings;

-- Step 4: Create new RLS policies that restrict to authenticated user
-- Goals
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- Habits
CREATE POLICY "Users can view own habits" ON habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own habits" ON habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own habits" ON habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own habits" ON habits FOR DELETE USING (auth.uid() = user_id);

-- Notes
CREATE POLICY "Users can view own notes" ON notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON notes FOR DELETE USING (auth.uid() = user_id);

-- Kanban Tasks
CREATE POLICY "Users can view own kanban" ON kanban_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own kanban" ON kanban_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own kanban" ON kanban_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own kanban" ON kanban_tasks FOR DELETE USING (auth.uid() = user_id);

-- Backlog Tasks
CREATE POLICY "Users can view own backlog" ON backlog_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own backlog" ON backlog_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own backlog" ON backlog_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own backlog" ON backlog_tasks FOR DELETE USING (auth.uid() = user_id);

-- Lists
CREATE POLICY "Users can view own lists" ON lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lists" ON lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lists" ON lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lists" ON lists FOR DELETE USING (auth.uid() = user_id);

-- Pomodoro Stats
CREATE POLICY "Users can view own pomo" ON pomodoro_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pomo" ON pomodoro_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pomo" ON pomodoro_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pomo" ON pomodoro_stats FOR DELETE USING (auth.uid() = user_id);

-- Settings
CREATE POLICY "Users can view own settings" ON settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON settings FOR DELETE USING (auth.uid() = user_id);

-- Done! Your database is now secured with user-based access control.
