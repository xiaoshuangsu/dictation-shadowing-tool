#!/usr/bin/env python3
"""
下载音频文件并上传到 R2

功能：
1. 从 dictionaryapi.dev 获取音频 URL
2. 下载 MP3 文件到本地
3. 上传到 Cloudflare R2
4. 更新数据库为 R2 URL（通过 Worker 代理）

使用方法：
  python scripts/upload_audio_to_r2.py
"""

import os
import sys
import time
import logging
import requests
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime

try:
    from supabase import create_client
except ImportError:
    print("❌ 错误: 未安装 supabase 包")
    sys.exit(1)

# 配置日志
log_dir = Path(__file__).parent.parent / 'logs'
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f'upload_audio_r2_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://cuxotlijjnxbsirpdkgr.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_SERVICE_KEY:
    print("❌ 错误: 未找到 SUPABASE_SERVICE_ROLE_KEY 环境变量")
    sys.exit(1)

# 创建 Supabase 客户端
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# R2 配置（A 账号）
# 注意：这里使用 R2 的 S3 兼容 API
R2_ACCOUNT_ID = os.environ.get("NEXT_PUBLIC_R2_ACCOUNT_ID") or os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET = os.environ.get("R2_BUCKET_NAME", "shadowhub")
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# 临时目录
TEMP_DIR = Path(__file__).parent.parent / 'temp' / 'audio'
TEMP_DIR.mkdir(parents=True, exist_ok=True)


def fetch_audio_urls_from_dictapi(word: str) -> Dict[str, Optional[str]]:
    """从 dictionaryapi.dev 获取音频 URL"""
    try:
        response = requests.get(
            f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}",
            timeout=10
        )

        if not response.ok:
            return {'us': None, 'uk': None}

        data = response.json()

        if not data or len(data) == 0:
            return {'us': None, 'uk': None}

        phonetics = data[0].get('phonetics', [])
        audio_urls = {'us': None, 'uk': None}

        for phonetic in phonetics:
            audio_url = phonetic.get('audio')
            if not audio_url or not audio_url.endswith('.mp3'):
                continue

            if '-us' in audio_url and not audio_urls['us']:
                audio_urls['us'] = audio_url
            elif '-uk' in audio_url and not audio_urls['uk']:
                audio_urls['uk'] = audio_url
            elif not audio_urls['us']:
                audio_urls['us'] = audio_url

        return audio_urls

    except Exception as e:
        logger.error(f"获取 {word} 音频 URL 失败: {e}")
        return {'us': None, 'uk': None}


def download_audio_file(url: str, dest_path: Path) -> bool:
    """下载音频文件到本地"""
    try:
        response = requests.get(url, timeout=30, stream=True)
        response.raise_for_status()

        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return True

    except Exception as e:
        logger.error(f"下载音频失败 {url}: {e}")
        return False


def upload_to_r2(file_path: Path, r2_key: str) -> bool:
    """上传文件到 R2"""
    try:
        import boto3
        from botocore.client import Config

        s3 = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )

        s3.upload_file(
            str(file_path),
            R2_BUCKET,
            r2_key,
            ExtraArgs={'ContentType': 'audio/mpeg'}
        )

        logger.info(f"✅ 上传成功: {r2_key}")
        return True

    except ImportError:
        logger.error("❌ 未安装 boto3，请运行: pip install boto3")
        return False
    except Exception as e:
        logger.error(f"❌ 上传到 R2 失败 {r2_key}: {e}")
        return False


def update_database_with_r2_url(word: str, variant: str, r2_url: str) -> bool:
    """更新数据库中的音频 URL 为 R2 URL"""
    try:
        # R2 URL 通过 media.shadowhub.app Worker 代理
        # 格式: https://media.shadowhub.app/audio/{word}-{variant}.mp3
        worker_url = f"https://media.shadowhub.app/audio/{word}-{variant}.mp3"

        field_name = f"audio_url_{variant}"

        supabase.table('dictionary_cache').update({
            field_name: worker_url
        }).eq('word', word).execute()

        logger.info(f"✅ 更新数据库: {word} - {variant}")
        return True

    except Exception as e:
        logger.error(f"❌ 更新数据库失败 {word} - {variant}: {e}")
        return False


