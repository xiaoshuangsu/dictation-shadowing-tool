#!/usr/bin/env python3
"""
批量重新处理 Cam 10/11/12 系列挖空（v6.1）
跳过 Cam 10 Test 2 Part 3（已处理）
"""
import os
import sys
import json
import time
from pathlib import Path
from supabase import create_client

# 添加 scripts 目录到路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入挖空脚本的函数
from reprocess_ietts_blanks import generate_blank_for_sentence

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

# Cam 10/11/12 系列的素材列表
CAM_10_11_12_MATERIALS = [
    # Cam 10
    'cam-10-academic-listening-test-1-part-1',
    'cam-10-academic-listening-test-1-part-2',
    'cam-10-academic-listening-test-1-part-3',
    'cam-10-academic-listening-test-1-part-4',
    'cam-10-academic-listening-test-2-part-1',
    'cam-10-academic-listening-test-2-part-2',
    # 'cam-10-academic-listening-test-2-part-3',  # 跳过（已处理）
    'cam-10-academic-listening-test-2-part-4',
    'cam-10-academic-listening-test-3-part-1',
    'cam-10-academic-listening-test-3-part-2',
    'cam-10-academic-listening-test-3-part-3',
    'cam-10-academic-listening-test-3-part-4',
    'cam-10-academic-listening-test-4-part-1',
    'cam-10-academic-listening-test-4-part-2',
    'cam-10-academic-listening-test-4-part-3',
    'cam-10-academic-listening-test-4-part-4',
    # Cam 11
    'cam-11-academic-listening-test-1-part-1',
    'cam-11-academic-listening-test-1-part-2',
    'cam-11-academic-listening-test-1-part-3',
    'cam-11-academic-listening-test-1-part-4',
    'cam-11-academic-listening-test-2-part-1',
    'cam-11-academic-listening-test-2-part-2',
    'cam-11-academic-listening-test-2-part-3',
    'cam-11-academic-listening-test-2-part-4',
    'cam-11-academic-listening-test-3-part-1',
    'cam-11-academic-listening-test-3-part-2',
    'cam-11-academic-listening-test-3-part-3',
    'cam-11-academic-listening-test-3-part-4',
    'cam-11-academic-listening-test-4-part-1',
    'cam-11-academic-listening-test-4-part-2',
    'cam-11-academic-listening-test-4-part-3',
    'cam-11-academic-listening-test-4-part-4',
    # Cam 12
    'cam-12-academic-listening-test-1-part-1',
    'cam-12-academic-listening-test-1-part-2',
    'cam-12-academic-listening-test-1-part-3',
    'cam-12-academic-listening-test-1-part-4',
    'cam-12-academic-listening-test-2-part-1',
    'cam-12-academic-listening-test-2-part-2',
    'cam-12-academic-listening-test-2-part-3',
    'cam-12-academic-listening-test-2-part-4',
    'cam-12-academic-listening-test-3-part-1',
    'cam-12-academic-listening-test-3-part-2',
    'cam-12-academic-listening-test-3-part-3',
    'cam-12-academic-listening-test-3-part-4',
    'cam-12-academic-listening-test-4-part-1',
    'cam-12-academic-listening-test-4-part-2',
    'cam-12-academic-listening-test-4-part-3',
    'cam-12-academic-listening-test-4-part-4',
]

def log(msg):
    """打印日志"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def process_material(slug: str) -> bool:
    """处理单个素材的挖空"""
    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        result = client.table('materials').select('*').eq('slug', slug).execute()

        if not result.data:
            log(f"  ❌ 素材不存在: {slug}")
            return False

        material = result.data[0]
        transcript = material.get('transcript')
        if isinstance(transcript, str):
            transcript = json.loads(transcript)

        log(f"  处理: {material['title']}")
        log(f"  句子数: {len(transcript)}")

        # 统计
        success_count = 0
        skip_count = 0
        weight_stats = {10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0}
        blanked_words = {}

        # 为每个句子生成挖空
        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            blank_data = generate_blank_for_sentence(sentence_text, blanked_words)

            if blank_data:
                sentence['blanks'] = [blank_data]

                # 更新全局计数
                word_lower = blank_data['word'].lower()
                blanked_words[word_lower] = blanked_words.get(word_lower, 0) + 1

                # 统计权重
                weight = blank_data.get('weight', 0)
                if weight in weight_stats:
                    weight_stats[weight] += 1

                success_count += 1
            else:
                sentence['blanks'] = []
                skip_count += 1

            if (i + 1) % 5 == 0:
                log(f"    进度: {i+1}/{len(transcript)}")

            time.sleep(0.5)

        log(f"  ✓ 完成: 成功 {success_count}, 跳过 {skip_count}")
        log(f"  权重分布: W10={weight_stats[10]}, W9={weight_stats[9]}, W8={weight_stats[8]}, W7={weight_stats[7]}, W6={weight_stats[6]}, W5={weight_stats[5]}")

        # 保存到数据库
        client.table('materials').update({
            'transcript': transcript
        }).eq('slug', slug).execute()

        log(f"  ✅ 已保存")
        return True

    except Exception as e:
        log(f"  ❌ 失败: {e}")
        import traceback
        traceback.print_exc()
        return False

# 主程序
if __name__ == '__main__':
    log("=" * 70)
    log("开始批量挖空: Cam 10/11/12 系列（v6.1）")
    log("=" * 70)
    log(f"素材数量: {len(CAM_10_11_12_MATERIALS)}")
    log(f"预计耗时: {len(CAM_10_11_12_MATERIALS) * 30 / 60:.1f} 分钟")
    log(f"跳过: cam-10-academic-listening-test-2-part-3（已处理）")
    log("")

    success_count = 0
    fail_count = 0

    for i, slug in enumerate(CAM_10_11_12_MATERIALS):
        log(f"[{i+1}/{len(CAM_10_11_12_MATERIALS)}] {slug}")
        success = process_material(slug)
        time.sleep(1)  # 素材之间延迟 1 秒

        if success:
            success_count += 1
        else:
            fail_count += 1

    log()
    log("=" * 70)
    log(f"批量挖空完成!")
    log(f"  成功: {success_count}")
    log(f"  失败: {fail_count}")
    log("=" * 70)
