#!/usr/bin/env python3
"""
音频自动识别脚本 - 使用 OpenAI Whisper
自动识别音频中的文本并生成完整的时间戳配置
"""

import json
import subprocess
import sys
from pathlib import Path

# 配置
AUDIO_FILE = "public/learn-english-via-listening-1001.mp3"
OUTPUT_FILE = "draft_config.json"
MODEL_SIZE = "base"  # 可选: tiny, base, small, medium, large

def check_whisper():
    """检查 whisper 是否安装"""
    try:
        import whisper
        print(f"✅ Whisper 已安装 (版本: {whisper.__version__})")
        return True
    except ImportError:
        print("❌ Whisper 未安装")
        print("\n请运行以下命令安装 Whisper:")
        print("\n  pip3 install openai-whisper\n")
        print("或者运行:")
        print("\n  pip3 install openai-whisper --cache-dir /tmp/pip-cache\n")
        return False

def transcribe_audio(audio_path, model_size="base"):
    """
    使用 Whisper 转录音频
    返回: segments with timestamps
    """
    import whisper
    import os

    print(f"🎙️  加载 Whisper 模型 ({model_size})...")
    print("⏳ 首次使用会自动下载模型（约 150MB for base model）")

    model = whisper.load_model(model_size)

    print(f"🎵 转录音频: {audio_path}")

    # Set ffmpeg path to local binary
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ffmpeg_path = os.path.join(script_dir, "ffmpeg")
    if os.path.exists(ffmpeg_path):
        os.environ["PATH"] = os.path.dirname(ffmpeg_path) + os.pathsep + os.environ.get("PATH", "")
        print(f"🔧 使用本地 ffmpeg: {ffmpeg_path}")

    audio = whisper.load_audio(audio_path)

    print("🔍 识别中...")
    result = model.transcribe(
        audio,
        language="en",  # 强制英语
        word_timestamps=True,  # 获取词级时间戳
        fp16=False  # 提高精度
    )

    return result

def segments_to_config(result):
    """
    将 Whisper 的输出转换为配置格式
    """
    segments_data = []

    # 从 segments 提取句子级时间戳
    if "segments" in result:
        for idx, segment in enumerate(result["segments"], 1):
            text = segment["text"].strip()
            start = segment["start"]
            end = segment["end"]

            segments_data.append({
                "id": idx,
                "start": round(start, 1),
                "end": round(end, 1),
                "text": text
            })

    return segments_data

def save_config(config, output_file):
    """保存配置到 JSON"""
    full_config = {
        "title": "First Snowfall",
        "audio_file": "learn-english-via-listening-1001.mp3",
        "segments": config,
        "total_duration": config[-1]["end"] if config else 0
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(full_config, f, ensure_ascii=False, indent=2)

    return full_config

def generate_sample_sentences(config):
    """生成可直接使用的 sampleSentences 代码"""
    print("\n" + "="*60)
    print("✨ 生成 sampleSentences 代码")
    print("="*60)

    print("\n// 复制以下代码到 src/app/page.tsx:\n")
    print("const sampleSentences = [")
    for seg in config["segments"]:
        # 转义文本中的引号
        text = seg["text"].replace('"', '\\"')
        print(f'  {{ id: {seg["id"]}, text: "{text}", startTime: {seg["start"]}, endTime: {seg["end"]} }},')
    print("]")

def main():
    print("="*60)
    print("🎙️  音频自动识别工具 (Whisper)")
    print("="*60)

    # 检查音频文件
    audio_path = Path(AUDIO_FILE)
    if not audio_path.exists():
        print(f"❌ 错误: 找不到音频文件 '{AUDIO_FILE}'")
        return

    # 检查 whisper
    if not check_whisper():
        return

    # 转录
    try:
        result = transcribe_audio(str(audio_path), MODEL_SIZE)

        # 转换为配置
        config = segments_to_config(result)

        print(f"\n✅ 识别完成！检测到 {len(config)} 个片段")

        # 显示前几个片段
        print("\n📋 识别结果预览:")
        for seg in config[:5]:
            print(f"  {seg['id']}: {seg['start']}s - {seg['end']}s")
            print(f"      \"{seg['text']}\"")

        if len(config) > 5:
            print(f"  ... (共 {len(config)} 个片段)")

        # 保存配置
        save_config(config, OUTPUT_FILE)
        print(f"\n💾 配置已保存到: {OUTPUT_FILE}")

        # 生成 sampleSentences 代码
        generate_sample_sentences({"segments": config})

        print("\n📝 下一步:")
        print("   1. 复制上面的代码到 src/app/page.tsx")
        print("   2. 刷新浏览器测试")
        print("   3. 如需微调，编辑 draft_config.json 后重新运行")

    except Exception as e:
        print(f"\n❌ 识别失败: {e}")
        print("\n可能的原因:")
        print("  - 音频文件损坏")
        print("  - 内存不足")
        print("  - 模型下载失败")

if __name__ == "__main__":
    main()