def process_word_audio(word: str) -> Dict[str, int]:
    """处理单个单词的音频上传"""
    stats = {'us': 0, 'uk': 0, 'failed': 0}

    try:
        # 1. 获取音频 URL
        audio_urls = fetch_audio_urls_from_dictapi(word)

        # 2. 处理 US 音频
        if audio_urls['us']:
            filename = f"{word}-us.mp3"
            temp_path = TEMP_DIR / filename

            # 下载
            if download_audio_file(audio_urls['us'], temp_path):
                # 上传到 R2
                r2_key = f"audio/{filename}"
                if upload_to_r2(temp_path, r2_key):
                    # 更新数据库
                    if update_database_with_r2_url(word, 'us', r2_key):
                        stats['us'] = 1
                    else:
                        stats['failed'] += 1

                # 删除临时文件
                temp_path.unlink(missing_ok=True)

        # 3. 处理 UK 音频
        if audio_urls['uk']:
            filename = f"{word}-uk.mp3"
            temp_path = TEMP_DIR / filename

            if download_audio_file(audio_urls['uk'], temp_path):
                r2_key = f"audio/{filename}"
                if upload_to_r2(temp_path, r2_key):
                    if update_database_with_r2_url(word, 'uk', r2_key):
                        stats['uk'] = 1
                    else:
                        stats['failed'] += 1

                temp_path.unlink(missing_ok=True)

        return stats

    except Exception as e:
        logger.error(f"处理单词 {word} 失败: {e}")
        stats['failed'] += 2
        return stats


def main():
    print("=" * 70)
    print("音频上传到 R2 脚本")
    print("=" * 70)
    print()

    # 检查环境变量
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]):
        print("❌ 错误: 未配置 R2 环境变量")
        print("请设置以下环境变量:")
        print("  - R2_ACCOUNT_ID")
        print("  - R2_ACCESS_KEY_ID")
        print("  - R2_SECRET_ACCESS_KEY")
        sys.exit(1)

    # 获取所有单词
    print("🔍 正在获取所有单词...")
    total_count_result = supabase.table('dictionary_cache').select('word', count='exact').execute()
    total_count = total_count_result.count

    print(f"✅ 总单词数: {total_count}")
    print()

    # 分批获取
    all_words = []
    offset = 0
    batch_size = 1000

    while offset < total_count:
        batch = supabase.table('dictionary_cache').select('word').range(
            offset, offset + batch_size - 1
        ).execute()
        all_words.extend(batch.data)
        if len(batch.data) < batch_size:
            break
        offset += batch_size

    print(f"📝 准备处理 {len(all_words)} 个单词的音频...")
    print()

    # 批量处理
    logger.info(f"🚀 开始上传音频到 R2...")
    logger.info(f"📝 日志文件: {log_file}")
    logger.info("=" * 70)

    us_success = 0
    uk_success = 0
    failed = 0
    processed = 0

    for i, word_data in enumerate(all_words, 1):
        word = word_data['word']

        try:
            stats = process_word_audio(word)
            us_success += stats['us']
            uk_success += stats['uk']
            failed += stats['failed']

            # 进度报告
            if i % 10 == 0:
                logger.info(f"⏳ 进度: {i}/{len(all_words)} ({i/len(all_words)*100:.1f}%) | "
                           f"US: {us_success}, UK: {uk_success}, 失败: {failed}")

            # 避免请求过快
            time.sleep(0.5)

        except KeyboardInterrupt:
            logger.info("\\n⚠️ 用户中断")
            break
        except Exception as e:
            logger.error(f"❌ 处理 {word} 时出错: {e}")
            failed += 2
            continue

    # 总结
    logger.info("=" * 70)
    logger.info("📊 上传完成！")
    logger.info("=" * 70)
    logger.info(f"✅ US 音频: {us_success} 个")
    logger.info(f"✅ UK 音频: {uk_success} 个")
    logger.info(f"❌ 失败: {failed} 个")
    logger.info(f"📈 成功率: {(us_success + uk_success) / (len(all_words) * 2) * 100:.1f}%")
    logger.info("=" * 70)

    # 验证几个单词
    print("\n🔍 验证结果...")
    test_words = ['jail', 'hello', 'world']

    for test_word in test_words:
        result = supabase.table('dictionary_cache').select(
            'word, audio_url_us, audio_url_uk'
        ).eq('word', test_word).execute()

        if result.data:
            item = result.data[0]
            print(f"\n{test_word}:")
            print(f"  US: {item.get('audio_url_us', 'null')[:80]}...")
            print(f"  UK: {item.get('audio_url_uk', 'null')[:80]}...")

    print("\n🎉 上传完成！")


if __name__ == '__main__':
    main()
