#!/usr/bin/env python3
"""
R2 存储桶清理与迁移脚本

功能：
1. 扫描 R2 和 VIDEOS 两个桶
2. 将错误放置的文件移动到正确的桶
3. 确保规范：视频在 VIDEOS，音频和封面在 R2

存储规范：
- VIDEOS 桶：videos/*.mp4
- R2 桶：audio/*.mp3, thumbnails/*.jpg
"""

import os
import sys
import boto3
from dotenv import load_dotenv
import tempfile
import shutil

load_dotenv()

# R2 配置
R2_ACCOUNT_ID = os.getenv('NEXT_PUBLIC_R2_ACCOUNT_ID')
R2_ACCESS_KEY = os.getenv('R2_ACCESS_KEY')
R2_SECRET_KEY = os.getenv('R2_SECRET_KEY')

# 如果环境变量没有，从 ~/.aws/credentials 读取
if not R2_ACCESS_KEY:
    import configparser
    config = configparser.ConfigParser()
    config.read(os.path.expanduser('~/.aws/credentials'))
    R2_ACCESS_KEY = config.get('r2', 'aws_access_key_id', fallback=None)
    R2_SECRET_KEY = config.get('r2', 'aws_secret_access_key', fallback=None)

ENDPOINT_URL = f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com'

# 存储桶名称（请根据实际情况修改）
R2_BUCKET = 'engnovate-audio'      # 存储 audio 和 thumbnails
VIDEOS_BUCKET = 'engnovate-videos' # 存储 videos

def get_s3_client():
    """获取 S3 客户端"""
    return boto3.client('s3',
        endpoint_url=ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY
    )

def list_all_files(bucket_name):
    """列出 bucket 中所有文件"""
    s3 = get_s3_client()
    files = []

    try:
        continuation_token = None
        while True:
            kwargs = {'Bucket': bucket_name}
            if continuation_token:
                kwargs['ContinuationToken'] = continuation_token

            response = s3.list_objects_v2(**kwargs)

            if 'Contents' in response:
                files.extend(response['Contents'])

            if not response.get('IsTruncated'):
                break
            continuation_token = response.get('NextContinuationToken')

    except Exception as e:
        print(f"❌ 列出文件失败 {bucket_name}: {e}")

    return files

def copy_file(s3, src_bucket, src_key, dest_bucket, dest_key):
    """复制文件"""
    try:
        # 复制文件
        s3.copy_object(
            CopySource={'Bucket': src_bucket, 'Key': src_key},
            Bucket=dest_bucket,
            Key=dest_key
        )
        return True
    except Exception as e:
        print(f"  ❌ 复制失败: {e}")
        return False

def delete_file(s3, bucket, key):
    """删除文件"""
    try:
        s3.delete_object(Bucket=bucket, Key=key)
        return True
    except Exception as e:
        print(f"  ❌ 删除失败: {e}")
        return False

