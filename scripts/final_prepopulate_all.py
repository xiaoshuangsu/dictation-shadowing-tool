#!/usr/bin/env python3
"""
词典缓存全量预生成脚本 - 7,139 个单词

特性：
- 自动重试机制（网络失败时，最多重试 3 次）
- 断点续传（已缓存的词跳过）
- 语言过滤（只保留 zh-CN, zh-Hant, vi, en）
- Prompt 微调（明确告知 GLM 只提供指定语言）
- 静默运行（每100词报告一次进度）
- 后台运行（支持长时间运行）

使用方法：
  python scripts/final_prepopulate_all.py [--yes] [--background]

选项：
  --yes, -y        自动确认，无需手动确认
  --background, -b 后台模式，静默运行（减少输出）
"""

import os
import sys
import json
import time
import re
import argparse
from pathlib import Path
from typing import Set, List, Dict, Optional
from collections import Counter
from supabase import create_client
import requests

# ══════════════════════════════════════════════════════════════════
# 配置区域
# ══════════════════════════════════════════════════════════════════

# 🌍 多语言配置（严格过滤，只保留这 4 种）
ALLOWED_LANGUAGES = ['zh-CN', 'zh-Hant', 'vi', 'en']

SUPPORTED_LANGUAGES = [
    {'code': 'zh-CN', 'name': '简体中文', 'prompt': '简体中文'},
    {'code': 'zh-Hant', 'name': '繁體中文', 'prompt': '繁體中文'},
    {'code': 'vi', 'name': 'Vietnamese', 'prompt': '越南语'},
    {'code': 'en', 'name': 'English', 'prompt': '英语'},
]

# 🔄 重试配置
MAX_RETRIES = 3
RETRY_DELAY = 3  # 秒

# 📊 进度报告间隔
PROGRESS_INTERVAL = 100  # 每处理 100 个单词报告一次

# 🚦 API 限流配置
API_DELAY = 0.6  # 每个请求之间延迟（秒）
BATCH_DELAY = 2  # 每批之后延迟（秒）
BATCH_SIZE = 5   # 每批处理数量

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

# ══════════════════════════════════════════════════════════════════
# 分词函数
# ══════════════════════════════════════════════════════════════════

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

# ══════════════════════════════════════════════════════════════════
# GLM API 函数（带重试和语言过滤）
# ══════════════════════════════════════════════════════════════════

def build_system_prompt() -> str:
    """
    构建严格的系统 Prompt，明确告知 GLM 只提供指定语言

    Returns:
        系统 Prompt 字符串
    """
    lang_list = '\n'.join([
        f'  - {lang["code"]}: {lang["prompt"]}释义'
        for lang in SUPPORTED_LANGUAGES
    ])

    json_structure = json.dumps({
        'word': '单词（小写）',
        'phonetic': '音标（如 /həˈləʊ/）',
        **{
            lang['code']: f'{lang["prompt"]}释义（最多3个常用释义，用分号分隔）'
            for lang in SUPPORTED_LANGUAGES
        },
        'example': '英文例句（选填）'
    }, ensure_ascii=False, indent=2)

    return f"""你是一个专业的多语言词典助手。请为英语单词提供准确、简洁的多语言释义。

⚠️ **重要限制：只提供以下语言的释义，不要添加其他语言**

{lang_list}

请严格按照以下 JSON 格式返回结果（不要有任何额外文字）：
{json_structure}

⚠️ **严格要求：**
1. **ONLY** provide definitions for: zh-CN, zh-Hant, vi, en
2. **DO NOT** include any other languages (no Japanese, Korean, Thai, French, German, Spanish, etc.)
3. 每种语言最多 3 个常用释义，用分号分隔
4. 释义要地道、自然、简洁
5. 只返回 JSON，不要有任何解释文字

示例：
输入：hello
输出：
{{
  "word": "hello",
  "phonetic": "/həˈləʊ/",
  "zh-CN": "你好；问候；喂",
  "zh-Hant": "你好；問候；喂",
  "vi": "xin chào; chào hỏi",
  "en": "a greeting; an expression of greeting",
  "example": "Hello, how are you?"
}}

⚠️ **再次强调：只提供 zh-CN, zh-Hant, vi, en 四种语言的释义，不要添加其他语言！**
"""

def filter_definitions(raw_data: Dict) -> Dict:
    """
    过滤 GLM 返回的数据，只保留允许的语言

    Args:
        raw_data: GLM 返回的原始数据

    Returns:
        过滤后的数据（只包含 ALLOWED_LANGUAGES）
    """
    filtered = {'word': raw_data.get('word', '').lower()}

    if 'phonetic' in raw_data:
        filtered['phonetic'] = raw_data['phonetic']

    # 只保留允许的语言
    definitions = {}
    for lang_code in ALLOWED_LANGUAGES:
        if lang_code in raw_data and raw_data[lang_code]:
            definitions[lang_code] = raw_data[lang_code]

    filtered['definitions'] = definitions

    # 可选的 example
    if 'example' in raw_data and raw_data['example']:
        filtered['example'] = raw_data['example']

    return filtered

