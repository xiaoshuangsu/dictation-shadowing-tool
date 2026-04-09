/**
 * 创建 category 字段索引以优化查询性能
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 检查并创建 category 索引...\n');

  // 直接通过 SQL 执行
  const { data, error } = await supabase
    .from('dictionary_cache')
    .select('word')
    .limit(1);

  if (error) {
    console.error('❌ 测试查询失败:', error.message);
    return;
  }

  console.log('✅ 测试查询成功');
  console.log('\n⚠️  请在 Supabase 控制台执行以下 SQL：\n');

  const sqlStatements = [
    '-- 1. 创建 category 字段索引（支持 LIKE 查询）',
    'CREATE INDEX IF NOT EXISTS idx_dictionary_cache_category_like ',
    'ON public.dictionary_cache USING gin (category gin_trgm_ops);',
    '',
    '-- 2. 如果 pg_trgm 扩展未启用，先启用它',
    'CREATE EXTENSION IF NOT EXISTS pg_trgm;',
    '',
    '-- 3. 或者使用简单的 B-tree 索引（对于精确匹配和前缀查询更快）',
    'CREATE INDEX IF NOT EXISTS idx_dictionary_cache_category ',
    'ON public.dictionary_cache(category);',
    '',
    '-- 4. 验证索引',
    "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'dictionary_cache';"
  ];

  sqlStatements.forEach(sql => console.log(sql));
}

main().catch(console.error);
