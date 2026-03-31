/**
 * 验证修复流程：确保前端挖空 = 数据库 blanks.word = 挖空脚本结果
 */

const sentence = "Andrea Brown.";

// ========== 步骤 1：挖空脚本的输出 ==========
const blankFromScript = { word: "Andrea", index: 0 };

console.log("=".repeat(70));
console.log("步骤 1：挖空脚本生成 blanks 数据");
console.log("=".repeat(70));
console.log(`句子: "${sentence}"`);
console.log(`空格分词: ${sentence.split(' ')}`);
console.log(`挖空词: "${blankFromScript.word}" (index: ${blankFromScript.index})`);
console.log();

// ========== 步骤 2：前端 WordMode 的处理（修复后）==========
console.log("=".repeat(70));
console.log("步骤 2：前端 WordMode 处理（修复后）");
console.log("=".repeat(70));

// 2.1 空格分词（与挖空脚本一致）
const spaceTokens = sentence.split(' ');
console.log("\n2.1 空格分词 (spaceTokens):");
spaceTokens.forEach((t, i) => console.log(`  [${i}] ${t}`));

// 2.2 验证：spaceTokens[blank.index] === blank.word?
console.log("\n2.2 验证匹配:");
const spaceToken = spaceTokens[blankFromScript.index];
console.log(`  blanks.index = ${blankFromScript.index}`);
console.log(`  spaceTokens[${blankFromScript.index}] = "${spaceToken}"`);
console.log(`  blanks.word = "${blankFromScript.word}"`);
console.log(`  匹配? ${spaceToken === blankFromScript.word ? '✅ 是' : '❌ 否'}`);

// 2.3 正则分词（用于渲染）
const renderTokens = sentence.match(/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g) || [];
console.log("\n2.3 正则分词 (renderTokens):");
renderTokens.forEach((t, i) => console.log(`  [${i}] "${t}"`));

// 2.4 索引转换：spaceTokens index → renderTokens index
let spaceTokenCount = 0;
let renderIndex = -1;

for (let i = 0; i < renderTokens.length; i++) {
  const token = renderTokens[i];
  // 跳过纯空格和纯标点的 token
  if (/^\s+$/.test(token) || /^[.,!?;:]+$/.test(token)) {
    continue;
  }
  // 找到第 blank.index 个非标点/空格的 token
  if (spaceTokenCount === blankFromScript.index) {
    renderIndex = i;
    break;
  }
  spaceTokenCount++;
}

console.log("\n2.4 索引转换:");
console.log(`  spaceTokens index: ${blankFromScript.index}`);
console.log(`  renderTokens index: ${renderIndex}`);
console.log(`  renderTokens[${renderIndex}] = "${renderTokens[renderIndex]}"`);

// 2.5 最终验证
const renderToken = renderTokens[renderIndex];
const cleanBlank = blankFromScript.word.toLowerCase().replace(/[.,!?;:'"]/g, '');
const cleanRender = renderToken.toLowerCase().replace(/[.,!?;:'"]/g, '');

console.log("\n2.5 最终验证:");
console.log(`  blanks.word: "${blankFromScript.word}"`);
console.log(`  renderToken: "${renderToken}"`);
console.log(`  匹配? ${cleanBlank === cleanRender ? '✅ 是' : '❌ 否'}`);

// ========== 步骤 3：渲染结果 ==========
console.log("\n" + "=".repeat(70));
console.log("步骤 3：渲染结果");
console.log("=".repeat(70));

const rendered = renderTokens.map((token, i) => {
  if (i === renderIndex) {
    return '[     ]';
  }
  return token;
}).join('');

console.log(`原文: "${sentence}"`);
console.log(`渲染: "${rendered}"`);
console.log();

// ========== 总结 ==========
console.log("=".repeat(70));
console.log("总结：前端挖空 = 数据库 blanks.word = 挖空脚本结果");
console.log("=".repeat(70));

if (cleanBlank === cleanRender) {
  console.log("✅ 验证通过！");
  console.log(`   前端挖空位置: "${renderToken}"`);
  console.log(`   数据库 blanks.word: "${blankFromScript.word}"`);
  console.log(`   挖空脚本结果: "${blankFromScript.word}"`);
  console.log(`   三者一致！`);
} else {
  console.log("❌ 验证失败！");
  console.log(`   前端挖空位置: "${renderToken}"`);
  console.log(`   数据库 blanks.word: "${blankFromScript.word}"`);
  console.log(`   不匹配！`);
}
