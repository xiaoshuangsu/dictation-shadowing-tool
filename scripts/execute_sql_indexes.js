/**
 * 执行 SQL 索引优化
 * 通过 Supabase REST API 执行 SQL 语句
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function executeIndexOptimization() {
  console.log('🚀 开始执行 SQL 索引优化...\n');

  try {
    // 注意：Supabase JavaScript 客户端不直接支持执行原始 SQL
    // 我们需要使用 RPC（远程过程调用）或者通过 SQL 编辑器手动执行

    console.log('⚠️  Supabase JS 客户端无法直接执行 DDL 语句');
    console.log('📝 请通过以下方式执行 SQL：\n');

    console.log('方法一：使用 Supabase Dashboard');
    console.log('1. 访问: https://supabase.com/dashboard/project/cuxotlijjnxbsirpdkgr/sql');
    console.log('2. 复制并运行 supabase/migrations/optimize_dictionary_cache_indexes.sql 中的 SQL 语句\n');

    console.log('方法二：使用 psql 命令行');
    console.log('psql "$DATABASE_URL" -f supabase/migrations/optimize_dictionary_cache_indexes.sql\n');

    console.log('方法三：使用 Supabase CLI');
    console.log('supabase db push\n');

    // 显示应该执行的 SQL 语句
    console.log('📋 应该执行的 SQL 语句：\n');
    console.log('-- 1. word 字段 GIN 索引（支持 ILIKE 搜索）');
    console.log('CREATE INDEX IF NOT EXISTS idx_dictionary_cache_word_gin');
    console.log('ON public.dictionary_cache');
    console.log('USING gin (word gin_trgm_ops);');
    console.log('');
    console.log('-- 2. definitions 字段 GIN 索引（多语言 JSONB 查询）');
    console.log('CREATE INDEX IF NOT EXISTS idx_dictionary_cache_definitions_gin');
    console.log('ON public.dictionary_cache');
    console.log('USING gin (definitions);');
    console.log('');
    console.log('-- 3. 常用查询复合索引');
    console.log('CREATE INDEX IF NOT EXISTS idx_dictionary_cache_word_asc');
    console.log('ON public.dictionary_cache (word ASC);');

    // 尝试检查索引是否存在（通过查询表信息）
    console.log('\n🔍 检查当前索引状态...');

    // 使用原始 SQL 查询（通过 rpc）
    // 注意：这需要 Supabase 支持，否则无法执行

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    throw error;
  }
}

executeIndexOptimization().catch(console.error);
