-- ============================================
-- 添加音频相关字段到 user_words 表
-- ============================================

-- 添加 audio_timestamp 字段（音频时间戳，用于跳转播放）
ALTER TABLE public.user_words
ADD COLUMN IF NOT EXISTS audio_timestamp DOUBLE PRECISION;

-- 添加 audio_url 字段（音频 URL，用于播放）
ALTER TABLE public.user_words
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- 添加注释
COMMENT ON COLUMN public.user_words.audio_timestamp IS '音频时间戳（秒），用于跳转到该单词在音频中的位置';
COMMENT ON COLUMN public.user_words.audio_url IS '音频 URL，用于播放该单词所在句子的音频';

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_words_audio_timestamp ON public.user_words(audio_timestamp);

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE 'user_words 表添加音频字段完成！';
  RAISE NOTICE '新增字段：audio_timestamp, audio_url';
END $$;
