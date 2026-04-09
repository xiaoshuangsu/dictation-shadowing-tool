/**
 * 抓取 Oxford 3000 完整词汇列表
 * 从 engnovate.com 获取单词列表
 */
import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

const CATEGORY_URL = 'https://engnovate.com/flashcards/?category=oxford-3000';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function scrapeOxford3000() {
  console.log('📚 开始抓取 Oxford 3000 词汇列表...\n');

  try {
    // 获取分类页面
    console.log('📄 获取分类页面...');
    const response = await fetch(CATEGORY_URL, { headers: HEADERS });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    // 提取所有单词链接
    const wordLinks = html.match(/href="\/flashcards\/word\/[^"]+"/g) || [];

    console.log(`✅ 找到 ${wordLinks.length} 个单词链接`);

    // 提取单词
    const words = wordLinks
      .map(link => link.match(/\/word\/([^"]+)/)?.[1])
      .filter(word => word && word.length > 0)
      .sort();

    console.log(`📝 提取到 ${words.length} 个唯一单词`);

    // 去重
    const uniqueWords = [...new Set(words)];
    console.log(`🎯 去重后: ${uniqueWords.length} 个单词`);

    // 显示前 10 个单词
    console.log('\n示例单词:');
    uniqueWords.slice(0, 10).forEach(word => console.log(`  - ${word}`));

    // 保存到文件
    const outputFile = '/tmp/oxford_3000_words.json';
    writeFileSync(outputFile, JSON.stringify(uniqueWords, null, 2));
    console.log(`\n💾 已保存到: ${outputFile}`);

    // 生成 TypeScript 格式
    const tsContent = `/**
 * Oxford 3000 词汇列表
 * 来源：从 engnovate.com 抓取（${uniqueWords.length} 个核心词汇）
 * 更新时间：${new Date().toISOString()}
 */
export const OXFORD_3000_WORDS: string[] = [
${uniqueWords.map(word => `  "${word}"`).join(',\n')}
];
`;

    const tsFile = '/tmp/oxford-3000-new.ts';
    writeFileSync(tsFile, tsContent);
    console.log(`📝 TypeScript 格式已保存到: ${tsFile}`);

    return uniqueWords;

  } catch (error) {
    console.error('❌ 抓取失败:', error.message);
    throw error;
  }
}

scrapeOxford3000().catch(console.error);
