/**
 * 分析 "It's" 挖空显示问题
 */

const sentence = "It's 07786643091.";

// 数据库中的实际 blanks 数据
const blank = { word: "It's", index: 0 };

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

// 索引转换
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
console.log(`  blank.index = 0`);
console.log(`  spaceTokens[0] = "${spaceTokens[0]}"`);
console.log(`  renderIndex = ${renderIndex}`);
console.log(`  renderTokens[${renderIndex}] = "${renderTokens[renderIndex]}"`);
console.log();

// 验证匹配
const blankWord = blank.word;
const spaceToken = spaceTokens[blank.index];
const renderToken = renderTokens[renderIndex];

console.log("验证匹配:");
console.log(`  blank.word = "${blankWord}"`);
console.log(`  spaceTokens[0] = "${spaceToken}"`);
console.log(`  renderTokens[${renderIndex}] = "${renderToken}"`);
console.log(`  匹配: ${blankWord === spaceToken && blankWord === renderToken ? '✅ 是' : '❌ 否'}`);
console.log();

// 渲染
console.log("渲染结果:");
const rendered = renderTokens.map((token, i) => {
  if (i === renderIndex) {
    return '[     ]';
  }
  return token;
}).join('');

console.log(`  "${rendered}"`);
console.log();

console.log("预期效果:");
console.log(`  应该显示: "[     ] 07786643091." (保留撇号)`);
console.log(`  实际显示: "${rendered}"`);

if (rendered === "[     ] 07786643091.") {
  console.log("  ✅ 修复正确！");
} else {
  console.log("  ❌ 还有问题！");
}
