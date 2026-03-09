const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function update() {
  const newTranscript = JSON.parse(fs.readFileSync('/tmp/april_transcript_new.json', 'utf8'));

  console.log('新 transcript 长度:', newTranscript.length);

  const { data: current } = await supabase
    .from('materials')
    .select('id, title, transcript')
    .ilike('title', '%april%fool%')
    .single();

  console.log('找到素材 ID:', current?.id);
  console.log('当前 transcript 长度:', current?.transcript?.length);

  if (!current) {
    console.log('未找到素材');
    return;
  }

  const updated = newTranscript.map((newS, i) => {
    const oldS = current.transcript[i];
    return {
      ...newS,
      translation: oldS?.translation || ''
    };
  });

  const { data: result, error } = await supabase
    .from('materials')
    .update({ transcript: updated })
    .eq('id', current.id)
    .select();

  if (error) {
    console.error('更新失败:', error);
  } else {
    console.log('更新成功！');
    console.log('新 transcript 长度:', result[0].transcript.length);
    console.log('第 2 句:', result[0].transcript[1]);
  }
}

update();
