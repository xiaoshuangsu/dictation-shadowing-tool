const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/a/dictation/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugSpecificSentences() {
  const { data: material } = await supabase
    .from('materials')
    .select('transcript')
    .ilike('title', '%april%fool%')
    .single();

  const s2 = material.transcript[1];
  const s33 = material.transcript[32];

  console.log('句子 2:');
  console.log('  startTime:', s2.startTime, '类型:', typeof s2.startTime);
  console.log('  endTime:', s2.endTime, '类型:', typeof s2.endTime);
  console.log('  startTime > endTime?', s2.startTime > s2.endTime);
  console.log('  实际比较:', parseFloat(s2.startTime), '>', parseFloat(s2.endTime), '=', parseFloat(s2.startTime) > parseFloat(s2.endTime));
  console.log('');

  console.log('句子 33:');
  console.log('  startTime:', s33.startTime, '类型:', typeof s33.startTime);
  console.log('  endTime:', s33.endTime, '类型:', typeof s33.endTime);
  console.log('  startTime > endTime?', s33.startTime > s33.endTime);
  console.log('  实际比较:', parseFloat(s33.startTime), '>', parseFloat(s33.endTime), '=', parseFloat(s33.startTime) > parseFloat(s33.endTime));
}

debugSpecificSentences();
