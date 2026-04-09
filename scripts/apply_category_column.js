/**
 * 检查并添加 category 列
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 检查 category 列...\n');

  // 尝试查询 category 列
  const { data, error } = await supabase
    .from('dictionary_cache')
    .select('category')
    .limit(1);

  if (error && error.message.includes('column')) {
    console.log('❌ category 列不存在');
    console.log('ℹ️  请在 Supabase 控制台执行以下 SQL:\n');
    console.log('-- 添加 category 列');
    console.log('ALTER TABLE public.dictionary_cache ADD COLUMN IF NOT EXISTS category TEXT;');
    console.log('\n-- 添加索引');
    console.log('CREATE INDEX IF NOT EXISTS idx_dictionary_cache_category ON public.dictionary_cache(category);');
  } else if (error) {
    console.log('❌ 其他错误:', error.message);
  } else {
    console.log('✅ category 列已存在');
  }
}

main().catch(console.error);
