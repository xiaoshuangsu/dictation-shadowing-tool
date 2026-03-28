#!/usr/bin/env python3
"""
分析 Cam 10 Test 2 Part 3 素材的挖空情况
"""
import os
import sys
import json
import string
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

def clean_word(word):
    """移除标点符号"""
    return word.strip(string.punctuation)

def analyze_material():
    """分析素材的挖空情况"""
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 查询素材
    slug = 'cam-10-academic-listening-test-2-part-3'
    result = client.table('materials').select('*').eq('slug', slug).execute()

    if not result.data:
        print(f"❌ 素材不存在: {slug}")
        return

    material = result.data[0]
    transcript = material.get('transcript')
    if isinstance(transcript, str):
        transcript = json.loads(transcript)

    print(f"=" * 70)
    print(f"素材: {material['title']}")
    print(f"句子总数: {len(transcript)}")
    print(f"=" * 70)
    print()

    # 统计
    total_blanks = 0
    no_blanks = 0
    index_mismatch = 0
    word_not_in_sentence = 0

    # 分析每个句子
    for i, sentence in enumerate(transcript):
        sentence_text = sentence.get('text', '')
        blanks = sentence.get('blanks', [])

        print(f"[{i+1}] {sentence_text}")

        if not blanks or len(blanks) == 0:
            no_blanks += 1
            print(f"    ⚠️  未挖空")
        else:
            total_blanks += 1
            blank = blanks[0]
            word = blank.get('word', '')
            index = blank.get('index', -1)

            # 空格分词
            words = sentence_text.split()

            # 检查 index 范围
            if index < 0 or index >= len(words):
                print(f"    ❌ index 超出范围: {index} (句子长度: {len(words)})")
                index_mismatch += 1
                continue

            # 获取 index 位置的词
            word_at_index = clean_word(words[index])

            # 检查是否匹配
            if word_at_index.lower() != word.lower():
                print(f"    ❌ 不匹配: blanks.word='{word}' 但 index={index} 位置是 '{word_at_index}'")

                # 尝试在句子中查找 word 的实际位置
                actual_index = -1
                for j, w in enumerate(words):
                    if clean_word(w).lower() == word.lower():
                        actual_index = j
                        break

                if actual_index >= 0:
                    print(f"       → 实际位置: index={actual_index}")
                else:
                    print(f"       → 单词不在句子中")
                    word_not_in_sentence += 1

                index_mismatch += 1
            else:
                print(f"    ✅ 挖空: '{word}' (index={index})")

        print()

    # 汇总
    print(f"=" * 70)
    print(f"分析汇总")
    print(f"=" * 70)
    print(f"句子总数: {len(transcript)}")
    print(f"已挖空: {total_blanks}")
    print(f"未挖空: {no_blanks}")
    print(f"挖空率: {total_blanks / len(transcript) * 100:.1f}%")
    print(f"Index 不匹配: {index_mismatch}")
    print(f"Word 不在句子中: {word_not_in_sentence}")
    print(f"=" * 70)

if __name__ == '__main__':
    analyze_material()
