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

// 翻译质量检查规则（完整版）
const CHECK_RULES = [
  // === 对话角色逻辑 ===
  {
    name: '主语倒置',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (zh.includes('我怎么') && (lowerText.includes('you did') || lowerText.includes('you can') || (lowerText.includes('how') && !lowerText.includes('ask myself')))) {
        return true;
      }
      return false;
    },
    message: '主语倒置：You did? → 你做到了？（❌ 我怎么做的）'
  },
  {
    name: '动词语境错误-call',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('call') && lowerText.includes('for my') && zh.includes('借')) {
        return true;
      }
      return false;
    },
    message: 'call for my item → 要回/问……的事（❌ 借）'
  },
  {
    name: '指代对象错误-you think I',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if ((zh.includes('我觉得我') || zh.includes('我觉得')) && lowerText.includes('you think') && !lowerText.includes('i think')) {
        return true;
      }
      return false;
    },
    message: 'you think I'm → 你觉得我（❌ 我觉得我）'
  },

  // === 口语俚语专项规则 ===
  {
    name: 'pulling my leg字面翻译',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('pulling my leg') && (zh.includes('拉腿') || zh.includes('拉我的腿'))) {
        return true;
      }
      return false;
    },
    message: 'pulling my leg → 拿我开涮/忽悠我（❌ 拉我的腿）'
  },
  {
    name: 'I got you字面翻译',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('i got you') && zh.includes('捉到') && !zh.includes('上当')) {
        return true;
      }
      return false;
    },
    message: 'I got you（整蛊） → 你上当了/上当了吧（❌ 我捉到你了）'
  },
  {
    name: 'joking词典中文',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('joking') && zh.includes('你在开玩笑')) {
        return true;
      }
      return false;
    },
    message: 'You were joking? → 你逗我呢？/你耍我啊？（❌ 你在开玩笑吗？）'
  },
  {
    name: 'kidding词典中文',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('kidding') && zh.includes('开玩笑') && !zh.includes('闹着玩')) {
        return true;
      }
      return false;
    },
    message: 'Just kidding → 闹着玩的/跟你开玩笑呢（❌ 只是开玩笑）'
  },

  // === 情绪对齐 ===
  {
    name: 'attacked死板翻译',
    pattern: (text, zh) => zh.includes('攻击') && text.toLowerCase().includes('attack'),
    message: 'attacked → 扑向（❌ 攻击）'
  },
  {
    name: 'fought死板翻译',
    pattern: (text, zh) => zh.includes('打斗') && text.toLowerCase().includes('fight'),
    message: 'fought → 斗了半天（❌ 打斗/战斗）'
  },

  // === 去辞海化 ===
  {
    name: '使用"哦不"',
    pattern: (text, zh) => zh.includes('哦不'),
    message: 'Oh no → 天哪！（❌ 哦不）'
  },
  {
    name: '使用"太可怕了"',
    pattern: (text, zh) => zh.includes('太可怕了'),
    message: 'terrible → 太吓人了（❌ 太可怕了）'
  },
  {
    name: '使用"笃定"',
    pattern: (text, zh) => zh.includes('笃定'),
    message: '对话中禁用"笃定"（书面词），应使用"居然"/"确实"'
  },

  // === 地理常识补丁 ===
  {
    name: '地理-之上/之下',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if ((lowerText.includes('above') || lowerText.includes('north of') || lowerText.includes('south of')) && (zh.includes('之上') || zh.includes('下方') || zh.includes('之下'))) {
        return true;
      }
      return false;
    },
    message: '地理常识：above/north of → 以北（❌ 之上）；below/south of → 以南（❌ 之下/下方）'
  },
  {
    name: '地理-触碰地面',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('light') && lowerText.includes('ground') && zh.includes('触碰')) {
        return true;
      }
      return false;
    },
    message: 'light touches ground → 阳光洒向大地（❌ 光触碰地面）'
  },

  // === 气候询问句型 ===
  {
    name: '气候询问-怎么样',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes("what's your") && lowerText.includes('like') && zh.includes('怎么样')) {
        return true;
      }
      return false;
    },
    message: 'What's your [Season] like? → 你们那儿的[季节]是什么样的？（❌ 你[季节]怎么样？）'
  },

  // === 情感反馈自然化 ===
  {
    name: '情感反馈-真有趣',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('interesting') && zh.includes('真有趣')) {
        return true;
      }
      return false;
    },
    message: 'How interesting! → 真新鲜！（❌ 真有趣）'
  },
  {
    name: '情感反馈-真不同',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('different') && zh.includes('真不同')) {
        return true;
      }
      return false;
    },
    message: 'How different! → 反差真大！（❌ 真不同）'
  },

  // === 励志哲学类关键词 ===
  {
    name: 'restless误译',
    pattern: (text, zh) => zh.includes('不安分') && text.toLowerCase().includes('restless'),
    message: 'restless → 心神不宁/焦躁（❌ 不安分）'
  },
  {
    name: 'thoughts误译',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if ((lowerText.includes('thoughts') || lowerText.includes('mind')) && zh.includes('想法') && !zh.includes('念头')) {
        return true;
      }
      return false;
    },
    message: 'thoughts（内心） → 杂念/念头（❌ 想法）'
  },
  {
    name: 'in this moment误译',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('in this moment') && zh.includes('在这个时刻') && !zh.includes('当下')) {
        return true;
      }
      return false;
    },
    message: 'in this moment → 当下/此时此刻（❌ 在这个时刻）'
  },

  // === 反问句式对齐 ===
  {
    name: '反问句-没吧',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if ((lowerText.includes("didn't i") || lowerText.includes('right?')) && zh.includes('没吧')) {
        return true;
      }
      return false;
    },
    message: 'Didn't I? → 是不是？（❌ 没吧？）'
  },

  // === 特定术语保护 ===
  {
    name: '特定术语-cyclones',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('cyclone') && !zh.includes('气旋') && !zh.includes('台风') && !zh.includes('飓风')) {
        return true;
      }
      return false;
    },
    message: 'cyclones → 气旋（澳大利亚）'
  },

  // === 过度翻译检测 ===
  {
    name: '过度翻译-一些',
    pattern: (text, zh) => zh.includes('一些') && !text.toLowerCase().includes('some'),
    message: '极简主义：禁止添加"一些"等填充词'
  },
  {
    name: '过度翻译-一点',
    pattern: (text, zh) => zh.includes('一点') && !text.toLowerCase().includes('bit') && !text.toLowerCase().includes('little'),
    message: '极简主义：禁止添加"一点"等填充词'
  },
  {
    name: '过度翻译-语气词',
    pattern: (text, zh) => {
      const lowerText = text.toLowerCase();
      // 检查是否在短句中添加了过多语气词
      if (text.length < 50 && zh.replace(/[啊呢吧嘛哈呀哩]/g, '').length < zh.length * 0.7) {
        return true;
      }
      return false;
    },
    message: '极简主义：短句禁止过度添加语气词（超过30%）'
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
