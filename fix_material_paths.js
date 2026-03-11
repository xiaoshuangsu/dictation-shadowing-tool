const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cuxotlijjnxbsirpdkgr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiOiJmN1eG90bGlqam54YnNpcnJka2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDg1MzQsImV4cCI6MjA4NjY4NDUzNH0.J_Ix3NnKEFDGlINAWQBCLZyW1lmep-5BKqnIAfpgQwk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMaterialPaths() {
  try {
    // 获取所有素材
    const { data: materials, error } = await supabase
      .from('materials')
      .select('id, slug, video_path, audio_path')
      .is('video_path', 'is.not', null);

    if (error) throw error;

    console.log(`找到 ${materials.length} 个素材需要检查`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const material of materials) {
      let updates = {};
      let needsUpdate = false;

      // 处理 video_path
      if (material.video_path && material.video_path.startsWith('http')) {
        const url = new URL(material.video_path);
        const filename = url.pathname.substring(1); // 去掉开头的 /

        // 检查是否需要添加版本号
        if (!filename.includes('-v') && !filename.includes('_v')) {
          // 需要检查文件是否在R2中
          console.log(`检查素材: ${material.slug}`);
          skippedCount++;
          continue;
        }

        updates.video_path = filename;
        needsUpdate = true;
      }

      // 处理 audio_path
      if (material.audio_path && material.audio_path.startsWith('http')) {
        const url = new URL(material.audio_path);
        const filename = url.pathname.substring(1); // 去掉开头的 /
        updates.audio_path = filename;
        needsUpdate = true;
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('materials')
          .update(updates)
          .eq('id', material.id);

        if (updateError) {
          console.error(`❌ 更新失败 [${material.slug}]:`, updateError.message);
        } else {
          console.log(`✅ 已更新 [${material.slug}]`);
          fixedCount++;
        }
      }
    }

    console.log(`\n总结:`);
    console.log(`✅ 成功更新: ${fixedCount} 个`);
    console.log(`⏭️ 跳过: ${skippedCount} 个`);
    console.log(`✅ 完成!`);

  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

fixMaterialPaths();
