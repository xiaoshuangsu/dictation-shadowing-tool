#!/usr/bin/env python3
"""
补充词典缓存的音频 URL

功能：
- 查找所有缺少音频 URL 的单词
- 使用 Google TTS 作为兜底方案
- 批量更新数据库

使用方法：
  python scripts/backfill_audio_urls.py
"""

import os
import sys
import time
import logging
from pathlib import Path
from typing import List, Dict
from datetime import datetime

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from supabase import create_client
except ImportError:
    print("❌ 错误: 未安装 supabase 包")
    print("   请运行: pip install supabase")
    sys.exit(1)

# 配置日志
log_dir = Path(__file__).parent.parent / 'logs'
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f'backfill_audio_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'

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


def get_google_tts_url(word: str, variant: str = 'us') -> str:
    """
    生成 Google TTS 音频 URL（兜底方案）

    Args:
        word: 单词
        variant: 'us' 或 'uk'

    Returns:
        Google TTS URL
    """
    lang = 'en-us' if variant == 'us' else 'en-GB'
    return f"https://translate.google.com/translate_tts?ie=UTF-8&q={word}&tl={lang}&client=tw-ob"


def backfill_audio_urls():
    """补充缺少音频的单词"""

    print("=" * 70)
    print("词典音频补充脚本")
    print("=" * 70)
    print()

    # 1. 查询所有缺少音频的单词
    print("🔍 正在查找缺少音频的单词...")

    total_count_result = supabase.table('dictionary_cache').select('word', count='exact').execute()
    total_count = total_count_result.count

    # 分批获取所有单词
    all_words = []
    offset = 0
    batch_size = 1000

    while offset < total_count:
        batch = supabase.table('dictionary_cache').select('word, audio_url_us, audio_url_uk').range(
            offset, offset + batch_size - 1
        ).execute()
        all_words.extend(batch.data)
        if len(batch.data) < batch_size:
            break
        offset += batch_size

    # 筛选缺少音频的单词
    words_needing_audio = [
        w for w in all_words
        if not w.get('audio_url_us') and not w.get('audio_url_uk')
    ]

    print(f"✅ 总单词数: {total_count}")
    print(f"❌ 缺少音频: {len(words_needing_audio)} 个")
    print()

    if len(words_needing_audio) == 0:
        print("✅ 所有单词都已有音频，无需补充")
        return

    # 2. 批量补充音频
    logger.info(f"🚀 开始补充 {len(words_needing_audio)} 个单词的音频...")
    logger.info(f"📝 日志文件: {log_file}")
    logger.info("=" * 70)

    success_count = 0
    failed_count = 0
    batch_update_data = []

    for i, word_data in enumerate(words_needing_audio, 1):
        word = word_data['word']

        # 生成 Google TTS URL
        audio_url_us = get_google_tts_url(word, 'us')
        audio_url_uk = get_google_tts_url(word, 'uk')

        # 添加到批量更新列表
        batch_update_data.append({
            'word': word,
            'audio_url_us': audio_url_us,
            'audio_url_uk': audio_url_uk
        })

        # 每 100 个单词批量更新一次
        if len(batch_update_data) >= 100:
            try:
                for update_data in batch_update_data:
                    supabase.table('dictionary_cache').update({
                        'audio_url_us': update_data['audio_url_us'],
                        'audio_url_uk': update_data['audio_url_uk']
                    }).eq('word', update_data['word']).execute()

                success_count += len(batch_update_data)
                logger.info(f"✅ 已更新 {success_count}/{len(words_needing_audio)} 个单词")
                batch_update_data = []

                # 避免过快请求
                time.sleep(0.5)

            except Exception as e:
                logger.error(f"❌ 批量更新失败: {e}")
                failed_count += len(batch_update_data)
                batch_update_data = []

        # 进度提示
        if i % 100 == 0:
            logger.info(f"⏳ 处理进度: {i}/{len(words_needing_audio)} ({i/len(words_needing_audio)*100:.1f}%)")

    # 更新剩余的单词
    if batch_update_data:
        try:
            for update_data in batch_update_data:
                supabase.table('dictionary_cache').update({
                    'audio_url_us': update_data['audio_url_us'],
                    'audio_url_uk': update_data['audio_url_uk']
                }).eq('word', update_data['word']).execute()

            success_count += len(batch_update_data)
        except Exception as e:
            logger.error(f"❌ 最后批量更新失败: {e}")
            failed_count += len(batch_update_data)

    # 3. 总结
    logger.info("=" * 70)
    logger.info("📊 补充完成！")
    logger.info("=" * 70)
    logger.info(f"✅ 成功: {success_count} 个")
    logger.info(f"❌ 失败: {failed_count} 个")
    logger.info(f"📈 成功率: {success_count / len(words_needing_audio) * 100:.1f}%")
    logger.info("=" * 70)

    # 4. 验证结果
    print("\n🔍 验证结果...")
    updated_count_result = supabase.table('dictionary_cache').select('word', count='exact').execute()
    updated_total = updated_count_result.count

    # 重新统计有音频的单词
    all_words_updated = []
    offset = 0

    while offset < updated_total:
        batch = supabase.table('dictionary_cache').select('word, audio_url_us, audio_url_uk').range(
            offset, offset + batch_size - 1
        ).execute()
        all_words_updated.extend(batch.data)
        if len(batch.data) < batch_size:
            break
        offset += batch_size

    has_audio = sum(1 for w in all_words_updated if w.get('audio_url_us') or w.get('audio_url_uk'))
    no_audio = updated_total - has_audio

    print(f"✅ 有音频: {has_audio} 个 ({has_audio/updated_total*100:.1f}%)")
    print(f"❌ 无音频: {no_audio} 个 ({no_audio/updated_total*100:.1f}%)")
    print("\n🎉 补充完成！")


if __name__ == '__main__':
    backfill_audio_urls()
