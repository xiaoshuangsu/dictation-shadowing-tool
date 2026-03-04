#!/usr/bin/env python3
"""
更新 Supabase materials 表的路径为统一格式

确保所有路径使用 R2 Worker URL:
- videos/xxx.mp4 → https://r2-proxy.../videos/xxx.mp4
- audio/xxx.mp3 → https://r2-proxy.../audio/xxx.mp3
- thumbnails/xxx.jpg → https://r2-proxy.../thumbnails/xxx.jpg
- shadowhub/videos/xxx.mp4 → https://r2-proxy.../shadowhub/videos/xxx.mp4
"""

import os
import sys
from dotenv import load_dotenv

try:
    from supabase import create_client
except ImportError:
    print("❌ 请安装 supabase-py: pip install supabase")
    sys.exit(1)

load_dotenv()

# Supabase 配置
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', 'https://cuxotlijjnxbsirpdkgr.supabase.co')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

# R2 Worker URL
R2_WORKER_URL = 'https://r2-proxy.suxiaoshuang2020.workers.dev'

def normalize_path(material):
    """标准化单个素材的路径"""
    updates = {}
    needs_update = False

    # 处理 video_path
    video_path = material.get('video_path')
    if video_path:
        if not video_path.startswith('http'):
            # 相对路径，添加 R2 Worker URL
            updates['video_path'] = f"{R2_WORKER_URL}/{video_path}"
            needs_update = True
        elif 'supabase.co' in video_path:
            # Supabase Storage URL，转换为 R2 Worker
            # 提取路径部分: https://.../engnovate-audio/videos/xxx.mp4 -> videos/xxx.mp4
            parts = video_path.split('/engnovate-audio/')
            if len(parts) > 1:
                updates['video_path'] = f"{R2_WORKER_URL}/{parts[1]}"
                needs_update = True

    # 处理 audio_path
    audio_path = material.get('audio_path')
    if audio_path:
        if not audio_path.startswith('http'):
            updates['audio_path'] = f"{R2_WORKER_URL}/{audio_path}"
            needs_update = True
        elif 'supabase.co' in audio_path:
            parts = audio_path.split('/engnovate-audio/')
            if len(parts) > 1:
                updates['audio_path'] = f"{R2_WORKER_URL}/{parts[1]}"
                needs_update = True

    # 处理 thumbnail_path
    thumbnail_path = material.get('thumbnail_path')
    if thumbnail_path:
        if not thumbnail_path.startswith('http'):
            updates['thumbnail_path'] = f"{R2_WORKER_URL}/{thumbnail_path}"
            needs_update = True
        elif 'supabase.co' in thumbnail_path:
            parts = thumbnail_path.split('/engnovate-audio/')
            if len(parts) > 1:
                updates['thumbnail_path'] = f"{R2_WORKER_URL}/{parts[1]}"
                needs_update = True

    return updates, needs_update

def update_material_paths():
    """更新所有素材的路径"""
    print("="*70)
    print("  标准化 Supabase 路径为统一格式")
    print("="*70)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取所有素材
    print("\n📥 获取所有素材...")
    result = client.table('materials').select('*').execute()

    if not result.data:
        print("❌ 没有找到素材")
        return

    print(f"✅ 找到 {len(result.data)} 个素材")

    # 统计
    stats = {
        'updated': 0,
        'already_correct': 0,
        'error': 0
    }

    print("\n🔧 开始标准化路径...")
    print("="*70)

    for i, material in enumerate(result.data, 1):
        material_id = material.get('id')
        title = material.get('title')

        updates, needs_update = normalize_path(material)

        if needs_update:
            print(f"\n{i}. {title}")
            print(f"   ID: {material_id}")

            for key, new_value in updates.items():
                old_value = material.get(key, '')
                print(f"   {key}:")
                print(f"     旧: {old_value[:60]}...")
                print(f"     新: {new_value[:60]}...")

            # 执行更新
            try:
                client.table('materials').update(updates).eq('id', material_id).execute()
                print(f"   💾 已更新")
                stats['updated'] += 1
            except Exception as e:
                print(f"   ❌ 更新失败: {e}")
                stats['error'] += 1
        else:
            stats['already_correct'] += 1

    # 总结
    print("\n" + "="*70)
    print("  标准化完成！")
    print("="*70)
    print(f"\n统计:")
    print(f"  已更新: {stats['updated']}")
    print(f"  已正确无需更新: {stats['already_correct']}")
    print(f"  错误: {stats['error']}")

    # 显示示例
    print("\n📋 路径格式规范:")
    print(f"  主项目视频: {R2_WORKER_URL}/videos/xxx.mp4")
    print(f"  音频:       {R2_WORKER_URL}/audio/xxx.mp3")
    print(f"  封面:       {R2_WORKER_URL}/thumbnails/xxx.jpg")
    print(f"  Shadowhub:  {R2_WORKER_URL}/shadowhub/videos/xxx.mp4")

if __name__ == '__main__':
    if not SUPABASE_KEY:
        print("❌ 错误: 未找到 SUPABASE_ANON_KEY")
        print("\n请设置环境变量:")
        print("  export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key")
        sys.exit(1)

    try:
        update_material_paths()
    except KeyboardInterrupt:
        print("\n\n❌ 用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
