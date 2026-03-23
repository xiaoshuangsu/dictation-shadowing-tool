#!/usr/bin/env python3
"""
更新词典缓存的音频 URL - 使用 dictionaryapi.dev 真实音频

功能：
- 从 dictionaryapi.dev 获取真实的 MP3 音频 URL
- 支持 CORS，可直接在浏览器中播放
- 批量更新数据库中的 audio_url_us 和 audio_url_uk

使用方法：
  python scripts/update_audio_urls.py
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
    print("   请运行: pip install supabase")
    sys.exit(1)

# 配置日志
log_dir = Path(__file__).parent.parent / 'logs'
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f'update_audio_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'

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


def fetch_audio_urls_from_dictapi(word: str) -> Dict[str, Optional[str]]:
    """
    从 dictionaryapi.dev 获取音频 URL

    Args:
        word: 单词

    Returns:
        {'us': url_or_none, 'uk': url_or_none}
    """
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

            # 判断是美音还是英音
            text = phonetic.get('text', '')

            if '-us' in audio_url and not audio_urls['us']:
                audio_urls['us'] = audio_url
            elif '-uk' in audio_url and not audio_urls['uk']:
                audio_urls['uk'] = audio_url
            elif text and 'US' in text and not audio_urls['us']:
                audio_urls['us'] = audio_url
            elif text and 'UK' in text and not audio_urls['uk']:
                audio_urls['uk'] = audio_url
            elif not audio_urls['us']:
                # 默认为美音
                audio_urls['us'] = audio_url

        return audio_urls

    except Exception as e:
        logger.error(f"获取 {word} 音频失败: {e}")
        return {'us': None, 'uk': None}


def update_audio_urls():
    """批量更新所有单词的音频 URL"""

    print("=" * 70)
    print("词典音频 URL 更新脚本")
    print("=" * 70)
    print()

    # 1. 获取所有单词
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

    print(f"📝 准备更新 {len(all_words)} 个单词的音频 URL...")
    print()

    # 2. 批量更新
    logger.info(f"🚀 开始更新 {len(all_words)} 个单词的音频 URL...")
    logger.info(f"📝 日志文件: {log_file}")
    logger.info("=" * 70)

    success_count = 0
    us_found = 0
    uk_found = 0
    failed_count = 0
    processed_words = []

    for i, word_data in enumerate(all_words, 1):
        word = word_data['word']

        try:
            # 获取音频 URL
            audio_urls = fetch_audio_urls_from_dictapi(word)

            # 更新数据库
            update_data = {}
            if audio_urls['us']:
                update_data['audio_url_us'] = audio_urls['us']
                us_found += 1
            if audio_urls['uk']:
                update_data['audio_url_uk'] = audio_urls['uk']
                uk_found += 1

            if update_data:
                supabase.table('dictionary_cache').update(update_data).eq('word', word).execute()
                success_count += 1

                # 记录更新的单词
                processed_words.append(word)

            # 进度报告
            if i % 100 == 0:
                logger.info(f"⏳ 进度: {i}/{len(all_words)} ({i/len(all_words)*100:.1f}%) | "
                           f"US: {us_found}, UK: {uk_found}")

            # 避免请求过快
            time.sleep(0.1)

        except Exception as e:
            logger.error(f"❌ [{i}/{len(all_words)}] {word} - 更新失败: {e}")
            failed_count += 1
            continue

    # 3. 总结
    logger.info("=" * 70)
    logger.info("📊 更新完成！")
    logger.info("=" * 70)
    logger.info(f"✅ 成功更新: {success_count} 个单词")
    logger.info(f"📵 找到 US 音频: {us_found} 个 ({us_found/len(all_words)*100:.1f}%)")
    logger.info(f"📵 找到 UK 音频: {uk_found} 个 ({uk_found/len(all_words)*100:.1f}%)")
    logger.info(f"❌ 失败: {failed_count} 个")
    logger.info("=" * 70)

    # 4. 验证几个单词
    print("\n🔍 验证更新结果...")
    test_words = ['jail', 'hello', 'world']

    for test_word in test_words:
        result = supabase.table('dictionary_cache').select('word, audio_url_us, audio_url_uk').eq('word', test_word).execute()
        if result.data:
            item = result.data[0]
            print(f'\n✅ {test_word}:')
            if item.get('audio_url_us'):
                print(f'  US: {item["audio_url_us"]}')
            else:
                print(f'  US: ❌ 未找到')
            if item.get('audio_url_uk'):
                print(f'  UK: {item["audio_url_uk"]}')
            else:
                print(f'  UK: ❌ 未找到')

    print("\n🎉 音频 URL 更新完成！")


if __name__ == '__main__':
    update_audio_urls()
