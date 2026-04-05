#!/usr/bin/env python3
"""
Oxford 3000 音频上传到 R2 测试脚本
整合：Edge TTS 生成 + R2 上传
"""

import asyncio
import json
import os
from pathlib import Path
import edge_tts
import boto3
from botocore.client import Config

# 配置
ENV_PATH = Path('/Users/a/dictation/.env.local')
INPUT_FILE = '/Users/a/dictation/oxford_test_with_audio.json'
R2_BUCKET = 'shadowhub'

# 加载环境变量
with open(ENV_PATH) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

# R2 配置
R2_ACCOUNT_ID = os.environ.get("NEXT_PUBLIC_R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"


def upload_to_r2(file_path: str, r2_key: str) -> str:
    """上传文件到 R2，返回 Worker 代理 URL"""
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )

        s3.upload_file(
            file_path,
            R2_BUCKET,
            r2_key,
            ExtraArgs={'ContentType': 'audio/mpeg'}
        )

        # 返回 Worker 代理 URL
        worker_url = f"https://media.shadowhub.app/{r2_key}"
        print(f"    ✅ 上传成功: {worker_url}")
        return worker_url

    except Exception as e:
        print(f"    ❌ 上传失败: {e}")
        return None


async def main():
    print("=" * 70)
    print("Oxford 3000 音频上传到 R2 测试")
    print("=" * 70)
    print()

    # 读取单词数据
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        words = json.load(f)

    print(f"📖 读取到 {len(words)} 个单词")
    print()

    success_count = 0
    failed_count = 0

    for i, word_data in enumerate(words, 1):
        word = word_data['word']
        local_audio = word_data.get('audio_file')

        if not local_audio or not Path(local_audio).exists():
            print(f"[{i}/{len(words)}] {word}")
            print(f"  ⚠️  本地音频不存在: {local_audio}")
            failed_count += 1
            continue

        print(f"[{i}/{len(words)}] {word}")
        print(f"  本地文件: {local_audio}")

        # 上传到 R2
        # R2 路径: audio/oxford3000/{word}.mp3
        r2_key = f"audio/oxford3000/{word}.mp3"
        worker_url = upload_to_r2(local_audio, r2_key)

        if worker_url:
            word_data['r2_url'] = worker_url
            word_data['r2_key'] = r2_key
            success_count += 1
        else:
            failed_count += 1

        # 短暂延迟
        await asyncio.sleep(0.5)

    # 保存结果
    output_file = '/Users/a/dictation/oxford_test_with_r2.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(words, f, indent=2, ensure_ascii=False)

    print()
    print("=" * 70)
    print(f"✅ 完成！")
    print(f"📄 结果文件: {output_file}")
    print("=" * 70)
    print()
    print(f"📊 统计:")
    print(f"  - 总单词: {len(words)}")
    print(f"  - 成功: {success_count}")
    print(f"  - 失败: {failed_count}")


if __name__ == '__main__':
    asyncio.run(main())
