const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/a/dictation/.env.local' });

// Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function queryDetailedTranscript() {
  console.log('🔍 详细分析 "April Fool\'s Day Joke" 的 transcript...\n');

  const { data: material, error } = await supabase
    .from('materials')
    .select('id, title, transcript')
    .ilike('title', '%april%fool%')
    .single();

  if (error || !material) {
    console.error('❌ 查询失败:', error);
    return;
  }

  console.log(`📝 素材: "${material.title}"`);
  console.log(`📝 共 ${material.transcript.length} 句\n`);

  // 显示所有句子
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 所有句子的时间戳:');
  console.log('═══════════════════════════════════════════════════════════\n');

  material.transcript.forEach((sentence, index) => {
    const start = parseFloat(sentence.startTime);
    const end = parseFloat(sentence.endTime);
    const duration = (end - start).toFixed(2);
    console.log(`#${String(index + 1).padStart(2, '0')} [${String(start.toFixed(2)).padStart(6, 's')} - ${String(end.toFixed(2)).padStart(6, 's')}] (${duration}s) ${sentence.text}`);
  });

  // 分析问题
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 时间戳问题分析:');
  console.log('═══════════════════════════════════════════════════════════\n');

  let problems = [];

  for (let i = 0; i < material.transcript.length; i++) {
    const sentence = material.transcript[i];
    const start = parseFloat(sentence.startTime);
    const end = parseFloat(sentence.endTime);

    // 检查 1: 开始时间 > 结束时间（倒置）
    if (start > end) {
      problems.push({
        type: '倒置',
        sentence: i + 1,
        issue: `startTime(${start}) > endTime(${end})`
      });
    }

    // 检查 2: 与下一句的重叠
    if (i < material.transcript.length - 1) {
      const next = material.transcript[i + 1];
      const nextStart = parseFloat(next.startTime);
      if (end > nextStart) {
        problems.push({
          type: '重叠',
          sentence: i + 1,
          issue: `句子${i + 1}结束(${end}) > 句子${i + 2}开始(${nextStart})，重叠 ${(end - nextStart).toFixed(3)}s`
        });
      }
    }

    // 检查 4: 时长异常（太短或太长）
    const duration = end - start;
    if (duration < 0.1) {
      problems.push({
        type: '时长过短',
        sentence: i + 1,
        issue: `仅 ${duration.toFixed(3)}s`
      });
    }
    if (duration > 10) {
      problems.push({
        type: '时长过长',
        sentence: i + 1,
        issue: `长达 ${duration.toFixed(2)}s`
      });
    }
  }

  if (problems.length > 0) {
    console.log(`⚠️ 发现 ${problems.length} 个问题:\n`);
    problems.forEach((p, i) => {
      console.log(`${i + 1}. [${p.type}] 句子 ${p.sentence}: ${p.issue}`);
    });
  } else {
    console.log('✅ 未发现明显的时间戳问题');
  }

  // 统计间隔分布
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 句子间隔统计:');
  console.log('═══════════════════════════════════════════════════════════\n');

  const gaps = [];
  for (let i = 0; i < material.transcript.length - 1; i++) {
    const current = material.transcript[i];
    const next = material.transcript[i + 1];
    const gap = parseFloat(next.startTime) - parseFloat(current.endTime);
    gaps.push(gap);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const maxGap = Math.max(...gaps);
  const minGap = Math.min(...gaps);

  console.log(`平均间隔: ${avgGap.toFixed(3)}s`);
  console.log(`最大间隔: ${maxGap.toFixed(3)}s`);
  console.log(`最小间隔: ${minGap.toFixed(3)}s`);
  console.log(`负间隔数量: ${gaps.filter(g => g < 0).length}`);
  console.log(`零间隔数量: ${gaps.filter(g => g === 0).length}`);
  console.log(`正间隔数量: ${gaps.filter(g => g > 0).length}`);

  // 显示间隔最大的前5个
  console.log('\n间隔最大的 5 个位置:');
  const sortedGaps = gaps.map((gap, i) => ({ gap, sentence: i + 1 }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  sortedGaps.forEach(({ gap, sentence }, i) => {
    const current = material.transcript[sentence - 1];
    const next = material.transcript[sentence];
    console.log(`${i + 1}. 句子 ${sentence}→${sentence + 1}: ${gap.toFixed(3)}s ("${current.text}" → "${next.text}")`);
  });

  // 检查数据类型
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('⚠️ 数据类型检查:');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`startTime 类型: ${typeof material.transcript[0].startTime}`);
  console.log(`endTime 类型: ${typeof material.transcript[0].endTime}`);
  console.log('\n⚠️ 注意：时间戳是字符串类型，需要转换为数字进行比较！');
}

queryDetailedTranscript()
  .then(() => console.log('\n✅ 分析完成'))
  .catch(console.error);
