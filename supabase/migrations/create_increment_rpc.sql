-- 创建 RPC 函数：原子性地累加统计数据

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.increment_today_dictation;
DROP FUNCTION IF EXISTS public.increment_today_shadowing;
DROP FUNCTION IF EXISTS public.increment_user_stats_dictation;
DROP FUNCTION IF EXISTS public.increment_user_stats_shadowing;

-- 创建 Dictation 累加函数（每日记录）
CREATE OR REPLACE FUNCTION public.increment_today_dictation(
  p_user_id UUID,
  p_date DATE
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.daily_records (user_id, date, dictation_count, shadowing_minutes, completed)
  VALUES (p_user_id, p_date, 1, 0, false)
  ON CONFLICT (user_id, date) DO UPDATE SET
    dictation_count = daily_records.dictation_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建 Shadowing 累加函数（每日记录）
CREATE OR REPLACE FUNCTION public.increment_today_shadowing(
  p_user_id UUID,
  p_date DATE,
  p_minutes INTEGER
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.daily_records (user_id, date, dictation_count, shadowing_minutes, completed)
  VALUES (p_user_id, p_date, 0, p_minutes, false)
  ON CONFLICT (user_id, date) DO UPDATE SET
    shadowing_minutes = daily_records.shadowing_minutes + p_minutes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建 Shadowing 累加函数（用户统计，支持浮点数累加）
CREATE OR REPLACE FUNCTION public.increment_user_stats_shadowing(
  p_user_id UUID,
  p_minutes FLOAT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_stats
  SET
    total_shadowing_minutes = CEIL(user_stats.total_shadowing_minutes + p_minutes),
    total_shadowing_sessions = user_stats.total_shadowing_sessions + 1
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建 Dictation 累加函数（用户统计，支持浮点数累加）
CREATE OR REPLACE FUNCTION public.increment_user_stats_dictation(
  p_user_id UUID,
  p_minutes FLOAT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_stats
  SET
    total_dictation_minutes = CEIL(user_stats.total_dictation_minutes + p_minutes),
    total_dictation_sentences = user_stats.total_dictation_sentences + 1
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授权执行
GRANT EXECUTE ON FUNCTION public.increment_today_dictation TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_today_shadowing TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_stats_shadowing TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_stats_dictation TO authenticated;

-- 验证
DO $$
BEGIN
  RAISE NOTICE '✅ RPC 函数创建成功！';
  RAISE NOTICE '1. increment_today_dictation - 原子性地累加每日 dictation_count';
  RAISE NOTICE '2. increment_today_shadowing - 原子性地累加每日 shadowing_minutes';
  RAISE NOTICE '3. increment_user_stats_shadowing - 累加浮点数后再取整，避免每句单独取整';
  RAISE NOTICE '4. increment_user_stats_dictation - 累加浮点数后再取整，避免每句单独取整';
END $$;