def fetch_filtered_translations(word: str, missing_languages: List[Dict]) -> Optional[Dict]:
    """
    调用 GLM API 获取单词释义（带重试和严格过滤）

    Args:
        word: 要翻译的单词
        missing_languages: 缺失的语言列表

    Returns:
        { 'zh-CN': '...', 'zh-Hant': '...', 'vi': '...', 'en': '...' }
    """
    if not missing_languages:
        return None

    system_prompt = build_system_prompt()

    try:
        for attempt in range(MAX_RETRIES):
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
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(RETRY_DELAY * (attempt + 1))
                        continue
                    else:
                        return None

                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content')

                if not content:
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(RETRY_DELAY * (attempt + 1))
                        continue
                    else:
                        return None

                # 解析 JSON
                try:
                    raw_data = json.loads(content)
                except json.JSONDecodeError:
                    # 尝试提取 JSON 部分
                    json_match = re.search(r'\{[\s\S]*\}', content)
                    if json_match:
                        try:
                            raw_data = json.loads(json_match.group(0))
                        except json.JSONDecodeError:
                            if attempt < MAX_RETRIES - 1:
                                time.sleep(RETRY_DELAY * (attempt + 1))
                                continue
                            else:
                                return None
                    else:
                        if attempt < MAX_RETRIES - 1:
                            time.sleep(RETRY_DELAY * (attempt + 1))
                            continue
                        else:
                            return None

                # 🔴 语言过滤：只保留我们需要的语言
                return filter_definitions(raw_data)

            except requests.Timeout:
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
                    continue
                else:
                    return None

            except requests.exceptions.RequestException:
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
                    continue
                else:
                    return None

        return None

    except Exception:
        return None

# ══════════════════════════════════════════════════════════════════
# 数据库操作
# ══════════════════════════════════════════════════════════════════

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
    """分析缺失的语言"""
    definitions = cached_data.get('definitions', {})

    if isinstance(definitions, str):
        try:
            definitions = json.loads(definitions)
        except json.JSONDecodeError:
            definitions = {}

    missing = []
    for lang in SUPPORTED_LANGUAGES:
        code = lang['code']
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

