const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// 加载环境变量
const env = fs.readFileSync('.env.local', 'utf8');
env.match(/(\w+)=(.+)/g)?.forEach(line => {
  const [key, ...parts] = line.split('=');
  const value = parts.join('=');
  process.env[key.trim()] = value.trim();
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const result = await supabase.from('materials').select('id,title,category').order('id');
  const data = result.data;

  const categories = {
    "对话/故事类": ["日常生活", "故事", "BBC Learning English", "心灵故事", "Daily Life"],
    "科普类": ["TED演讲", "Science and Facts"],
    "职场/雅思类": ["IELTS Listening", "文化历史", "艺术文化"]
  };

  const stats = {};
  const materialsByCategory = {};

  Object.keys(categories).forEach(key => {
    stats[key] = 0;
    materialsByCategory[key] = [];
  });
  stats["其他"] = 0;

  data.forEach(m => {
    let found = false;
    Object.keys(categories).forEach(key => {
      if (categories[key].includes(m.category)) {
        stats[key]++;
        materialsByCategory[key].push(m);
        found = true;
      }
    });
    if (!found) {
      stats["其他"]++;
    }
  });

  console.log('📊 分类统计:\n');
  Object.keys(stats).forEach(key => {
    console.log(`${key}: ${stats[key]} 个`);
  });

  console.log('\n🎯 对话/故事类素材列表（随机抽检用）:\n');
  const dialogueMaterials = materialsByCategory["对话/故事类"];

  // 随机抽检 3 个
  const samples = [];
  while (samples.length < 3 && dialogueMaterials.length > 0) {
    const randomIndex = Math.floor(Math.random() * dialogueMaterials.length);
    const sample = dialogueMaterials.splice(randomIndex, 1)[0];
    samples.push(sample);
  }

  samples.forEach((m, i) => {
    console.log(`${i + 1}. ${m.title} [${m.category}]`);
    console.log(`   ID: ${m.id}`);
  });

  console.log('\n📝 抽检素材 ID (用于后续对比):');
  samples.forEach(m => {
    console.log(m.id);
  });
})();
