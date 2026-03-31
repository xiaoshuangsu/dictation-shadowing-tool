#!/usr/bin/env python3
"""
分析挖空质量
检查某个素材的挖空数据，分析权重分布和具体词
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

def analyze_material_blanks(slug: str):
    """分析某个素材的挖空数据"""
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    result = client.table('materials').select('*').eq('slug', slug).execute()

    if not result.data:
        print(f"❌ 素材不存在: {slug}")
        return

    material = result.data[0]
    transcript = material.get('transcript')
    if isinstance(transcript, str):
        transcript = json.loads(transcript)

    print(f"\n{'='*70}")
    print(f"  分析素材: {material['title']}")
    print(f"  Slug: {slug}")
    print(f"{'='*70}")

    # 统计权重分布
    weight_stats = {}
    weight_examples = {}  # 每个权重的示例

    for sentence in transcript:
        blanks = sentence.get('blanks', [])
        if blanks:
            blank = blanks[0]
            word = blank.get('word', '')
            weight = blank.get('weight', 0)
            pos = blank.get('pos', '')
            text = sentence.get('text', '')

            # 统计权重
            if weight not in weight_stats:
                weight_stats[weight] = 0
                weight_examples[weight] = []
            weight_stats[weight] += 1

            # 收集示例（每个权重最多3个）
            if len(weight_examples[weight]) < 3:
                weight_examples[weight].append({
                    'word': word,
                    'text': text,
                    'pos': pos,
                    'index': blank.get('index', -1)
                })

    # 打印权重分布
    print(f"\n📊 权重分布:")
    total = sum(weight_stats.values())
    for weight in sorted(weight_stats.keys(), reverse=True):
        count = weight_stats[weight]
        percentage = (count / total * 100) if total > 0 else 0
        print(f"  W{weight}: {count} ({percentage:.1f}%)")

    # 打印每个权重的示例
    print(f"\n🔍 各权重示例:")
    for weight in sorted(weight_examples.keys(), reverse=True):
        examples = weight_examples[weight]
        print(f"\n  【权重 {weight}】共 {weight_stats[weight]} 个")
        for i, ex in enumerate(examples, 1):
            # 高亮被挖空的词
            words = ex['text'].split()
            idx = ex['index']
            if 0 <= idx < len(words):
                words[idx] = f"[{words[idx]}]"
            highlighted = ' '.join(words)
            print(f"    {i}. {highlighted}")
            print(f"       词: {ex['word']}, 词性: {ex['pos']}")

def main():
    # 分析第一个素材
    slug = 'cam-14-academic-listening-test-3-part-1'
    analyze_material_blanks(slug)

    print(f"\n{'='*70}\n")

if __name__ == '__main__':
    main()
