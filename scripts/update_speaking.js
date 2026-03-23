import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSpeaking() {
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

    // 更新翻译
    let updatedCount = 0;
    transcript.forEach((segment) => {
      // ID 5: Speaking? Hi, this is Hannah.
      if (segment.id === 5) {
        console.log(`\n更新 ID 5: "${segment.text}"`);
        console.log(`  旧翻译: ${segment.translation?.zh}`);
        segment.translation = segment.translation || {};
        segment.translation.zh = "我就是。嗨，我是Hannah。";
        console.log(`  新翻译: ${segment.translation.zh}`);
        updatedCount++;
      }

      // ID 25: Speaking? Hi, this is Hannah.
      if (segment.id === 25) {
        console.log(`\n更新 ID 25: "${segment.text}"`);
        console.log(`  旧翻译: ${segment.translation?.zh}`);
        segment.translation = segment.translation || {};
        segment.translation.zh = "我就是。嗨，我是汉娜。";
        console.log(`  新翻译: ${segment.translation.zh}`);
        updatedCount++;
      }
    });

    console.log(`\n✅ 已更新 ${updatedCount} 个句子`);

    // 更新数据库
    const { error: updateError } = await supabase
      .from('materials')
      .update({ transcript: JSON.stringify(transcript) })
      .eq('id', material.id);

    if (updateError) {
      console.error('❌ 更新失败:', updateError);
    } else {
      console.log('\n✅ 数据库更新成功！');
    }
  } catch (err) {
    console.error('❌ 错误:', err);
  }
}

updateSpeaking();
