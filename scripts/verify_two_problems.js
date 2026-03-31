/**
 * 验证：撇号问题和分词索引不一致是独立的
 */

const sentence1 = "Good morning. I want some information";
const sentence2 = "It's 07786643091";

console.log("=== 句子 1：没有撇号 ===");
console.log(`句子: "${sentence1}"`);

const spaceTokens1 = sentence1.split(' ');
const renderTokens1 = sentence1.match(/([a-zA-Z0-9'-]+|[.,!?;:]+|\s+)/g) || [];

console.log("\n空格分词 (挖空脚本使用):");
spaceTokens1.forEach((t, i) => console.log(`  [${i}] ${t}`));

console.log("\n正则分词 (v6.1 WordMode 使用):");
renderTokens1.forEach((t, i) => console.log(`  [${i}] "${t}"`));

console.log("\n索引对比（假设 blanks.index=5）:");
console.log(`  空格分词 [5]: "${spaceTokens1[5]}"`);
console.log(`  正则分词 [5]: "${renderTokens1[5]}"`);
console.log(`  匹配? ${spaceTokens1[5] === renderTokens1[5] ? '✅ 是' : '❌ 否（错位！）'}`);

console.log("\n" + "=".repeat(50));
console.log("\n=== 句子 2：有撇号（撇号问题） ===");
console.log(`句子: "${sentence2}"`);

const spaceTokens2 = sentence2.split(' ');
const renderTokens2_old = sentence2.match(/([a-zA-Z0-9'-]+|[.,!?;:]+|\s+)/g) || [];
const renderTokens2_new = sentence2.match(/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g) || [];

console.log("\n空格分词 (挖空脚本使用):");
spaceTokens2.forEach((t, i) => console.log(`  [${i}] ${t}`));

console.log("\n正则分词 (旧版 - 不支持 U+2019):");
renderTokens2_old.forEach((t, i) => console.log(`  [${i}] "${t}"`));

console.log("\n正则分词 (新版 - 支持 U+2019):");
renderTokens2_new.forEach((t, i) => console.log(`  [${i}] "${t}"`));

console.log("\n对比 (假设 blanks.index=0):");
console.log(`  空格分词 [0]: "${spaceTokens2[0]}"`);
console.log(`  正则分词 旧版 [0]: "${renderTokens2_old[0]}" (被拆分！❌)`);
console.log(`  正则分词 新版 [0]: "${renderTokens2_new[0]}" (完整 ✅)`);

console.log("\n" + "=".repeat(50));
console.log("\n结论:");
console.log("1. 句子 1（没有撇号）:");
console.log("   - 撇号修复：不影响（没有撇号）");
console.log("   - 索引转换：需要修复（index 5 错位）");
console.log("\n2. 句子 2（有撇号）:");
console.log("   - 撇号修复：需要修复（支持 U+2019）");
console.log("   - 索引转换：需要修复（即使撇号正确，仍有分词索引不一致）");
console.log("\n✅ 两个问题是独立的，都需要修复！");
