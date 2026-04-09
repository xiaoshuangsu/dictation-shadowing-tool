/**
 * 为 dictionary_cache 表中的单词补全 19 国语言翻译
 * 使用 GLM API 进行翻译
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GLM API 配置
const GLM_API_KEY = process.env.GLM_API_KEY;
const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
const GLM_MODEL = 'glm-4-flash';

// 19 国语言列表（除了英文）
const LANGUAGES = [
  { code: 'zh', name: '简体中文' },
  { code: 'zh_hant', name: '繁體中文' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'ja', name: '日本語' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'ko', name: '한국어' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
  { code: 'th', name: 'ภาษาไทย' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'uk', name: 'Українська' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'mn', name: 'Монгол' },
  { code: 'hi', name: 'हिन्दी' }
];

/**
 * 调用 GLM API 进行翻译
 */
async function translateWithGLM(text, targetLang) {
  const langNames = {
    'zh': '简体中文',
    'zh_hant': '繁體中文',
    'vi': '越南语',
    'ja': '日语',
    'de': '德语',
    'es': '西班牙语',
    'fr': '法语',
    'ko': '韩语',
    'pt': '葡萄牙语',
    'ru': '俄语',
    'ar': '阿拉伯语',
    'th': '泰语',
    'id': '印尼语',
    'ms': '马来语',
    'tr': '土耳其语',
    'el': '希腊语',
    'uk': '乌克兰语',
    'bn': '孟加拉语',
    'mn': '蒙古语',
    'hi': '印地语'
  };

  const prompt = `请将以下英文单词定义翻译为${langNames[targetLang] || targetLang}：

英文定义：${text}

要求：
1. 只输出翻译结果，不要解释
2. 保持专业术语的准确性
3. 简洁明了`;

  try {
    const response = await fetch(`${GLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`GLM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error(`翻译失败 (${targetLang}):`, error.message);
    return null;
  }
}

/**
 * 补全单个单词的翻译
 */
async function completeWordTranslations(wordData) {
  const { word, definitions } = wordData;

  // 解析现有的 definitions
  let existingDefs = {};
  if (typeof definitions === 'string') {
    try {
      existingDefs = JSON.parse(definitions);
    } catch (e) {
      existingDefs = { en: definitions };
    }
  } else if (typeof definitions === 'object') {
    existingDefs = definitions;
  }

  // 获取英文定义
  const englishDef = existingDefs.en || existingDefs['en'] || '';

  if (!englishDef) {
    console.log(`⚠️  跳过单词 "${word}"：没有英文定义`);
    return null;
  }

  console.log(`\n📝 处理单词: ${word}`);
  console.log(`   英文定义: ${englishDef.substring(0, 100)}...`);

  // 检查缺少的语言
  const missingLangs = LANGUAGES.filter(lang => !existingDefs[lang.code]);

  if (missingLangs.length === 0) {
    console.log(`   ✅ 所有语言翻译已存在`);
    return null;
  }

  console.log(`   🔄 缺少 ${missingLangs.length} 种语言翻译`);

  // 补全翻译
  const newTranslations = { ...existingDefs };

  for (const lang of missingLangs) {
    console.log(`   翻译为 ${lang.name}...`);
    const translation = await translateWithGLM(englishDef, lang.code);

    if (translation) {
      newTranslations[lang.code] = translation;
      console.log(`   ✅ ${lang.name}: ${translation.substring(0, 50)}...`);
    }

    // 添加延迟以避免 API 限流
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return newTranslations;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始补全 dictionary_cache 表的翻译...\n');

  // 获取所有单词
  const { data: words, error } = await supabase
    .from('dictionary_cache')
    .select('word, definitions')
    .order('word', { ascending: true });

  if (error) {
    console.error('❌ 获取单词失败:', error);
    return;
  }

  console.log(`📊 找到 ${words.length} 个单词\n`);

  // 处理每个单词
  let updateCount = 0;
  const limit = 10; // 限制处理数量（测试用）

  for (let i = 0; i < Math.min(words.length, limit); i++) {
    const wordData = words[i];
    const newTranslations = await completeWordTranslations(wordData);

    if (newTranslations) {
      // 更新数据库
      const { error: updateError } = await supabase
        .from('dictionary_cache')
        .update({ definitions: newTranslations })
        .eq('word', wordData.word);

      if (updateError) {
        console.error(`   ❌ 更新失败:`, updateError);
      } else {
        console.log(`   ✅ 更新成功`);
        updateCount++;
      }
    }
  }

  console.log(`\n🎉 完成！共更新 ${updateCount} 个单词的翻译`);
  console.log(`\n💡 提示：要处理所有 ${words.length} 个单词，请修改脚本中的 limit 变量`);
}

main().catch(console.error);
