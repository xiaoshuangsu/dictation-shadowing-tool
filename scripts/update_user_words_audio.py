#!/usr/bin/env python3
"""
快速更新用户生词本中单词的音频 URL

优先更新用户生词本中的单词，以便立即测试
"""

import os
import sys
import time
import requests
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    print("❌ 错误: 未安装 supabase 包")
    sys.exit(1)

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# 创建 Supabase 客户端
supabase = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)


def fetch_audio_urls(word: str):
    """从 dictionaryapi.dev 获取音频 URL"""
    try:
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
        print(f"❌ 获取 {word} 音频失败: {e}")
        return None


def main():
    print("=" * 70)
    print("快速更新用户生词本音频 URL")
    print("=" * 70)
    print()

    # 1. 获取用户生词本中的单词
    print("🔍 正在获取生词本单词...")
    user_words_result = supabase.table('user_words').select('word').execute()

    if not user_words_result.data:
        print("❌ 生词本为空")
        return

    words = [w['word'] for w in user_words_result.data]
    print(f"✅ 找到 {len(words)} 个单词: {', '.join(words)}")
    print()

    # 2. 逐个更新
    for i, word in enumerate(words, 1):
        print(f"[{i}/{len(words)}] 正在更新 {word}...")

        # 获取音频 URL
        audio_urls = fetch_audio_urls(word)

        if audio_urls:
            # 更新数据库
            update_data = {}
            if audio_urls['us']:
                update_data['audio_url_us'] = audio_urls['us']
                print(f"  ✅ US: {audio_urls['us']}")
            if audio_urls['uk']:
                update_data['audio_url_uk'] = audio_urls['uk']
                print(f"  ✅ UK: {audio_urls['uk']}")

            if update_data:
                supabase.table('dictionary_cache').update(update_data).eq('word', word).execute()
                print(f"  ✅ 已更新到数据库")
            else:
                print(f"  ⚠️  未找到音频 URL")
        else:
            print(f"  ❌ 获取音频失败")

        print()

        # 避免请求过快
        time.sleep(0.5)

    # 3. 验证
    print("=" * 70)
    print("🔍 验证更新结果:")
    print("=" * 70)

    for word in words:
        result = supabase.table('dictionary_cache').select(
            'word, audio_url_us, audio_url_uk'
        ).eq('word', word).execute()

        if result.data:
            item = result.data[0]
            print(f"\n{word}:")
            us = item.get('audio_url_us')
            uk = item.get('audio_url_uk')

            if us and 'dictionaryapi.dev' in us:
                print(f"  ✅ US: {us}")
            else:
                print(f"  ⚠️  US: {us or 'null'}")

            if uk and 'dictionaryapi.dev' in uk:
                print(f"  ✅ UK: {uk}")
            else:
                print(f"  ⚠️  UK: {uk or 'null'}")

    print("\n" + "=" * 70)
    print("🎉 更新完成！请强制刷新浏览器测试")
    print("=" * 70)


if __name__ == '__main__':
    main()
