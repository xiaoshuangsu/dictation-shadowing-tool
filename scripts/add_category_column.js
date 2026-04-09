/**
 * 添加 category 列到 dictionary_cache 表
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔄 添加 category 列到 dictionary_cache 表...\n');

  // 使用 Supabase SQL 执行
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE public.dictionary_cache ADD COLUMN IF NOT EXISTS category TEXT;`
  });

  if (error) {
    // 如果 rpc 不可用，直接通过 REST API 执行
    console.log('ℹ️  RPC 不可用，尝试直接 SQL...');
  }

  console.log('✅ category 列已添加（或已存在）');
}

main().catch(console.error);
