/**
 * 检查 dictionary_metadata 表结构
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableStructure() {
  console.log('🔍 检查 dictionary_metadata 表结构...\n');

  // 使用 PostgreSQL 查询表结构
  const { data: columns, error } = await supabase
    .rpc('get_table_columns', { table_name: 'dictionary_metadata' });

  if (error) {
    console.log('❌ 无法查询表结构，尝试另一种方法...');

    // 直接查询一些数据看看结构
    const { data: sampleData, error: sampleError } = await supabase
      .from('dictionary_metadata')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('❌ 查询失败:', sampleError.message);
      return;
    }

    console.log('✅ 表结构（通过样本数据）:');
    console.log(JSON.stringify(sampleData, null, 2));
    return;
  }

  console.log('✅ 表结构:');
  console.log(columns);
}

checkTableStructure().catch(console.error);
