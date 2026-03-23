import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function searchSpeaking() {
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

  console.log('=== 搜索包含 "speak" 或 "Speaking" 的句子 ===\n');

  transcript.forEach((segment) => {
    const text = segment.text?.toLowerCase() || '';
    if (text.includes('speak') || text.includes('speaking')) {
      console.log(`ID: ${segment.id}`);
      console.log(`原文: ${segment.text}`);
      console.log(`简体: ${segment.translation?.zh || 'N/A'}`);
      console.log('---');
    }
  });
}

searchSpeaking();
