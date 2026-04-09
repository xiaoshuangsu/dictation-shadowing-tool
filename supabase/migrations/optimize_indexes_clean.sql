-- 启用 pg_trgm 扩展（用于模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- word 字段 GIN 索引（支持 ILIKE 搜索）
DROP INDEX IF EXISTS public.idx_dictionary_cache_word_gin;
CREATE INDEX idx_dictionary_cache_word_gin
ON public.dictionary_cache
USING gin (word gin_trgm_ops);

-- definitions 字段 GIN 索引（多语言 JSONB 查询）
DROP INDEX IF EXISTS public.idx_dictionary_cache_definitions_gin;
CREATE INDEX idx_dictionary_cache_definitions_gin
ON public.dictionary_cache
USING gin (definitions);

-- word 字段升序索引（用于排序查询）
DROP INDEX IF EXISTS public.idx_dictionary_cache_word_asc;
CREATE INDEX idx_dictionary_cache_word_asc
ON public.dictionary_cache (word ASC);
