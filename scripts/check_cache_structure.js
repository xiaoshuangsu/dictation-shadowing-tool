/**
 * 检查 dictionary_cache 表结构
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCacheStructure() {
  console.log('🔍 检查 dictionary_cache 表结构...\n');

  // 查询一些样本数据
  const { data: sampleData, error } = await supabase
    .from('dictionary_cache')
    .select('*')
    .limit(1);

  if (error) {
    console.log('❌ 查询失败:', error.message);
    return;
  }

  if (sampleData && sampleData.length > 0) {
    console.log('✅ 表结构（通过样本数据）:');
    console.log('字段列表:', Object.keys(sampleData[0]).join(', '));
    console.log('\n示例数据:');
    console.log(JSON.stringify(sampleData[0], null, 2));
  }

  // 统计总词汇数
  const { count, error: countError } = await supabase
    .from('dictionary_cache')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`\n📊 总词汇数: ${count}`);
  }
}

checkCacheStructure().catch(console.error);
