-- 为 user_words 表添加复习相关字段
-- 执行时间：2026-03-22

-- 1. 添加 next_review_at 字段（下次复习时间）
ALTER TABLE user_words
ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. 添加 review_level 字段（复习级别 0-5）
ALTER TABLE user_words
ADD COLUMN IF NOT EXISTS review_level INTEGER DEFAULT 0;

-- 3. 添加注释
COMMENT ON COLUMN user_words.next_review_at IS '下次复习时间（默认为当前时间）';
COMMENT ON COLUMN user_words.review_level IS '复习级别：0-5（0=新词，5=完全掌握）';

-- 4. 创建索引（优化查询性能）
CREATE INDEX IF NOT EXISTS idx_user_words_next_review_at
ON user_words(next_review_at);

CREATE INDEX IF NOT EXISTS idx_user_words_review_level
ON user_words(review_level);

-- 验证字段是否添加成功
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_words'
AND column_name IN ('next_review_at', 'review_level')
ORDER BY column_name;
