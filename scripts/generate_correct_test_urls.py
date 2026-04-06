#!/usr/bin/env python3
"""
生成正确的测试 URL（使用 category slug）
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

# Category 到 slug 的映射（从 category.ts 复制）
CATEGORY_SLUG_MAP = {
    '日常生活': 'daily-life',
    '历史演讲': 'historical-speeches',
    '文化历史': 'culture-history',
    '心灵故事': 'heart-soul-stories',
    '艺术文化': 'arts-culture',
    'Science and Facts': 'science-and-facts',
    '故事': 'stories',
    '人物访谈': 'interviews',
    'BBC Learning English': 'bbc-learning-english',
    'VOA Learning English': 'voa-learning-english',
    'TED演讲': 'ted-talks',
    '动画片': 'cartoons',
    'IELTS Listening': 'ielts-listening',
}

def category_to_slug(category: str) -> str:
    """转换 category 为 slug"""
    return CATEGORY_SLUG_MAP.get(category, category.lower().replace(' ', '-'))

print("=" * 70)
print("🔗 生成正确的测试 URL")
print("=" * 70)

# 查询包含样板词的素材
sample_slugs = [
    'cam-15-academic-listening-test-3-part-1',
    '3-tips-to-boost-your-confidence-ted-ed'
]

results = []

for slug in sample_slugs:
    response = supabase.table('materials') \
        .select('id, title, category, slug') \
        .eq('slug', slug) \
        .single() \
        .execute()

    if response.data:
        material = response.data
        category = material.get('category')
        category_slug = CATEGORY_SLUG_MAP.get(category, category.lower().replace(' ', '-'))

        url = f"/topics/{category_slug}/{material['slug']}"

        results.append({
            'title': material['title'],
            'category': category,
            'category_slug': category_slug,
            'slug': material['slug'],
            'url': url,
            'full_url': f"http://localhost:3000{url}"
        })

print()
print("✅ 正确的测试 URL：")
print()

for i, result in enumerate(results, 1):
    print(f"{i}. {result['title']}")
    print(f"   Category: {result['category']} → {result['category_slug']}")
    print(f"   URL: {result['full_url']}")
    print()

# 保存到文件
with open('/tmp/correct_test_urls.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("=" * 70)
print(f"💾 结果已保存到: /tmp/correct_test_urls.json")
print("=" * 70)
