/**
 * 拆分词库文件 - 将现有单词列表拆分为 Oxford 3000 和 IELTS
 */
import { readFileSync, writeFileSync } from 'fs';

// 读取现有的 Oxford 3000 文件
const oxfordFile = readFileSync('/Users/a/dictation/src/data/oxford-3000.ts', 'utf-8');

// 提取单词列表（匹配引号中的单词）
const wordMatches = oxfordFile.match(/"([^"]+)"/g);
const allWords = wordMatches.map(m => m.replace(/"/g, ''));

console.log(`📊 总单词数: ${allWords.length}`);

// 拆分为两部分
const oxfordWords = allWords.slice(0, 500);
const ieltsWords = allWords.slice(500);

console.log(`📚 Oxford 3000: ${oxfordWords.length} 个单词`);
console.log(`📝 IELTS: ${ieltsWords.length} 个单词`);

// 检查重叠
const overlap = oxfordWords.filter(w => ieltsWords.includes(w));
console.log(`⚠️  重叠单词数: ${overlap.length}`);
console.log(`   重叠率: ${(overlap.length / Math.min(oxfordWords.length, ieltsWords.length) * 100).toFixed(1)}%`);

// 生成 Oxford 3000 文件
const oxfordContent = `/**
 * Oxford 3000 词汇列表
 * 来源：从 dictionary_cache 表导出（前 500 个核心词汇）
 * 更新时间：${new Date().toISOString()}
 */
export const OXFORD_3000_WORDS: string[] = [
${oxfordWords.map(word => `  "${word}"`).join(',\n')}
];
`;

writeFileSync('/Users/a/dictation/src/data/oxford-3000.ts', oxfordContent);
console.log('\n✅ Oxford 3000 已保存');
console.log(`   起始: ${oxfordWords[0]}`);
console.log(`   结束: ${oxfordWords[oxfordWords.length - 1]}`);

// 生成 IELTS 文件
const ieltsContent = `/**
 * IELTS 词汇列表
 * 来源：从 dictionary_cache 表导出（后 500 个学术词汇）
 * 更新时间：${new Date().toISOString()}
 */
export const IELTS_WORDS: string[] = [
${ieltsWords.map(word => `  "${word}"`).join(',\n')}
];
`;

writeFileSync('/Users/a/dictation/src/data/ielts.ts', ieltsContent);
console.log('\n✅ IELTS 已保存');
console.log(`   起始: ${ieltsWords[0]}`);
console.log(`   结束: ${ieltsWords[ieltsWords.length - 1]}`);

console.log('\n🎉 词库拆分完成！');
