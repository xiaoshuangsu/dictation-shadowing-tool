#!/usr/bin/env python3
"""
自动修复：上传本地音频到 R2 并更新 Supabase

功能：
1. 扫描 Supabase 中使用 Supabase Storage URL 的素材
2. 从本地目录读取对应的 mp3 文件
3. 上传到 R2
4. 更新 Supabase 记录
5. 验证 URL 可访问
"""

import os
import sys
import requests
from pathlib import Path
from typing import List, Dict, Optional
import boto3
from supabase import create_client

# ==================== 配置 ====================
# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# R2 配置
R2_ACCOUNT_ID = os.environ.get("NEXT_PUBLIC_R2_ACCOUNT_ID", "56f5f35ef68837e643bf13af9871c584")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "c6bf7a378f8786823b897975d895601d")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "8b75bb30c56e360a37070ca415871e5983c50e758119c18df201377651fbde21")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "shadowhub")
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_WORKER_URL = os.environ.get("NEXT_PUBLIC_R2_WORKER_URL", "https://r2-proxy.suxiaoshuang2020.workers.dev")

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://cuxotlijjnxbsirpdkgr.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# 本地路径（多个源目录）
LOCAL_SOURCE_DIRS = [
    Path("/Users/a/Desktop/下载视频/素材/日常对话"),
    Path("/Users/a/dictation/public/youtube_videos"),
    Path("/Users/a/dictation/public/audio"),
]

def upload_to_r2(local_path: str, key: str, content_type: str) -> Optional[Dict]:
    """上传文件到 R2"""
    s3 = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY
    )

    try:
        if not os.path.exists(local_path):
            print(f"    ❌ 本地文件不存在: {local_path}")
            return None

        file_size = os.path.getsize(local_path)
        size_mb = file_size / 1024 / 1024

        print(f"    上传中: {key} ({size_mb:.2f} MB)")
        s3.upload_file(
            local_path,
            R2_BUCKET_NAME,
            key,
            ExtraArgs={'ContentType': content_type}
        )

        public_url = f"{R2_WORKER_URL}/{key}"
        return {
            'success': True,
            'key': key,
            'public_url': public_url,
            'size': file_size
        }
    except Exception as e:
        print(f"    ❌ 上传失败: {e}")
        return None

def check_url(url: str) -> bool:
    """检查 URL 是否可访问"""
    try:
        response = requests.head(url, timeout=10)
        return response.status_code == 200
    except:
        return False

def fix_materials():
    """主修复逻辑"""
    print("=" * 70)
    print("  自动修复：上传本地音频到 R2")
    print("=" * 70)

    # 连接 Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase 连接成功\n")

    # 获取所有素材
    result = supabase.table('materials').select('*').execute()
    materials = result.data

    print(f"总素材数: {len(materials)}\n")

    # 找出需要修复的素材（使用相对路径或 Supabase Storage URL）
    need_fix = []
    for m in materials:
        audio_path = m.get('audio_path', '')
        # 检查是否是相对路径或 Supabase Storage URL（不是 R2）
        if audio_path and not audio_path.startswith('http'):
            # 相对路径，需要修复
            need_fix.append(m)
        elif audio_path and 'supabase.co' in audio_path and 'storage' in audio_path:
            # Supabase Storage URL，需要修复
            need_fix.append(m)

    print(f"需要修复的素材数: {len(need_fix)}\n")

    if not need_fix:
        print("✅ 没有需要修复的素材")
        return

    success_count = 0
    fail_count = 0

    for idx, material in enumerate(need_fix, 1):
        title = material.get('title', 'Unknown')
        material_id = material.get('id')
        old_audio_path = material.get('audio_path', '')

        print(f"\n[{idx}/{len(need_fix)}] 处理: {title}")
        print(f"  ID: {material_id}")
        print(f"  旧路径: {old_audio_path[:60]}...")

        # 提取文件名
        # 相对路径: audio/First Snowfall.mp3
        # 本地文件: First Snowfall.mp3 (保持原样，包括空格)
        filename = old_audio_path.split('/')[-1]
        local_path = LOCAL_SOURCE_DIR / filename

        if not local_path.exists():
            print(f"  ❌ 本地文件不存在: {local_path}")
            fail_count += 1
            continue

        # 上传到 R2（如果还没上传）
        r2_key = f"audio/{filename}"
        r2_url = f"{R2_WORKER_URL}/{r2_key}"

        # 检查 R2 上是否已存在
        if check_url(r2_url):
            print(f"  ✅ R2 已存在文件，跳过上传")
            new_audio_url = r2_url
        else:
            upload_result = upload_to_r2(str(local_path), r2_key, 'audio/mpeg')
            if not upload_result:
                fail_count += 1
                continue
            new_audio_url = upload_result['public_url']
            print(f"  ✅ 已上传到 R2: {new_audio_url}")
        upload_result = upload_to_r2(str(local_path), r2_key, 'audio/mpeg')

        if not upload_result:
            fail_count += 1
            continue

        new_audio_url = upload_result['public_url']
        print(f"  ✅ R2 URL: {new_audio_url}")

        # 更新 Supabase
        try:
            update_result = supabase.table('materials').update({
                'audio_path': new_audio_url
            }).eq('id', material_id).execute()
            print(f"  ✅ Supabase 已更新")
            success_count += 1

            # 验证新 URL
            if check_url(new_audio_url):
                print(f"  ✅ URL 验证通过 (200 OK)")
            else:
                print(f"  ⚠️  URL 验证失败")

        except Exception as e:
            print(f"  ❌ 更新 Supabase 失败: {e}")
            fail_count += 1

    # 打印总结
    print("\n" + "=" * 70)
    print("  修复完成统计")
    print("=" * 70)
    print(f"✅ 成功: {success_count}")
    print(f"❌ 失败: {fail_count}")
    print(f"📊 总计: {len(need_fix)}")
    print("=" * 70)

if __name__ == "__main__":
    fix_materials()
