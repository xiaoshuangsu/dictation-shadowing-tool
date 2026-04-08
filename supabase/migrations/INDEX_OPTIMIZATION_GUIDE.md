# SQL 索引优化执行指南

由于技术限制无法自动执行，请手动执行以下 SQL 语句以优化性能。

## 执行方法

### 方法一：Supabase Dashboard（推荐）

1. 访问: https://supabase.com/dashboard/project/cuxotlijjnxbsirpdkgr/sql
2. 复制下面的 SQL 语句
3. 粘贴到 SQL 编辑器
4. 点击 "Run" 按钮

### 方法二：使用 psql 命令行

如果您有 `DATABASE_URL` 环境变量：

```bash
psql "$DATABASE_URL" -f supabase/migrations/optimize_dictionary_cache_indexes.sql
```

## SQL 语句

```sql
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
```

## 验证索引

执行完成后，运行以下查询验证索引是否创建成功：

```sql
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'dictionary_cache'
ORDER BY indexname;
```

应该看到以下索引：
- `idx_dictionary_cache_word_gin`
- `idx_dictionary_cache_definitions_gin`
- `idx_dictionary_cache_word_asc`

## 性能预期

- 并行查询：减少 50% 查询时间
- 单词查询速度提升：在 5000+ 词量下达到毫秒级检索
- JSONB 查询优化：多语言定义查询更快
