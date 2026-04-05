#!/usr/bin/env python3
"""
最终战报生成脚本 - 明早 9 点自动执行

生成内容：
1. 总翻译成功数
2. 被拦截线拦下的脏数据总量
3. 残留坏数据的 SQL 清理建议
"""

import os
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
import sys
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
from supabase import create_client

# 加载环境变量
env_path = project_root / '.env.local'
load_dotenv(env_path)

# Supabase 配置
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

def generate_report():
    """生成最终战报"""

    print("=" * 80)
    print("📊 最终战报 - 翻译任务完成报告")
    print("=" * 80)
    print(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # 连接数据库
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # ==================== 统计 1: 总翻译成功数 ====================
    print("【1️⃣ 总翻译统计】")
    print("-" * 80)

    response = supabase.table('materials').select('id, transcript').execute()

    total_translations = 0
    total_translated_materials = 0
    language_counts = defaultdict(int)

    ALL_LANGUAGES = ['zh', 'zh_hant', 'vi', 'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el',
                     'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']

    for material in response.data:
        transcript = material.get('transcript', [])
        if not transcript:
            continue

        total_translated_materials += 1

        for sentence in transcript:
            translation = sentence.get('translation', {})
            for lang in ALL_LANGUAGES:
                if lang in translation and translation[lang] and translation[lang] != '[TODO_RETRY]':
                    total_translations += 1
                    language_counts[lang] += 1

    print(f"总翻译条目数: {total_translations:,}")
    print(f"已翻译素材数: {total_translated_materials}")
    print()
    print("各语言翻译统计:")
    sorted_langs = sorted(language_counts.items(), key=lambda x: x[1], reverse=True)
    for lang, count in sorted_langs:
        print(f"  {lang}: {count:,} 条")

    # ==================== 统计 2: 拦截脏数据总量 ====================
    print()
    print("【2️⃣ 拦截统计】")
    print("-" * 80)

    log_file = project_root / 'scripts' / 'translation_batch.log'

    if log_file.exists():
        with open(log_file, 'r', encoding='utf-8') as f:
            log_content = f.read()

        # 统计拦截次数
        intercept_count = log_content.count('🚫 拦截翻译')
        print(f"累计拦截次数: {intercept_count}")

        # 按拦截原因分类
        intercept_reasons = defaultdict(int)
        for line in log_content.split('\n'):
            if '🚫 拦截翻译' in line:
                # 提取拦截原因
                match = re.search(r'拦截翻译 \[(\w+)\]: (.+)', line)
                if match:
                    lang = match.group(1)
                    reason = match.group(2).split(':')[0]
                    intercept_reasons[f"{lang}:{reason}"] += 1

        print()
        print("拦截原因分类:")
        sorted_reasons = sorted(intercept_reasons.items(), key=lambda x: x[1], reverse=True)
        for reason, count in sorted_reasons[:10]:
            print(f"  {reason}: {count} 次")

    # ==================== 统计 3: 残留坏数据检测 ====================
    print()
    print("【3️⃣ 残留坏数据检测】")
    print("-" * 80)

    dirty_samples = []

    for material in response.data[:100]:  # 抽样检查前 100 个素材
        transcript = material.get('transcript', [])
        if not transcript:
            continue

        for sentence in transcript:
            translation = sentence.get('translation', {})

            # 检查孟加拉语和印地语
            for lang in ['bn', 'hi']:
                if lang in translation and translation[lang] and translation[lang] != '[TODO_RETRY]':
                    text = translation[lang]

                    # 检测残留的坏数据特征
                    is_dirty = False
                    reason = ""

                    # XML 标签
                    if any(tag in text for tag in ['<translation_result>', '<instruction>', '<source_text>']):
                        is_dirty = True
                        reason = "XML 标签"
                    # 指令词
                    elif any(word in text.lower() for word in ['instruction', 'critical', 'requirement']):
                        is_dirty = True
                        reason = "英文指令词"
                    # 中文指令词
                    elif any(word in text for word in ['翻译', '指令', '避免重复']):
                        is_dirty = True
                        reason = "中文指令词"
                    # 孟加拉语特定幻觉
                    elif 'শব্দ পুনরাবৃত্তি' in text or 'সরাসরি অনুবাদ' in text:
                        is_dirty = True
                        reason = "孟加拉语幻觉"

                    if is_dirty:
                        dirty_samples.append({
                            'lang': lang,
                            'reason': reason,
                            'text': text[:100]
                        })

    print(f"发现残留坏数据: {len(dirty_samples)} 条")

    if dirty_samples:
        print()
        print("残留坏数据样本（前 10 条）:")
        for idx, sample in enumerate(dirty_samples[:10], 1):
            print(f"  [{idx}] {sample['lang']} - {sample['reason']}")
            print(f"      {sample['text']}...")

    # ==================== SQL 清理建议 ====================
    print()
    print("【4️⃣ SQL 清理建议】")
    print("-" * 80)

    if dirty_samples:
        print("-- 批量清理残留坏数据的 SQL 语句")
        print()
        print("-- 方法 1: 清理特定语言的脏数据（推荐）")
        print()
        print("-- 清理孟加拉语中包含幻觉特征的翻译")
        print("UPDATE materials")
        print("SET transcript = transcript::jsonb || jsonb_build_object(")
        print("  'translation', jsonb_set(")
        print("    COALESCE(transcript->'translation', '{}'::jsonb),")
        print("    '{bn}', 'null'::jsonb")
        print("  )")
        print(") WHERE transcript::text LIKE '%শব্দ পুনরাবৃত্তি%';")
        print()
        print("-- 清理印地语中包含英文指令词的翻译")
        print("UPDATE materials")
        print("SET transcript = transcript::jsonb || jsonb_build_object(")
        print("  'translation', jsonb_set(")
        print("    COALESCE(transcript->'translation', '{}'::jsonb),")
        print("    '{hi}', 'null'::jsonb")
        print("  )")
        print(") WHERE transcript::text LIKE '%instruction%';")
        print()
        print("-- 方法 2: 使用 Python 脚本逐句检查并清理")
        print("-- 运行: python3 scripts/clean_dirty_translations.py")
    else:
        print("✅ 未发现残留坏数据，无需 SQL 清理")

    # ==================== 总结 ====================
    print()
    print("=" * 80)
    print("📈 任务完成总结")
    print("=" * 80)
    print(f"总翻译条目: {total_translations:,}")
    print(f"拦截次数: {intercept_count if log_file.exists() else 0}")
    print(f"残留坏数据: {len(dirty_samples)}")
    print()

    success_rate = (total_translations / (total_translations + intercept_count) * 100) if log_file.exists() else 100
    print(f"净成功率: {success_rate:.1f}%")
    print()

    if len(dirty_samples) == 0 and intercept_count < 100:
        print("✅ 任务完成质量：优秀")
    elif len(dirty_samples) < 50 and intercept_count < 500:
        print("✅ 任务完成质量：良好")
    else:
        print("⚠️  任务完成质量：需要改进")

    print()
    print("=" * 80)
    print("报告生成完成")
    print("=" * 80)

if __name__ == '__main__':
    generate_report()
