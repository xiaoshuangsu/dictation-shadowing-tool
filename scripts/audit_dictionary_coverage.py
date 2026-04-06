#!/usr/bin/env python3
"""
词典覆盖率审计脚本
统计 dictionary_cache 表中 V3.0 数据的更新进度
"""

import os
import json
from dotenv import load_dotenv
from supabase import create_client

# 加载环境变量
env_path = '.env.local'
load_dotenv(env_path)

# 创建 Supabase 客户端
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

print("=" * 70)
print("📊 Dictionary Cache 覆盖率审计（V3.0 数据结构）")
print("=" * 70)

# 查询所有数据
response = supabase.table('dictionary_cache').select('*').execute()
all_words = response.data

print(f"\n📦 总单词数: {len(all_words)}")

# 统计指标
total_count = len(all_words)
has_translations = 0
has_audio_r2 = 0
has_both = 0

# 语言列表（20 种）
expected_languages = ['en', 'zh', 'zh_hant', 'vi', 'ar', 'de', 'es', 'ja',
                     'ms', 'ru', 'tr', 'el', 'id', 'ko', 'pt', 'th', 'uk',
                     'bn', 'mn', 'hi']

# 样板词候选（拥有完整 translations + audio_r2_url）
sample_words = []

print("\n🔍 正在分析数据...")

for word_data in all_words:
    word = word_data.get('word', '')
    translations = word_data.get('translations')
    audio_r2 = word_data.get('audio_r2_url')

    # 检查是否有 translations 字段
    has_trans_field = translations is not None and isinstance(translations, dict)

    # 检查 translations 是否包含所有 20 种语言
    if has_trans_field:
        lang_count = len([k for k in expected_languages if k in translations and translations[k]])
        is_complete_translations = lang_count == 20
    else:
        lang_count = 0
        is_complete_translations = False

    # 检查是否有 audio_r2_url
    has_audio = audio_r2 is not None and audio_r2.startswith('https://media.shadowhub.app')

    # 统计
    if has_trans_field:
        has_translations += 1

    if has_audio:
        has_audio_r2 += 1

    if has_trans_field and has_audio:
        has_both += 1

    # 收集样板词（完整 V3.0 数据）
    if is_complete_translations and has_audio:
        sample_words.append({
            'word': word,
            'phonetic': word_data.get('phonetic', ''),
            'lang_count': lang_count,
            'audio_url': audio_r2,
            'sample_translations': {
                'en': translations.get('en', '')[:50] + '...' if len(translations.get('en', '')) > 50 else translations.get('en', ''),
                'zh': translations.get('zh', ''),
                'de': translations.get('de', ''),
                'th': translations.get('th', '')
            }
        })

# 计算覆盖率
trans_coverage = (has_translations / total_count * 100) if total_count > 0 else 0
audio_coverage = (has_audio_r2 / total_count * 100) if total_count > 0 else 0
both_coverage = (has_both / total_count * 100) if total_count > 0 else 0

print("\n" + "=" * 70)
print("📈 覆盖率统计")
print("=" * 70)
print(f"✅ 包含 translations 字段: {has_translations}/{total_count} ({trans_coverage:.1f}%)")
print(f"✅ 包含 audio_r2_url: {has_audio_r2}/{total_count} ({audio_coverage:.1f}%)")
print(f"✅ 完整 V3.0 数据（两者都有）: {has_both}/{total_count} ({both_coverage:.1f}%)")

print("\n" + "=" * 70)
print("🌟 样板词列表（完整 V3.0 数据，用于前端测试）")
print("=" * 70)

# 显示前 5 个样板词
for i, sample in enumerate(sample_words[:5], 1):
    print(f"\n{i}. {sample['word']} {sample['phonetic']}")
    print(f"   翻译语言数: {sample['lang_count']}/20")
    print(f"   音频: {sample['audio_url']}")
    print(f"   示例翻译:")
    print(f"     en: {sample['sample_translations']['en']}")
    print(f"     zh: {sample['sample_translations']['zh']}")
    print(f"     de: {sample['sample_translations']['de']}")
    print(f"     th: {sample['sample_translations']['th']}")

print("\n" + "=" * 70)
print("✅ 审计完成")
print("=" * 70)

# 保存样板词列表到文件
if sample_words:
    with open('/tmp/dictionary_sample_words.json', 'w', encoding='utf-8') as f:
        json.dump(sample_words[:5], f, ensure_ascii=False, indent=2)
    print(f"\n💾 样板词列表已保存到: /tmp/dictionary_sample_words.json")
