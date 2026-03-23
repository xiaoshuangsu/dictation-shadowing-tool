import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyTranslations() {
  const { data, error } = await supabase
    .from('materials')
    .select('transcript')
    .eq('id', 'd742ed42-654b-49ed-a329-269be83a89c1')
    .single();

  if (error || !data) {
    console.error('Error:', error);
    return;
  }

  const transcript = typeof data.transcript === 'string'
    ? JSON.parse(data.transcript)
    : data.transcript;

  console.log('=== 验证翻译结果 ===\n');

  // 查找目标句子
  const targetTexts = [
    "Can I speak to Sally?",
    "Can I speak to Sally, please?",
    "Speaking?"
  ];

  transcript.forEach((segment) => {
    if (targetTexts.includes(segment.text)) {
      console.log(`原文: ${segment.text}`);
      console.log(`简体: ${segment.translation?.zh || 'N/A'}`);
      console.log(`繁体: ${segment.translation?.zh_hant || 'N/A'}`);
      console.log(`越南: ${segment.translation?.vi || 'N/A'}`);
      console.log('---');
    }
  });
}

verifyTranslations();
