#!/usr/bin/env python3
"""
存量素材时间戳重叠修复工具

功能：
1. 扫描数据库中所有 YouTube 素材
2. 检查每个素材的 transcript 时间戳
3. 修正重叠的时间戳（强制真空带）
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


def log(msg: str):
    print(f"[{msg}]")


def check_and_fix_overlap(transcript: List[Dict], min_gap: float = 0.2) -> Tuple[List[Dict], int]:
    """
    检查并修复时间戳重叠

    Args:
        transcript: 字幕数据
        min_gap: 最小间隔（秒）

    Returns:
        (修复后的 transcript, 修复次数)
    """
    if not transcript or len(transcript) < 2:
        return transcript, 0

    fixed_transcript = []
    fixes = 0

    for i, sentence in enumerate(transcript):
        new_sentence = sentence.copy()

        # 如果不是最后一句，检查是否与下一句重叠
        if i < len(transcript) - 1:
            current_end = sentence['endTime']
            next_start = transcript[i + 1]['startTime']

            # 检查是否重叠
            if current_end > next_start:
                overlap = current_end - next_start
                # 修正：将当前句结束时间改为下一句开始时间 - min_gap
                new_end = max(sentence['startTime'] + 0.2, next_start - min_gap)
                new_sentence['endTime'] = round(new_end, 2)
                fixes += 1
                log(f"   修复第 {i+1} 句重叠: {overlap:.2f}s → 新 endTime: {new_sentence['endTime']}")

        fixed_transcript.append(new_sentence)

    return fixed_transcript, fixes


def scan_materials(limit: int = None, youtube_id: str = None):
    """
    扫描并修复素材

    Args:
        limit: 限制处理的素材数量（None = 全部）
        youtube_id: 只处理指定的 YouTube ID（用于测试）
    """
    log("开始扫描数据库...")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 构建查询
    query = supabase.table('materials').select('*').eq('source_type', 'youtube')

    if youtube_id:
        query = query.eq('youtube_id', youtube_id)
        log(f"只处理视频: {youtube_id}")
    elif limit:
        query = query.limit(limit)
        log(f"限制处理数量: {limit}")

    result = query.execute()

    if not result.data:
        log("没有找到 YouTube 素材")
        return

    total = len(result.data)
    log(f"找到 {total} 个 YouTube 素材\n")

    total_fixes = 0
    fixed_count = 0

    for i, material in enumerate(result.data, 1):
        material_id = material['id']
        youtube_id = material['youtube_id']
        title = material['title'][:60] + '...' if len(material['title']) > 60 else material['title']
        transcript = material.get('transcript', [])

        if not transcript:
            continue

        # 检查并修复
        fixed_transcript, fixes = check_and_fix_overlap(transcript)

        if fixes > 0:
            log(f"[{i}/{total}] 素材: {title}")
            log(f"         YouTube ID: {youtube_id}")
            log(f"         发现并修复 {fixes} 处重叠")

            # 更新数据库
            try:
                supabase.table('materials').update({
                    'transcript': fixed_transcript
                }).eq('id', material_id).execute()
                log(f"         ✅ 已更新到数据库\n")
            except Exception as e:
                log(f"         ❌ 更新失败: {e}\n")

            total_fixes += fixes
            fixed_count += 1
        else:
            # 每 10 个报告一次进度
            if i % 10 == 0:
                log(f"[{i}/{total}] 检查完成: {title} (无重叠)")

    log("=" * 60)
    log(f"扫描完成！")
    log(f"  总素材数: {total}")
    log(f"  修复素材数: {fixed_count}")
    log(f"  总修复次数: {total_fixes}")
    log("=" * 60)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='修复 YouTube 素材时间戳重叠')
    parser.add_argument('--limit', type=int, help='限制处理的素材数量')
    parser.add_argument('--youtube-id', type=str, help='只处理指定的 YouTube ID')

    args = parser.parse_args()

    scan_materials(limit=args.limit, youtube_id=args.youtube_id)
