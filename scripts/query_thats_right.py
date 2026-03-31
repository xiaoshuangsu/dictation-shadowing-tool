#!/usr/bin/env python3
"""
查询 Cam 13 中 "That's right, which isn't great." 的实际 blanks
"""
import os
import json
from pathlib import Path
from supabase import create_client

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

result = supabase.table('materials').select('transcript').eq('slug', 'cam-13-academic-listening-test-4-part-1').execute()

if result.data:
    material = result.data[0]
    transcript = material['transcript']

    if isinstance(transcript, str):
        transcript = json.loads(transcript)

    # 找到目标句子
    for i, sentence in enumerate(transcript):
        text = sentence.get('text', '')
        if "That's right" in text:
            print(f"找到句子（第{i+1}句）:")
            print(f"  text: {text}")
            print()

            blanks = sentence.get('blanks')
            if blanks and len(blanks) > 0:
                blank = blanks[0]
                print(f"  blanks:")
                print(f"    word: {blank.get('word')}")
                print(f"    index: {blank.get('index')}")
                print(f"    weight: {blank.get('weight')}")
                print()

                # 验证
                words = text.split(' ')
                print(f"  验证:")
                print(f"    words[{blank.get('index')}] = '{words[blank.get('index')]}'")
                print(f"    匹配: {'✅ 是' if words[blank.get('index')] == blank.get('word') or words[blank.get('index')].startswith(blank.get('word')) else '❌ 否'}")
            else:
                print(f"  blanks: (空)")

            print()
            print(f"  分析结论:")
            print(f"    如果 blanks.word = '{blank.get('word')}'")
            print(f"    则挖空位置是第 {blank.get('index')} 个词")
            break
else:
    print("查询失败")
