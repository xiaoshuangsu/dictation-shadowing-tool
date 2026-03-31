/**
 * 验证 WordMode 修复逻辑
 */

const sentence = "Good morning. I want some information on self-drive tours";

// 数据库中的 blanks 数据（基于空格分词）
const blank = { word: "information", index: 5 };

// 修复后的 WordMode 逻辑
const spaceTokens = sentence.split(' ');
const renderTokens = sentence.match(/([a-zA-Z0-9'-]+|[.,!?;:]+|\s+)/g) || [];

console.log("句子:", sentence);
console.log();
console.log("blanks 数据:", blank);
console.log();

console.log("空格分词 (spaceTokens):");
spaceTokens.forEach((token, i) => {
  console.log(`  [${i}] ${token}`);
});
console.log();

console.log("正则分词 (renderTokens):");
renderTokens.forEach((token, i) => {
  console.log(`  [${i}] "${token}"`);
});
console.log();

// 验证：blank.index 在 spaceTokens 中是否对应 blank.word
console.log("验证 blanks 数据:");
console.log(`  spaceTokens[${blank.index}] = "${spaceTokens[blank.index]}"`);
console.log(`  blank.word = "${blank.word}"`);
console.log(`  匹配: ${spaceTokens[blank.index].includes(blank.word) ? '✅' : '❌'}`);
console.log();

// 转换逻辑：从 spaceTokens.index 转换到 renderTokens.index
let spaceTokenCount = 0;
let renderIndex = -1;

for (let i = 0; i < renderTokens.length; i++) {
  const token = renderTokens[i];
  // 跳过纯空格和纯标点的 token
  if (/^\s+$/.test(token) || /^[.,!?;:]+$/.test(token)) {
    continue;
  }
  // 找到第 blank.index 个非标点/空格的 token
  if (spaceTokenCount === blank.index) {
    renderIndex = i;
    break;
  }
  spaceTokenCount++;
}

console.log("索引转换:");
console.log(`  spaceTokens index: ${blank.index}`);
console.log(`  renderTokens index: ${renderIndex}`);
console.log(`  renderTokens[${renderIndex}] = "${renderTokens[renderIndex]}"`);
console.log();

// 验证转换结果
const cleanBlankWord = blank.word.toLowerCase().replace(/[.,!?;:'"]/g, '');
const cleanRenderToken = renderTokens[renderIndex].toLowerCase().replace(/[.,!?;:'"]/g, '');

console.log("最终验证:");
console.log(`  cleanBlankWord: "${cleanBlankWord}"`);
console.log(`  cleanRenderToken: "${cleanRenderToken}"`);
console.log(`  匹配: ${cleanBlankWord === cleanRenderToken ? '✅ 成功！' : '❌ 失败！'}`);
