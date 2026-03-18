const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 加载环境变量
const env = fs.readFileSync('.env.local', 'utf8');
env.match(/(\w+)=(.+)/g)?.forEach(line => {
  const [key, ...parts] = line.split('=');
  const value = parts.join('=');
  process.env[key.trim()] = value.trim();
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 翻译质量检查规则
const CHECK_RULES = [
  {
    name: '主语倒置',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (zh.includes('我怎么') && (lowerText.includes('you did') || lowerText.includes('you can') || lowerText.includes('how') && !lowerText.includes('ask myself'))) {
        return true;
      }
      return false;
    },
    message: '可能存在主语倒置（应译为"你怎么..."而非"我怎么..."）'
  },
  {
    name: 'restless误译',
    pattern: (text, zh) => zh.includes('不安分') && text.toLowerCase().includes('restless'),
    message: 'restless应译为"心神不宁/焦躁"，禁用"不安分"'
  },
  {
    name: 'attacked误译',
    pattern: (text, zh) => zh.includes('攻击') && text.toLowerCase().includes('attack'),
    message: 'attacked应译为"扑向"，禁用"攻击"'
  },
  {
    name: 'fought误译',
    pattern: (text, zh) => zh.includes('打斗') && text.toLowerCase().includes('fight'),
    message: 'fought应译为"斗了半天"，禁用"打斗"'
  },
  {
    name: '指代对象错误',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if ((zh.includes('我觉得我') || zh.includes('我觉得')) && lowerText.includes('you think') && !lowerText.includes('i think')) {
        return true;
      }
      return false;
    },
    message: '指代对象错误（you think应译为"你觉得我"而非"我觉得我"）'
  },
  {
    name: '气候询问误译',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes("what's your") && lowerText.includes('like') && zh.includes('怎么样')) {
        return true;
      }
      return false;
    },
    message: '气候询问应译为"你们那儿的...是什么样的？"而非"...怎么样？"'
  },
  {
    name: '情感反馈生硬',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if ((lowerText.includes('interesting') || lowerText.includes('different')) && (zh.includes('真有趣') || zh.includes('真不同'))) {
        return true;
      }
      return false;
    },
    message: '应译为"真新鲜！"/"反差真大！"而非"真有趣"/"真不同"'
  },
  {
    name: '使用书面词"笃定"',
    pattern: (text, zh) => zh.includes('笃定'),
    message: '对话中禁用书面词"笃定"，应使用"居然"/"确实"'
  },
  {
    name: '使用"哦不"',
    pattern: (text, zh) => zh.includes('哦不'),
    message: '应译为"天哪！"而非"哦不"'
  },
  {
    name: '使用"太可怕了"',
    pattern: (text, zh) => zh.includes('太可怕了'),
    message: '应译为"太吓人了"而非"太可怕了"'
  },
  {
    name: '使用"你觉得我怎么样"',
    pattern: (text, zh) => zh.includes('你觉得我怎么样'),
    message: '应译为"你觉得我怎么样"为"你觉得我..."'
  }
];

async function checkMaterial(materialId) {
  const { data: material } = await supabase
    .from('materials')
    .select('id,title,category,transcript')
    .eq('id', materialId)
    .single();

  if (!material) return null;

  const transcript = material.transcript || [];
  const issues = [];

  transcript.forEach((s, idx) => {
    const text = s.text || '';
    const trans = s.translation;
    const zh = trans?.zh || (typeof trans === 'string' ? trans : '');

    if (!zh) return;

    CHECK_RULES.forEach(rule => {
      if (rule.pattern(text, zh)) {
        issues.push({
          sentence: idx + 1,
          en: text,
          zh: zh,
          rule: rule.name,
          message: rule.message
        });
      }
    });
  });

  return {
    id: material.id,
    title: material.title,
    category: material.category,
    totalSentences: transcript.length,
    issues: issues
  };
}

async function main() {
  console.log('🔍 开始全面检查翻译质量\n');
  console.log('='.repeat(80));

  // 获取所有素材
  const result = await supabase.from('materials').select('id,title,category').order('id');
  const materials = result.data;

  if (!materials) {
    console.log('❌ 查询失败:', result.error);
    return;
  }

  console.log(`\n📊 总素材数: ${materials.length}`);
  console.log('🚀 开始检查...\n');

  let totalIssues = 0;
  const problemMaterials = [];
  const report = {
    timestamp: new Date().toISOString(),
    totalMaterials: materials.length,
    checkedMaterials: 0,
    problemMaterials: 0,
    totalIssues: 0,
    materials: []
  };

  for (let i = 0; i < materials.length; i++) {
    const m = materials[i];
    const progress = `检查进度: [${i + 1}/${materials.length}] [${m.category}] ${m.title}`;
    process.stdout.write('\r' + ' '.repeat(100) + '\r' + progress);

    const checkResult = await checkMaterial(m.id);

    report.checkedMaterials++;

    if (checkResult && checkResult.issues.length > 0) {
      totalIssues += checkResult.issues.length;
      problemMaterials.push(checkResult);
      report.problemMaterials++;
      report.materials.push({
        id: checkResult.id,
        title: checkResult.title,
        category: checkResult.category,
        issues: checkResult.issues
      });
    }

    // 每 50 个素材保存一次进度
    if ((i + 1) % 50 === 0) {
      report.totalIssues = totalIssues;
      fs.writeFileSync('translation_quality_report.json', JSON.stringify(report, null, 2));
    }
  }

  report.totalIssues = totalIssues;

  // 保存完整报告
  fs.writeFileSync('translation_quality_report.json', JSON.stringify(report, null, 2));

  // 输出总结
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 检查总结\n');
  console.log(`检查素材数: ${report.checkedMaterials}`);
  console.log(`发现问题素材: ${report.problemMaterials}`);
  console.log(`问题总数: ${report.totalIssues}`);
  console.log(`\n✅ 报告已保存至: translation_quality_report.json`);

  if (problemMaterials.length > 0) {
    console.log('\n⚠️ 问题素材列表 (前 20 个):\n');
    problemMaterials.slice(0, 20).forEach(m => {
      console.log(`- [${m.category}] ${m.title}`);
      console.log(`  问题数: ${m.issues.length}`);
      m.issues.slice(0, 3).forEach(issue => {
        console.log(`  • 句${issue.sentence}: ${issue.rule}`);
      });
      if (m.issues.length > 3) {
        console.log(`  ... 还有 ${m.issues.length - 3} 个问题`);
      }
      console.log('');
    });

    if (problemMaterials.length > 20) {
      console.log(`... 还有 ${problemMaterials.length - 20} 个问题素材，详见报告文件\n`);
    }

    // 生成需要重新翻译的素材 ID 列表
    const needRetranslation = problemMaterials.map(m => m.id);
    fs.writeFileSync('need_retranslation_ids.txt', needRetranslation.join('\n'));
    console.log(`📝 需要重新翻译的素材 ID 已保存至: need_retranslation_ids.txt`);
  } else {
    console.log('\n✅ 所有素材翻译质量良好！\n');
  }
}

main().catch(err => {
  console.error('❌ 检查失败:', err);
  process.exit(1);
});
