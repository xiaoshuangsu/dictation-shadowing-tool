#!/usr/bin/env python3
"""
查找包含样板词的素材 V3
检查 transcript 字段结构
"""

import os
import json
import re
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

# 查询素材并检查 transcript 结构
print("📋 查询 transcript 字段结构...")
response = supabase.table('materials').select('id, title, category, slug, transcript').limit(5).execute()

if response.data:
    first_material = response.data[0]
    transcript = first_material.get('transcript')

    print(f"✅ transcript 字段类型: {type(transcript)}")

    if isinstance(transcript, list):
        print(f"   transcript 是列表，长度: {len(transcript)}")
        if len(transcript) > 0:
            print(f"   第一个元素类型: {type(transcript[0])}")
            print(f"   第一个元素字段: {list(transcript[0].keys()) if isinstance(transcript[0], dict) else 'N/A'}")
            if isinstance(transcript[0], dict) and 'text' in transcript[0]:
                print(f"   第一个句子文本: {transcript[0]['text'][:80]}...")
    else:
        print(f"   transcript 内容: {str(transcript)[:200]}")

print()

# 搜索包含样板词的素材
print("🔍 搜索包含样板词的素材...")
print()

matches = []

for material in response.data:
    material_id = material.get('id')
    title = material.get('title', '')
    category = material.get('category', '')
    slug = material.get('slug', '')
    transcript = material.get('transcript', [])

    if not isinstance(transcript, list):
        continue

    # 检查每个句子
    for sentence in transcript:
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
            pattern = r'\b' + re.escape(word) + r'\b'
            if re.search(pattern, text_lower):
                found_words.append(word)

        if found_words:
            matches.append({
                'material_id': material_id,
                'title': title,
                'category': category,
                'slug': slug,
                'url': f"/topics/{category}/{slug}",
                'sentence': sentence,
                'words': found_words
            })

# 如果没有找到，查询更多素材
if len(matches) < 2:
    print(f"⚠️  前 5 个素材中只找到 {len(matches)} 个匹配，扩大搜索范围...")
    print()

    # 查询更多素材（分批查询）
    all_materials = []
    for offset in range(0, 100, 20):
        batch = supabase.table('materials') \
            .select('id, title, category, slug, transcript') \
            .range(offset, offset + 19) \
            .execute()
        all_materials.extend(batch.data)
        if len(batch.data) < 20:
            break

    print(f"📦 查询了 {len(all_materials)} 个素材")

    matches = []

    for material in all_materials:
        material_id = material.get('id')
        title = material.get('title', '')
        category = material.get('category', '')
        slug = material.get('slug', '')
        transcript = material.get('transcript', [])

        if not isinstance(transcript, list):
            continue

        # 检查每个句子
        for sentence in transcript:
            if not isinstance(sentence, dict):
                continue

            text = sentence.get('text', '')
            if not text:
                continue

            text_lower = text.lower()

            # 检查是否包含样板词（作为独立单词）
            found_words = []
            for word in SAMPLE_WORDS:
                pattern = r'\b' + re.escape(word) + r'\b'
                if re.search(pattern, text_lower):
                    found_words.append(word)

            if found_words:
                matches.append({
                    'material_id': material_id,
                    'title': title,
                    'category': category,
                    'slug': slug,
                    'url': f"/topics/{category}/{slug}",
                    'sentence': sentence,
                    'words': found_words
                })

# 显示结果
print()
print("=" * 70)
print(f"✅ 找到 {len(matches)} 个匹配句子")
print("=" * 70)

# 按素材分组
from collections import defaultdict
materials_map = defaultdict(list)

for match in matches:
    key = f"{match['title']} ({match['category']})"
    materials_map[key].append(match)

# 显示前 2 个素材
for idx, (material_name, sentences) in enumerate(list(materials_map.items())[:2], 1):
    print(f"\n{idx}. {material_name}")
    if sentences:
        print(f"   URL: {sentences[0]['url']}")
        print(f"   材料ID: {sentences[0]['material_id']}")
        print(f"   匹配数: {len(sentences)} 个句子")
        print()

        # 显示前 3 个匹配句子
        for i, item in enumerate(sentences[:3], 1):
            sentence = item['sentence']
            text = item['words'][0]  # 找到的单词

            print(f"   句子 #{sentence.get('index', i)}:")
            print(f"   文本: {sentence['text'][:120]}{'...' if len(sentence['text']) > 120 else ''}")
            print(f"   包含词: {', '.join(item['words'])}")
            print(f"   开始时间: {sentence.get('startTime', 'N/A')}s")
            print()

# 保存结果到文件
if materials_map:
    top_materials = list(materials_map.items())[:2]

    result_data = []
    for material_name, sentences in top_materials:
        if sentences:
            first = sentences[0]
            result_data.append({
                'title': material_name,
                'url': first['url'],
                'material_id': first['material_id'],
                'category': first['category'],
                'slug': first['slug'],
                'matched_sentences': [
                    {
                        'index': s['sentence'].get('index'),
                        'text': s['sentence']['text'],
                        'words': s['words'],
                        'startTime': s['sentence'].get('startTime'),
                        'endTime': s['sentence'].get('endTime')
                    }
                    for s in sentences[:5]
                ]
            })

    with open('/tmp/sample_word_materials.json', 'w', encoding='utf-8') as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)

    print()
    print("=" * 70)
    print(f"💾 结果已保存到: /tmp/sample_word_materials.json")
    print("=" * 70)

# 检查开发服务器状态
print()
print("📋 开发服务器状态:")
print("   访问: http://localhost:3000")
