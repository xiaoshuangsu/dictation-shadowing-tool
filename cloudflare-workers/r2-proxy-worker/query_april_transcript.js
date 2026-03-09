const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/a/dictation/.env.local' });

// Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function queryAprilTranscript() {
  console.log('🔍 查询 "April Fool\'s Day Joke" 的 transcript 数据...\n');

  // 查询包含 "April Fool" 的素材
  const { data: aprilMaterials, error: aprilError } = await supabase
    .from('materials')
    .select('id, title, transcript')
    .ilike('title', '%april%fool%');

  if (aprilError) {
    console.error('❌ 查询失败:', aprilError);
    return;
  }

  console.log(`📝 找到 ${aprilMaterials?.length || 0} 个包含 "April Fool" 的素材\n`);

  if (aprilMaterials && aprilMaterials.length > 0) {
    aprilMaterials.forEach((material, index) => {
      console.log(`${index + 1}. 标题: "${material.title}"`);
      console.log(`   ID: ${material.id}`);
      console.log(`   Transcript 长度: ${material.transcript?.length || 0} 句`);
      console.log('');
    });

    // 取第一个匹配的素材
    const material = aprilMaterials[0];
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 详细信息: "${material.title}"`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (material.transcript && material.transcript.length > 0) {
      console.log(`✅ 共 ${material.transcript.length} 句\n`);
      console.log('🕐 前 5 句的时间戳和文本:');
      console.log('───────────────────────────────────────────────────────────\n');

      material.transcript.slice(0, 5).forEach((sentence, index) => {
        console.log(`句子 ${index + 1}:`);
        console.log(`  开始时间: ${sentence.startTime}s`);
        console.log(`  结束时间: ${sentence.endTime}s`);
        console.log(`  时长: ${(sentence.endTime - sentence.startTime).toFixed(2)}s`);
        console.log(`  文本: "${sentence.text}"`);
        console.log(`  翻译: "${sentence.translation || '(无)'}"`);
        console.log('');
      });

      // 验证时间戳是否连续
      console.log('───────────────────────────────────────────────────────────');
      console.log('🔍 时间戳连续性检查:\n');

      for (let i = 0; i < Math.min(5, material.transcript.length - 1); i++) {
        const current = material.transcript[i];
        const next = material.transcript[i + 1];
        const gap = (next.startTime - current.endTime).toFixed(3);

        console.log(`句子 ${i + 1} → ${i + 2}:`);
        console.log(`  当前结束: ${current.endTime}s`);
        console.log(`  下一开始: ${next.startTime}s`);
        console.log(`  间隔: ${gap}s ${parseFloat(gap) < 0 ? '⚠️ 负间隔!' : parseFloat(gap) > 0.5 ? '⚠️ 间隔过大!' : '✅ 正常'}`);
        console.log('');
      }

      // 检查总时长
      const firstSentence = material.transcript[0];
      const lastSentence = material.transcript[material.transcript.length - 1];
      const totalDuration = (lastSentence.endTime - firstSentence.startTime).toFixed(2);

      console.log('───────────────────────────────────────────────────────────');
      console.log('📊 统计信息:');
      console.log(`  第一句开始: ${firstSentence.startTime}s`);
      console.log(`  最后一句结束: ${lastSentence.endTime}s`);
      console.log(`  总时长: ${totalDuration}s`);
      console.log('═══════════════════════════════════════════════════════════');

    } else {
      console.log('⚠️ 该素材没有 transcript 数据');
    }
  }

  // 同时查询包含 "English Conversation" 的素材
  console.log('\n\n');
  console.log('🔍 查询包含 "English Conversation" 的素材...\n');

  const { data: conversationMaterials, error: conversationError } = await supabase
    .from('materials')
    .select('id, title, transcript')
    .ilike('title', '%english%conversation%');

  if (conversationError) {
    console.error('❌ 查询失败:', conversationError);
    return;
  }

  console.log(`📝 找到 ${conversationMaterials?.length || 0} 个包含 "English Conversation" 的素材\n`);

  if (conversationMaterials && conversationMaterials.length > 0) {
    conversationMaterials.forEach((material, index) => {
      console.log(`${index + 1}. 标题: "${material.title}"`);
      console.log(`   ID: ${material.id}`);
      console.log(`   Transcript 长度: ${material.transcript?.length || 0} 句`);
      console.log('');
    });
  }
}

// 执行查询
queryAprilTranscript()
  .then(() => {
    console.log('\n✅ 查询完成');
  })
  .catch((error) => {
    console.error('\n❌ 发生错误:', error);
  });
