#!/usr/bin/env python3
"""
Audio Silence Detection Script
使用 pydub 库检测音频中的静音部分，自动切分并生成时间戳配置
"""

import json
import os
from pydub import AudioSegment
from pydub.silence import detect_nonsilent
from pathlib import Path

# 配置 ffmpeg 路径
script_dir = Path(__file__).parent
local_ffmpeg = script_dir / "ffmpeg"
if local_ffmpeg.exists():
    AudioSegment.converter = str(local_ffmpeg.absolute())
    print(f"✅ 使用本地 ffmpeg: {local_ffmpeg}")

# 配置
AUDIO_FILE = "public/learn-english-via-listening-1001.mp3"
OUTPUT_FILE = "draft_config.json"

# 音频参数
MIN_SILENCE_LEN = 500  # 最小静音长度（毫秒）
SILENCE_THRESH = -40    # 静音阈值（dBFS，负值越大越严格）
MIN_SOUND_LEN = 1000   # 最小有效声音长度（毫秒）- 小于此值忽略

def detect_segments(audio_path):
    """
    检测音频中的有效语音片段
    返回: [(start_ms, end_ms), ...] - 每个片段的起止时间（毫秒）
    """
    print(f"🎵 加载音频文件: {audio_path}")
    audio = AudioSegment.from_mp3(audio_path)

    duration_sec = len(audio) / 1000
    print(f"📊 音频总时长: {duration_sec:.1f} 秒")
    print(f"🔍 检测静音（阈值: {SILENCE_THRESH} dBFS, 最小静音: {MIN_SILENCE_LEN}ms, 最小声音: {MIN_SOUND_LEN}ms）")

    # 检测非静音片段（返回毫秒）
    nonsilent_data = detect_nonsilent(
        audio,
        min_silence_len=MIN_SILENCE_LEN,
        silence_thresh=SILENCE_THRESH,
        seek_step=100  # 搜索步长（毫秒）
    )

    print(f"✅ 检测到 {len(nonsilent_data)} 个语音片段")
    return nonsilent_data, audio

def segments_to_json(segments, audio):
    """
    将检测到的片段转换为 JSON 配置格式
    """
    result = {
        "title": "First Snowfall",
        "audio_file": "learn-english-via-listening-1001.mp3",
        "total_duration": len(audio) / 1000,
        "segments": []
    }

    for idx, (start_ms, end_ms) in enumerate(segments, 1):
        start_sec = start_ms / 1000
        end_sec = end_ms / 1000
        duration = end_sec - start_sec

        # 提取音频文本预览（可选 - 使用语音识别）
        text = f"[Segment {idx}] ({duration:.1f}s)"

        result["segments"].append({
            "id": idx,
            "start": round(start_sec, 1),
            "end": round(end_sec, 1),
            "duration": round(duration, 1),
            "text": text,  # 需要人工填写或使用语音识别
            "start_ms": start_ms,
            "end_ms": end_ms
        })

        print(f"  片段 {idx}: {start_sec:.1f}s - {end_sec:.1f}s (时长: {duration:.1f}s)")

    return result

def save_json(data, output_file):
    """保存 JSON 配置文件"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n💾 配置已保存到: {output_file}")

def main():
    """主函数"""
    print("=" * 60)
    print("🎙️  音频静音检测与切分工具")
    print("=" * 60)

    # 检查音频文件
    audio_path = Path(AUDIO_FILE)
    if not audio_path.exists():
        print(f"❌ 错误: 找不到音频文件 '{AUDIO_FILE}'")
        print(f"   请确保文件在项目根目录的 public/ 文件夹中")
        return

    # 检测音频片段
    segments, audio = detect_segments(audio_path)

    if not segments:
        print("⚠️  未检测到任何语音片段，请调整参数")
        return

    # 过滤掉太短的片段
    filtered_segments = [
        (start, end) for start, end in segments
        if (end - start) >= MIN_SOUND_LEN
    ]

    if len(filtered_segments) < len(segments):
        print(f"🔧 过滤了 {len(segments) - len(filtered_segments)} 个太短的片段")

    # 生成 JSON 配置
    config = segments_to_json(filtered_segments, audio)

    # 添加统计信息
    config["stats"] = {
        "total_segments": len(filtered_segments),
        "total_duration": config["total_duration"],
        "avg_segment_duration": sum(
            s["end"] - s["start"] for s in config["segments"]
        ) / len(config["segments"])
    }

    # 保存配置
    save_json(config, OUTPUT_FILE)

    print("\n📋 下一步:")
    print("   1. 编辑 draft_config.json")
    print("   2. 为每个片段填写正确的 'text' 内容")
    print("   3. 微调 'start' 和 'end' 时间戳")
    print("   4. 将数据复制到 src/app/page.tsx 的 sampleSentences 数组")
    print("=" * 60)

if __name__ == "__main__":
    main()
