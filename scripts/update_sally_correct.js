import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    console.log(`\nTotal segments: ${transcript.length}`);

    // 翻译映射
    const translations = {
      "Can I speak to Sally?": "我能找一下Sally 吗？",
      "Can I speak to Sally, please?": "请问我能找一下 Sally 吗？",
      "Speaking?": "我就是。"
    };

    // 更新翻译
    let updatedCount = 0;
    transcript.forEach((segment) => {
      if (translations[segment.text]) {
        console.log(`\nUpdating: "${segment.text}"`);
        console.log(`  Old zh: ${segment.translation?.zh}`);
        segment.translation = segment.translation || {};
        segment.translation.zh = translations[segment.text];
        console.log(`  New zh: ${segment.translation.zh}`);
        updatedCount++;
      }
    });

    console.log(`\n✅ Updated ${updatedCount} segments`);

    // 更新数据库
    const { error: updateError } = await supabase
      .from('materials')
      .update({ transcript: JSON.stringify(transcript) })
      .eq('id', material.id);

    if (updateError) {
      console.error('❌ Update failed:', updateError);
    } else {
      console.log('\n✅ Database updated successfully!');
    }
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

updateTranslations();
