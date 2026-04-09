/**
 * 检查特定单词的 translations 数据
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWords() {
  const words = ['abilities', 'aboard'];

  for (const word of words) {
    console.log(`\n📝 检查单词: ${word}`);

    const { data, error } = await supabase
      .from('dictionary_cache')
      .select('word, definitions, translations')
      .eq('word', word)
      .single();

    if (error) {
      console.log(`❌ 查询失败:`, error);
      continue;
    }

    if (!data) {
      console.log(`⚠️  单词不存在`);
      continue;
    }

    // 检查 definitions
    console.log(`\n📦 definitions 字段:`);
    if (typeof data.definitions === 'object') {
      const defKeys = Object.keys(data.definitions);
      console.log(`   类型: object, 语言数量: ${defKeys.length}`);
      console.log(`   包含: ${defKeys.join(', ')}`);
      console.log(`   英文: ${data.definitions.en?.substring(0, 50)}...`);
    } else {
      console.log(`   类型: ${typeof data.definitions}`);
    }

    // 检查 translations
    console.log(`\n🌍 translations 字段:`);
    if (data.translations && typeof data.translations === 'object') {
      const transKeys = Object.keys(data.translations);
      console.log(`   类型: object, 语言数量: ${transKeys.length}`);
      console.log(`   包含: ${transKeys.join(', ')}`);
      console.log(`   英文: ${data.translations.en?.substring(0, 50)}...`);
      console.log(`   日语: ${data.translations.ja}`);
    } else {
      console.log(`   ❌ translations 为空或不是对象`);
      console.log(`   值: ${data.translations}`);
    }
  }
}

checkWords().catch(console.error);
