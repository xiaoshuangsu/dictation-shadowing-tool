import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 从环境变量获取配置
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing database credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTranslation() {
  try {
    // 查找素材
    const { data: material, error } = await supabase
      .from('materials')
      .select('*')
      .ilike('title', '%Can I Speak to Sally%')
      .single();

    if (error) {
      console.error('Query failed:', error);
      return;
    }

    if (!material) {
      console.error('Material not found');
      return;
    }

    console.log('Found material:', material.title);
    console.log('Material ID:', material.id);

    // 解析 transcript（可能是对象或 JSON 字符串）
    const transcript = typeof material.transcript === 'string'
      ? JSON.parse(material.transcript)
      : material.transcript;

    // 翻译映射
    const translations = {
      "Can I speak to Sally?": "我能找一下Sally 吗？",
      "Can I speak to Sally, please?": "请问我能找一下 Sally 吗？",
      "Speaking?": "我就是。"
    };

    // 更新翻译
    transcript.forEach((segment) => {
      if (translations[segment.en]) {
        console.log('Updating:', segment.en);
        console.log('  Old:', segment['zh-CN']);
        segment['zh-CN'] = translations[segment.en];
        console.log('  New:', segment['zh-CN']);
      }
    });

    // 更新数据库
    const { error: updateError } = await supabase
      .from('materials')
      .update({ transcript: JSON.stringify(transcript) })
      .eq('id', material.id);

    if (updateError) {
      console.error('Update failed:', updateError);
    } else {
      console.log('\nMaterial translation updated successfully!');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

updateTranslation();