def cleanup_buckets():
    """清理和迁移文件"""
    s3 = get_s3_client()

    print("="*70)
    print("  R2 存储桶清理与迁移")
    print("="*70)
    print(f"\n存储桶配置:")
    print(f"  R2 桶: {R2_BUCKET} (audio, thumbnails)")
    print(f"  VIDEOS 桶: {VIDEOS_BUCKET} (videos)")

    # 第一步：扫描两个桶
    print("\n" + "="*70)
    print("步骤 1: 扫描存储桶")
    print("="*70)

    r2_files = list_all_files(R2_BUCKET)
    videos_files = list_all_files(VIDEOS_BUCKET)

    print(f"\nR2 桶: {len(r2_files)} 个文件")
    print(f"VIDEOS 桶: {len(videos_files)} 个文件")

    # 第二步：分析错误放置的文件
    print("\n" + "="*70)
    print("步骤 2: 分析文件分布")
    print("="*70)

    # R2 桶中不应该有的视频文件
    videos_in_r2 = [f for f in r2_files if f['Key'].endswith('.mp4')]

    # VIDEOS 桶中不应该有的音频和图片文件
    audio_in_videos = [f for f in videos_files if f['Key'].endswith('.mp3')]
    images_in_videos = [f for f in videos_files if f['Key'].endswith(('.jpg', '.png', '.jpeg'))]

    print(f"\n发现的问题:")
    print(f"  R2 桶中的视频: {len(videos_in_r2)} 个")
    print(f"  VIDEOS 桶中的音频: {len(audio_in_videos)} 个")
    print(f"  VIDEOS 桶中的图片: {len(images_in_videos)} 个")

    if not videos_in_r2 and not audio_in_videos and not images_in_videos:
        print("\n✅ 文件分布正确，无需迁移！")
        return

    # 显示需要迁移的文件
    if videos_in_r2:
        print(f"\nR2 桶中的视频文件:")
        for f in videos_in_r2[:5]:
            print(f"  - {f['Key']}")
        if len(videos_in_r2) > 5:
            print(f"  ... 还有 {len(videos_in_r2) - 5} 个")

    if audio_in_videos:
        print(f"\nVIDEOS 桶中的音频文件:")
        for f in audio_in_videos[:5]:
            print(f"  - {f['Key']}")
        if len(audio_in_videos) > 5:
            print(f"  ... 还有 {len(audio_in_videos) - 5} 个")

    if images_in_videos:
        print(f"\nVIDEOS 桶中的图片文件:")
        for f in images_in_videos[:5]:
            print(f"  - {f['Key']}")
        if len(images_in_videos) > 5:
            print(f"  ... 还有 {len(images_in_videos) - 5} 个")

    # 第三步：确认迁移
    print("\n" + "="*70)
    print("步骤 3: 执行迁移")
    print("="*70)

    response = input("\n是否继续迁移？(yes/no): ")
    if response.lower() != 'yes':
        print("❌ 取消迁移")
        return

    migrated_count = 0
    deleted_count = 0

    # 迁移 R2 桶中的视频到 VIDEOS 桶
    if videos_in_r2:
        print(f"\n迁移 R2 桶中的视频到 VIDEOS 桶...")
        for f in videos_in_r2:
            key = f['Key']
            print(f"  处理: {key}")

            # 检查目标是否已存在
            try:
                s3.head_object(Bucket=VIDEOS_BUCKET, Key=key)
                print(f"    ⚠️  VIDEOS 桶中已存在，跳过")
            except:
                # 不存在，需要复制
                if copy_file(s3, R2_BUCKET, key, VIDEOS_BUCKET, key):
                    print(f"    ✅ 已复制到 VIDEOS 桶")
                    migrated_count += 1
                else:
                    print(f"    ❌ 复制失败，跳过删除")
                    continue

            # 删除 R2 桶中的文件
            if delete_file(s3, R2_BUCKET, key):
                print(f"    ✅ 已从 R2 桶删除")
                deleted_count += 1

    # 迁移 VIDEOS 桶中的音频到 R2 桶
    if audio_in_videos:
        print(f"\n迁移 VIDEOS 桶中的音频到 R2 桶...")
        for f in audio_in_videos:
            key = f['Key']
            print(f"  处理: {key}")

            # 检查目标是否已存在
            try:
                s3.head_object(Bucket=R2_BUCKET, Key=key)
                print(f"    ⚠️  R2 桶中已存在，跳过")
            except:
                # 不存在，需要复制
                if copy_file(s3, VIDEOS_BUCKET, key, R2_BUCKET, key):
                    print(f"    ✅ 已复制到 R2 桶")
                    migrated_count += 1
                else:
                    print(f"    ❌ 复制失败，跳过删除")
                    continue

            # 删除 VIDEOS 桶中的文件
            if delete_file(s3, VIDEOS_BUCKET, key):
                print(f"    ✅ 已从 VIDEOS 桶删除")
                deleted_count += 1

    # 迁移 VIDEOS 桶中的图片到 R2 桶
    if images_in_videos:
        print(f"\n迁移 VIDEOS 桶中的图片到 R2 桶...")
        for f in images_in_videos:
            key = f['Key']
            print(f"  处理: {key}")

            # 检查目标是否已存在
            try:
                s3.head_object(Bucket=R2_BUCKET, Key=key)
                print(f"    ⚠️  R2 桶中已存在，跳过")
            except:
                # 不存在，需要复制
                if copy_file(s3, VIDEOS_BUCKET, key, R2_BUCKET, key):
                    print(f"    ✅ 已复制到 R2 桶")
                    migrated_count += 1
                else:
                    print(f"    ❌ 复制失败，跳过删除")
                    continue

            # 删除 VIDEOS 桶中的文件
            if delete_file(s3, VIDEOS_BUCKET, key):
                print(f"    ✅ 已从 VIDEOS 桶删除")
                deleted_count += 1

    # 完成
    print("\n" + "="*70)
    print("  迁移完成！")
    print("="*70)
    print(f"\n迁移文件数: {migrated_count}")
    print(f"删除文件数: {deleted_count}")

if __name__ == '__main__':
    # 检查凭证
    if not R2_ACCESS_KEY or not R2_SECRET_KEY:
        print("❌ 错误: 未找到 R2 凭证")
        print("\n请设置环境变量或 ~/.aws/credentials")
        sys.exit(1)

    # 执行清理
    try:
        cleanup_buckets()
    except KeyboardInterrupt:
        print("\n\n❌ 用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
