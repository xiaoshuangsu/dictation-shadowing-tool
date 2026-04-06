#!/usr/bin/env python3
"""
查找包含样板词的素材 V2
先查询素材结构，再查找包含样板词的句子
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

# 先查询几个素材看看结构
print("📋 查询素材结构...")
response = supabase.table('materials').select('*').limit(3).execute()

if response.data:
    print(f"✅ 成功查询到 {len(response.data)} 个素材")
    print(f"   字段: {list(response.data[0].keys())}")

    # 检查是否有 sentences 字段
    first_material = response.data[0]
    if 'sentences' in first_material:
        print(f"   sentences 字段存在")
        print(f"   sentences 类型: {type(first_material['sentences'])}")
        if isinstance(first_material['sentences'], list) and len(first_material['sentences']) > 0:
            print(f"   第一个句子字段: {list(first_material['sentences'][0].keys())}")
    else:
        print(f"   ⚠️  没有 sentences 字段")
        print(f"   可用字段: {list(first_material.keys())}")

print()

# 查询句子表（sentences 或 sentence_items）
print("📋 查询句子表...")
try:
    # 尝试查询 sentences 表
    sentences_response = supabase.table('sentences').select('*').limit(5).execute()
    print(f"✅ sentences 表存在")
    print(f"   字段: {list(sentences_response.data[0].keys())}")

    # 查询包含样板词的句子
    print()
    print("🔍 搜索包含样板词的句子...")

    matches = []
    sample_materials = set()

    for word in SAMPLE_WORDS:
        # 使用 ilike 进行模糊搜索
        word_response = supabase.table('sentences') \
            .select('id, material_id, text, index') \
            .ilike('text', f'%{word}%') \
            .limit(20) \
            .execute()

        for sentence in word_response.data:
            text = sentence.get('text', '')
            material_id = sentence.get('material_id')

            if not material_id:
                continue

            sample_materials.add(material_id)
            matches.append({
                'word': word,
                'sentence_id': sentence.get('id'),
                'material_id': material_id,
                'text': text,
                'index': sentence.get('index')
            })

    print(f"✅ 找到 {len(matches)} 个匹配")

    # 获取素材详情
    if sample_materials:
        print()
        print("📋 获取素材详情...")

        material_ids = list(sample_materials)[:10]  # 只查前 10 个
        materials_response = supabase.table('materials') \
            .select('id, title, category, slug') \
            .in_('id', material_ids) \
            .execute()

        materials_map = {m['id']: m for m in materials_response.data}

        # 按素材分组
        from collections import defaultdict
        materials_with_matches = defaultdict(list)

        for match in matches:
            material_id = match['material_id']
            if material_id in materials_map:
                material = materials_map[material_id]
                key = f"{material['title']} ({material.get('category', 'N/A')})"
                materials_with_matches[key].append({
                    **match,
                    'title': material['title'],
                    'category': material.get('category', ''),
                    'slug': material.get('slug', ''),
                    'url': f"/topics/{material.get('category', '')}/{material.get('slug', '')}"
                })

        # 显示结果
        print()
        print("=" * 70)
        print(f"✅ 找到 {len(materials_with_matches)} 个素材包含样板词")
        print("=" * 70)

        # 显示前 2 个素材
        for idx, (material_name, sentences) in enumerate(list(materials_with_matches.items())[:2], 1):
            print(f"\n{idx}. {material_name}")
            if sentences:
                print(f"   URL: {sentences[0]['url']}")
                print(f"   材料ID: {sentences[0]['material_id']}")
                print(f"   匹配数: {len(sentences)} 个句子")
                print()

                # 显示前 3 个匹配句子
                for i, sentence in enumerate(sentences[:3], 1):
                    print(f"   句子 #${sentence['index']}:")
                    print(f"   文本: {sentence['text'][:100]}{'...' if len(sentence['text']) > 100 else ''}")
                    print(f"   包含词: {sentence['word']}")
                    print()

        # 保存结果到文件
        if materials_with_matches:
            top_materials = list(materials_with_matches.items())[:2]

            result_data = []
            for material_name, sentences in top_materials:
                if sentences:
                    result_data.append({
                        'title': material_name,
                        'url': sentences[0]['url'],
                        'material_id': sentences[0]['material_id'],
                        'category': sentences[0]['category'],
                        'slug': sentences[0]['slug'],
                        'matched_sentences': [
                            {
                                'index': s['index'],
                                'text': s['text'],
                                'word': s['word'],
                                'sentence_id': s['sentence_id']
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

except Exception as e:
    print(f"❌ 查询 sentences 表失败: {e}")

    # 尝试其他可能的表名
    print()
    print("📋 尝试其他表名...")
    possible_tables = ['sentence_items', 'material_sentences', 'content']
    for table in possible_tables:
        try:
            test_response = supabase.table(table).select('*').limit(1).execute()
            print(f"✅ {table} 表存在")
            print(f"   字段: {list(test_response.data[0].keys())}")
        except:
            print(f"❌ {table} 表不存在")
