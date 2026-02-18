-- Update daily goal: 10 dictation sentences OR 10 shadowing minutes

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_calculate_daily_completed ON public.daily_records;

-- Recreate function with new targets
CREATE OR REPLACE FUNCTION calculate_daily_completed()
RETURNS TRIGGER AS $$
DECLARE
  target_dictation INTEGER := 10;
  target_shadowing INTEGER := 10;
BEGIN
  -- Check if daily goal is completed
  IF NEW.dictation_count >= target_dictation OR NEW.shadowing_minutes >= target_shadowing THEN
    NEW.completed := true;

    -- Update user streak data
    UPDATE public.user_profiles
    SET
      current_streak = CASE
        WHEN last_completed_date = CURRENT_DATE - INTERVAL '1 day'
        THEN current_streak + 1
        WHEN last_completed_date IS NULL OR last_completed_date < CURRENT_DATE - INTERVAL '1 day'
        THEN 1
        ELSE current_streak
      END,
      max_streak = GREATEST(max_streak,
        CASE
          WHEN last_completed_date = CURRENT_DATE - INTERVAL '1 day'
          THEN current_streak + 1
          WHEN last_completed_date IS NULL OR last_completed_date < CURRENT_DATE - INTERVAL '1 day'
          THEN 1
          ELSE current_streak
        END
      ),
      last_completed_date = CURRENT_DATE
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_calculate_daily_completed
  BEFORE INSERT OR UPDATE ON public.daily_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_daily_completed();

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Daily goal updated to 10 dictation sentences OR 10 shadowing minutes';
END $$;
