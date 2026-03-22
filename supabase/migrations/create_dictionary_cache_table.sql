-- ============================================
-- ShadowHub 词典缓存表创建脚本
-- ============================================

-- 创建 dictionary_cache 表存储单词释义缓存
CREATE TABLE IF NOT EXISTS public.dictionary_cache (
  word TEXT PRIMARY KEY,
  phonetic TEXT,
  definition_json JSONB NOT NULL,
  example TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  hit_count INTEGER DEFAULT 0
);

-- 添加注释
COMMENT ON TABLE public.dictionary_cache IS '词典缓存表 - 存储单词释义以减少 API 调用';
COMMENT ON COLUMN public.dictionary_cache.word IS '单词（小写，主键）';
COMMENT ON COLUMN public.dictionary_cache.phonetic IS '音标（如 /həˈləʊ/）';
COMMENT ON COLUMN public.dictionary_cache.definition_json IS '多语言释义 JSONB，格式：{"zh": "你好；问候", "vi": "xin chào", "en": "hello; greeting"}';
COMMENT ON COLUMN public.dictionary_cache.example IS '英文例句';
COMMENT ON COLUMN public.dictionary_cache.hit_count IS '缓存命中次数（用于统计热门词汇）';

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_definition_json ON public.dictionary_cache USING GIN(definition_json);
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_hit_count ON public.dictionary_cache(hit_count DESC);
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_updated_at ON public.dictionary_cache(updated_at DESC);

-- 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION update_dictionary_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dictionary_cache_updated_at
  BEFORE UPDATE ON public.dictionary_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_dictionary_cache_updated_at();

-- 创建函数：增加命中次数
CREATE OR REPLACE FUNCTION increment_cache_hit_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hit_count = OLD.hit_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：每次查询时增加命中次数（通过应用层调用）
-- 注意：PostgreSQL 没有内置的 SELECT 触发器，需要通过函数手动调用

-- ============================================
-- 缓存统计视图
-- ============================================

CREATE OR REPLACE VIEW dictionary_stats AS
SELECT
  COUNT(*) as total_words,
  COUNT(CASE WHEN hit_count > 0 THEN 1 END) as hit_words,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits,
  MAX(updated_at) as last_updated
FROM public.dictionary_cache;

COMMENT ON VIEW public.dictionary_stats IS '词典缓存统计视图';

-- ============================================
-- 辅助函数：获取或创建单词缓存
-- ============================================

CREATE OR REPLACE FUNCTION get_or_fetch_word_definition(
  p_word TEXT
) RETURNS TABLE (
  word TEXT,
  phonetic TEXT,
  definition_json JSONB,
  example TEXT,
  from_cache BOOLEAN
) AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- 1. 先查询缓存
  SELECT * INTO v_record
  FROM public.dictionary_cache
  WHERE word = LOWER(TRIM(p_word));

  -- 2. 如果命中，返回缓存数据
  IF FOUND THEN
    -- 增加命中计数（通过单独的 UPDATE）
    UPDATE public.dictionary_cache
    SET hit_count = hit_count + 1
    WHERE word = v_record.word;

    RETURN QUERY
    SELECT
      v_record.word,
      v_record.phonetic,
      v_record.definition_json,
      v_record.example,
      TRUE;
    RETURN;
  END IF;

  -- 3. 如果未命中，返回空记录（应用层需要调用 API 并插入）
  RETURN QUERY
  SELECT
    NULL::TEXT,
    NULL::TEXT,
    NULL::JSONB,
    NULL::TEXT,
    FALSE;
  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_fetch_word_definition IS '获取单词释义（优先从缓存）';

-- ============================================
-- 辅助函数：批量插入缓存
-- ============================================

CREATE OR REPLACE FUNCTION upsert_dictionary_cache(
  p_word TEXT,
  p_phonetic TEXT,
  p_definition_json JSONB,
  p_example TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.dictionary_cache (word, phonetic, definition_json, example)
  VALUES (
    LOWER(TRIM(p_word)),
    p_phonetic,
    p_definition_json,
    p_example
  )
  ON CONFLICT (word) DO UPDATE SET
    phonetic = EXCLUDED.phonetic,
    definition_json = EXCLUDED.definition_json,
    example = EXCLUDED.example,
    updated_at = NOW();

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to upsert dictionary cache for word: %', p_word;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_dictionary_cache IS '插入或更新词典缓存';

-- ============================================
-- 完成提示
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'dictionary_cache 表创建完成！';
  RAISE NOTICE '功能：';
  RAISE NOTICE '1. 单词释义缓存（减少 API 调用）';
  RAISE NOTICE '2. 命中统计（track hit_count）';
  RAISE NOTICE '3. 辅助函数：get_or_fetch_word_definition(), upsert_dictionary_cache()';
  RAISE NOTICE '';
  RAISE NOTICE '接下来需要：';
  RAISE NOTICE '1. 在 Supabase Dashboard 执行此 SQL';
  RAISE NOTICE '2. 更新 /api/word-definition 路由使用缓存逻辑';
  RAISE NOTICE '3. 创建后台脚本预生成常用词汇缓存';
END $$;
