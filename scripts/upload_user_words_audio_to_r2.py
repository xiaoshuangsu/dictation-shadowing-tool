#!/usr/bin/env python3
"""
音频上传到 R2 脚本（优化版）

功能流程：
1. 数据拉取：从 user_words 表获取单词，优先处理 audio_url 为空或非 R2 链接的记录
2. 双源获取音频：
   - 第一优先级：dictionaryapi.dev（真实 MP3）
   - 第二优先级：Google TTS 或 Edge TTS（US 发音）
3. R2 存储：重命名为 [word].mp3
4. 数据库写回：更新为 https://media.shadowhub.app/sounds/[word].mp3
5. 限速：每秒 3-5 个词
6. 实时进度：Progress: 1240/7000

使用方法：
  python scripts/upload_user_words_audio_to_r2.py
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
log_file = log_dir / f'upload_user_words_audio_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'

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

# R2 配置
R2_ACCOUNT_ID = os.environ.get("NEXT_PUBLIC_R2_ACCOUNT_ID") or os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET = os.environ.get("R2_BUCKET_NAME", "shadowhub")
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# 临时目录
TEMP_DIR = Path(__file__).parent.parent / 'temp' / 'audio'
TEMP_DIR.mkdir(parents=True, exist_ok=True)


def fetch_audio_from_dictapi(word: str) -> Optional[bytes]:
    """从 dictionaryapi.dev 获取音频文件内容"""
    try:
        # 获取音频 URL
        response = requests.get(
            f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}",
            timeout=10
        )

        if not response.ok:
            return None

        data = response.json()

        if not data or len(data) == 0:
            return None

        phonetics = data[0].get('phonetics', [])

        # 优先查找 US 音频
        for phonetic in phonetics:
            audio_url = phonetic.get('audio')
            if audio_url and audio_url.endswith('.mp3') and '-us' in audio_url:
                # 下载音频
                audio_response = requests.get(audio_url, timeout=30)
                if audio_response.ok:
                    return audio_response.content

        # 如果没有找到 US 音频，查找任何音频
        for phonetic in phonetics:
            audio_url = phonetic.get('audio')
            if audio_url and audio_url.endswith('.mp3'):
                audio_response = requests.get(audio_url, timeout=30)
                if audio_response.ok:
                    return audio_response.content

        return None

    except Exception as e:
        logger.warning(f"从 dictionaryapi.dev 获取 {word} 失败: {e}")
        return None


def fetch_audio_from_tts(word: str) -> Optional[bytes]:
    """从 Google TTS 获取音频（US 发音）"""
    try:
        # 使用 Google TTS API（无需 API Key）
        tts_url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={word}&tl=en-us&client=tw-ob"

        response = requests.get(tts_url, timeout=30)

        if response.ok and response.headers.get('content-type', '').startswith('audio/'):
            return response.content

        return None

    except Exception as e:
        logger.warning(f"从 Google TTS 获取 {word} 失败: {e}")
        return None


def upload_to_r2(audio_content: bytes, word: str) -> bool:
    """上传音频到 R2"""
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

        # 上传文件，命名为 [word].mp3
        s3_key = f"sounds/{word}.mp3"

        s3.put_object(
            Bucket=R2_BUCKET,
            Key=s3_key,
            Body=audio_content,
            ContentType='audio/mpeg'
        )

        logger.info(f"✅ 上传成功: sounds/{word}.mp3 ({len(audio_content)} bytes)")
        return True

    except Exception as e:
        logger.error(f"❌ 上传到 R2 失败 {word}: {e}")
        return False


def update_database_audio_url(word: str) -> bool:
    """更新数据库中的音频 URL 为 R2 URL"""
    try:
        # R2 URL 通过 media.shadowhub.app Worker 代理
        # 格式: https://media.shadowhub.app/sounds/[word].mp3
        worker_url = f"https://media.shadowhub.app/sounds/{word}.mp3"

        # 更新 US 和 UK 使用同一个 URL（因为我们只生成 US 发音）
        supabase.table('dictionary_cache').update({
            'audio_url_us': worker_url,
            'audio_url_uk': worker_url  # UK 也使用 US 发音
        }).eq('word', word).execute()

        logger.info(f"✅ 更新数据库: {word} -> {worker_url}")
        return True

    except Exception as e:
        logger.error(f"❌ 更新数据库失败 {word}: {e}")
        return False


def process_word(word: str) -> bool:
    """处理单个单词的音频上传"""
    try:
        # 第一优先级：从 dictionaryapi.dev 获取
        audio_content = fetch_audio_from_dictapi(word)

        # 第二优先级：从 Google TTS 获取
        if not audio_content:
            logger.info(f"⚠️  {word} - dictionaryapi.dev 无音频，尝试 Google TTS...")
            audio_content = fetch_audio_from_tts(word)

        if not audio_content:
            logger.warning(f"❌ {word} - 所有音频源均失败")
            return False

        # 上传到 R2
        if upload_to_r2(audio_content, word):
            # 更新数据库
            if update_database_audio_url(word):
                return True

        return False

    except Exception as e:
        logger.error(f"❌ 处理 {word} 失败: {e}")
        return False


def main():
    print("=" * 70)
    print("用户生词本音频上传到 R2")
    print("=" * 70)
    print()

    # 1. 从 user_words 表获取单词
    print("🔍 正在获取用户生词本中的单词...")

    user_words_result = supabase.table('user_words').select('word').execute()

    if not user_words_result.data:
        print("❌ 生词本为空")
        return

    words = [w['word'] for w in user_words_result.data]
    print(f"✅ 找到 {len(words)} 个单词")
    print()

    # 2. 检查哪些单词需要处理（audio_url 为空或非 R2 链接）
    words_to_process = []

    for word in words:
        # 查询数据库中的音频 URL
        cache_result = supabase.table('dictionary_cache').select('audio_url_us').eq('word', word).execute()

        if not cache_result.data:
            words_to_process.append(word)
        else:
            current_url = cache_result.data[0].get('audio_url_us')
            # 如果为空或不是 R2 链接，则需要处理
            if not current_url or 'media.shadowhub.app/sounds' not in current_url:
                words_to_process.append(word)

    print(f"📝 需要处理 {len(words_to_process)} 个单词")

    if len(words_to_process) == 0:
        print("\\n✅ 所有单词都已是 R2 音频，无需处理")
        return

    print(f"\\n🚀 开始处理 {len(words_to_process)} 个单词...")
    print(f"📝 日志文件: {log_file}")
    print("=" * 70)
    print()

    # 3. 批量处理（限速：每秒 3-5 个词）
    success = 0
    failed = 0

    for i, word in enumerate(words_to_process, 1):
        try:
            if process_word(word):
                success += 1
            else:
                failed += 1

            # 实时进度输出
            print(f"\\rProgress: {i}/{len(words_to_process)} | "
                  f"✅ {success} | ❌ {failed}", end='', flush=True)

            # 限速：每秒 3-5 个词（0.2-0.3 秒/词）
            time.sleep(0.25)

        except KeyboardInterrupt:
            logger.info("\\n⚠️ 用户中断")
            break
        except Exception as e:
            logger.error(f"❌ 处理 {word} 时出错: {e}")
            failed += 1
            continue

    print()  # 换行

    # 4. 总结
    print("=" * 70)
    print("📊 处理完成！")
    print("=" * 70)
    print(f"✅ 成功: {success} 个")
    print(f"❌ 失败: {failed} 个")
    print(f"📈 成功率: {success / len(words_to_process) * 100:.1f}%")
    print("=" * 70)

    # 5. 验证结果
    print("\\n🔍 验证几个单词的音频 URL:")
    test_words = words[:3] if len(words) >= 3 else words

    for test_word in test_words:
        result = supabase.table('dictionary_cache').select(
            'word, audio_url_us, audio_url_uk'
        ).eq('word', test_word).execute()

        if result.data:
            item = result.data[0]
            url = item.get('audio_url_us', '')
            if 'media.shadowhub.app/sounds' in url:
                print(f"\\n✅ {test_word}:")
                print(f"   {url}")
            else:
                print(f"\\n⚠️  {test_word}: 仍使用旧 URL ({url[:50]}...)")

    print("\\n🎉 上传完成！")


if __name__ == '__main__':
    main()
