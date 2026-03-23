import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMaterial() {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('id', 'd742ed42-654b-49ed-a329-269be83a89c1')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data) {
    console.log('Material not found');
    return;
  }

  console.log('=== Material Info ===');
  console.log('Title:', data.title);
  console.log('Category:', data.category);
  console.log('ID:', data.id);

  const transcript = typeof data.transcript === 'string'
    ? JSON.parse(data.transcript)
    : data.transcript;

  console.log('\n=== Transcript Segments ===');
  console.log(`Total segments: ${transcript.length}`);
  transcript.forEach((seg, i) => {
    console.log(`\n[${i + 1}] ${seg.en}`);
    console.log(`    zh-CN: ${seg['zh-CN']}`);
  });
}

checkMaterial();
