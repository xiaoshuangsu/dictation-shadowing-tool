#!/usr/bin/env python3
"""
查找包含样板词的素材
用于测试词典弹窗功能
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

# 样板词列表
SAMPLE_WORDS = ['act', 'add', 'aid', 'aim', 'air']

print("=" * 70)
print("🔍 查找包含样板词的素材")
print("=" * 70)
print(f"样板词: {', '.join(SAMPLE_WORDS)}")
print()

# 查询所有素材
response = supabase.table('materials').select('id, title, category, sentences').limit(100).execute()
materials = response.data

print(f"📦 查询到 {len(materials)} 个素材")
print()

# 存储匹配结果
matches = []

for material in materials:
    material_id = material.get('id')
    title = material.get('title', '')
    category = material.get('category', '')
    sentences = material.get('sentences', [])

    if not sentences:
        continue

    # 检查每个句子
    for idx, sentence in enumerate(sentences):
        if not isinstance(sentence, dict):
            continue

        text = sentence.get('text', '')
        if not text:
            continue

        # 转换为小写进行搜索
        text_lower = text.lower()

        # 检查是否包含样板词（作为独立单词）
        found_words = []
        for word in SAMPLE_WORDS:
            # 使用正则表达式匹配独立单词
            import re
            pattern = r'\b' + re.escape(word) + r'\b'
            if re.search(pattern, text_lower):
                found_words.append(word)

        if found_words:
            matches.append({
                'material_id': material_id,
                'title': title,
                'category': category,
                'sentence_index': idx,
                'text': text.strip(),
                'words': found_words,
                'url': f"/topics/{category}/{material_id}"
            })

# 显示结果
print("=" * 70)
print(f"✅ 找到 {len(matches)} 个匹配")
print("=" * 70)

# 按素材分组显示
from collections import defaultdict
materials_with_matches = defaultdict(list)

for match in matches:
    key = f"{match['title']} ({match['category']})"
    materials_with_matches[key].append(match)

# 显示前 5 个素材
for idx, (material_name, sentences) in enumerate(list(materials_with_matches.items())[:5], 1):
    print(f"\n{idx}. {material_name}")
    print(f"   URL: {sentences[0]['url']}")
    print(f"   匹配数: {len(sentences)} 个句子")
    print()

    # 显示前 3 个匹配句子
    for i, sentence in enumerate(sentences[:3], 1):
        print(f"   句子 #{sentence['sentence_index']}:")
        print(f"   文本: {sentence['text'][:100]}...")
        print(f"   包含词: {', '.join(sentence['words'])}")
        print()

# 保存结果到文件
if matches:
    # 只保存前 2 个素材的所有匹配
    top_materials = list(materials_with_matches.items())[:2]

    result_data = []
    for material_name, sentences in top_materials:
        material_id = sentences[0]['material_id']
        category = sentences[0]['category']

        result_data.append({
            'title': material_name,
            'url': sentences[0]['url'],
            'category': category,
            'material_id': material_id,
            'sentences': [
                {
                    'index': s['sentence_index'],
                    'text': s['text'],
                    'words': s['words']
                }
                for s in sentences
            ]
        })

    with open('/tmp/sample_word_materials.json', 'w', encoding='utf-8') as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)

    print("=" * 70)
    print(f"💾 结果已保存到: /tmp/sample_word_materials.json")
    print("=" * 70)
