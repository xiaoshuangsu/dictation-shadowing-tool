import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('materials')
    .select('id, title, slug, transcript')
    .eq('slug', 'telephone-conversations-can-i-speak-to-sally-easy-dialogue-role-play')
    .single();

  if (error || !data) {
    console.error('Error:', error);
    return;
  }

  const transcript = typeof data.transcript === 'string'
    ? JSON.parse(data.transcript)
    : data.transcript;

  console.log('=== 检查 transcript 字段 ===');
  console.log('transcript 类型:', typeof data.transcript);
  console.log('是否为数组:', Array.isArray(transcript));
  console.log('数组长度:', transcript?.length);

  console.log('\n前3个段落:');
  if (transcript && transcript.length > 0) {
    transcript.slice(0, 3).forEach((seg) => {
      console.log(`- ${seg.text}`);
      console.log(`  startTime: ${seg.startTime}, endTime: ${seg.endTime}`);
    });
  }

  console.log('\n=== 检查第1个段落数据结构 ===');
  console.log(JSON.stringify(transcript[0], null, 2));
}

check();
