-- ============================================
-- 添加音频字段到 dictionary_cache 表
-- ============================================

-- 添加美音和英音音频 URL 字段
ALTER TABLE public.dictionary_cache
ADD COLUMN IF NOT EXISTS audio_url_us TEXT,
ADD COLUMN IF NOT EXISTS audio_url_uk TEXT;

-- 添加注释
COMMENT ON COLUMN public.dictionary_cache.audio_url_us IS '美音音频 URL（来自 dictionaryapi.dev 或 Google TTS）';
COMMENT ON COLUMN public.dictionary_cache.audio_url_uk IS '英音音频 URL（来自 dictionaryapi.dev 或 Google TTS）';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE 'dictionary_cache 表添加音频字段完成！';
  RAISE NOTICE '新增字段：audio_url_us, audio_url_uk';
END $$;
