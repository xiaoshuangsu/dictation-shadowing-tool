#!/usr/bin/env python3
"""
词典缓存预生成脚本

功能：
1. 从 materials 表提取所有单词
2. 批量调用 GLM API 获取释义
3. 存入 dictionary_cache 表

使用方法：
  python scripts/prepopulate_dictionary_cache.py

环境变量：
  GLM_API_KEY - 智谱 AI API 密钥
  SUPABASE_SERVICE_ROLE_KEY - Supabase Service Role Key
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

if not SUPABASE_SERVICE_KEY:
    print("❌ 错误: 未找到 SUPABASE_SERVICE_ROLE_KEY 环境变量")
    sys.exit(1)

if not GLM_API_KEY:
    print("❌ 错误: 未找到 GLM_API_KEY 环境变量")
    sys.exit(1)

# 创建 Supabase 客户端
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ══════════════════════════════════════════════════════════════════════════════
# 分词和单词提取
# ══════════════════════════════════════════════════════════════════════════════

def extract_words_from_text(text: str) -> Set[str]:
    """从文本中提取有效的英语单词"""
    # 使用正则表达式提取单词
    words = re.findall(r'\b[a-zA-Z]{2,}\b', text.lower())

    # 过滤掉常见的非单词词汇
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
            # 检查是否包含至少一个元音字母（英语单词的基本特征）
            if any(c in 'aeiouy' for c in word):
                valid_words.add(word)

    return valid_words

def extract_words_from_transcripts() -> Dict[str, int]:
    """从所有素材的 transcript 中提取单词并统计频率"""
    print("📖 正在提取所有素材的单词...")

    # 获取所有素材
    response = supabase.table('materials').select('id, title, transcript').execute()

    if not response.data:
        print("❌ 未找到任何素材")
        return {}

    word_counter = Counter()

    for material in response.data:
        transcript = material.get('transcript')
        if not transcript:
            continue

        # 提取每个句子的文本
        for sentence in transcript:
            text = sentence.get('text', '')
            words = extract_words_from_text(text)
            word_counter.update(words)

    print(f"✅ 提取完成！共找到 {len(word_counter)} 个唯一单词")
    return dict(word_counter)

# ══════════════════════════════════════════════════════════════════════════════
# GLM API 调用
# ══════════════════════════════════════════════════════════════════════════════

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
}

示例：
输入：hello
输出：
{
  "word": "hello",
  "phonetic": "/həˈləʊ/",
  "zh": "你好；问候；喂",
  "vi": "xin chào; chào hỏi",
  "en": "a greeting; an expression of greeting",
  "example": "Hello, how are you?"
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
            print(f"  ⚠️  GLM API 返回空内容")
            return None

        # 解析 JSON
        try:
            result = json.loads(content)
            return result
        except json.JSONDecodeError:
            # 尝试提取 JSON 部分
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                try:
                    result = json.loads(json_match.group(0))
                    return result
                except json.JSONDecodeError:
                    pass

            print(f"  ⚠️  无法解析 GLM 响应")
            return None

    except Exception as e:
        print(f"  ⚠️  调用 GLM API 失败: {e}")
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
        print(f"  ⚠️  保存到缓存失败: {e}")
        return False

# ══════════════════════════════════════════════════════════════════════════════
# 主函数
# ══════════════════════════════════════════════════════════════════════════════

def main():
    # 检查命令行参数
    auto_confirm = '--yes' in sys.argv or '-y' in sys.argv
    print("=" * 70)
    print("词典缓存预生成脚本")
    print("=" * 70)
    print()

    # 1. 提取所有单词
    word_freq = extract_words_from_transcripts()

    if not word_freq:
        print("❌ 未找到任何单词，退出")
        return

    # 按频率排序
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)

    print(f"\n📊 单词频率统计（Top 20）：")
    for word, freq in sorted_words[:20]:
        print(f"  {word:20s} : {freq:3d} 次")

    # 2. 检查已缓存的单词
    print(f"\n🔍 检查已缓存的单词...")
    cached_response = supabase.table('dictionary_cache').select('word').execute()
    cached_words = {row['word'] for row in cached_response.data}

    print(f"✅ 已缓存 {len(cached_words)} 个单词")

    # 3. 确定需要预生成的单词
    words_to_cache = [word for word, freq in sorted_words if word not in cached_words]

    print(f"\n📝 需要预生成 {len(words_to_cache)} 个单词")

    if len(words_to_cache) == 0:
        print("\n✅ 所有单词已缓存，无需预生成")
        return

    # 询问是否继续
    print(f"\n⚠️  预计需要调用 GLM API {len(words_to_cache)} 次")
    print(f"⚠️  预计耗时：{len(words_to_cache) * 2 / 60:.1f} 分钟")

    if auto_confirm:
        print("\n✅ 自动确认模式，开始执行...")
    else:
        confirm = input("\n是否继续？(y/N): ")
        if confirm.lower() != 'y':
            print("❌ 已取消")
            return

    # 4. 批量调用 API 并缓存
    print(f"\n🚀 开始预生成...")
    print("=" * 70)

    success_count = 0
    failed_count = 0
    total_words = len(words_to_cache)

    for i, word in enumerate(words_to_cache, 1):
        print(f"\n[{i}/{total_words}] 处理单词: {word}", end=" ")

        # 调用 GLM API
        word_data = fetch_word_definition_from_glm(word)

        if not word_data:
            print("❌ 失败")
            failed_count += 1
            time.sleep(1)  # API 失败后等待
            continue

        # 保存到缓存
        if save_word_to_cache(word_data):
            print("✅ 成功")
            success_count += 1
        else:
            print("⚠️  保存失败")
            failed_count += 1

        # API 限流：每 5 个单词后等待 2 秒
        if i % 5 == 0:
            print(f"\n⏸️  已处理 {i}/{total_words}，等待 2 秒...")
            time.sleep(2)
        else:
            time.sleep(0.5)  # 每个单词之间等待 0.5 秒

    # 5. 总结
    print("\n" + "=" * 70)
    print("📊 预生成完成！")
    print("=" * 70)
    print(f"✅ 成功: {success_count} 个")
    print(f"❌ 失败: {failed_count} 个")
    print(f"📈 成功率: {success_count / total_words * 100:.1f}%")
    print()

    # 6. 查询缓存统计
    stats_response = supabase.table('dictionary_cache').select('hit_count').execute()
    total_cached = len(stats_response.data)
    total_hits = sum(row.get('hit_count', 0) for row in stats_response.data)

    print(f"📚 缓存统计:")
    print(f"  - 总单词数: {total_cached}")
    print(f"  - 总命中次数: {total_hits}")
    print(f"  - 平均命中: {total_hits / total_cached:.1f} 次/词" if total_cached > 0 else "")

if __name__ == '__main__':
    main()
