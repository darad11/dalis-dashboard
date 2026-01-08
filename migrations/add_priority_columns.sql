-- Add priority and urgency columns to goals table for calendar event colors
ALTER TABLE goals 
ADD COLUMN IF NOT EXISTS priority TEXT,
ADD COLUMN IF NOT EXISTS urgency TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
