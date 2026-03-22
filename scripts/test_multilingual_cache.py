#!/usr/bin/env python3
"""
词典缓存多语言测试脚本 - Top 10 单词

特性：
1. 多语言配置数组（支持动态扩展）
2. 断点续传（只翻译缺失的语言）
3. 去重逻辑（已存在的语言跳过）

使用方法：
  python scripts/test_multilingual_cache.py
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from typing import Set, List, Dict, Optional
from collections import Counter
from supabase import create_client
import requests

# ══════════════════════════════════════════════════════════════════════════════
# 配置区域
# ══════════════════════════════════════════════════════════════════════════════

# 🌍 多语言配置（可以动态扩展）
SUPPORTED_LANGUAGES = [
    {'code': 'zh-CN', 'name': '简体中文', 'prompt': '中文'},
    {'code': 'zh-Hant', 'name': '繁體中文', 'prompt': '繁體中文'},
    {'code': 'vi', 'name': 'Vietnamese', 'prompt': '越南语'},
    # 未来扩展只需添加新语言：
    # {'code': 'ja', 'name': '日本語', 'prompt': '日本語'},
    # {'code': 'ko', 'name': '한국어', 'prompt': '한국어'},
]

# 测试单词数量
TOP_N_WORDS = 10

# ══════════════════════════════════════════════════════════════════════════════
# 环境配置
# ══════════════════════════════════════════════════════════════════════════════

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

GLM_API_KEY = os.environ.get("GLM_API_KEY")
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"

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
# 分词函数
# ══════════════════════════════════════════════════════════════════════════════

def extract_words_from_text(text: str) -> Set[str]:
    """从文本中提取有效的英语单词"""
    words = re.findall(r'\b[a-zA-Z]{2,}\b', text.lower())

    # 过滤停用词
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

# ══════════════════════════════════════════════════════════════════════════════
# GLM API 函数
# ══════════════════════════════════════════════════════════════════════════════

def fetch_missing_translations(word: str, missing_languages: List[Dict]) -> Optional[Dict]:
    """
    调用 GLM API 获取缺失的语言释义

    Args:
        word: 要翻译的单词
        missing_languages: 缺失的语言列表（如 [{'code': 'zh-CN', 'name': '简体中文'}]）

    Returns:
        { 'zh-CN': '...', 'zh-Hant': '...', 'vi': '...' }
    """
    if not missing_languages:
        return None

    # 构建 Prompt
    lang_list = '\n'.join([
        f'  - {lang["code"]}: {lang["prompt"]}释义'
        for lang in missing_languages
    ])

    json_structure = json.dumps({
        lang['code']: f'{lang["prompt"]}释义（最多3个常用释义，用分号分隔）'
        for lang in missing_languages
    }, ensure_ascii=False, indent=2)

    system_prompt = f"""你是一个专业的多语言词典助手。请为英语单词提供准确、简洁的多语言释义。

请严格按照以下 JSON 格式返回结果（不要有任何额外文字）：
{json_structure}

要求：
1. 每种语言最多 3 个常用释义，用分号分隔
2. 释义要地道、自然、简洁
3. 只返回 JSON，不要有任何解释文字

