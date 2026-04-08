/**
 * 从日志文件中提取成功入库的单词并更新数据库 category 字段
 * 严格按照日志中的 "✅ 入库成功: word" 记录为准
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 从日志文件中提取成功入库的单词
 * 匹配模式: "✅ 入库成功: word"
 */
function extractWordsFromLog(logPath) {
  const content = readFileSync(logPath, 'utf-8');
  const lines = content.split('\n');

  const words = [];
  const seen = new Set();

  for (const line of lines) {
    // 匹配 "✅ 入库成功: word" 模式
    const match = line.match(/✅ 入库成功:\s+(\S+)/);
    if (match) {
      const word = match[1].toLowerCase().trim();
      // 排除无效词 "for"
      if (word && word.length > 0 && word !== 'for' && !seen.has(word)) {
        words.push(word);
        seen.add(word);
      }
    }
  }

  return words;
}

async function main() {
  console.log('🚀 开始从日志提取并打标词汇...\n');

  // 1. 从两份日志中提取单词
  console.log('📚 提取 Oxford 3000 词汇...');
  const oxfordLogPath = '/Users/a/dictation/scripts/logs_archive/oxford_v3_full_run.log';
  const oxfordWords = extractWordsFromLog(oxfordLogPath);
  console.log(`✅ Oxford: ${oxfordWords.length} 个唯一单词`);

  console.log('\n📝 提取 IELTS 词汇...');
  const ieltsLogPath = '/Users/a/dictation/scripts/ielts_full_run.log';
  const ieltsWords = extractWordsFromLog(ieltsLogPath);
  console.log(`✅ IELTS: ${ieltsWords.length} 个唯一单词`);

  // 2. 计算分类
  const oxfordSet = new Set(oxfordWords);
  const ieltsSet = new Set(ieltsWords);

  const onlyOxford = oxfordWords.filter(w => !ieltsSet.has(w));
  const onlyIelts = ieltsWords.filter(w => !oxfordSet.has(w));
  const both = oxfordWords.filter(w => ieltsSet.has(w));

  console.log('\n📊 分类统计:');
  console.log(`   仅 Oxford: ${onlyOxford.length} 个`);
  console.log(`   仅 IELTS: ${onlyIelts.length} 个`);
  console.log(`   重合词: ${both.length} 个`);
  console.log(`   总计: ${onlyOxford.length + onlyIelts.length + both.length} 个\n`);

  // 3. 保存单词列表供调试
  writeFileSync('/tmp/only_oxford.txt', onlyOxford.join('\n'));
  writeFileSync('/tmp/only_ielts.txt', onlyIelts.join('\n'));
  writeFileSync('/tmp/both_oxford_ielts.txt', both.join('\n'));
  console.log('✅ 单词列表已保存到 /tmp/\n');

  // 4. 更新数据库 category 字段
  console.log('🔄 开始更新数据库 category 字段...\n');

  const chunkSize = 100;
  let totalUpdated = 0;

  // 4a. 清空现有 category 标签
  console.log('🧹 清空现有 category 标签...');
  const { error: clearError } = await supabase
    .from('dictionary_cache')
    .update({ category: null })
    .not('category', 'is', null);

  if (clearError) {
    console.error('❌ 清空失败:', clearError.message);
  } else {
    console.log('✅ 已清空现有标签\n');
  }

  // 4b. 标记仅 Oxford 的单词
  if (onlyOxford.length > 0) {
    console.log(`📚 标记仅 Oxford 单词 (${onlyOxford.length} 个)...`);
    let oxfordCount = 0;
    for (let i = 0; i < onlyOxford.length; i += chunkSize) {
      const chunk = onlyOxford.slice(i, i + chunkSize);
      const { data, error, count } = await supabase
        .from('dictionary_cache')
        .update({ category: 'oxford' }, { count: 'exact' })
        .in('word', chunk);

      if (error) {
        console.error(`   ❌ 批次 ${i}-${i + chunkSize} 更新失败:`, error.message);
      } else {
        oxfordCount += count || 0;
        totalUpdated += count || 0;
      }
    }
    console.log(`   ✅ 完成，更新了 ${oxfordCount} 个单词\n`);
  }

  // 4c. 标记仅 IELTS 的单词
  if (onlyIelts.length > 0) {
    console.log(`📝 标记仅 IELTS 单词 (${onlyIelts.length} 个)...`);
    let ieltsCount = 0;
    for (let i = 0; i < onlyIelts.length; i += chunkSize) {
      const chunk = onlyIelts.slice(i, i + chunkSize);
      const { data, error, count } = await supabase
        .from('dictionary_cache')
        .update({ category: 'ielts' }, { count: 'exact' })
        .in('word', chunk);

      if (error) {
        console.error(`   ❌ 批次 ${i}-${i + chunkSize} 更新失败:`, error.message);
      } else {
        ieltsCount += count || 0;
        totalUpdated += count || 0;
      }
    }
    console.log(`   ✅ 完成，更新了 ${ieltsCount} 个单词\n`);
  }

  // 4d. 标记重合词
  if (both.length > 0) {
    console.log(`🔗 标记重合词 (${both.length} 个)...`);
    let bothCount = 0;
    for (let i = 0; i < both.length; i += chunkSize) {
      const chunk = both.slice(i, i + chunkSize);
      const { data, error, count } = await supabase
        .from('dictionary_cache')
        .update({ category: 'oxford,ielts' }, { count: 'exact' })
        .in('word', chunk);

      if (error) {
        console.error(`   ❌ 批次 ${i}-${i + chunkSize} 更新失败:`, error.message);
      } else {
        bothCount += count || 0;
        totalUpdated += count || 0;
      }
    }
    console.log(`   ✅ 完成，更新了 ${bothCount} 个单词\n`);
  }

  // 5. 验证结果
  console.log('📊 验证结果...\n');

  // 查询每个分类的精确计数
  const { count: oxfordCount, error: oxfordError } = await supabase
    .from('dictionary_cache')
    .select('word', { count: 'exact', head: true })
    .eq('category', 'oxford');

  const { count: ieltsCount, error: ieltsError } = await supabase
    .from('dictionary_cache')
    .select('word', { count: 'exact', head: true })
    .eq('category', 'ielts');

  const { count: bothCount, error: bothError } = await supabase
    .from('dictionary_cache')
    .select('word', { count: 'exact', head: true })
    .eq('category', 'oxford,ielts');

  const { count: totalCount, error: totalError } = await supabase
    .from('dictionary_cache')
    .select('word', { count: 'exact', head: true })
    .not('category', 'is', null);

  console.log('数据库分类统计:');
  console.log(`   oxford: ${oxfordCount || 0} 个单词`);
  console.log(`   ielts: ${ieltsCount || 0} 个单词`);
  console.log(`   oxford,ielts: ${bothCount || 0} 个单词`);
  console.log(`   总计: ${totalCount || 0} 个单词`);

  // 对比预期
  console.log('\n📈 对比预期:');
  console.log(`   仅 Oxford: 预期 ${onlyOxford.length}，实际 ${oxfordCount || 0}${onlyOxford.length === (oxfordCount || 0) ? ' ✅' : ' ❌'}`);
  console.log(`   仅 IELTS: 预期 ${onlyIelts.length}，实际 ${ieltsCount || 0}${onlyIelts.length === (ieltsCount || 0) ? ' ✅' : ' ❌'}`);
  console.log(`   重合词: 预期 ${both.length}，实际 ${bothCount || 0}${both.length === (bothCount || 0) ? ' ✅' : ' ❌'}`);

  console.log('\n🎉 打标完成！');
}

main().catch(console.error);
