#!/usr/bin/env python3
"""
查询数据库中所有包含连字符的单词
"""
import os
import re
import json
from supabase import create_client, Client
from collections import defaultdict

# Supabase 配置（从环境变量读取）
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://cuxotlijjnxbsirpdkgr.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

def find_hyphenated_words():
    """查找所有包含连字符的单词"""

    # 创建 Supabase 客户端
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("🔍 正在查询数据库...")

    # 查询所有素材
    response = supabase.table('materials').select('id,title,transcript').execute()

    # 统计结果
    hyphenated_words = defaultdict(list)
    materials_with_hyphens = []

    for material in response.data:
        material_id = material['id']
        title = material['title']
        transcript = material.get('transcript', [])

        has_hyphen = False

        for sentence in transcript:
            text = sentence.get('text', '')
            if not text:
                continue

            # 提取所有单词（包括连字符词）
            # 使用正则匹配：字母-数字-连字符
            words = re.findall(r'[a-zA-Z0-9-]+', text)

            for word in words:
                # 检查是否包含连字符
                if '-' in word:
                    has_hyphen = True
                    hyphenated_words[word].append({
                        'material_id': material_id,
                        'title': title,
                        'sentence': text
                    })

        if has_hyphen:
            materials_with_hyphens.append({
                'id': material_id,
                'title': title
            })

    # 打印结果
    print("\n" + "="*80)
    print(f"📊 统计结果")
    print("="*80)

    print(f"\n包含连字符词的素材数量: {len(materials_with_hyphens)}")
    print(f"不同的连字符词数量: {len(hyphenated_words)}")

    # 按出现频率排序
    sorted_words = sorted(hyphenated_words.items(), key=lambda x: len(x[1]), reverse=True)

    print("\n" + "="*80)
    print(f"📝 所有连字符词列表（按出现频率排序）")
    print("="*80)

    for word, occurrences in sorted_words:
        print(f"\n🔹 {word} (出现 {len(occurrences)} 次)")
        # 显示前3个例子
        for i, occ in enumerate(occurrences[:3]):
            print(f"   [{i+1}] {occ['title']}")
            print(f"       句子: {occ['sentence'][:100]}...")

    # 保存到 JSON 文件
    output_file = 'hyphenated_words_report.json'
    report_data = {
        'summary': {
            'total_materials_with_hyphens': len(materials_with_hyphens),
            'unique_hyphenated_words': len(hyphenated_words),
            'total_occurrences': sum(len(v) for v in hyphenated_words.values())
        },
        'materials_with_hyphens': materials_with_hyphens,
        'hyphenated_words': {
            word: [
                {
                    'material_id': occ['material_id'],
                    'title': occ['title'],
                    'sentence': occ['sentence']
                }
                for occ in occurrences
            ]
            for word, occurrences in sorted_words
        }
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 详细报告已保存到: {output_file}")

    # 检查是否有带空格的连字符词（如 "self -esteem"）
    print("\n" + "="*80)
    print("⚠️  检查带空格的连字符词")
    print("="*80)

    problem_patterns = defaultdict(list)

    for material in response.data:
        title = material['title']
        transcript = material.get('transcript', [])

        for sentence in transcript:
            text = sentence.get('text', '')
            if not text:
                continue

            # 检查 "word -word" 或 "word- word" 模式
            # 这里需要检查原始文本中是否有带空格的情况
            patterns = [
                (r'(\w+)\s+-\s*(\w+)', 'word - word'),  # word - word
                (r'(\w+)\s+-(\w+)', 'word -word'),      # word -word
                (r'(\w+)-\s+(\w+)', 'word- word'),      # word- word
            ]

            for pattern, desc in patterns:
                matches = re.finditer(pattern, text)
                for match in matches:
                    problem_patterns[desc].append({
                        'title': title,
                        'matched_text': match.group(0),
                        'sentence': text
                    })

    if problem_patterns:
        print("\n发现以下问题模式：")
        for pattern, occurrences in problem_patterns.items():
            print(f"\n❌ 模式: {pattern} (出现 {len(occurrences)} 次)")
            for i, occ in enumerate(occurrences[:5]):
                print(f"   [{i+1}] {occ['title']}")
                print(f"       匹配: '{occ['matched_text']}'")
                print(f"       句子: {occ['sentence'][:100]}...")
    else:
        print("\n✅ 未发现带空格的连字符词")

    print("\n" + "="*80)

if __name__ == '__main__':
    find_hyphenated_words()