示例：
输入：hello
输出：
{{
  "zh-CN": "你好；问候；喂",
  "zh-Hant": "你好；問候；喂",
  "vi": "xin chào; chào hỏi"
}}"""

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
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': word}
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
        print(f"  ⚠️  调用失败: {e}")
        return None

# ══════════════════════════════════════════════════════════════════════════════
# 数据库操作
# ══════════════════════════════════════════════════════════════════════════════

def get_cached_definitions(word: str) -> Optional[Dict]:
    """获取单词的缓存释义"""
    try:
        response = supabase.table('dictionary_cache').select('*').eq('word', word.lower()).execute()

        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"  ⚠️  查询缓存失败: {e}")
        return None

def analyze_missing_languages(cached_data: Dict) -> List[Dict]:
    """
    分析缺失的语言

    Args:
        cached_data: 从数据库获取的缓存数据

    Returns:
        缺失的语言列表
    """
    definitions = cached_data.get('definitions', {})

    # 如果 definitions 是字符串，尝试解析
    if isinstance(definitions, str):
        try:
            definitions = json.loads(definitions)
        except json.JSONDecodeError:
            definitions = {}

    missing = []

    for lang in SUPPORTED_LANGUAGES:
        code = lang['code']
        # 检查语言是否存在且非空
        if not definitions.get(code):
            missing.append(lang)

    return missing

def save_word_to_cache(
    word: str,
    phonetic: str,
    definitions: Dict,
    example: Optional[str] = None
) -> bool:
    """保存或更新单词缓存"""
    try:
        word_lower = word.lower().strip()

        # 检查是否已存在
        cached = get_cached_definitions(word_lower)

        if cached:
            # 合并已有释义（断点续传）
            existing_definitions = cached.get('definitions', {})
            if isinstance(existing_definitions, str):
                try:
                    existing_definitions = json.loads(existing_definitions)
                except json.JSONDecodeError:
                    existing_definitions = {}

            # 合并：新释义覆盖旧释义
            merged_definitions = {**existing_definitions, **definitions}

            # 更新
            supabase.table('dictionary_cache').update({
                'phonetic': phonetic,
                'definitions': merged_definitions,
                'example': example or cached.get('example')
            }).eq('word', word_lower).execute()
        else:
            # 插入新记录
            supabase.table('dictionary_cache').insert({
                'word': word_lower,
                'phonetic': phonetic,
                'definitions': definitions,
                'example': example
            }).execute()

        return True

    except Exception as e:
        print(f"  ⚠️  保存失败: {e}")
        return False

# ══════════════════════════════════════════════════════════════════════════════
# 主流程
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 80)
    print("词典缓存多语言测试脚本 - Top 10 单词")
    print("=" * 80)
    print()

    # 显示当前配置
    print("🌍 当前支持的语言:")
    for i, lang in enumerate(SUPPORTED_LANGUAGES, 1):
        print(f"  {i}. {lang['code']:10s} - {lang['name']}")
    print()

    # 1. 提取单词
    print("📖 正在提取所有素材的单词...")
    response = supabase.table('materials').select('id, title, transcript').execute()

    if not response.data:
        print("❌ 未找到任何素材")
        return

    word_counter = Counter()
    for material in response.data:
        transcript = material.get('transcript')
        if not transcript:
            continue
        for sentence in transcript:
            text = sentence.get('text', '')
            words = extract_words_from_text(text)
            word_counter.update(words)

    print(f"✅ 提取完成！共找到 {len(word_counter)} 个唯一单词")
    print()

    # 2. 获取 Top N 单词
    top_words = word_counter.most_common(TOP_N_WORDS)

    print(f"📊 Top {TOP_N_WORDS} 高频词汇:")
    for i, (word, freq) in enumerate(top_words, 1):
        cached = get_cached_definitions(word)
        status = "✅" if cached else "  "
        print(f"  {status} {i:2d}. {word:20s} : {freq:3d} 次")

    print()
    print("=" * 80)
    print("🚀 开始处理...")
    print("=" * 80)
    print()

    # 统计
    success_count = 0
    skipped_count = 0
    failed_count = 0
    total_translations = 0

    for i, (word, freq) in enumerate(top_words, 1):
        print(f"[{i}/{TOP_N_WORDS}] 处理单词: {word} ({freq}次)")
        print("-" * 80)

        # 3. 检查缓存
        cached_data = get_cached_definitions(word)

        if cached_data:
            # 4. 分析缺失的语言
            missing_languages = analyze_missing_languages(cached_data)

            if not missing_languages:
                print("  ✅ 所有语言已完整，跳过")
                skipped_count += 1
                print()
                continue
            else:
                print(f"  📝 缺失语言: {', '.join([lang['code'] for lang in missing_languages])}")
        else:
            # 没有缓存，需要翻译所有语言
            missing_languages = SUPPORTED_LANGUAGES.copy()
            print(f"  🆕 新单词，需要翻译所有语言")

        # 5. 调用 API 获取缺失的翻译
        print(f"  🌐 调用 GLM API ({len(missing_languages)} 种语言)...", end=" ")

        translations = fetch_missing_translations(word, missing_languages)

        if not translations:
            print("❌ 失败")
            failed_count += 1
            print()
            continue

        print("✅ 成功")

        # 6. 显示结果
        for lang_code, translation in translations.items():
            lang_name = next((l['name'] for l in SUPPORTED_LANGUAGES if l['code'] == lang_code), lang_code)
            print(f"     {lang_code:10s} ({lang_name}): {translation}")

        # 7. 构建完整的数据（合并已有数据）
        phonetic = cached_data.get('phonetic', '') if cached_data else ''
        example = cached_data.get('example') if cached_data else None

        # 如果没有音标，尝试从 API 响应中获取
        if not phonetic and 'phonetic' in translations:
            phonetic = translations['phonetic']

        # 保存到数据库
        if save_word_to_cache(word, phonetic, translations, example):
            print(f"  💾 已保存到缓存")
            success_count += 1
            total_translations += len(translations)
        else:
            print(f"  ⚠️  保存失败")
            failed_count += 1

        print()

    # 总结
    print("=" * 80)
    print("📊 处理完成！")
    print("=" * 80)
    print(f"✅ 成功: {success_count} 个单词，{total_translations} 条翻译")
    print(f"⏭️  跳过: {skipped_count} 个单词（已完整）")
    print(f"❌ 失败: {failed_count} 个单词")
    print()

    # 查询缓存统计
    stats_response = supabase.table('dictionary_cache').select('word, definitions').execute()
    total_cached = len(stats_response.data)

    print(f"📚 缓存统计:")
    print(f"  - 总单词数: {total_cached}")
    print()

    # 显示示例数据
    print("📋 数据示例（前 3 个）:")
    for i, record in enumerate(stats_response.data[:3], 1):
        word = record['word']
        definitions = record['definitions']
        if isinstance(definitions, str):
            definitions = json.loads(definitions)

        print(f"\n  {i}. {word}:")
        for lang_code, translation in definitions.items():
            if translation:  # 只显示非空的翻译
                lang_name = next((l['name'] for l in SUPPORTED_LANGUAGES if l['code'] == lang_code), lang_code)
                print(f"     [{lang_code}] {lang_name}: {translation}")

if __name__ == '__main__':
    main()
