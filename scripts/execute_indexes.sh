#!/bin/bash

# 加载环境变量
source .env.local

# SQL 语句
SQL="
-- 启用 pg_trgm 扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- word 字段 GIN 索引
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_word_gin
ON public.dictionary_cache
USING gin (word gin_trgm_ops);

-- definitions 字段 GIN 索引
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_definitions_gin
ON public.dictionary_cache
USING gin (definitions);

-- word 字段升序索引
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_word_asc
ON public.dictionary_cache (word ASC);
"

echo "🚀 尝试通过 Supabase REST API 执行 SQL..."

# 尝试使用 Supabase SQL REST API
curl -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | jq -Rs .)}"

echo ""
echo "如果上面的请求失败，请手动访问 Supabase Dashboard 执行 SQL:"
echo "https://supabase.com/dashboard/project/cuxotlijjnxbsirpdkgr/sql"
