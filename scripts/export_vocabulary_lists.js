/**
 * 从数据库导出词汇列表并生成词库文件
 * Oxford 3000: 前 1000 个常用词
 * IELTS: 前 4000 个学术词汇
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exportVocabularyLists() {
  console.log('📊 从数据库导出词汇列表...\n');

  try {
    // 获取所有单词（按字母顺序）
    console.log('📥 获取所有单词...');
    const { data: allWords, error } = await supabase
      .from('dictionary_cache')
      .select('word')
      .order('word', { ascending: true });

    if (error) {
      throw error;
    }

    console.log(`✅ 数据库中共有 ${allWords.length} 个单词`);

    // Oxford 3000: 前 1000 个单词
    const oxfordWords = allWords.slice(0, 1000).map(w => w.word);
    console.log(`\n📚 Oxford 3000: ${oxfordWords.length} 个单词`);

    // IELTS: 所有单词（最多 4000 个）
    const ieltsWords = allWords.slice(0, Math.min(4000, allWords.length)).map(w => w.word);
    console.log(`📝 IELTS: ${ieltsWords.length} 个单词`);

    // 生成 Oxford 3000 TypeScript 文件
    const oxfordContent = `/**
 * Oxford 3000 词汇列表
 * 来源：从 dictionary_cache 表导出（${oxfordWords.length} 个核心词汇）
 * 更新时间：${new Date().toISOString()}
 */
export const OXFORD_3000_WORDS: string[] = [
${oxfordWords.map(word => `  "${word}"`).join(',\n')}
];
`;

    writeFileSync('/Users/a/dictation/src/data/oxford-3000.ts', oxfordContent);
    console.log(`\n✅ Oxford 3000 已保存到: src/data/oxford-3000.ts`);

    // 生成 IELTS TypeScript 文件
    const ieltsContent = `/**
 * IELTS 词汇列表
 * 来源：从 dictionary_cache 表导出（${ieltsWords.length} 个学术词汇）
 * 更新时间：${new Date().toISOString()}
 */
export const IELTS_WORDS: string[] = [
${ieltsWords.map(word => `  "${word}"`).join(',\n')}
];
`;

    writeFileSync('/Users/a/dictation/src/data/ielts.ts', ieltsContent);
    console.log(`✅ IELTS 已保存到: src/data/ielts.ts`);

    console.log('\n🎉 词库文件更新完成！');
    console.log(`   - Oxford 3000: ${oxfordWords.length} 个单词`);
    console.log(`   - IELTS: ${ieltsWords.length} 个单词`);

  } catch (error) {
    console.error('❌ 导出失败:', error.message);
    throw error;
  }
}

exportVocabularyLists().catch(console.error);
