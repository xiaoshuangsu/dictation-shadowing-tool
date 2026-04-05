#!/usr/bin/env python3
"""
手动入库：Baby Penguin 视频素材
直接将视频信息写入 materials 表
"""

import os
import re
from dotenv import load_dotenv
from supabase import create_client

# 加载环境变量
load_dotenv('/Users/a/dictation/.env.local')

# 连接 Supabase
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# 视频信息
video_data = {
    'title': 'Baby Penguin Tries To Make Friends | Snow Chick: A Penguin\'s Tale | BBC Earth',
    'youtube_id': 'q3uXXh1sHcI',
    'duration': 262,  # 秒
    'category': 'BBC Earth',
    'difficulty': 'C2',
    'thumbnail': 'https://i.ytimg.com/vi/q3uXXh1sHcI/maxresdefault.jpg'
}

def title_to_slug(title):
    """将标题转换为 slug"""
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    if len(slug) > 100:
        slug = slug[:100]
    return slug

# 生成 slug
slug = title_to_slug(video_data['title'])

print("=" * 70)
print("🎬 手动入库：BBC Earth 视频")
print("=" * 70)
print(f"\n📋 视频信息:")
print(f"   标题: {video_data['title']}")
print(f"   YouTube ID: {video_data['youtube_id']}")
print(f"   时长: {video_data['duration']} 秒")
print(f"   分类: {video_data['category']}")
print(f"   难度: {video_data['difficulty']}")
print(f"   Slug: {slug}")

# 准备数据
material_data = {
    'title': video_data['title'],
    'slug': slug,
    'youtube_id': video_data['youtube_id'],
    'duration': video_data['duration'],
    'category': video_data['category'],
    'difficulty': video_data['difficulty'],
    'thumbnail': video_data['thumbnail'],
    'source_type': 'youtube',
    'status': 'pending_translation',  # 可检测状态，后台翻译脚本会自动处理
    'transcript': None,  # 字幕将在之后手动添加
    'created_at': 'now()',
    'updated_at': 'now()'
}

print(f"\n💾 正在入库...")

try:
    # 插入数据
    result = supabase.table('materials').insert(material_data).execute()

    if result.data:
        inserted_id = result.data[0]['id']
        print(f"✅ 入库成功!")
        print(f"   记录 ID: {inserted_id}")
        print(f"   Slug: {slug}")
        print(f"\n📝 下一步:")
        print(f"   1. 手动添加字幕文件（使用 upload_subtitle API）")
        print(f"   2. 后台翻译脚本会自动检测到 pending_translation 状态")
        print(f"   3. 翻译脚本将自动处理 19 国语言翻译")
    else:
        print("❌ 入库失败")

except Exception as e:
    print(f"❌ 错误: {e}")

print("\n" + "=" * 70)
print("✅ 手动入库完成")
print("=" * 70)
