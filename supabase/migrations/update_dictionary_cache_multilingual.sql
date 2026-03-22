-- ============================================
-- 词典缓存表多语言优化
-- ============================================

-- 1. 重命名字段并更新结构
ALTER TABLE public.dictionary_cache
  RENAME COLUMN definition_json TO definitions;

-- 2. 更新注释
COMMENT ON COLUMN public.dictionary_cache.definitions IS '多语言释义 JSONB，格式：{"zh-CN": "...", "zh-Hant": "...", "vi": "..."}';
COMMENT ON TABLE public.dictionary_cache IS '词典缓存表 - 支持动态多语言释义';

-- 3. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_definitions ON public.dictionary_cache USING GIN(definitions);

-- 4. 更新现有数据（如果有的话）
-- 将旧的 definition_json 格式迁移到新的多语言格式
UPDATE public.dictionary_cache
SET definitions = jsonb_build_object(
  'zh-CN', COALESCE(definitions->>'zh', ''),
  'zh-Hant', '',
  'vi', COALESCE(definitions->>'vi', ''),
  'en', COALESCE(definitions->>'en', '')
)
WHERE definitions ? 'zh' OR definitions ? 'vi';

-- 5. 创建语言配置表（用于管理支持的语言）
CREATE TABLE IF NOT EXISTS public.supported_languages (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0
);

COMMENT ON TABLE public.supported_languages IS '支持的语言配置表';

-- 6. 插入当前支持的语言
INSERT INTO public.supported_languages (code, name, native_name, is_active, priority) VALUES
  ('zh-CN', 'Simplified Chinese', '简体中文', true, 1),
  ('zh-Hant', 'Traditional Chinese', '繁體中文', true, 2),
  ('vi', 'Vietnamese', 'Tiếng Việt', true, 3),
  ('en', 'English', 'English', false, 0)
ON CONFLICT (code) DO NOTHING;

-- 7. 创建视图查询当前配置
CREATE OR REPLACE VIEW current_language_config AS
SELECT code, name, native_name, priority
FROM public.supported_languages
WHERE is_active
ORDER BY priority ASC;

COMMENT ON VIEW current_language_config IS '当前启用的语言配置';

-- 8. 创建函数：获取缺失的语言
CREATE OR REPLACE FUNCTION get_missing_languages(
  p_word TEXT,
  p_target_languages TEXT[]
) RETURNS TEXT[] AS $$
DECLARE
  v_cached_def JSONB;
  v_missing TEXT[] := '{}';
  v_lang TEXT;
BEGIN
  -- 获取缓存中的释义
  SELECT definitions INTO v_cached_def
  FROM public.dictionary_cache
  WHERE word = LOWER(TRIM(p_word));

  -- 如果没有缓存，返回所有目标语言
  IF v_cached_def IS NULL THEN
    RETURN p_target_languages;
  END IF;

  -- 检查每个目标语言是否存在
  FOREACH v_lang IN ARRAY p_target_languages
  LOOP
    IF NOT (v_cached_def ? v_lang) OR v_cached_def->>v_lang = '' THEN
      v_missing := array_append(v_missing, v_lang);
    END IF;
  END LOOP;

  RETURN v_missing;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_missing_languages IS '获取单词缺失的语言释义';

-- 9. 完成提示
DO $$
BEGIN
  RAISE NOTICE '词典缓存表多语言优化完成！';
  RAISE NOTICE '1. definition_json 已重命名为 definitions';
  RAISE NOTICE '2. 新建 supported_languages 语言配置表';
  RAISE NOTICE '3. 创建 get_missing_languages() 函数用于断点续传';
  RAISE NOTICE '';
  RAISE NOTICE '数据格式示例：';
  RAISE NOTICE '{';
  RAISE NOTICE '  "zh-CN": "你好；问候",';
  RAISE NOTICE '  "zh-Hant": "你好；問候",';
  RAISE NOTICE '  "vi": "xin chào; chào hỏi",';
  RAISE NOTICE '  "en": "a greeting; hello"';
  RAISE NOTICE '}';
END $$;
