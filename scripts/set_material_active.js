/**
 * 恢复脚本：将已下架的素材重新上架
 *
 * 使用方法：
 * node scripts/set_material_active.js <slug>
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ 缺少必要的环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const targetSlug = process.argv[2];

if (!targetSlug) {
  console.error('❌ 请提供素材 slug');
  console.log('\n使用方法:');
  console.log('  node scripts/set_material_active.js <slug>');
  process.exit(1);
}

async function setMaterialActive() {
  console.log(`\n🔍 查找素材: ${targetSlug}\n`);

  const { data: material, error: queryError } = await supabase
    .from('materials')
    .select('id, title, slug, category, is_active')
    .eq('slug', targetSlug)
    .single();

  if (queryError || !material) {
    console.error('❌ 素材不存在:', queryError?.message || '未找到');
    process.exit(1);
  }

  console.log('📋 素材信息:');
  console.log(`  标题: ${material.title}`);
  console.log(`  当前状态: ${material.is_active === false ? '❌ 已下架' : '✅ 正常'}`);

  if (material.is_active !== false) {
    console.log('\n⚠️  该素材已经是正常状态');
    return;
  }

  console.log(`\n⏳ 正在将素材重新上架...\n`);

  const { error: updateError } = await supabase
    .from('materials')
    .update({ is_active: true })
    .eq('slug', targetSlug);

  if (updateError) {
    console.error('❌ 更新失败:', updateError.message);
    process.exit(1);
  }

  console.log('✅ 素材已重新上架！');
  console.log('\n📝 现在可以访问:');
  console.log(`  http://localhost:3000/topics/${material.category}/${targetSlug}`);
}

setMaterialActive().catch(console.error);
