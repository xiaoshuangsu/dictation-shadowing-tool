-- 创建 RPC 函数：原子性地累加今日 Dictation 和 Shadowing 数据

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.increment_today_dictation;
DROP FUNCTION IF EXISTS public.increment_today_shadowing;

-- 创建 Dictation 累加函数
CREATE OR REPLACE FUNCTION public.increment_today_dictation(
  p_user_id UUID,
  p_date DATE
)
RETURNS VOID AS $$
BEGIN
  -- 插入新记录（如果不存在）或累加计数
  INSERT INTO public.daily_records (user_id, date, dictation_count, shadowing_minutes, completed)
  VALUES (
    p_user_id,
    p_date,
    1,
    0,
    false
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    dictation_count = daily_records.dictation_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建 Shadowing 累加函数
CREATE OR REPLACE FUNCTION public.increment_today_shadowing(
  p_user_id UUID,
  p_date DATE,
  p_minutes INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- 插入新记录（如果不存在）或累加时间
  INSERT INTO public.daily_records (user_id, date, dictation_count, shadowing_minutes, completed)
  VALUES (
    p_user_id,
    p_date,
    0,
    p_minutes,
    false
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    shadowing_minutes = daily_records.shadowing_minutes + p_minutes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授权执行
GRANT EXECUTE ON FUNCTION public.increment_today_dictation TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_today_shadowing TO authenticated;

-- 验证
DO $$
BEGIN
  RAISE NOTICE '✅ RPC 函数创建成功！';
  RAISE NOTICE '1. increment_today_dictation - 原子性地累加 dictation_count';
  RAISE NOTICE '2. increment_today_shadowing - 原子性地累加 shadowing_minutes';
  RAISE NOTICE '这些函数使用 ON CONFLICT DO UPDATE，确保不会重复计算';
END $$;
