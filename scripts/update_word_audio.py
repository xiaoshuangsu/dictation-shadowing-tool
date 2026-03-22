#!/usr/bin/env python3
"""
快速脚本：为 user_words 中的现有单词获取音频 URL
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://cuxotlijjnxbsirpdkgr.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

def fetch_audio_urls(word: str) -> dict:
    """获取单词的 US/UK 音频 URL"""
    audio_urls = {'us': None, 'uk': None}

    try:
        # 1. 尝试从 dictionaryapi.dev 获取
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            data = response.json()

            # 遍历所有音标
            if isinstance(data, list) and len(data) > 0:
                phonetics = data[0].get('phonetics', [])

                for phonetic in phonetics:
                    audio_url = phonetic.get('audio')

                    if audio_url:
                        # 判断是美音还是英音
                        phonetic_text = phonetic.get('text', '')
                        if not audio_urls['us'] and ('US' in phonetic_text or '-us' in audio_url):
                            audio_urls['us'] = audio_url
                        elif not audio_urls['uk'] and ('UK' in phonetic_text or '-uk' in audio_url):
                            audio_urls['uk'] = audio_url

                # 如果没有区分，使用第一个音频
                if not audio_urls['us'] and not audio_urls['uk'] and phonetics:
                    for phonetic in phonetics:
                        if phonetic.get('audio'):
                            audio_urls['us'] = phonetic['audio']
                            break

        # 2. 如果没有找到，使用 Google TTS
        if not audio_urls['us']:
            audio_urls['us'] = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q={word}&tl=en-us"
        if not audio_urls['uk']:
            audio_urls['uk'] = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q={word}&tl=en-GB"

    except Exception as e:
        print(f"  ⚠️  获取音频失败: {e}")
        # 降级到 Google TTS
        audio_urls = {
            'us': f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q={word}&tl=en-us",
            'uk': f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q={word}&tl=en-GB"
        }

    return audio_urls

def update_dictionary_cache(word: str, audio_urls: dict) -> bool:
    """更新 dictionary_cache 表的音频字段"""
    try:
        # 使用 Supabase REST API
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }

        # 先检查是否存在（word 是主键）
        check_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/dictionary_cache?word=eq.{word}&select=word",
            headers=headers
        )

        if check_response.status_code != 200:
            print(f"  ⚠️  查询失败: {check_response.status_code} - {check_response.text[:100]}")
            return False

        existing = check_response.json()

        if existing and len(existing) > 0:
            # 更新现有记录（使用 word 作为主键）
            update_response = requests.patch(
                f"{SUPABASE_URL}/rest/v1/dictionary_cache?word=eq.{word}",
                headers=headers,
                json={
                    'audio_url_us': audio_urls['us'],
                    'audio_url_uk': audio_urls['uk']
                }
            )
            if update_response.status_code != 204:
                print(f"  ⚠️  更新失败: {update_response.status_code} - {update_response.text[:100]}")
                return False
            return True

        # 插入新记录
        insert_response = requests.post(
            f"{SUPABASE_URL}/rest/v1/dictionary_cache",
            headers=headers,
            json={
                'word': word,
                'audio_url_us': audio_urls['us'],
                'audio_url_uk': audio_urls['uk']
            }
        )
        if insert_response.status_code != 201:
            print(f"  ⚠️  插入失败: {insert_response.status_code} - {insert_response.text[:100]}")
            return False
        return True

    except Exception as e:
        print(f"  ❌ 更新数据库失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("🎵 为现有单词获取音频 URL...")
    print()

    # 获取用户的单词列表（从 user_words 表）
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }

    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/user_words?select=word",
        headers=headers
    )

    if response.status_code != 200:
        print(f"❌ 获取单词列表失败: {response.status_code}")
        return

    words = [item['word'] for item in response.json()]
    print(f"📝 找到 {len(words)} 个单词")

    success_count = 0

    for i, word in enumerate(words, 1):
        print(f"[{i}/{len(words)}] 处理: {word}")

        # 获取音频 URL
        audio_urls = fetch_audio_urls(word)

        if audio_urls['us'] or audio_urls['uk']:
            # 更新数据库
            if update_dictionary_cache(word, audio_urls):
                print(f"  ✅ US: {audio_urls['us'][:50]}..." if audio_urls['us'] else "  ✅ US: Google TTS")
                print(f"  ✅ UK: {audio_urls['uk'][:50]}..." if audio_urls['uk'] else "  ✅ UK: Google TTS")
                success_count += 1
            else:
                print(f"  ❌ 更新失败")
        else:
            print(f"  ⚠️  未找到音频")

        print()

    print(f"✅ 完成！成功更新 {success_count}/{len(words)} 个单词的音频")

if __name__ == '__main__':
    main()
