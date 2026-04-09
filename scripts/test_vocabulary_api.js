#!/usr/bin/env node

/**
 * 测试 vocabulary-words API
 */

async function testAPI() {
  const response = await fetch('http://localhost:3000/api/vocabulary-words?category=oxford-3000&limit=15&offset=0');
  const text = await response.text();

  console.log('=== API 响应 ===');
  console.log('Status:', response.status);
  console.log('Headers:', Object.fromEntries(response.headers.entries()));

  try {
    const json = JSON.parse(text);
    console.log('\n=== 解析后的 JSON ===');
    console.log('Success:', json.success);
    console.log('Total words:', json.total);
    console.log('Returned words:', json.words?.length);

    if (json.words && json.words.length > 0) {
      console.log('\nFirst word:', JSON.stringify(json.words[0], null, 2));
    }
  } catch (e) {
    console.log('\n=== 原始响应 (非 JSON) ===');
    console.log(text.substring(0, 500));
  }
}

testAPI().catch(console.error);
