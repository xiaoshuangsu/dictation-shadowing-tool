#!/usr/bin/env python3
"""
修复 Supabase materials 表中的路径

确保：
- video_path 指向 VIDEOS 桶（如果存在）
- audio_path 指向 R2 桶
- thumbnail_path 指向 R2 桶
"""

import os
import sys
from dotenv import load_dotenv

# 尝试导入 supabase
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

def fix_material_paths():
    """修复 materials 表中的路径"""
    print("="*70)
    print("  修复 Supabase materials 表路径")
    print("="*70)

    # 创建 Supabase 客户端
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
        'audio_fixed': 0,
        'thumbnail_fixed': 0,
        'video_fixed': 0,
        'already_correct': 0,
        'error': 0
    }

    # 遍历并修复
    print("\n🔧 开始修复路径...")
    print("="*70)

    for i, material in enumerate(result.data, 1):
        material_id = material.get('id')
        title = material.get('title')
        audio_path = material.get('audio_path', '')
        video_path = material.get('video_path')
        thumbnail_path = material.get('thumbnail_path', '')

        print(f"\n{i}. {title}")
        print(f"   ID: {material_id}")

        updates = {}
        needs_update = False

        # 修复 audio_path
        if audio_path:
            # 如果是相对路径，转换为 R2 Worker URL
            if not audio_path.startswith('http'):
                new_path = f"{R2_WORKER_URL}/{audio_path}"
                if audio_path.startswith('audio/'):
                    updates['audio_path'] = new_path
                    print(f"   ✅ audio_path: {audio_path}")
                    print(f"      → {new_path}")
                    needs_update = True
                    stats['audio_fixed'] += 1
                else:
                    print(f"   ⚠️  audio_path 路径异常: {audio_path}")
            # 如果已经是 R2 URL，检查是否正确
            elif R2_WORKER_URL in audio_path:
                if audio_path.startswith(f'{R2_WORKER_URL}/audio/'):
                    print(f"   ✅ audio_path 已正确")
                    stats['already_correct'] += 1
                else:
                    print(f"   ⚠️  audio_path 格式异常: {audio_path}")
            else:
                print(f"   ℹ️  audio_path: 其他 URL ({audio_path[:50]}...)")

        # 修复 thumbnail_path
        if thumbnail_path:
            # 如果是相对路径，转换为 R2 Worker URL
            if not thumbnail_path.startswith('http'):
                new_path = f"{R2_WORKER_URL}/{thumbnail_path}"
                if thumbnail_path.startswith('thumbnails/'):
                    updates['thumbnail_path'] = new_path
                    print(f"   ✅ thumbnail_path: {thumbnail_path}")
                    print(f"      → {new_path}")
                    needs_update = True
                    stats['thumbnail_fixed'] += 1
                else:
                    print(f"   ⚠️  thumbnail_path 路径异常: {thumbnail_path}")
            # 如果已经是 R2 URL，检查是否正确
            elif R2_WORKER_URL in thumbnail_path:
                if thumbnail_path.startswith(f'{R2_WORKER_URL}/thumbnails/'):
                    print(f"   ✅ thumbnail_path 已正确")
                else:
                    print(f"   ⚠️  thumbnail_path 格式异常: {thumbnail_path}")
            else:
                print(f"   ℹ️  thumbnail_path: 其他 URL")

        # 修复 video_path
        if video_path:
            # 如果是相对路径，转换为 R2 Worker URL
            if not video_path.startswith('http'):
                new_path = f"{R2_WORKER_URL}/{video_path}"
                if video_path.startswith('videos/'):
                    updates['video_path'] = new_path
                    print(f"   ✅ video_path: {video_path}")
                    print(f"      → {new_path}")
                    needs_update = True
                    stats['video_fixed'] += 1
                else:
                    print(f"   ⚠️  video_path 路径异常: {video_path}")
            # 如果已经是 R2 URL，检查是否正确
            elif R2_WORKER_URL in video_path:
                if video_path.startswith(f'{R2_WORKER_URL}/videos/'):
                    print(f"   ✅ video_path 已正确")
                else:
                    print(f"   ⚠️  video_path 格式异常: {video_path}")
            else:
                print(f"   ℹ️  video_path: 其他 URL")

        # 执行更新
        if needs_update and updates:
            try:
                client.table('materials').update(updates).eq('id', material_id).execute()
                print(f"   💾 已更新到数据库")
            except Exception as e:
                print(f"   ❌ 更新失败: {e}")
                stats['error'] += 1

    # 总结
    print("\n" + "="*70)
    print("  修复完成！")
    print("="*70)
    print(f"\n统计:")
    print(f"  audio_path 修复: {stats['audio_fixed']}")
    print(f"  thumbnail_path 修复: {stats['thumbnail_fixed']}")
    print(f"  video_path 修复: {stats['video_fixed']}")
    print(f"  已正确无需修复: {stats['already_correct']}")
    print(f"  错误: {stats['error']}")

def verify_paths():
    """验证路径格式"""
    print("\n" + "="*70)
    print("  验证路径格式")
    print("="*70)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    result = client.table('materials').select('*').limit(5).execute()

    print("\n示例素材的路径：")
    for m in result.data:
        print(f"\n  {m.get('title')}")
        print(f"    audio: {m.get('audio_path', 'N/A')[:60]}...")
        print(f"    thumbnail: {m.get('thumbnail_path', 'N/A')}")

if __name__ == '__main__':
    if not SUPABASE_KEY:
        print("❌ 错误: 未找到 SUPABASE_ANON_KEY")
        print("\n请设置环境变量:")
        print("  export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key")
        sys.exit(1)

    try:
        fix_material_paths()
        verify_paths()
    except KeyboardInterrupt:
        print("\n\n❌ 用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
