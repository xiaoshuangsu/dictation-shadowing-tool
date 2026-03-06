/**
 * 添加 SEO 字段到 materials 表
 *
 * 运行方式: node scripts/add_seo_fields.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// slug 生成函数
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // 移除特殊字符
    .replace(/\s+/g, '-') // 空格转连字符
    .replace(/-+/g, '-') // 多个连字符转单个
    .trim()
    .substring(0, 100); // 限制长度
}

// 生成 meta_title
function generateMetaTitle(title) {
  return `${title} | English Dictation & Shadowing`;
}

// 生成 meta_description
function generateMetaDescription(title, transcript) {
  let description = '';

  if (transcript && Array.isArray(transcript) && transcript.length > 0) {
    // 从转录文本中提取前几句
    const textParts = transcript.slice(0, 5).map(s => s.text || s.translation || '');
    description = textParts.join(' ')
      .replace(/[\n\r]+/g, ' ')
      .substring(0, 150);
  } else {
    description = `Practice English listening and speaking with "${title}" dictation exercise. Improve your English skills with interactive audio and text.`;
  }

  return description + '...';
}

async function main() {
  console.log('开始添加 SEO 字段...\n');

  try {
    // 1. 获取所有记录
    const { data: materials, error } = await supabase
      .from('materials')
      .select('*');

    if (error) throw error;

    console.log(`找到 ${materials.length} 条记录\n`);

    let updated = 0;
    let skipped = 0;

    for (const material of materials) {
      const updates = {};

      // 生成 slug
      if (!material.slug) {
        updates.slug = generateSlug(material.title);
      }

      // 生成 meta_title
      if (!material.meta_title) {
        updates.meta_title = generateMetaTitle(material.title);
      }

      // 生成 meta_description
      if (!material.meta_description) {
        updates.meta_description = generateMetaDescription(
          material.title,
          material.transcript
        );
      }

      // 生成 og_image
      if (!material.og_image && material.thumbnail_path) {
        updates.og_image = material.thumbnail_path;
      }

      // 更新数据库
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('materials')
          .update(updates)
          .eq('id', material.id);

        if (updateError) {
          console.error(`✗ 更新失败 [${material.title}]:`, updateError.message);
        } else {
          updated++;
          if (updated <= 5) {
            console.log(`✓ 已更新 [${material.title}]`);
            console.log(`  slug: ${updates.slug}`);
            console.log(`  meta_title: ${updates.meta_title?.substring(0, 50)}...`);
            console.log('');
          }
        }
      } else {
        skipped++;
      }
    }

    console.log('\n=== 总结 ===');
    console.log(`已更新: ${updated} 条`);
    console.log(`跳过: ${skipped} 条`);
    console.log(`总计: ${materials.length} 条\n`);

    // 验证结果
    const { data: verify } = await supabase
      .from('materials')
      .select('slug, meta_title, meta_description, og_image');

    console.log('=== 字段填充统计 ===');
    console.log(`slug: ${verify.filter(r => r.slug).length}/${verify.length}`);
    console.log(`meta_title: ${verify.filter(r => r.meta_title).length}/${verify.length}`);
    console.log(`meta_description: ${verify.filter(r => r.meta_description).length}/${verify.length}`);
    console.log(`og_image: ${verify.filter(r => r.og_image).length}/${verify.length}`);

  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

main();
