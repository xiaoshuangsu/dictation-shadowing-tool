/**
 * 精准恢复 translations 字段
 * 从 4月7日备份中恢复 19 国语言翻译，只更新 translations 字段
 * 不会影响其他数据（学习记录等）
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 从 CSV 备份中读取 translations
 */
async function loadBackupTranslations() {
  console.log('📂 正在读取备份文件...\n');

  const csvContent = readFileSync(
    '/Users/a/dictation/backups/dictionary_cache_20260407.csv',
    'utf-8'
  );

  // 手动解析 CSV
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');

  const wordIndex = headers.indexOf('word');
  const translationsIndex = headers.indexOf('translations');

  if (wordIndex === -1 || translationsIndex === -1) {
    throw new Error('CSV 文件格式错误：缺少 word 或 translations 列');
  }

  const translationsMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // 简单的 CSV 解析（假设字段中没有逗号）
    const fields = lines[i].split('","').map(f => f.replace(/^"/, '').replace(/"$/, ''));

    if (fields.length <= Math.max(wordIndex, translationsIndex)) continue;

    const word = fields[wordIndex];
    const translationsStr = fields[translationsIndex];

    if (translationsStr && translationsStr !== '' && translationsStr !== 'null') {
      try {
        // CSV 中的 translations 是 Python 字典格式，需要转换为 JSON
        let translationsObj = translationsStr;

        // 替换单引号为双引号（Python → JSON）
        translationsObj = translationsObj
          .replace(/'/g, '"')
          .replace(/None/g, 'null')
          .replace(/True/g, 'true')
          .replace(/False/g, 'false');

        const translations = JSON.parse(translationsObj);
        translationsMap.set(word, translations);
      } catch (e) {
        console.warn(`⚠️  解析失败: ${word}`, e.message);
      }
    }
  }

  console.log(`✅ 备份文件包含 ${lines.length - 1} 个单词`);
  console.log(`✅ 成功提取 ${translationsMap.size} 个单词的翻译\n`);
  return translationsMap;
}

/**
 * 精准恢复 translations 字段
 */
async function restoreTranslations() {
  console.log('🚀 开始精准恢复 translations 字段...\n');
  console.log('⚠️  注意：只会更新 translations 字段，不会影响其他数据\n');

  // 1. 读取备份中的 translations
  const backupTranslations = await loadBackupTranslations();

  // 2. 获取当前数据库中的单词列表
  console.log('📊 正在获取当前数据库中的单词...');
  const { data: currentWords, error } = await supabase
    .from('dictionary_cache')
    .select('word, translations')
    .order('word', { ascending: true });

  if (error) {
    console.error('❌ 获取当前单词失败:', error);
    return;
  }

  console.log(`✅ 当前数据库有 ${currentWords.length} 个单词\n`);

  // 3. 比较并更新
  let updateCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  console.log('🔄 开始更新...\n');

  for (const currentWord of currentWords) {
    const backupTrans = backupTranslations.get(currentWord.word);

    if (!backupTrans) {
      console.log(`⚠️  ${currentWord.word}: 备份中不存在`);
      skipCount++;
      continue;
    }

    // 检查是否需要更新
    const currentTransLangs = currentWord.translations
      ? Object.keys(currentWord.translations).length
      : 0;
    const backupTransLangs = Object.keys(backupTrans).length;

    if (backupTransLangs <= currentTransLangs) {
      console.log(`⏭️  ${currentWord.word}: 已有 ${currentTransLangs} 种语言，跳过`);
      skipCount++;
      continue;
    }

    // 更新 translations 字段
    const { error: updateError } = await supabase
      .from('dictionary_cache')
      .update({ translations: backupTrans })
      .eq('word', currentWord.word);

    if (updateError) {
      console.error(`❌ ${currentWord.word}: 更新失败`, updateError.message);
      errorCount++;
    } else {
      console.log(`✅ ${currentWord.word}: ${currentTransLangs} → ${backupTransLangs} 种语言`);
      updateCount++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('📊 恢复完成统计:');
  console.log(`   ✅ 成功更新: ${updateCount} 个单词`);
  console.log(`   ⏭️  跳过: ${skipCount} 个单词`);
  console.log(`   ❌ 失败: ${errorCount} 个单词`);
  console.log('─'.repeat(60));

  // 4. 验证：随机抽样检查
  console.log('\n🔍 验证恢复结果...\n');

  const sampleWords = ['abandon', 'academic', 'ability'];
  for (const word of sampleWords) {
    const { data } = await supabase
      .from('dictionary_cache')
      .select('word, translations')
      .eq('word', word)
      .single();

    if (data && data.translations) {
      const langs = Object.keys(data.translations).sort();
      console.log(`✅ ${word}: ${langs.length} 种语言`);
      console.log(`   ${langs.join(', ')}`);
    } else {
      console.log(`⚠️  ${word}: 未找到或 translations 为空`);
    }
  }

  console.log('\n🎉 恢复完成！');
}

restoreTranslations().catch(console.error);
