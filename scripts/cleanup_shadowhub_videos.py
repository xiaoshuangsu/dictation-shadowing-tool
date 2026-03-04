#!/usr/bin/env python3
"""
清理 shadowhub 视频目录重复文件

功能：
1. 扫描 shadowhub/videos/ 和 shadowhub/youtube_videos/
2. 找出重复的文件
3. 删除重复文件
4. 将 youtube_videos/ 迁移到 videos/

最终结果：所有视频统一在 shadowhub/videos/
"""

import os
import sys
import boto3
from dotenv import load_dotenv
from difflib import SequenceMatcher

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

# R2 桶名称
R2_BUCKET = 'engnovate-audio'

# 影子目录
SHADOWHUB_VIDEOS = 'shadowhub/videos/'
SHADOWHUB_YOUTUBE_VIDEOS = 'shadowhub/youtube_videos/'

def get_s3_client():
    """获取 S3 客户端"""
    return boto3.client('s3',
        endpoint_url=ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY
    )

def list_files_in_prefix(bucket, prefix):
    """列出指定前缀的所有文件"""
    s3 = get_s3_client()
    files = []

    try:
        continuation_token = None
        while True:
            kwargs = {'Bucket': bucket, 'Prefix': prefix}
            if continuation_token:
                kwargs['ContinuationToken'] = continuation_token

            response = s3.list_objects_v2(**kwargs)

            if 'Contents' in response:
                files.extend(response['Contents'])

            if not response.get('IsTruncated'):
                break
            continuation_token = response.get('NextContinuationToken')

    except Exception as e:
        print(f"❌ 列出文件失败 {bucket}/{prefix}: {e}")

    return files

def similar(a, b):
    """计算两个字符串的相似度"""
    return SequenceMatcher(None, a, b).ratio()

def find_duplicates(videos_files, youtube_files):
    """找出重复的文件"""
    print("\n" + "="*70)
    print("  分析重复文件")
    print("="*70)

    # 创建文件名映射
    videos_map = {f['Key'].split('/')[-1]: f for f in videos_files}
    youtube_map = {f['Key'].split('/')[-1]: f for f in youtube_files}

    # 1. 完全相同的文件名
    exact_duplicates = set(videos_map.keys()) & set(youtube_map.keys())

    # 2. 相似的文件名
    similar_pairs = []
    for v_name in videos_map.keys():
        for y_name in youtube_map.keys():
            if v_name != y_name:
                sim = similar(v_name, y_name)
                if sim > 0.8:  # 80% 以上相似度
                    similar_pairs.append((v_name, y_name, sim))

    return exact_duplicates, similar_pairs

