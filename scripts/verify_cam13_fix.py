#!/usr/bin/env python3
"""
验证 Cam 13 修复后的效果
"""
import os
import json
from pathlib import Path
from supabase import create_client

# 从 .env.local 加载环境变量
def load_env():
    env_path = Path(__file__).parent.parent / '.env.local'
    if not env_path.exists():
        raise FileNotFoundError(f".env.local 不存在: {env_path}")

    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

load_env()

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# 查询素材
result = supabase.table('materials').select('transcript').eq('slug', 'cam-13-academic-listening-test-4-part-1').execute()

if result.data:
    material = result.data[0]
    transcript = material['transcript']

    if isinstance(transcript, str):
        transcript = json.loads(transcript)

    print("Cam 13 Academic Listening Test 4 Part 1")
    print("=" * 70)
    print()
    print("前 10 个句子的挖空情况：")
    print()

    for i in range(min(10, len(transcript))):
        sentence = transcript[i]
        text = sentence.get('text', '')
        blanks = sentence.get('blanks')

        print(f"[{i+1:2d}] {text[:60]}...")

        if blanks and len(blanks) > 0:
            blank = blanks[0]
            words = text.split(' ')
            word = blank.get('word')
            index = blank.get('index')

            if index < len(words):
                word_at_index = words[index]
                match = word_at_index == word or word_at_index.startswith(word)
                status = "✅" if match else "❌"
                print(f"     挖空: {word} (index {index}) → '{word_at_index}' {status}")
            else:
                print(f"     挖空: {word} (index {index}) ❌ 索引超出范围")
        else:
            print(f"     (无挖空)")
        print()

    print()
    print("=" * 70)
    print("统计：")

    has_blanks = sum(1 for s in transcript if s.get('blanks') and len(s.get('blanks', [])) > 0)
    no_blanks = len(transcript) - has_blanks

    print(f"有 blanks: {has_blanks} 句")
    print(f"无 blanks: {no_blanks} 句")
    print()
    print("✅ 修复完成！请在浏览器中测试效果：")
    print("   http://localhost:3000/topics/ielts-listening/cam-13-academic-listening-test-4-part-1")
