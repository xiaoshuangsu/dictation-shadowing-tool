import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  // 1. 检查所有素材的 slug
  const { data: allMaterials, error } = await supabase
    .from('materials')
    .select('id, title, slug, category')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== 所有素材 (按创建时间倒序，前20个) ===');
  allMaterials.slice(0, 20).forEach((m, i) => {
    const generatedSlug = m.slug ? m.slug : `[no slug]`;
    console.log(`${i + 1}. ${m.title}`);
    console.log(`   Slug: ${generatedSlug}`);
    console.log(`   Category: ${m.category}`);
    console.log('---');
  });

  // 2. 检查是否有 slug 冲突
  const slugCount = {};
  allMaterials.forEach((m) => {
    const s = m.slug || 'no-slug';
    slugCount[s] = (slugCount[s] || 0) + 1;
  });

  console.log('\n=== Slug 冲突检查 ===');
  Object.entries(slugCount).forEach(([slug, count]) => {
    if (count > 1) {
      console.log(`⚠️  Slug "${slug}" 出现 ${count} 次`);
    }
  });

  // 3. 检查目标 slug
  const targetSlug = 'telephone-conversations-can-i-speak-to-sally-easy-dialogue-role-play';
  console.log(`\n=== 查找目标 slug: ${targetSlug} ===`);

  const found = allMaterials.find((m) => {
    const materialSlug = m.slug || '[no-slug]';
    return materialSlug === targetSlug;
  });

  if (found) {
    console.log('✅ 找到匹配的素材:');
    console.log(`   ID: ${found.id}`);
    console.log(`   Title: ${found.title}`);
    console.log(`   Slug: ${found.slug}`);
  } else {
    console.log('❌ 未找到匹配的素材！');
    console.log(`\n总素材数: ${allMaterials.length}`);
    console.log('正在查找包含 "Sally" 的素材...');

    const sallyMaterials = allMaterials.filter((m) =>
      m.title.toLowerCase().includes('sally') ||
      (m.slug && m.slug.toLowerCase().includes('sally'))
    );

    console.log(`\n找到 ${sallyMaterials.length} 个包含 "Sally" 的素材:`);
    sallyMaterials.forEach((m, i) => {
      console.log(`${i + 1}. ${m.title}`);
      console.log(`   ID: ${m.id}`);
      console.log(`   Slug: ${m.slug || '[no-slug]'}`);
      console.log('---');
    });
  }

  // 4. 通过 category 和 slug 一起查找
  console.log('\n=== 通过 category + slug 查找 ===');
  const { data: sallyMaterial } = await supabase
    .from('materials')
    .select('*')
    .eq('slug', targetSlug)
    .single();

  if (sallyMaterial) {
    console.log('✅ 直接通过 slug 找到:');
    console.log(`   ID: ${sallyMaterial.id}`);
    console.log(`   Title: ${sallyMaterial.title}`);
  } else {
    console.log('❌ 直接通过 slug 未找到');
  }
}

diagnose();
