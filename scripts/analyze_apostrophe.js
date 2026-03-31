/**
 * 分析撇号丢失问题
 */

const sentence = "It's 07786643091.";

// 假设 blanks 数据挖空 "It"
const blank = { word: "It", index: 0 };

// 空格分词
const spaceTokens = sentence.split(' ');
console.log("空格分词 (spaceTokens):");
spaceTokens.forEach((token, i) => {
  console.log(`  [${i}] "${token}"`);
});
console.log();

// 正则分词
const renderTokens = sentence.match(/([a-zA-Z0-9'-]+|[.,!?;:]+|\s+)/g) || [];
console.log("正则分词 (renderTokens):");
renderTokens.forEach((token, i) => {
  console.log(`  [${i}] "${token}"`);
});
console.log();

// 我的修复逻辑：索引转换
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

console.log("索引转换结果:");
console.log(`  spaceTokens index: ${blank.index} → "${spaceTokens[blank.index]}"`);
console.log(`  renderTokens index: ${renderIndex} → "${renderTokens[renderIndex]}"`);
console.log();

// 渲染逻辑
console.log("渲染结果:");
let rendered = renderTokens.map((token, i) => {
  if (i === renderIndex) {
    return '[     ]';  // 挖空位置
  }
  return token;
}).join('');

console.log(`  "${rendered}"`);
console.log();

console.log("❌ 问题分析:");
console.log(`  原文: "${sentence}"`);
console.log(`  渲染: "${rendered}"`);
console.log(`  丢失: "'s" 中的撇号被分到 "s" token 中，没有和 "It" 一起被挖空`);
console.log();
console.log("预期效果:");
console.log(`  应该显示: "[     ]'s 07786643091." (保留撇号)`);
console.log(`  实际显示: "[     ]s 07786643091." (撇号丢失)`);
