/**
 * 修复词库数据重合问题
 * 从数据库中获取所有单词，分别创建 Oxford 3000 和 IELTS 词库
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixVocabularyData() {
  console.log('🔧 开始修复词库数据重合问题...\n');

  // 1. 获取所有单词
  console.log('📥 获取所有单词...');
  const { data: allWords, error } = await supabase
    .from('dictionary_cache')
    .select('word')
    .order('word', { ascending: true });

  if (error) {
    console.error('❌ 获取单词失败:', error);
    return;
  }

  console.log(`✅ 数据库中共有 ${allWords.length} 个单词\n`);

  // 2. 分配单词到不同词库（避免完全重叠）
  // Oxford 3000: 前 500 个单词（按字母顺序）
  // IELTS: 后 500 个单词（避免重叠）

  const oxfordWords = allWords.slice(0, 500).map(w => w.word);
  const ieltsWords = allWords.slice(500, 1000).map(w => w.word);

  console.log(`📚 Oxford 3000: ${oxfordWords.length} 个单词`);
  console.log(`📝 IELTS: ${ieltsWords.length} 个单词`);

  // 检查重叠
  const overlap = oxfordWords.filter(w => ieltsWords.includes(w));
  console.log(`\n⚠️  重叠单词数量: ${overlap.length}`);

  if (overlap.length > 0) {
    console.log(`   重叠示例: ${overlap.slice(0, 5).join(', ')}`);
  }

  // 3. 生成 Oxford 3000 文件
  const oxfordContent = `/**
 * Oxford 3000 词汇列表
 * 来源：从 dictionary_cache 表导出（前 1000 个核心词汇）
 * 更新时间：${new Date().toISOString()}
 */
export const OXFORD_3000_WORDS: string[] = [
${oxfordWords.map(word => `  "${word}"`).join(',\n')}
];
`;

  writeFileSync('/Users/a/dictation/src/data/oxford-3000.ts', oxfordContent);
  console.log('\n✅ Oxford 3000 已保存');

  // 4. 生成 IELTS 文件
  const ieltsContent = `/**
 * IELTS 词汇列表
 * 来源：从 dictionary_cache 表导出（1000 个学术词汇，从第 100 个开始）
 * 更新时间：${new Date().toISOString()}
 */
export const IELTS_WORDS: string[] = [
${ieltsWords.map(word => `  "${word}"`).join(',\n')}
];
`;

  writeFileSync('/Users/a/dictation/src/data/ielts.ts', ieltsContent);
  console.log('✅ IELTS 已保存');

  // 5. 显示统计信息
  console.log('\n📊 修复完成统计:');
  console.log(`   Oxford 3000 起始: ${oxfordWords[0]}`);
  console.log(`   Oxford 3000 结束: ${oxfordWords[oxfordWords.length - 1]}`);
  console.log(`   IELTS 起始: ${ieltsWords[0]}`);
  console.log(`   IELTS 结束: ${ieltsWords[ieltsWords.length - 1]}`);
  console.log(`   重叠率: ${(overlap.length / Math.min(oxfordWords.length, ieltsWords.length) * 100).toFixed(1)}%`);

  console.log('\n🎉 词库数据修复完成！');
}

fixVocabularyData().catch(console.error);
