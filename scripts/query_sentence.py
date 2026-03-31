#!/usr/bin/env python3
"""
查询特定句子的挖空结果
"""
import os
import json
from pathlib import Path
from supabase import create_client

# 加载环境变量
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

# 连接数据库
client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# 查询素材
result = client.table('materials').select('*').eq('slug', 'cam-14-academic-listening-test-3-part-1').execute()

if not result.data:
    print("❌ 素材不存在")
else:
    material = result.data[0]
    transcript = material.get('transcript')
    if isinstance(transcript, str):
        transcript = json.loads(transcript)

    # 查找目标句子
    target_sentence = "Well, let's go for the February date then."

    print(f"🔍 查找句子: {target_sentence}\n")

    for sentence in transcript:
        text = sentence.get('text', '')
        if target_sentence.lower() in text.lower():
            blanks = sentence.get('blanks', [])
            print(f"✅ 找到句子:")
            print(f"   原句: {text}")

            if blanks:
                blank = blanks[0]
                word = blank.get('word', '')
                index = blank.get('index', -1)
                weight = blank.get('weight', 'N/A')

                # 高亮挖空的词
                words = text.split()
                if 0 <= index < len(words):
                    words[index] = f"[{words[index]}]"

                print(f"   挖空: {' '.join(words)}")
                print(f"   词: {word}")
                print(f"   位置: {index}")
                print(f"   权重: {weight}")
            else:
                print(f"   挖空: (无)")

            break
