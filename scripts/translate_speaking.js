import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const glmApiKey = process.env.GLM_API_KEY;

// 翻译函数（使用智谱 GLM）
async function translateText(text, toLang = 'zh_hant') {
  const langMap = {
    'zh_hant': '繁體中文',
    'vi': '越南語'
  };

  const prompt = `请将以下简体中文翻译成地道的${langMap[toLang]}，只返回翻译结果，不要任何解释：

${text}`;

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${glmApiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`GLM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Translation error:', error);
    return null;
  }
}

async function updateTranslations() {
  try {
    // 获取素材
    const { data: material, error } = await supabase
      .from('materials')
      .select('*')
      .eq('id', 'd742ed42-654b-49ed-a329-269be83a89c1')
      .single();

    if (error || !material) {
      console.error('Material not found:', error);
      return;
    }

    console.log('Found material:', material.title);

    // 解析 transcript
    const transcript = typeof material.transcript === 'string'
      ? JSON.parse(material.transcript)
      : material.transcript;

    // 需要翻译的句子
    const sentencesToTranslate = [
      "我就是。嗨，我是Hannah。",
      "我就是。嗨，我是汉娜。"
    ];

    // 翻译成繁体中文
    console.log('\n=== 翻译成繁体中文 ===');
    for (let i = 0; i < sentencesToTranslate.length; i++) {
      const sentence = sentencesToTranslate[i];
      const segmentId = i === 0 ? 5 : 25; // ID 5 和 ID 25

      const translation = await translateText(sentence, 'zh_hant');
      if (translation) {
        console.log(`"${sentence}" => "${translation}"`);

        // 更新 transcript
        transcript.forEach((segment) => {
          if (segment.id === segmentId && segment.translation?.zh === sentence) {
            segment.translation.zh_hant = translation;
          }
        });
      }
      // 延迟避免 API 限速
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 翻译成越南语
    console.log('\n=== 翻译成越南语 ===');
    for (let i = 0; i < sentencesToTranslate.length; i++) {
      const sentence = sentencesToTranslate[i];
      const segmentId = i === 0 ? 5 : 25; // ID 5 和 ID 25

      const translation = await translateText(sentence, 'vi');
      if (translation) {
        console.log(`"${sentence}" => "${translation}"`);

        // 更新 transcript
        transcript.forEach((segment) => {
          if (segment.id === segmentId && segment.translation?.zh === sentence) {
            segment.translation.vi = translation;
          }
        });
      }
      // 延迟避免 API 限速
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 更新数据库
    const { error: updateError } = await supabase
      .from('materials')
      .update({ transcript: JSON.stringify(transcript) })
      .eq('id', material.id);

    if (updateError) {
      console.error('❌ 更新失败:', updateError);
    } else {
      console.log('\n✅ 所有翻译更新成功！');
    }
  } catch (err) {
    console.error('❌ 错误:', err);
  }
}

updateTranslations();
