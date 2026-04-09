/**
 * 检查 API 返回的数据结构
 */
async function checkAPI() {
  const response = await fetch('http://localhost:3000/api/vocabulary-words?category=oxford-3000&limit=1&offset=0');
  const json = await response.json();

  if (json.success && json.words && json.words.length > 0) {
    const word = json.words[0];
    console.log('单词:', word.word);
    console.log('有 translations 字段:', !!word.translations);
    console.log('有 dictionary_cache.translations 字段:', !!word.dictionary_cache?.translations);

    if (word.translations) {
      try {
        const trans = JSON.parse(word.translations);
        console.log('translations 中的语言数量:', Object.keys(trans).length);
        console.log('包含日语:', 'ja' in trans);
        console.log('日语翻译:', trans.ja);
      } catch (e) {
        console.log('translations 解析失败:', e.message);
      }
    }

    if (word.dictionary_cache?.translations) {
      try {
        const cacheTrans = JSON.parse(word.dictionary_cache.translations);
        console.log('dictionary_cache.translations 中的语言数量:', Object.keys(cacheTrans).length);
        console.log('包含日语:', 'ja' in cacheTrans);
        console.log('日语翻译:', cacheTrans.ja);
      } catch (e) {
        console.log('cache translations 解析失败:', e.message);
      }
    }
  }
}

checkAPI().catch(console.error);
