import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSlugs() {
  const { data, error } = await supabase
    .from('materials')
    .select('id, title, slug, category')
    .in('title', ['[Telephone Conversations] Can I Speak to Sally? - Easy Dialogue - Role Play', 'First Snowfall'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== 对比两个素材的 Slug ===\n');

  data.forEach((m) => {
    console.log(`Title: ${m.title}`);
    console.log(`Slug: ${m.slug || '[no slug]'}`);
    console.log(`Category: ${m.category}`);
    console.log('---');
  });

  // 检查 slug 生成
  const { titleToSlug } = await import('../lib/utils/slug.js');
  const fs = require('fs');
  const slugPath = '/Users/a/dictation/src/lib/utils/slug.js';

  console.log('\n=== Slug 生成测试 ===');
  data.forEach((m) => {
    const generatedSlug = m.slug || titleToSlug(m.title);
    console.log(`\n${m.title}`);
    console.log(`实际 Slug: ${m.slug || 'none'}`);
    console.log(`生成 Slug: ${generatedSlug}`);
  });
}

checkSlugs();
