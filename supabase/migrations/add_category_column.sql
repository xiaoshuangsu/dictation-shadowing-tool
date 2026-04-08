-- 添加 category 列到 dictionary_cache 表
ALTER TABLE public.dictionary_cache
ADD COLUMN IF NOT EXISTS category TEXT;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_category
ON public.dictionary_cache(category);

-- 添加复合索引（category + word）
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_category_word
ON public.dictionary_cache(category, word);

-- 查看添加结果
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'dictionary_cache'
    AND column_name = 'category';
