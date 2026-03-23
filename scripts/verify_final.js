import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyFinal() {
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

  console.log('=== 最终翻译验证 ===\n');

  // 显示更新的句子
  const targetIds = [2, 4, 5, 25];

  transcript.forEach((segment) => {
    if (targetIds.includes(segment.id)) {
      console.log(`ID: ${segment.id}`);
      console.log(`原文: ${segment.text}`);
      console.log(`简体: ${segment.translation?.zh || 'N/A'}`);
      console.log(`繁体: ${segment.translation?.zh_hant || 'N/A'}`);
      console.log(`越南: ${segment.translation?.vi || 'N/A'}`);
      console.log('---');
    }
  });
}

verifyFinal();
