/**
 * 测试脚本：将指定素材设为下架状态（用于本地验证）
 *
 * 使用方法：
 * node scripts/set_material_inactive.js <slug>
 *
 * 示例：
 * node scripts/set_material_inactive.js the-goose-that-laid-golden-eggs
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
  console.log('  node scripts/set_material_inactive.js <slug>');
  console.log('\n示例:');
  console.log('  node scripts/set_material_inactive.js the-goose-that-laid-golden-eggs');
  process.exit(1);
}

async function setMaterialInactive() {
  console.log(`\n🔍 查找素材: ${targetSlug}\n`);

  // 先查询素材信息
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
  console.log(`  分类: ${material.category}`);
  console.log(`  当前状态: ${material.is_active === false ? '❌ 已下架' : '✅ 正常'}`);

  if (material.is_active === false) {
    console.log('\n⚠️  该素材已经是下架状态');
    console.log('\n如需重新上架，请运行:');
    console.log(`  node scripts/set_material_active.js ${targetSlug}`);
    return;
  }

  console.log(`\n⏳ 正在将素材设为下架状态...\n`);

  // 更新素材状态
  const { error: updateError } = await supabase
    .from('materials')
    .update({ is_active: false })
    .eq('slug', targetSlug);

  if (updateError) {
    console.error('❌ 更新失败:', updateError.message);
    process.exit(1);
  }

  console.log('✅ 素材已下架！');
  console.log('\n📝 后续步骤:');
  console.log(`1. 访问: http://localhost:3000/topics/${material.category}/${targetSlug}`);
  console.log('2. 确认浏览器 Network 面板显示 301 状态码');
  console.log('3. 确认跳转到分类页');
  console.log(`4. 访问: http://localhost:3000/sitemap.xml`);
  console.log('5. 确认该素材已从 sitemap 中消失');
  console.log('\n如需恢复，请运行:');
  console.log(`  node scripts/set_material_active.js ${targetSlug}`);
}

setMaterialInactive().catch(console.error);
