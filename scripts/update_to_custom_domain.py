#!/usr/bin/env python3
"""
将 Supabase materials 表中的媒体链接更新为自定义域名
"""

import os
import sys
from pathlib import Path
from supabase import create_client

def load_env():
    env_path = Path(__file__).parent.parent / '.env.local'
    if not env_path.exists():
        raise FileNotFoundError(f".env.local 不存在: {env_path}")

    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

load_env()

SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

# 自定义域名（最终目标）
CUSTOM_DOMAIN = 'https://media.shadowhub.app'

# 需要替换的旧域名
OLD_DOMAINS = [
    'https://r2-proxy.suxiaoshuang2020.workers.dev',
    'https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev',
    'https://media.shadowhub.app',
]

def replace_url(url: str) -> str:
    if not url:
        return url

    for old_domain in OLD_DOMAINS:
        if old_domain in url:
            # 提取路径部分
            path = url.replace(old_domain, '')
            # 确保路径以 / 开头
            if not path.startswith('/'):
                path = '/' + path
            new_url = CUSTOM_DOMAIN + path
            return new_url

    return url

def main():
    print("="*60)
    print("更新数据库媒体链接为自定义域名")
    print("="*60)
    print(f"目标域名: {CUSTOM_DOMAIN}")
    print("="*60)
    print()

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("获取所有素材...")
    result = supabase.table('materials').select('*').execute()

    if not result.data:
        print("❌ 没有找到任何素材")
        return

    print(f"共找到 {len(result.data)} 个素材")
    print()

    updated_count = 0
    skipped_count = 0

    for material in result.data:
        needs_update = False
        updates = {}

        # 检查并更新 audio_path
        if material.get('audio_path'):
            old_url = material['audio_path']
            new_url = replace_url(old_url)
            if new_url != old_url:
                updates['audio_path'] = new_url
                needs_update = True
                print(f"  [{material['title'][:40]}...]")
                print(f"    audio_path: {old_url[:60]}...")
                print(f"             → {new_url}")

        # 检查并更新 video_path
        if material.get('video_path'):
            old_url = material['video_path']
            new_url = replace_url(old_url)
            if new_url != old_url:
                updates['video_path'] = new_url
                needs_update = True
                if 'audio_path' not in updates:
                    print(f"  [{material['title'][:40]}...]")
                print(f"    video_path: {old_url[:60]}...")
                print(f"             → {new_url}")

        # 检查并更新 thumbnail_path
        if material.get('thumbnail_path'):
            old_url = material['thumbnail_path']
            new_url = replace_url(old_url)
            if new_url != old_url:
                updates['thumbnail_path'] = new_url
                needs_update = True
                if 'audio_path' not in updates and 'video_path' not in updates:
                    print(f"  [{material['title'][:40]}...]")
                print(f"    thumbnail: {old_url[:60]}...")
                print(f"             → {new_url}")

        # 检查并更新 og_image
        if material.get('og_image'):
            old_url = material['og_image']
            new_url = replace_url(old_url)
            if new_url != old_url:
                updates['og_image'] = new_url
                needs_update = True

        if needs_update:
            supabase.table('materials').update(updates).eq('id', material['id']).execute()
            updated_count += 1
            print()
        else:
            skipped_count += 1

    print("="*60)
    print(f"✅ 更新完成！")
    print(f"   更新: {updated_count} 条记录")
    print(f"   跳过: {skipped_count} 条记录")
    print("="*60)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
