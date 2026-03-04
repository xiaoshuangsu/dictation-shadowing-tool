#!/usr/bin/env python3
"""
检查 R2 存储桶中的文件
"""

import os
import boto3
from dotenv import load_dotenv

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

BUCKETS = {
    'R2': 'engnovate-audio',  # 存储 audio 和 thumbnails
    'VIDEOS': 'engnovate-videos'  # 存储 videos
}

def list_bucket_files(bucket_name, prefix=''):
    """列出 bucket 中的文件"""
    print(f"\n{'='*70}")
    print(f"📦 Bucket: {bucket_name}")
    print(f"{'='*70}")

    try:
        s3 = boto3.client('s3',
            endpoint_url=ENDPOINT_URL,
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY
        )

        continuation_token = None
        file_count = 0

        while True:
            kwargs = {'Bucket': bucket_name}
            if prefix:
                kwargs['Prefix'] = prefix
            if continuation_token:
                kwargs['ContinuationToken'] = continuation_token

            response = s3.list_objects_v2(**kwargs)

            if 'Contents' in response:
                for obj in response['Contents']:
                    file_count += 1
                    size_mb = obj['Size'] / 1024 / 1024
                    print(f"  {obj['Key']:<60} {size_mb:>8.2f} MB")

            if not response.get('IsTruncated'):
                break
            continuation_token = response.get('NextContinuationToken')

        if file_count == 0:
            print(f"  ⚠️  没有找到文件（prefix: '{prefix}'）")
        else:
            print(f"\n  总计: {file_count} 个文件")

    except Exception as e:
        print(f"  ❌ 错误: {e}")

def check_specific_files(bucket_name, files):
    """检查特定文件是否存在"""
    print(f"\n{'='*70}")
    print(f"🔍 检查 Bucket: {bucket_name}")
    print(f"{'='*70}")

    try:
        s3 = boto3.client('s3',
            endpoint_url=ENDPOINT_URL,
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY
        )

        for file_key in files:
            try:
                s3.head_object(Bucket=bucket_name, Key=file_key)
                print(f"  ✅ {file_key}")
            except s3.exceptions.ClientError as e:
                if e.response['Error']['Code'] == '404':
                    print(f"  ❌ {file_key} (不存在)")
                else:
                    print(f"  ❌ {file_key} ({e})")

    except Exception as e:
        print(f"  ❌ 错误: {e}")

if __name__ == '__main__':
    print("\n" + "="*70)
    print("  R2 存储桶文件检查工具")
    print("="*70)

    if not R2_ACCESS_KEY or not R2_SECRET_KEY:
        print("\n❌ 错误: 未找到 R2 凭证")
        print("\n请设置环境变量或 ~/.aws/credentials:")
        print("  export R2_ACCESS_KEY=xxx")
        print("  export R2_SECRET_KEY=xxx")
        print("\n或在 ~/.aws/credentials 中添加:")
        print("  [r2]")
        print("  aws_access_key_id = xxx")
        print("  aws_secret_access_key = xxx")
        exit(1)

    # 检查每个 bucket
    for bucket_type, bucket_name in BUCKETS.items():
        list_bucket_files(bucket_name)

    # 检查特定文件
    print("\n\n" + "="*70)
    print("  检查示例文件")
    print("="*70)

    sample_files = {
        'engnovate-audio': [
            'audio/Canada_Provinces_and_Territories.mp3',
            'thumbnails/Canada_Provinces_and_Territories.jpg',
        ],
        'engnovate-videos': [
            'videos/empty-your-mind.mp4',
        ]
    }

    for bucket_name, files in sample_files.items():
        check_specific_files(bucket_name, files)

    print("\n" + "="*70)
    print("  检查完成")
    print("="*70)
    print("\n💡 提示:")
    print("  1. 如果文件不存在，需要上传到 R2")
    print("  2. 参考 scripts/upload-local-audios-to-r2.py")
    print("  3. 确保 Worker 绑定了正确的存储桶")