def cleanup_shadowhub_videos():
    """清理 shadowhub 视频目录"""
    s3 = get_s3_client()

    print("="*70)
    print("  shadowhub 视频目录清理")
    print("="*70)
    print(f"\nR2 桶: {R2_BUCKET}")
    print(f"检查目录:")
    print(f"  1. {SHADOWHUB_VIDEOS}")
    print(f"  2. {SHADOWHUB_YOUTUBE_VIDEOS}")

    # 第一步：扫描两个目录
    print("\n" + "="*70)
    print("步骤 1: 扫描目录")
    print("="*70)

    videos_files = list_files_in_prefix(R2_BUCKET, SHADOWHUB_VIDEOS)
    youtube_files = list_files_in_prefix(R2_BUCKET, SHADOWHUB_YOUTUBE_VIDEOS)

    print(f"\nshadowhub/videos/: {len(videos_files)} 个文件")
    for f in videos_files[:5]:
        size_mb = f['Size'] / 1024 / 1024
        print(f"  - {f['Key']} ({size_mb:.2f} MB)")
    if len(videos_files) > 5:
        print(f"  ... 还有 {len(videos_files) - 5} 个")

    print(f"\nshadowhub/youtube_videos/: {len(youtube_files)} 个文件")
    for f in youtube_files[:5]:
        size_mb = f['Size'] / 1024 / 1024
        print(f"  - {f['Key']} ({size_mb:.2f} MB)")
    if len(youtube_files) > 5:
        print(f"  ... 还有 {len(youtube_files) - 5} 个")

    if not videos_files and not youtube_files:
        print("\n✅ 两个目录都是空的，无需清理")
        return

    # 第二步：找出重复文件
    print("\n" + "="*70)
    print("步骤 2: 查找重复文件")
    print("="*70)

    exact_duplicates, similar_pairs = find_duplicates(videos_files, youtube_files)

    if exact_duplicates:
        print(f"\n完全相同的文件名: {len(exact_duplicates)} 个")
        for name in sorted(exact_duplicates):
            v_file = next(f for f in videos_files if f['Key'].endswith(name))
            y_file = next(f for f in youtube_files if f['Key'].endswith(name))

            v_size = v_file['Size'] / 1024 / 1024
            y_size = y_file['Size'] / 1024 / 1024

            print(f"\n  📹 {name}")
            print(f"     videos/:          {v_size:.2f} MB")
            print(f"     youtube_videos/:  {y_size:.2f} MB")

    if similar_pairs:
        print(f"\n相似的文件名: {len(similar_pairs)} 对")
        for v_name, y_name, sim in similar_pairs[:5]:
            print(f"  {v_name} ↔ {y_name} (相似度: {sim:.2%})")
        if len(similar_pairs) > 5:
            print(f"  ... 还有 {len(similar_pairs) - 5} 对")

    # 第三步：确认处理
    print("\n" + "="*70)
    print("步骤 3: 执行清理和迁移")
    print("="*70)

    print("\n处理策略:")
    print("1. 删除 youtube_videos/ 中与 videos/ 重复的文件")
    print("2. 将 youtube_videos/ 中剩余的文件移动到 videos/")

    response = input("\n是否继续？(yes/no): ")
    if response.lower() != 'yes':
        print("❌ 取消操作")
        return

    deleted_count = 0
    moved_count = 0
    skipped_count = 0

    # 处理完全重复的文件（删除 youtube_videos/ 中的）
    if exact_duplicates:
        print(f"\n删除重复文件...")
        for name in exact_duplicates:
            y_file = next(f for f in youtube_files if f['Key'].endswith(name))

            try:
                s3.delete_object(Bucket=R2_BUCKET, Key=y_file['Key'])
                print(f"  ✅ 删除: {y_file['Key']}")
                deleted_count += 1
            except Exception as e:
                print(f"  ❌ 删除失败: {y_file['Key']} - {e}")

    # 移动 youtube_videos/ 中剩余的文件到 videos/
    youtube_files_after = list_files_in_prefix(R2_BUCKET, SHADOWHUB_YOUTUBE_VIDEOS)

    if youtube_files_after:
        print(f"\n迁移剩余文件...")
        for f in youtube_files_after:
            old_key = f['Key']
            filename = old_key.split('/')[-1]
            new_key = SHADOWHUB_VIDEOS + filename

            # 检查目标是否已存在
            try:
                s3.head_object(Bucket=R2_BUCKET, Key=new_key)
                print(f"  ⚠️  跳过: {filename} (目标已存在)")
                skipped_count += 1
                # 删除源文件
                s3.delete_object(Bucket=R2_BUCKET, Key=old_key)
                deleted_count += 1
                continue
            except:
                pass  # 目标不存在，可以移动

            # 复制到新位置
            try:
                s3.copy_object(
                    CopySource={'Bucket': R2_BUCKET, 'Key': old_key},
                    Bucket=R2_BUCKET,
                    Key=new_key
                )
                print(f"  ✅ 移动: {filename}")
                moved_count += 1
            except Exception as e:
                print(f"  ❌ 移动失败: {filename} - {e}")
                continue

            # 删除源文件
            try:
                s3.delete_object(Bucket=R2_BUCKET, Key=old_key)
                deleted_count += 1
            except Exception as e:
                print(f"  ⚠️  删除源文件失败: {filename} - {e}")

    # 检查 youtube_videos/ 是否为空
    youtube_files_final = list_files_in_prefix(R2_BUCKET, SHADOWHUB_YOUTUBE_VIDEOS)

    # 完成
    print("\n" + "="*70)
    print("  清理完成！")
    print("="*70)
    print(f"\n统计:")
    print(f"  删除重复文件: {deleted_count}")
    print(f"  移动文件: {moved_count}")
    print(f"  跳过文件: {skipped_count}")

    # 最终状态
    videos_files_final = list_files_in_prefix(R2_BUCKET, SHADOWHUB_VIDEOS)

    print(f"\n最终状态:")
    print(f"  shadowhub/videos/: {len(videos_files_final)} 个文件")
    print(f"  shadowhub/youtube_videos/: {len(youtube_files_final)} 个文件")

    # 建议下一步
    if videos_files_final:
        print(f"\n💡 下一步:")
        print(f"  所有视频现在都在 shadowhub/videos/ 目录")
        print(f"  你可能需要:")
        print(f"  1. 更新数据库中的路径")
        print(f"  2. 考虑将这些视频迁移到 VIDEOS 桶")

if __name__ == '__main__':
    if not R2_ACCESS_KEY or not R2_SECRET_KEY:
        print("❌ 错误: 未找到 R2 凭证")
        print("\n请设置环境变量或 ~/.aws/credentials")
        sys.exit(1)

    try:
        cleanup_shadowhub_videos()
    except KeyboardInterrupt:
        print("\n\n❌ 用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
