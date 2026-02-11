#!/usr/bin/env python3
"""
基于固定间隔切分音频 - 适用于连续录音
"""

import json
from pathlib import Path

# 配置
AUDIO_FILE = "public/learn-english-via-listening-1001.mp3"
OUTPUT_FILE = "draft_config.json"

# 切分参数
SEGMENT_DURATION = 4.0  # 每段时长（秒）
MIN_SEGMENT_DURATION = 2.0  # 最小段落长度
OVERLAP = 0.0  # 重叠时间

def generate_fixed_intervals(total_duration):
    """
    生成固定间隔的时间戳
    """
    segments = []
    current_time = 0.0
    segment_id = 1

    while current_time < total_duration - MIN_SEGMENT_DURATION:
        end_time = min(current_time + SEGMENT_DURATION, total_duration)

        if end_time - current_time >= MIN_SEGMENT_DURATION:
            segments.append({
                "id": segment_id,
                "start": round(current_time, 1),
                "end": round(end_time, 1),
                "duration": round(end_time - current_time, 1),
                "text": f"[{segment_id}] {round(current_time, 1)}s-{round(end_time, 1)}s",
            })
            segment_id += 1

        current_time = end_time - OVERLAP

    return segments

def main():
    print("=" * 60)
    print("🎙️  固定间隔音频切分工具")
    print("=" * 60)
    print(f"📊 每段时长: {SEGMENT_DURATION}秒")
    print(f"📊 最小段落: {MIN_SEGMENT_DURATION}秒")

    # 音频时长（使用 ffmpeg 获取）
    import subprocess
    import re
    FFMPEG_PATH = "/Users/a/dictation/ffmpeg"

    cmd = [FFMPEG_PATH, "-i", AUDIO_FILE, "-f", "null", "-"]
    result = subprocess.run(cmd, capture_output=True, text=True)

    total_duration = 0
    for line in result.stderr.split('\n'):
        if 'Duration:' in line:
            match = re.search(r'Duration: (\d+):(\d+):(\d+)\.(\d+)', line)
            if match:
                hours = int(match.group(1))
                minutes = int(match.group(2))
                seconds = int(match.group(3))
                milliseconds = int(match.group(4))
                total_duration = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
                break

    print(f"🎵 音频总时长: {total_duration:.1f} 秒")

    # 生成时间戳
    segments = generate_fixed_intervals(total_duration)
    print(f"✅ 切分出 {len(segments)} 个片段")

    # 生成配置
    config = {
        "title": "First Snowfall",
        "audio_file": "learn-english-via-listening-1001.mp3",
        "total_duration": round(total_duration, 1),
        "segments": segments
    }

    # 保存
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    print(f"\n💾 配置已保存到: {OUTPUT_FILE}")
    print(f"\n📋 时间戳预览:")
    for seg in segments[:5]:
        print(f"   {seg['id']}: {seg['start']}s - {seg['end']}s")
    if len(segments) > 5:
        print(f"   ... (共 {len(segments)} 个片段)")
    print("\n📝 下一步:")
    print("   1. 编辑 draft_config.json")
    print("   2. 填写每个片段的 'text' 内容")
    print("   3. 根据实际音频调整 'start' 和 'end' 时间戳")
    print("   4. 转换为 sampleSentences 格式并复制到 src/app/page.tsx")

if __name__ == "__main__":
    main()
