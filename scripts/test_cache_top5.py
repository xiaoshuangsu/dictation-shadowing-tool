#!/usr/bin/env python3
"""
词典缓存测试脚本 - 只预生成 Top 5 单词
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from typing import Set, List, Dict
from collections import Counter
from supabase import create_client
import requests

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# GLM API 配置
GLM_API_KEY = os.environ.get("GLM_API_KEY")
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://cuxotlijjnxbsirpdkgr.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# 创建 Supabase 客户端
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def extract_words_from_text(text: str) -> Set[str]:
    """从文本中提取有效的英语单词"""
    words = re.findall(r'\b[a-zA-Z]{2,}\b', text.lower())
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
        'these', 'those', 'it', 'its', 'he', 'she', 'they', 'them', 'him',
        'her', 'his', 'their', 'our', 'your', 'my', 'me', 'us', 'you', 'we'
    }
    valid_words = set()
    for word in words:
        if word not in stop_words and len(word) >= 2:
            if any(c in 'aeiouy' for c in word):
                valid_words.add(word)
    return valid_words

def fetch_word_definition_from_glm(word: str) -> Dict:
    """调用 GLM API 获取单词释义"""
    try:
        response = requests.post(
            f"{GLM_BASE_URL}/chat/completions",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {GLM_API_KEY}'
            },
            json={
                'model': 'glm-4-flash',
                'messages': [
                    {
                        'role': 'system',
                        'content': """你是一个专业的英语词典助手。请为用户查询的单词提供准确、简洁的释义。

请严格按照以下 JSON 格式返回结果（不要有任何额外文字）：
{
  "word": "单词（小写）",
  "phonetic": "音标（如 /həˈləʊ/）",
  "zh": "中文释义，最多3个常用释义，用分号分隔",
  "vi": "越南语释义，最多3个常用释义，用分号分隔",
  "en": "英文释义，最多3个常用释义，用分号分隔",
  "example": "英文例句（选填，如果该单词常用的话）"
}"""
                    },
                    {
                        'role': 'user',
                        'content': word
                    }
                ],
                'temperature': 0.2,
                'max_tokens': 500,
                'top_p': 0.7
            },
            timeout=30
        )

        if response.status_code != 200:
            print(f"  ⚠️  GLM API 错误: {response.status_code}")
            return None

        data = response.json()
        content = data.get('choices', [{}])[0].get('message', {}).get('content')

        if not content:
            return None

        try:
            result = json.loads(content)
            return result
        except json.JSONDecodeError:
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                try:
                    result = json.loads(json_match.group(0))
                    return result
                except json.JSONDecodeError:
                    pass
            return None

    except Exception as e:
        print(f"  ⚠️  调用失败: {e}")
        return None

def save_word_to_cache(word_data: Dict) -> bool:
    """将单词释义保存到缓存表"""
    try:
        word = word_data.get('word', '').lower().strip()
        definition_json = {
            'zh': word_data.get('zh', ''),
            'vi': word_data.get('vi', ''),
            'en': word_data.get('en', '')
        }

        supabase.table('dictionary_cache').upsert({
            'word': word,
            'phonetic': word_data.get('phonetic', ''),
            'definition_json': definition_json,
            'example': word_data.get('example')
        }, on_conflict='word').execute()

        return True

    except Exception as e:
        print(f"  ⚠️  保存失败: {e}")
        return False

def main():
    print("=" * 70)
    print("词典缓存测试脚本 - Top 5 单词")
    print("=" * 70)
    print()

    # 获取所有素材
    response = supabase.table('materials').select('id, title, transcript').execute()

    if not response.data:
        print("❌ 未找到任何素材")
        return

    # 提取单词并统计频率
    word_counter = Counter()
    for material in response.data:
        transcript = material.get('transcript')
        if not transcript:
            continue
        for sentence in transcript:
            text = sentence.get('text', '')
            words = extract_words_from_text(text)
            word_counter.update(words)

    # 获取 Top 5
    top_words = word_counter.most_common(5)

    print(f"📊 Top 5 高频词汇:")
    for i, (word, freq) in enumerate(top_words, 1):
        print(f"  {i}. {word:20s} : {freq:3d} 次")

    print(f"\n🚀 开始预生成...")
    print("=" * 70)

    success_count = 0
    failed_count = 0

    for i, (word, freq) in enumerate(top_words, 1):
        print(f"\n[{i}/5] 处理单词: {word} ({freq}次)", end=" ")

        # 调用 GLM API
        word_data = fetch_word_definition_from_glm(word)

        if not word_data:
            print("❌ 失败")
            failed_count += 1
            continue

        # 保存到缓存
        if save_word_to_cache(word_data):
            print("✅ 成功")
            success_count += 1
        else:
            print("⚠️  保存失败")
            failed_count += 1

        time.sleep(1)  # API 限流

    # 总结
    print("\n" + "=" * 70)
    print("📊 预生成完成！")
    print("=" * 70)
    print(f"✅ 成功: {success_count} 个")
    print(f"❌ 失败: {failed_count} 个")

    # 查询缓存统计
    stats_response = supabase.table('dictionary_cache').select('hit_count').execute()
    total_cached = len(stats_response.data)

    print(f"\n📚 缓存总数: {total_cached}")

if __name__ == '__main__':
    main()
