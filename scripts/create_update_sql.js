/**
 * 创建 SQL 更新脚本
 */
import { readFileSync, writeFileSync } from 'fs';

// 读取单词列表
const oxfordWords = readFileSync('/tmp/oxford_words.txt', 'utf-8').split('\n').filter(w => w.trim());
const ieltsWords = readFileSync('/tmp/ielts_words.txt', 'utf-8').split('\n').filter(w => w.trim());

console.log(`📚 Oxford 3000: ${oxfordWords.length} 个单词`);
console.log(`📝 IELTS: ${ieltsWords.length} 个单词`);

// 创建 SQL 更新脚本
const sqlContent = `-- 批量更新 Oxford 3000 词汇的 category 字段
-- 生成时间: ${new Date().toISOString()}

-- 第一步：重置所有 category 字段
UPDATE dictionary_cache SET category = NULL;

-- 第二步：标记 Oxford 3000 词汇
UPDATE dictionary_cache
SET category = 'oxford'
WHERE word IN ${oxfordWords.map(() => '?').join(', ')};

-- 第三步：标记 IELTS 词汇
UPDATE dictionary_cache
SET category = 'ielts'
WHERE word IN ${ieltsWords.map(() => '?').join(', ')};

-- 第四步：验证结果
SELECT
    category,
    COUNT(*) as count
FROM dictionary_cache
GROUP BY category
ORDER BY category;
`;

writeFileSync('/tmp/update_category.sql', sqlContent);
console.log('✅ SQL 脚本已保存到 /tmp/update_category.sql');
console.log(`\n⚠️  请手动执行以下步骤：`);
console.log(`1. 访问 Supabase Dashboard SQL 编辑器`);
console.log(`2. 复制并运行 /tmp/update_category.sql 的内容`);
console.log(`3. 或者通过 psql 执行: psql "$DATABASE_URL" < /tmp/update_category.sql`);

// 显示参数化语句
console.log(`\n📋 参数列表（供手动 SQL 使用）：`);
console.log(`\nOxford 3000 前 10 个单词:`);
oxfordWords.slice(0, 10).forEach(w => console.log(`  ${w}`));
