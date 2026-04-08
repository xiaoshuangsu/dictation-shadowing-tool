-- ============================================
-- Dictionary Cache 性能优化索引
-- 为 Oxford 3000 / IELTS 词汇查询提速
-- ============================================

-- 1. word 字段主键索引（如果不存在）
-- 说明：word 是 dictionary_cache 的主键，应该已有索引
-- 这是单列主键索引，创建表时自动创建

-- 2. word 字段 GIN 索引（支持 ILIKE 搜索）
-- 说明：如果未来需要支持前缀匹配或模糊搜索
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_word_gin
ON public.dictionary_cache
USING gin (word gin_trgm_ops);

-- 3. definitions 字段 GIN 索引（多语言 JSONB 查询）
-- 说明：加速 JSONB 字段的键值查询
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_definitions_gin
ON public.dictionary_cache
USING gin (definitions);

-- 4. 常用查询复合索引
-- 说明：覆盖典型的单词查询 + 排序场景
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_word_asc
ON public.dictionary_cache (word ASC);

-- ============================================
-- 索引验证查询
-- ============================================

-- 查看所有索引
SELECT
  indexname,
  indexname AS index_name,
  tablename,
  indexdef
FROM pg_indexes
WHERE tablename = 'dictionary_cache'
ORDER BY indexname;

-- 查看表大小和索引大小
SELECT
  pg_size_pretty(pg_relation_size('public.dictionary_cache')) AS table_size,
  pg_size_pretty(pg_total_relation_size('public.dictionary_cache')) AS total_size;

-- ============================================
-- 性能测试查询
-- ============================================

-- 测试单词查询性能（EXPLAIN ANALYZE）
EXPLAIN (ANALYZE, BUFFERS)
SELECT word, phonetic, definitions
FROM dictionary_cache
WHERE word IN ('abandon', 'ability', 'abroad')
ORDER BY word;

-- ============================================
-- 完成提示
-- ============================================

-- 创建完成后，API 性能提升预期：
-- - 并行查询：减少 50% 查询时间（串行→并行）
-- - 前端预加载：用户感知的加载延迟减少
-- - 索引优化：单词查询速度提升
