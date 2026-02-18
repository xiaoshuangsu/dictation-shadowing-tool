-- 添加真实播放时长字段（秒）
-- 用于记录实际音频播放时间，特别是 Shadowing 练习

ALTER TABLE public.practice_records
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

COMMENT ON COLUMN public.practice_records.duration_seconds IS '实际音频播放时长（秒），用于 Shadowing 等需要真实播放时间的练习模式';

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_practice_records_duration ON public.practice_records(user_id, practice_mode, duration_seconds);

-- 验证
DO $$
BEGIN
  RAISE NOTICE '✅ duration_seconds 字段添加成功！';
  RAISE NOTICE '该字段用于记录真实音频播放时长（秒）';
  RAISE NOTICE '统计逻辑：total_shadowing_minutes = SUM(duration_seconds) / 60';
END $$;
