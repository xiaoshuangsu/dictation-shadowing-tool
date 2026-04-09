-- Migration: Make user_words.definition nullable
-- Date: 2026-04-09
-- Purpose: Remove NOT NULL constraint from definition field
-- Reason: Definition should be fetched from dictionary cache, not required in user_words

-- Make definition nullable
ALTER TABLE user_words ALTER COLUMN definition DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_words.definition IS 'Optional: Will be fetched from dictionary_cache or vocabulary_words';
