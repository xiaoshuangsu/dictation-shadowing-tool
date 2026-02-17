-- V3 数据留存系统 - 数据库更新脚本
-- 执行前请备份数据库

-- ============================================
-- 1. 更新 user_profiles 表，添加连胜相关字段
-- ============================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_completed_date DATE;

-- 添加注释
COMMENT ON COLUMN public.user_profiles.current_streak IS '当前连续学习天数';
COMMENT ON COLUMN public.user_profiles.max_streak IS '历史最高连续学习天数';
COMMENT ON COLUMN public.user_profiles.last_completed_date IS '最后完成学习目标的日期';

-- ============================================
-- 2. 创建 user_stats 表（累计统计）
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_dictation_sentences INTEGER DEFAULT 0,
  total_shadowing_minutes INTEGER DEFAULT 0,
  total_shadowing_sessions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE public.user_stats IS '用户累计统计数据';
COMMENT ON COLUMN public.user_stats.total_dictation_sentences IS '累计听写句数';
COMMENT ON COLUMN public.user_stats.total_shadowing_minutes IS '累计Shadowing分钟数';
COMMENT ON COLUMN public.user_stats.total_shadowing_sessions IS '累计Shadowing次数';

-- ============================================
-- 3. 创建 daily_records 表（每日记录）
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  dictation_count INTEGER DEFAULT 0,
  shadowing_minutes INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 确保每个用户每天只有一条记录
  UNIQUE(user_id, date)
);

-- 添加注释
COMMENT ON TABLE public.daily_records IS '每日学习记录表';
COMMENT ON COLUMN public.daily_records.dictation_count IS '当天听写句数';
COMMENT ON COLUMN public.daily_records.shadowing_minutes IS '当天Shadowing分钟数';
COMMENT ON COLUMN public.daily_records.completed IS '是否完成当天学习目标（听写≥3句 或 Shadowing≥5分钟）';

-- ============================================
-- 4. 创建索引优化查询性能
-- ============================================

-- user_stats 索引
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON public.user_stats(user_id);

-- daily_records 索引
CREATE INDEX IF NOT EXISTS idx_daily_records_user_id ON public.daily_records(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON public.daily_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON public.daily_records(user_id, date DESC);

-- ============================================
-- 5. 启用 Row Level Security
-- ============================================

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. 创建 RLS 策略
-- ============================================

-- user_stats：用户只能读写自己的统计数据
CREATE POLICY "Users can view own stats"
  ON public.user_stats FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own stats"
  ON public.user_stats FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own stats"
  ON public.user_stats FOR UPDATE
  USING (user_id = auth.uid());

-- daily_records：用户只能读写自己的每日记录
CREATE POLICY "Users can view own daily records"
  ON public.daily_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own daily records"
  ON public.daily_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own daily records"
  ON public.daily_records FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- 7. 创建触发器自动更新 updated_at
-- ============================================

-- user_stats 触发器
CREATE OR REPLACE FUNCTION update_user_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats_updated_at
  BEFORE UPDATE ON public.user_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_updated_at();

-- daily_records 触发器
CREATE OR REPLACE FUNCTION update_daily_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_daily_records_updated_at
  BEFORE UPDATE ON public.daily_records
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_records_updated_at();

-- ============================================
-- 8. 创建连胜计算函数
-- ============================================

CREATE OR REPLACE FUNCTION calculate_daily_completed()
RETURNS TRIGGER AS $$
DECLARE
  target_dictation INTEGER := 3;
  target_shadowing INTEGER := 5;
BEGIN
  -- 检查是否完成当天目标
  IF NEW.dictation_count >= target_dictation OR NEW.shadowing_minutes >= target_shadowing THEN
    NEW.completed := true;

    -- 更新用户连胜数据
    UPDATE public.user_profiles
    SET
      -- 如果昨天完成，则当前连胜+1；否则重置为1
      current_streak = CASE
        WHEN last_completed_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
        WHEN last_completed_date = CURRENT_DATE THEN current_streak
        ELSE 1
      END,
      -- 更新最高连胜
      max_streak = GREATEST(
        max_streak,
        CASE
          WHEN last_completed_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
          WHEN last_completed_date = CURRENT_DATE THEN current_streak
          ELSE 1
        END
      ),
      -- 更新最后完成日期
      last_completed_date = CURRENT_DATE
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：在插入或更新 daily_records 时自动计算连胜
CREATE TRIGGER trigger_calculate_daily_completed
  BEFORE INSERT OR UPDATE ON public.daily_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_daily_completed();

-- ============================================
-- 9. 为现有用户初始化 user_stats 记录
-- ============================================

INSERT INTO public.user_stats (user_id, total_dictation_sentences, total_shadowing_minutes, total_shadowing_sessions)
SELECT
  id,
  0, -- 初始值，可以从 practice_records 表汇总
  0,
  0
FROM public.user_profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_stats WHERE user_stats.user_id = user_profiles.id
);

-- ============================================
-- 10. 可选：从 practice_records 汇总历史数据到 user_stats
-- ============================================

-- 这个脚本可以运行一次来初始化统计数据
-- 之后的数据更新应该通过应用层逻辑完成

/*
INSERT INTO public.user_stats (user_id, total_dictation_sentences, total_shadowing_sessions)
SELECT
  user_id,
  COUNT(*) FILTER (WHERE practice_mode = 'dictation'),
  COUNT(*) FILTER (WHERE practice_mode = 'shadowing')
FROM public.practice_records
GROUP BY user_id
ON CONFLICT (user_id)
DO UPDATE SET
  total_dictation_sentences = EXCLUDED.total_dictation_sentences,
  total_shadowing_sessions = EXCLUDED.total_shadowing_sessions;
*/

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'V3 数据留存系统数据库更新完成！';
  RAISE NOTICE '请验证以下内容：';
  RAISE NOTICE '1. user_profiles 表是否包含 current_streak, max_streak, last_completed_date 字段';
  RAISE NOTICE '2. user_stats 表是否创建成功';
  RAISE NOTICE '3. daily_records 表是否创建成功';
  RAISE NOTICE '4. 索引和 RLS 策略是否正确设置';
END $$;
