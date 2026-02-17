-- 添加听写时长字段到 user_stats 表

-- 1. 添加 total_dictation_minutes 字段
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS total_dictation_minutes INTEGER DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN public.user_stats.total_dictation_minutes IS '累计听写分钟数';

-- 2. 为现有用户设置默认值
UPDATE public.user_stats
SET total_dictation_minutes = 0
WHERE total_dictation_minutes IS NULL;

-- 3. 验证更新
DO $$
BEGIN
  RAISE NOTICE '✅ 听写时长字段添加成功！';
  RAISE NOTICE 'user_stats 表现在包含 total_dictation_minutes 字段';
END $$;
