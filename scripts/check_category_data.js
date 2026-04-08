/**
 * 检查 category 字段数据状态
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 检查 category 字段数据...\n');

  // 检查 oxford
  const { count: oxfordCount, error: oxfordError } = await supabase
    .from('dictionary_cache')
    .select('word', { count: 'exact', head: true })
    .like('category', '%oxford%');

  console.log('✅ LIKE %oxford%:', oxfordCount || 0, '个单词');
  if (oxfordError) console.error('❌ 错误:', oxfordError);

  // 检查精确匹配
  const { count: exactCount, error: exactError } = await supabase
    .from('dictionary_cache')
    .select('word', { count: 'exact', head: true })
    .eq('category', 'oxford');

  console.log('✅ = oxford:', exactCount || 0, '个单词');
  if (exactError) console.error('❌ 错误:', exactError);

  // 检查字段是否存在
  const { data: sampleData, error: sampleError } = await supabase
    .from('dictionary_cache')
    .select('word, category, definitions')
    .like('category', '%oxford%')
    .limit(3);

  if (sampleError) {
    console.error('❌ 查询示例失败:', sampleError.message);
  } else {
    console.log('\n📋 示例数据:');
    sampleData.forEach(d => {
      console.log('  -', d.word, '| category:', d.category, '| has definitions:', !!d.definitions);
    });
  }
}

main().catch(console.error);
