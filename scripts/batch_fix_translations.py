#!/usr/bin/env python3
"""
批量修复翻译问题
"""
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('/Users/a/dictation/.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', 'https://cuxotlijjnxbsirpdkgr.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

url = f'{SUPABASE_URL}/rest/v1/materials'
headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

# 定义修复规则
fixes = [
    # Jessica's First Day of School - Mr. 翻译问题
    {
        'title': "Jessica's First Day of School",
        'text': "His name is Mr.",
        'old': "他名叫先生",
        'new': "他名叫……先生"
    },
    {
        'title': "Jessica's First Day of School",
        'text': "Jessica stands for the National Anthem.",
        'old': "杰西卡代表国家演唱国歌。",
        'new': "杰西卡起立致敬国歌。"
    },

    # Mark's Big Game - big game 翻译
    {
        'title': "Mark's Big Game",
        'text': "Mark's Big Game",
        'old': "马克的大游戏",
        'new': "马克的重要比赛"
    },

    # My First Pet - fixed/绝育
    {
        'title': "My First Pet",
        'text': "She is fixed.",
        'old': "她已经修好了",
        'new': "她已经绝育了"
    },
    {
        'title': "My First Pet",
        'text': "Milo cannot have kittens.",
        'old': "米洛不可能有小猫。",
        'new': "米洛不能生育小猫。"
    },

    # If I Could Fly - look down on
    {
        'title': "If I Could Fly",
        'text': "I would look down on the houses and factories.",
        'old': "看不起",
        'new': "俯瞰"
    },
    {
        'title': "If I Could Fly",
        'text': "I would soar up high and dive down low",
        'old': "潜水",
        'new': "俯冲"
    },

    # The Viking - oars
    {
        'title': "The Viking",
        'text': "ors",
        'old': "ors",  # 需要在原文中检查
        'new': "桨"
    },
]

print("=== 批量修复翻译 ===\n")

fixed_count = 0

# 获取所有素材
params = {'select': 'id,title,transcript', 'limit': 100}
response = requests.get(url, headers=headers, params=params)
materials = response.json()

# 创建素材索引
material_index = {m['title']: m for m in materials}

for fix in fixes:
    material = material_index.get(fix['title'])
    if not material:
        print(f"✗ 未找到: {fix['title']}")
        continue

    transcript = material.get('transcript', [])
    modified = False

    for sentence in transcript:
        text = sentence.get('text', '')
        translation = sentence.get('translation', '')

        # 检查是否需要修复
        if fix['old'] in translation and (fix['text'] in text or fix['text'] in translation):
            new_translation = translation.replace(fix['old'], fix['new'])
            sentence['translation'] = new_translation
            modified = True
            print(f"✓ {fix['title'][:30]}")
            print(f"  {fix['old']} → {fix['new']}")

    if modified:
        # 更新数据库
        update_params = {'id': f'eq.{material["id"]}'}
        patch_response = requests.patch(
            url,
            json={'transcript': transcript},
            headers=headers,
            params=update_params
        )

        if patch_response.status_code in [200, 204]:
            fixed_count += 1
            print()
        else:
            print(f"  ✗ 更新失败: {patch_response.status_code}\n")

print(f"\n完成！共修复 {fixed_count} 个素材")
