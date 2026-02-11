#!/usr/bin/env python3
"""
简化的音频静音检测脚本 - 使用 ffmpeg silencedetect 滤镜
"""

import json
import subprocess
import re
from pathlib import Path

# 配置
AUDIO_FILE = "public/learn-english-via-listening-1001.mp3"
OUTPUT_FILE = "draft_config.json"
FFMPEG_PATH = "/Users/a/dictation/ffmpeg"

def get_silence_timestamps(audio_path):
    """
    使用 ffmpeg 的 silencedetect 滤镜检测静音时间戳
    """
    cmd = [
        FFMPEG_PATH,
        "-i", audio_path,
        "-af", "silencedetect=noise=-35dB:duration=0.3",  # 更敏感的参数
        "-f", "null",
        "-"
    ]

    print(f"🔍 检测静音...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    # 解析输出
    silence_start = None
    silence_end = None
    silence_segments = []

    for line in result.stderr.split('\n'):
        if 'silence_start' in line:
            match = re.search(r'silence_start=([\d.]+)', line)
            if match:
                silence_start = float(match.group(1))
        elif 'silence_end' in line:
            match = re.search(r'silence_end=([\d.]+)', line)
            if match:
                silence_end = float(match.group(1))
                if silence_start is not None:
                    silence_segments.append((silence_start, silence_end))
                    silence_start = None

    return silence_segments

def get_audio_duration(audio_path):
    """获取音频总时长"""
    cmd = [
        FFMPEG_PATH,
        "-i", audio_path,
        "-f", "null",
        "-"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    # 解析 Duration (格式: HH:MM:SS.ms)
    for line in result.stderr.split('\n'):
        if 'Duration:' in line:
            match = re.search(r'Duration: (\d+):(\d+):(\d+)\.(\d+)', line)
            if match:
                hours = int(match.group(1))
                minutes = int(match.group(2))
                seconds = int(match.group(3))
                milliseconds = int(match.group(4))
                return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
    return 0

def segments_from_silence(silence_segments, total_duration):
    """
    从静音片段推断语音片段
    """
    segments = []
    prev_end = 0

    for start, end in silence_segments:
        # 静音之前的语音段
        if start - prev_end > 0.5:  # 至少0.5秒
            segments.append((prev_end, start))
        prev_end = end

    # 最后一段语音
    if total_duration - prev_end > 1.0:
        segments.append((prev_end, total_duration))

    return segments

def generate_draft_config(segments, total_duration):
    """生成配置文件"""
    config = {
        "title": "First Snowfall",
        "audio_file": "learn-english-via-listening-1001.mp3",
        "total_duration": round(total_duration, 1),
        "segments": []
    }

    for idx, (start, end) in enumerate(segments, 1):
        config["segments"].append({
            "id": idx,
            "start": round(start, 1),
            "end": round(end, 1),
            "duration": round(end - start, 1),
            "text": f"[Segment {idx}] - {round(end - start, 1)}s",
            "start_ms": int(start * 1000),
            "end_ms": int(end * 1000)
        })

        print(f"  片段 {idx}: {round(start, 1)}s - {round(end, 1)}s (时长: {round(end - start, 1)}s)")

    return config

def save_json(data, output_file):
    """保存 JSON"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n💾 配置已保存到: {output_file}")

def main():
    print("=" * 60)
    print("🎙️  音频静音检测与切分工具 (简化版)")
    print("=" * 60)

    audio_path = Path(AUDIO_FILE)
    if not audio_path.exists():
        print(f"❌ 错误: 找不到音频文件 '{AUDIO_FILE}'")
        return

    print(f"🎵 加载音频: {AUDIO_FILE}")

    # 获取音频时长
    total_duration = get_audio_duration(str(audio_path))
    print(f"📊 音频总时长: {total_duration:.1f} 秒")

    # 检测静音
    silence_segments = get_silence_timestamps(str(audio_path))
    print(f"✅ 检测到 {len(silence_segments)} 个静音段")

    # 推断语音片段
    segments = segments_from_silence(silence_segments, total_duration)
    print(f"🎯 推断出 {len(segments)} 个语音片段")

    if segments:
        config = generate_draft_config(segments, total_duration)
        save_json(config, OUTPUT_FILE)

        print("\n📋 下一步:")
        print("   1. 编辑 draft_config.json")
        print("   2. 填写每个片段的 'text' 内容")
        print("   3. 微调 'start' 和 'end' 时间戳")
        print("   4. 复制到 src/app/page.tsx 的 sampleSentences")
    else:
        print("⚠️  未检测到足够的语音片段，请调整参数")

if __name__ == "__main__":
    main()