# ══════════════════════════════════════════════════════════════════
# 主流程
# ══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='词典缓存全量预生成脚本')
    parser.add_argument('--yes', '-y', action='store_true', help='自动确认模式')
    parser.add_argument('--background', '-b', action='store_true', help='后台模式（静默运行）')
    args = parser.parse_args()

    background_mode = args.background
    auto_confirm = args.yes or background_mode

    if not background_mode:
        print("=" * 80)
        print("词典缓存全量预生成脚本（优化版）")
        print("=" * 80)
        print()
        print("🌍 支持的语言（严格过滤，只保留这 4 种）:")
        for lang in SUPPORTED_LANGUAGES:
            print(f"  - {lang['code']:10s} : {lang['name']}")
        print()
        print("🔄 配置:")
        print(f"  - 自动重试: {MAX_RETRIES} 次")
        print(f"  - 进度报告: 每 {PROGRESS_INTERVAL} 词")
        print()

    # 1. 提取所有单词
    if not background_mode:
        print("📖 正在提取所有素材的单词...", flush=True)

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

    total_unique = len(word_counter)

    if not background_mode:
        print(f"✅ 提取完成！共找到 {total_unique} 个唯一单词", flush=True)
    else:
        print(f"[INIT] 提取完成！共找到 {total_unique} 个唯一单词", flush=True)

    # 按频率排序
    all_words = sorted(word_counter.items(), key=lambda x: x[1], reverse=True)

    # 2. 检查已缓存的单词
    if not background_mode:
        print(f"\n🔍 检查已缓存的单词...", flush=True)

    cached_response = supabase.table('dictionary_cache').select('word').execute()
    cached_words = {row['word'] for row in cached_response.data}

    if not background_mode:
        print(f"✅ 已缓存 {len(cached_words)} 个单词", flush=True)
    else:
        print(f"[INIT] 已缓存 {len(cached_words)} 个单词", flush=True)

    # 3. 确定需要预生成的单词
    words_to_cache = [(word, freq) for word, freq in all_words if word not in cached_words]

    if not background_mode:
        print(f"\n📝 需要预生成 {len(words_to_cache)} 个单词", flush=True)
    else:
        print(f"[INIT] 需要预生成 {len(words_to_cache)} 个单词", flush=True)

    if len(words_to_cache) == 0:
        print("\n✅ 所有单词已缓存，无需预生成")
        return

    # 询问是否继续
    if not background_mode:
        print(f"\n⚠️  预计需要调用 GLM API {len(words_to_cache)} 次")
        print(f"⚠️  预计耗时：{len(words_to_cache) * API_DELAY / 60:.1f} 分钟")

    if auto_confirm:
        if not background_mode:
            print("\n✅ 自动确认模式，开始执行...", flush=True)
        else:
            print(f"[START] 开始处理 {len(words_to_cache)} 个单词...", flush=True)
    else:
        confirm = input("\n是否继续？")
        if confirm.lower() != 'y':
            print("❌ 已取消")
            return

    # 4. 批量处理
    if not background_mode:
        print(f"\n🚀 开始预生成...", flush=True)
        print("=" * 80, flush=True)

    success_count = 0
    failed_count = 0
    skipped_count = 0
    total_words = len(words_to_cache)
    start_time = time.time()
    last_report = 0

    for i, (word, freq) in enumerate(words_to_cache, 1):
        # 检查缓存（可能已被其他进程处理）
        cached = get_cached_definitions(word)
        if cached:
            missing_languages = analyze_missing_languages(cached)
            if not missing_languages:
                skipped_count += 1
                if not background_mode and i - last_report >= PROGRESS_INTERVAL:
                    print(f"  进度: [{i}/{total_words}] 跳过已缓存: {word}", flush=True)
                    last_report = i
                continue

        # 调用 GLM API
        missing_languages = SUPPORTED_LANGUAGES.copy() if not cached else analyze_missing_languages(cached)
        result = fetch_filtered_translations(word, missing_languages)

        if not result:
            failed_count += 1
            if not background_mode and i - last_report >= PROGRESS_INTERVAL:
                print(f"  进度: [{i}/{total_words}] ❌ 失败: {word}", flush=True)
                last_report = i
            time.sleep(API_DELAY)
            continue

        # 保存到缓存
        phonetic = result.get('phonetic', '')
        definitions = result.get('definitions', {})
        example = result.get('example')

        if save_word_to_cache(word, phonetic, definitions, example):
            success_count += 1
        else:
            failed_count += 1

        # 进度报告（每 100 个词）
        if i % PROGRESS_INTERVAL == 0 or i == total_words:
            progress_pct = i / total_words * 100
            elapsed = time.time() - start_time
            speed = i / elapsed if elapsed > 0 else 0
            eta = (total_words - i) / speed if speed > 0 else 0

            if background_mode:
                print(f"[PROGRESS] {i}/{total_words} ({progress_pct:.1f}%) | "
                      f"✅{success_count} ❌{failed_count} ⏭️{skipped_count} | "
                      f"速度: {speed:.1f} 词/分 | "
                      f"剩余: {eta/60:.0f} 分钟", flush=True)
            else:
                print(f"  进度: [{i}/{total_words}] ({progress_pct:.1f}%) | "
                      f"✅{success_count} ❌{failed_count} ⏭️{skipped_count} | "
                      f"速度: {speed:.1f} 词/分 | "
                      f"剩余: {eta/60:.0f} 分钟", flush=True)
            last_report = i

        # API 限流
        if i % BATCH_SIZE == 0:
            time.sleep(BATCH_DELAY)
        else:
            time.sleep(API_DELAY)

    # 5. 总结
    elapsed = time.time() - start_time

    if not background_mode:
        print("\n" + "=" * 80)
        print("📊 预生成完成！")
        print("=" * 80, flush=True)
    else:
        print(f"\n[COMPLETE] 处理完成！", flush=True)

    print(f"✅ 成功: {success_count} 个", flush=True)
    print(f"❌ 失败: {failed_count} 个", flush=True)
    print(f"⏭️  跳过: {skipped_count} 个", flush=True)

    if success_count + failed_count > 0:
        print(f"📈 成功率: {success_count / (success_count + failed_count) * 100:.1f}%", flush=True)
    print(f"⏱️  总耗时: {elapsed/60:.1f} 分钟", flush=True)

    # 6. 查询缓存统计
    stats_response = supabase.table('dictionary_cache').select('word, definitions').execute()
    total_cached = len(stats_response.data)

    print(f"\n📚 缓存统计:", flush=True)
    print(f"  - 总单词数: {total_cached}", flush=True)

    # 统计每种语言的覆盖率
    lang_coverage = {lang: 0 for lang in ALLOWED_LANGUAGES}
    for record in stats_response.data:
        definitions = record.get('definitions', {})
        if isinstance(definitions, str):
            try:
                definitions = json.loads(definitions)
            except json.JSONDecodeError:
                continue

        for lang in ALLOWED_LANGUAGES:
            if definitions.get(lang):
                lang_coverage[lang] += 1

    print(f"  - 语言覆盖率:", flush=True)
    for lang, count in lang_coverage.items():
        pct = count / total_cached * 100 if total_cached > 0 else 0
        print(f"    - {lang:10s}: {count:4d} / {total_cached} ({pct:.1f}%)", flush=True)

if __name__ == '__main__':
    main()
