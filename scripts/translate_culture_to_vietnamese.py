#!/usr/bin/env python3
"""
批量翻译文化历史类素材为越南语（正式叙述风格）
用词正式，叙述性客观，术语准确
"""

import os
import sys
import json
import subprocess
import time
from pathlib import Path
from typing import List, Dict

# 加载环境变量
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

from supabase import create_client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# 导入翻译模块
sys.path.insert(0, str(Path(__file__).parent))
from translate_to_vietnamese import process_material

def main():
    """批量翻译文化历史类素材"""

    # 获取文化历史类素材
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # 获取文化历史分类素材
    result = client.table('materials').select('*').eq('category', '文化历史').execute()

    culture_materials = result.data

    print("="*100)
    print("🏛️ 批量翻译文化历史类素材为越南语（正式叙述风格）")
    print("="*100)
    print(f"\n📊 总素材数: {len(culture_materials)}")
    print(f"📝 翻译风格: 文化历史（正式叙述 + 客观准确 + 术语规范）")
    print(f"📦 批次大小: 10 个素材/commit")
    print("="*100)
    print()

    if not culture_materials:
        print("❌ 未找到文化历史类素材")
        return

    stats = {
        'success': [],
        'failed': []
    }

    # 分批处理
    batch_size = 10
    total_batches = (len(culture_materials) + batch_size - 1) // batch_size

    for batch_idx in range(total_batches):
        start_idx = batch_idx * batch_size
        end_idx = min(start_idx + batch_size, len(culture_materials))
        batch = culture_materials[start_idx:end_idx]

        print(f"\n{'='*100}")
        print(f"📦 Batch {batch_idx + 1}/{total_batches} | 素材 {start_idx + 1}-{end_idx}")
        print(f"{'='*100}\n")

        for idx, material in enumerate(batch):
            current_num = start_idx + idx + 1
            material_id = material['id']
            title = material['title']

            # 获取完整素材信息
            result = client.table('materials').select('*').eq('id', material_id).execute()
            if not result.data:
                print(f"❌ [{current_num}/{len(culture_materials)}] 未找到: {title[:50]}")
                stats['failed'].append((title, 'not_found'))
                continue

            full_material = result.data[0]
            transcript = full_material.get('transcript', [])

            # 检查是否已有越南语翻译
            has_vi = False
            for sent in transcript:
                translation = sent.get('translation', {})
                if isinstance(translation, dict) and translation.get('vi'):
                    has_vi = True
                    break

            if has_vi:
                print(f"[{current_num}/{len(culture_materials)}] ⏭️  已有翻译: {title[:60]}")
                stats['success'].append(title)
                continue

            # 处理翻译（使用 culture 分类以应用正式叙述风格）
            print(f"[{current_num}/{len(culture_materials)}] 🎬 {title[:60]}")
            process_result = process_material(
                material_id,
                title,
                'culture_history',  # 强制使用文化历史分类
                full_material.get('difficulty', 'B2'),
                transcript,
                client
            )

            if process_result['success']:
                stats['success'].append(title)
                print(f"     ✅ 完成\n")
            else:
                reason = process_result['reason']
                stats['failed'].append((title, reason))
                print(f"     ❌ 失败: {reason}\n")

            time.sleep(0.5)  # 避免过快请求

        # 每批完成后 commit
        if batch_idx < total_batches - 1:  # 最后一批不需要 commit
            try:
                commit_msg = f"feat(vi): 翻译文化历史素材 batch {batch_idx + 1}/{total_batches} ({len(batch)} materials)"
                subprocess.run(['git', 'add', '.'], capture_output=True, timeout=30)
                subprocess.run(['git', 'commit', '-m', commit_msg], capture_output=True, timeout=30)
                print(f"   📦 Git commit: {commit_msg}\n")
            except Exception as e:
                print(f"   ⚠️  Git commit 失败: {str(e)[:50]}\n")

    # 最终结果汇报
    print(f"\n{'='*100}")
    print(f"✅ 翻译任务完成")
    print(f"{'='*100}")
    print(f"\n📊 统计结果:")
    print(f"\n   ✅ 成功: {len(stats['success'])} 个")
    print(f"   ❌ 失败: {len(stats['failed'])} 个")
    print(f"\n{'='*100}")

    # 保存统计结果
    with open('/tmp/culture_history_translation_stats.json', 'w') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
