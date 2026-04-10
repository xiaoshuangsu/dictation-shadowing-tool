#!/usr/bin/env python3
"""
词典翻译诊断脚本
检查 dictionary_cache 表中 translations 字段的完整性
"""

import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# 加载环境变量
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

# 验证环境变量
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ 缺少 Supabase 环境变量")
    sys.exit(1)

# 连接 Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 定义标准的 19 国语言 Key
STANDARD_19_LANGUAGES = [
    'zh', 'zh_hant', 'vi',  # 原有 3 种
    'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el',  # Group A (8 种)
    'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi'   # Group B (8 种)
]

print("=" * 70)
print("📊 词典翻译诊断报告")
print("=" * 70)
print()

# 统计 A：完全没有 translations 字段的单词
print("[1/3] 统计完全没有 translations 字段的单词...")
response_a = supabase.table('dictionary_cache').select('word', count='exact').is_('translations', 'null').execute()

count_no_translations = response_a.count if hasattr(response_a, 'count') else len(response_a.data)
print(f"✅ 统计 A：完全没有 translations 字段的单词数量 = {count_no_translations}")

print()

# 统计 B：虽有 translations 但 Key 不全（少于 19 国）的单词
print("[2/3] 统计 translations 字段 Key 不全的单词...")

# 获取所有有 translations 字段的单词
response_all = supabase.table('dictionary_cache').select('word', 'translations').not_.is_('translations', 'null').execute()

all_words = response_all.data
print(f"📊 总共有 translations 字段的单词数：{len(all_words)}")

incomplete_words = []
complete_words = []
invalid_translations = []

for word_entry in all_words:
    word = word_entry['word']
    translations_raw = word_entry.get('translations')

    # 检查 translations 是否为有效 JSON
    try:
        if isinstance(translations_raw, str):
            translations = json.loads(translations_raw)
        elif isinstance(translations_raw, dict):
            translations = translations_raw
        else:
            invalid_translations.append(word)
            continue

        # 检查 Key 数量
        if translations is None:
            invalid_translations.append(word)
            continue

        existing_keys = set(translations.keys())
        standard_keys = set(STANDARD_19_LANGUAGES)

        # 计算缺失的语言
        missing_keys = standard_keys - existing_keys

        if len(missing_keys) > 0:
            incomplete_words.append({
                'word': word,
                'existing_count': len(existing_keys),
                'missing_count': len(missing_keys),
                'missing_keys': sorted(list(missing_keys)),
                'translations': translations
            })
        else:
            complete_words.append(word)

    except (json.JSONDecodeError, TypeError, AttributeError) as e:
        invalid_translations.append(word)

print(f"✅ 统计 B：虽有 translations 但 Key 不全（少于 19 国）的单词数量 = {len(incomplete_words)}")
print(f"✅ 统计 C：translations 完整（19 国齐全）的单词数量 = {len(complete_words)}")
print(f"⚠️  统计 D：translations 格式无效的单词数量 = {len(invalid_translations)}")

print()
print("[3/3] 翻译不全的单词示例（前 2 个）：")
print("-" * 70)

for idx, word_info in enumerate(incomplete_words[:2], 1):
    print(f"\n示例 {idx}：{word_info['word']}")
    print(f"  现有语言数：{word_info['existing_count']}/19")
    print(f"  缺失语言数：{word_info['missing_count']}")
    print(f"  缺失语言：{', '.join(word_info['missing_keys'])}")
    print(f"  完整 translations JSON：")
    print(f"  {json.dumps(word_info['translations'], ensure_ascii=False, indent=2)}")

print()
print("=" * 70)
print("📊 诊断汇总")
print("=" * 70)
print(f"✅ 完全没有 translations 字段：{count_no_translations} 个单词")
print(f"⚠️  translations 不全：{len(incomplete_words)} 个单词")
print(f"✅ translations 完整：{len(complete_words)} 个单词")
print(f"❌ translations 格式无效：{len(invalid_translations)} 个单词")
print(f"📊 总单词数：{count_no_translations + len(incomplete_words) + len(complete_words) + len(invalid_translations)}")
print()

if invalid_translations:
    print(f"⚠️  格式无效的单词列表（前 10 个）：{', '.join(invalid_translations[:10])}")
