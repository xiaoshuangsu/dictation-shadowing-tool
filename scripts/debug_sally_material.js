import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMaterial() {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('id', 'd742ed42-654b-49ed-a329-269be83a89c1')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== Material Info ===');
  console.log('ID:', data.id);
  console.log('Title:', data.title);
  console.log('Category:', data.category);

  const transcript = typeof data.transcript === 'string'
    ? JSON.parse(data.transcript)
    : data.transcript;

  console.log('\n=== Transcript Info ===');
  console.log('Type:', typeof data.transcript);
  console.log('Is Array?', Array.isArray(transcript));
  console.log('Length:', transcript?.length);

  if (Array.isArray(transcript)) {
    console.log('\n=== First 5 Segments ===');
    for (let i = 0; i < Math.min(5, transcript.length); i++) {
      const seg = transcript[i];
      console.log(`\n[${i}] ID: ${seg.id}`);
      console.log(`    text: ${seg.text}`);
      console.log(`    zh: ${seg.translation?.zh}`);
    }

    console.log('\n=== Last 3 Segments ===');
    for (let i = Math.max(0, transcript.length - 3); i < transcript.length; i++) {
      const seg = transcript[i];
      console.log(`\n[${i}] ID: ${seg.id}`);
      console.log(`    text: ${seg.text}`);
      console.log(`    zh: ${seg.translation?.zh}`);
    }
  }
}

debugMaterial();
