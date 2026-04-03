#!/usr/bin/env python3
"""
修复 YouTube 素材句子紧贴问题

问题：所有句子间隔为 0.000 秒，导致音频无缝衔接，播放时"念多了"
解决：强制在每句之间添加 200ms 间隔（通过减少当前句 endTime）
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
from typing import List, Dict, Tuple

# 加载环境变量
env_path = Path(__file__).parent.parent / '.env.local'
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# 配置参数
SENTENCE_GAP = 0.2  # 句间间隔（秒）
MIN_DURATION = 0.2  # 最小句子时长（秒）


def log(msg: str):
    print(f"[{msg}]")


def fix_tight_sentences(transcript: List[Dict]) -> Tuple[List[Dict], int]:
    """
    修复紧贴的句子时间戳

    策略：从后往前遍历，确保每句之间至少有 SENTENCE_GAP 间隔
    """
    if len(transcript) < 2:
        return transcript, 0

    fixed = []
    fixes = 0

    # 从后往前处理
    for i in range(len(transcript) - 1, -1, -1):
        sentence = transcript[i].copy()

        if i < len(transcript) - 1:
            # 不是最后一句，检查与下一句的间隔
            current_end = sentence['endTime']
            next_start = fixed[-1]['startTime']  # 已修正的下一句开始时间

            # 计算实际间隔
            gap = next_start - current_end

            if gap < SENTENCE_GAP:
                # 需要修正：减少当前句的结束时间
                new_end = next_start - SENTENCE_GAP

                # 确保不会导致句子太短
                if new_end - sentence['startTime'] >= MIN_DURATION:
                    sentence['endTime'] = round(new_end, 2)
                    fixes += 1
                else:
                    # 句子太短，只能减少到最小时长
                    sentence['endTime'] = round(sentence['startTime'] + MIN_DURATION, 2)
                    fixes += 1

        fixed.append(sentence)

    # 反转回来（因为是从后往前处理的）
    fixed.reverse()

    return fixed, fixes


def scan_and_fix(limit: int = None, youtube_id: str = None, dry_run: bool = False):
    """
    扫描并修复素材

    Args:
        limit: 限制处理的素材数量
        youtube_id: 只处理指定的 YouTube ID
        dry_run: 只显示问题，不实际修复
    """
    log("开始扫描...")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 构建查询
    query = supabase.table('materials').select('*').eq('source_type', 'youtube')

    if youtube_id:
        query = query.eq('youtube_id', youtube_id)

    if limit:
        query = query.limit(limit)

    result = query.execute()

    if not result.data:
        log("没有找到素材")
        return

    total = len(result.data)
    log(f"找到 {total} 个 YouTube 素材\n")

    total_fixes = 0
    fixed_count = 0

    for i, material in enumerate(result.data, 1):
        material_id = material['id']
        yt_id = material['youtube_id']
        title = material['title'][:50] + '...' if len(material['title']) > 50 else material['title']
        transcript = material.get('transcript', [])

        if not transcript or len(transcript) < 2:
            continue

        # 检查是否需要修复
        needs_fix = False
        for j in range(len(transcript) - 1):
            gap = transcript[j + 1]['startTime'] - transcript[j]['endTime']
            if gap < SENTENCE_GAP:
                needs_fix = True
                break

        if needs_fix:
            fixed_transcript, fixes = fix_tight_sentences(transcript)

            if fixes > 0:
                log(f"[{i}/{total}] {title}")
                log(f"         YouTube ID: {yt_id}")
                log(f"         修复了 {fixes} 个时间戳")

                # 显示修复示例
                for k in range(min(3, len(transcript) - 1)):
                    old_gap = transcript[k + 1]['startTime'] - transcript[k]['endTime']
                    new_gap = fixed_transcript[k + 1]['startTime'] - fixed_transcript[k]['endTime']
                    if old_gap != new_gap:
                        log(f"           句子 {k+1}: 间隔 {old_gap:.3f}s → {new_gap:.3f}s")

                if not dry_run:
                    try:
                        supabase.table('materials').update({
                            'transcript': fixed_transcript
                        }).eq('id', material_id).execute()
                        log(f"         ✅ 已更新\n")
                    except Exception as e:
                        log(f"         ❌ 更新失败: {e}\n")
                else:
                    log(f"         [DRY RUN] 跳过更新\n")

                total_fixes += fixes
                fixed_count += 1
        else:
            if i % 20 == 0:
                log(f"[{i}/{total}] 检查: {title} (无需修复)")

    log("=" * 60)
    log(f"完成！")
    log(f"  总素材数: {total}")
    log(f"  需要修复: {fixed_count}")
    log(f"  总修复数: {total_fixes}")
    if dry_run:
        log(f"  [DRY RUN 模式] 未实际修改数据库")
    log("=" * 60)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='修复 YouTube 素材句子紧贴问题')
    parser.add_argument('--limit', type=int, help='限制处理的素材数量')
    parser.add_argument('--youtube-id', type=str, help='只处理指定的 YouTube ID')
    parser.add_argument('--dry-run', action='store_true', help='只显示问题，不实际修复')

    args = parser.parse_args()

    scan_and_fix(limit=args.limit, youtube_id=args.youtube_id, dry_run=args.dry_run)
