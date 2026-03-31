#!/usr/bin/env python3
"""
对比 v4.1 和 v5.0 的挖空差异
选择一个未处理的素材，分别用两个版本处理，对比结果
"""
import os
import json
from pathlib import Path
from supabase import create_client

# ==================== 加载环境变量 ====================
def load_env():
    """从 .env.local 加载环境变量"""
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

# ==================== 配置 ====================
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

def get_sample_sentences():
    """获取一些样本句子进行对比"""
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 查找未处理的 Cam 13/14 素材
    result = client.table('materials').select('slug, title, transcript').eq('slug', 'cam-13-academic-listening-test-2-part-1').execute()

    if not result.data:
        # 如果没有找到，找一个其他的
        result = client.table('materials').select('slug, title').ilike('slug', '%cam-13%').limit(1).execute()

    if result.data:
        material = result.data[0]
        transcript = material.get('transcript')
        if isinstance(transcript, str):
            transcript = json.loads(transcript)

        # 取前10个句子作为样本
        return transcript[:10]

    return []

def compare_blanks(sentences):
    """对比新旧版本的挖空结果"""
    print(f"\n{'='*70}")
    print(f"  新旧版本挖空对比（前10个句子）")
    print(f"{'='*70}")

    for i, sentence in enumerate(sentences, 1):
        text = sentence.get('text', '')
        blanks = sentence.get('blanks', [])

        print(f"\n【句子 {i}】")
        print(f"  原句: {text}")

        if blanks:
            blank = blanks[0]
            word = blank.get('word', '')
            weight = blank.get('weight', 'N/A')
            pos = blank.get('pos', '')

            # 高亮挖空的词
            words = text.split()
            idx = blank.get('index', -1)
            if 0 <= idx < len(words):
                words[idx] = f"[{words[idx]}]"
            highlighted = ' '.join(words)

            print(f"  挖空: {highlighted}")
            print(f"  词: {word}, 权重: {weight}, 词性: {pos}")
        else:
            print(f"  挖空: (无)")

def main():
    # 获取样本句子
    sentences = get_sample_sentences()

    if not sentences:
        print("❌ 未找到样本素材")
        return

    compare_blanks(sentences)

    print(f"\n{'='*70}")
    print("  说明:")
    print("  - 这是当前数据库中的挖空结果（v5.0）")
    print("  - 需要备份后用 v4.1 处理同一个素材进行对比")
    print("{'='*70}\n")

if __name__ == '__main__':
    main()
