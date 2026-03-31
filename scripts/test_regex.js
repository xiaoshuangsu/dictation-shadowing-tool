/**
 * 测试正则表达式是否正确匹配 "It's"
 */

const sentence = "It's 07786643091.";

// v6.1 修复使用的正则
const regex1 = /([a-zA-Z0-9'-]+|[.,!?;:]+|\s+)/g;
const tokens1 = sentence.match(regex1) || [];

console.log("正则 1 (v6.1): /([a-zA-Z0-9'-]+|[.,!?;:]+|\\s+)/g");
tokens1.forEach((token, i) => {
  console.log(`  [${i}] "${token}"`);
});
console.log();

// 旧版本正则
const regex2 = /[a-zA-Z0-9-']+/g;
const tokens2 = sentence.match(regex2) || [];

console.log("正则 2 (旧版): /[a-zA-Z0-9-']+/g");
tokens2.forEach((token, i) => {
  console.log(`  [${i}] "${token}"`);
});
console.log();

console.log("结论:");
console.log(`  正则 1 匹配 "It's" 作为一个整体: ${tokens1[0] === "It's" ? '✅ 是' : '❌ 否'}`);
console.log(`  正则 2 匹配 "It's" 作为一个整体: ${tokens2[0] === "It's" ? '✅ 是' : '❌ 否'}`);
