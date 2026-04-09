/**
 * 查询 Supabase 中 Oxford 3000 和 IELTS 词汇数量
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// 加载环境变量
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVocabularyLists() {
  console.log('📊 查询 Supabase 中的词库数据...\n');

  // 统计 Oxford 3000 词汇数量
  const { count: oxfordCount, error: oxfordError } = await supabase
    .from('dictionary_metadata')
    .select('word', { count: 'exact', head: true })
    .eq('is_oxford_3000', true);

  if (oxfordError) {
    console.log('❌ 查询 Oxford 3000 词汇失败:', oxfordError.message);
    return;
  }

  console.log(`📚 Oxford 3000 词汇总数: ${oxfordCount}`);

  // 统计 IELTS 词汇数量
  const { count: ieltsCount, error: ieltsError } = await supabase
    .from('dictionary_metadata')
    .select('word', { count: 'exact', head: true })
    .eq('is_ielts', true);

  if (ieltsError) {
    console.log('❌ 查询 IELTS 词汇失败:', ieltsError.message);
    return;
  }

  console.log(`📝 IELTS 词汇总数: ${ieltsCount}`);

  // 获取 Oxford 3000 单词列表（用于补全词库文件）
  if (oxfordCount > 500) {
    console.log('\n📥 获取 Oxford 3000 完整列表...');
    const { data: oxfordWords, error: oxfordWordsError } = await supabase
      .from('dictionary_metadata')
      .select('word')
      .eq('is_oxford_3000', true)
      .order('word', { ascending: true });

    if (!oxfordWordsError && oxfordWords) {
      console.log(`✅ 成功获取 ${oxfordWords.length} 个 Oxford 3000 单词`);
      // 将结果保存到临时文件
      const fs = await import('fs');
      fs.writeFileSync(
        '/tmp/oxford_3000_full.json',
        JSON.stringify(oxfordWords.map(w => w.word), null, 2)
      );
      console.log('💾 已保存到 /tmp/oxford_3000_full.json');
    }
  }

  // 获取 IELTS 单词列表（用于补全词库文件）
  if (ieltsCount > 500) {
    console.log('\n📥 获取 IELTS 完整列表...');
    const { data: ieltsWords, error: ieltsWordsError } = await supabase
      .from('dictionary_metadata')
      .select('word')
      .eq('is_ielts', true)
      .order('word', { ascending: true });

    if (!ieltsWordsError && ieltsWords) {
      console.log(`✅ 成功获取 ${ieltsWords.length} 个 IELTS 单词`);
      // 将结果保存到临时文件
      const fs = await import('fs');
      fs.writeFileSync(
        '/tmp/ielts_full.json',
        JSON.stringify(ieltsWords.map(w => w.word), null, 2)
      );
      console.log('💾 已保存到 /tmp/ielts_full.json');
    }
  }
}

checkVocabularyLists().catch(console.error);
