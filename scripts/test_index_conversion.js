/**
 * 测试索引转换逻辑（模拟 WordMode 的修复）
 */

// 模拟多个句子的 blanks 数据
const testCases = [
  {
    sentence: "Good morning. I want some information",
    blank: { word: "information", index: 5 },
    expected: "information"
  },
  {
    sentence: "Thank you. And your address?",
    blank: { word: "Thank", index: 0 },
    expected: "Thank"
  },
  {
    sentence: "It's 07786643091.",
    blank: { word: "It's", index: 0 },
    expected: "It's"
  },
  {
    sentence: "Okay. We have a couple of self-drive tours there visiting different places of interest in California.",
    blank: { word: "interesting", index: 8 },
    expected: "different" // 注意：数据库中的 index 可能是错的，但我们要测试转换逻辑
  }
];

console.log("=".repeat(70));
console.log("测试：索引转换逻辑（WordMode 的修复）");
console.log("=".repeat(70));
console.log();

let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, i) => {
  const { sentence, blank, expected } = testCase;

  console.log(`测试 ${i + 1}: "${sentence.substring(0, 50)}..."`);
  console.log(`  blanks: { word: "${blank.word}", index: ${blank.index} }`);

  // ========== 模拟 WordMode 的修复逻辑 ==========
  // 1. 空格分词（与挖空脚本一致）
  const spaceTokens = sentence.split(' ');

  // 2. 正则分词（用于渲染，保留标点）
  const renderTokens = sentence.match(/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g) || [];

  // 3. 索引转换：spaceTokens index → renderTokens index
  let spaceTokenCount = 0;
  let renderIndex = -1;

  for (let j = 0; j < renderTokens.length; j++) {
    const token = renderTokens[j];
    // 跳过纯空格和纯标点的 token
    if (/^\s+$/.test(token) || /^[.,!?;:]+$/.test(token)) {
      continue;
    }
    // 找到第 blank.index 个非标点/空格的 token
    if (spaceTokenCount === blank.index) {
      renderIndex = j;
      break;
    }
    spaceTokenCount++;
  }

  // 4. 验证转换结果
  const spaceToken = spaceTokens[blank.index];
  const renderToken = renderTokens[renderIndex];

  console.log(`  空格分词 [${blank.index}]: "${spaceToken}"`);
  console.log(`  正则分词 [${renderIndex}]: "${renderToken}"`);

  // 检查是否匹配
  const cleanBlank = blank.word.toLowerCase().replace(/[.,!?;:'""]/g, '');
  const cleanSpace = spaceToken.toLowerCase().replace(/[.,!?;:'""]/g, '');
  const cleanRender = renderToken.toLowerCase().replace(/[.,!?;:'""]/g, '');

  const match = (cleanSpace === cleanBlank) && (cleanRender === cleanBlank);

  if (match) {
    console.log(`  ✅ 通过：索引转换正确，"${blank.word}" 被正确匹配`);
    passCount++;
  } else {
    console.log(`  ❌ 失败：`);
    console.log(`     期望: "${expected}"`);
    console.log(`     spaceTokens[${blank.index}]: "${spaceToken}"`);
    console.log(`     renderTokens[${renderIndex}]: "${renderToken}"`);
    console.log(`     blanks.word: "${blank.word}"`);
    failCount++;
  }

  console.log();
});

console.log("=".repeat(70));
console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
console.log("=".repeat(70));

// ========== 额外验证：渲染结果 ==========
console.log();
console.log("=".repeat(70));
console.log("验证：渲染结果（是否保留标点符号）");
console.log("=".repeat(70));
console.log();

const renderTestCases = [
  {
    sentence: "It's 07786643091.",
    blank: { word: "It's", index: 0 },
    description: "包含撇号的句子"
  },
  {
    sentence: "Good morning. I want some information.",
    blank: { word: "morning.", index: 1 },
    description: "包含句号的句子"
  }
];

renderTestCases.forEach((testCase, i) => {
  const { sentence, blank, description } = testCase;

  console.log(`测试 ${i + 1}: ${description}`);
  console.log(`  原文: "${sentence}"`);

  // 应用修复逻辑
  const spaceTokens = sentence.split(' ');
  const renderTokens = sentence.match(/([a-zA-Z0-9'\u2019-]+|[.,!?;:]+|\s+)/g) || [];

  let spaceTokenCount = 0;
  let renderIndex = -1;

  for (let j = 0; j < renderTokens.length; j++) {
    const token = renderTokens[j];
    if (/^\s+$/.test(token) || /^[.,!?;:]+$/.test(token)) {
      continue;
    }
    if (spaceTokenCount === blank.index) {
      renderIndex = j;
      break;
    }
    spaceTokenCount++;
  }

  // 渲染
  const rendered = renderTokens.map((token, j) => {
    if (j === renderIndex) {
      return '[     ]';
    }
    return token;
  }).join('');

  console.log(`  渲染: "${rendered}"`);

  // 检查标点符号是否保留
  const hasPeriod = sentence.includes('.');
  const renderedHasPeriod = rendered.includes('.');

  if (hasPeriod && renderedHasPeriod) {
    console.log(`  ✅ 标点符号保留`);
  } else if (hasPeriod && !renderedHasPeriod) {
    console.log(`  ❌ 标点符号丢失`);
  } else {
    console.log(`  ⚠️  无标点符号`);
  }

  console.log();
});

console.log("=".repeat(70));
