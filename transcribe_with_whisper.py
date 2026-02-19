#!/usr/bin/env python3
"""
使用 OpenAI Whisper 自动转录音频并生成句子级别时间戳

功能：
1. 从 Supabase 获取素材列表
2. 下载音频文件
3. 使用 Whisper 转录（生成句子级别时间戳）
4. 更新数据库的 transcript 字段

依赖安装：
pip install openai-whisper supabase torch

运行：
python transcribe_with_whisper.py
"""

import os
import json
import requests
from pathlib import Path
from supabase import create_client, Client
import whisper

# ==================== 配置 ====================
# Supabase 配置
SUPABASE_URL = "https://cuxotlijjnxbsirpdkgr.supabase.co"
SUPABASE_KEY = "sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm"

# Whisper 模型选择（可选: tiny, base, small, medium, large）
# tiny: 最快但精度较低 (~1GB RAM)
# base: 平衡速度和精度 (~1GB RAM)
# small: 较好的精度 (~2GB RAM)
# medium: 更好的精度 (~5GB RAM)
# large: 最佳精度 (~10GB RAM)
WHISPER_MODEL = "base"  # 推荐 base 或 small

# 音频文件临时下载目录
AUDIO_DIR = Path("./temp_audio")

# Supabase Storage 配置
STORAGE_BUCKET = "engnovate-audio"
STORAGE_URL = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}"

# ==================== 初始化 ====================
# 创建必要的目录
AUDIO_DIR.mkdir(exist_ok=True)

# 初始化 Supabase 客户端
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 60)
print("Whisper 自动转录脚本")
print("=" * 60)
print(f"Whisper 模型: {WHISPER_MODEL}")
print(f"音频目录: {AUDIO_DIR.absolute()}")
print("=" * 60)

# ==================== 加载 Whisper 模型 ====================
print(f"\n正在加载 Whisper 模型 ({WHISPER_MODEL})...")
print("提示：首次运行会自动下载模型文件（约 150MB）")
model = whisper.load_model(WISPER_MODEL)
print("✓ 模型加载完成")

# ==================== 获取素材列表 ====================
print("\n正在获取素材列表...")
response = supabase.table("materials").select("*").execute()

if not response.data:
    print("✗ 没有找到素材数据")
    exit(1)

materials = response.data
print(f"✓ 找到 {len(materials)} 个素材")

# ==================== 处理每个素材 ====================
transcription_results = []

for idx, material in enumerate(materials, 1):
    material_id = material["id"]
    title = material["title"]
    audio_path = material["audio_path"]

    # 检查是否已有转录数据
    if material.get("transcript"):
        print(f"\n[{idx}/{len(materials)}] 跳过（已有转录）: {title}")
        continue

    print(f"\n[{idx}/{len(materials)}] 正在处理: {title}")
    print(f"  音频路径: {audio_path}")

    # 下载音频文件
    audio_url = f"{STORAGE_URL}/{audio_path}"
    local_audio_path = AUDIO_DIR / Path(audio_path).name

    if not local_audio_path.exists():
        print(f"  下载音频...")
        try:
            response = requests.get(audio_url, stream=True, timeout=30)
            response.raise_for_status()

            with open(local_audio_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"  ✓ 下载完成: {local_audio_path.stat().st_size / 1024 / 1024:.1f} MB")
        except Exception as e:
            print(f"  ✗ 下载失败: {e}")
            continue
    else:
        print(f"  使用缓存: {local_audio_path.name}")

    # 转录音频
    print(f"  正在转录...")
    try:
        # 使用 Whisper 转录，生成句子级别时间戳
        result = model.transcribe(
            str(local_audio_path),
            language="en",  # 英文
            task="transcribe",
            word_timestamps=True,  # 生成词级别时间戳
            initial_prompt="This is an English learning material."  # 提示词
        )

        # 提取句子并生成时间戳
        segments = result.get("segments", [])

        if not segments:
            print(f"  ✗ 转录失败：没有生成句子")
            continue

        # 构建 transcript 数据
        transcript_data = []
        for i, seg in enumerate(segments, 1):
            transcript_data.append({
                "id": i,
                "text": seg["text"].strip(),
                "startTime": round(seg["start"], 2),
                "endTime": round(seg["end"], 2)
            })

        # 更新数据库
        print(f"  ✓ 转录完成，共 {len(transcript_data)} 个句子")
        print(f"  示例句子: {transcript_data[0]['text']}")

        # 显示前 3 个句子
        for sent in transcript_data[:3]:
            print(f"    [{sent['startTime']:.1f}s - {sent['endTime']:.1f}s] {sent['text']}")
        if len(transcript_data) > 3:
            print(f"    ... (还有 {len(transcript_data) - 3} 个句子)")

        # 更新数据库
        update_response = supabase.table("materials").update({
            "transcript": transcript_data
        }).eq("id", material_id).execute()

        if update_response.data:
            print(f"  ✓ 数据库更新完成")
            transcription_results.append({
                "id": material_id,
                "title": title,
                "sentences": len(transcript_data)
            })
        else:
            print(f"  ✗ 数据库更新失败")

    except Exception as e:
        print(f"  ✗ 转录失败: {e}")
        import traceback
        traceback.print_exc()
        continue

    # 删除本地音频文件以节省空间
    try:
        local_audio_path.unlink()
        print(f"  清理缓存文件")
    except:
        pass

# ==================== 总结 ====================
print("\n" + "=" * 60)
print("转录完成！")
print("=" * 60)
print(f"成功处理: {len(transcription_results)} 个素材")

if transcription_results:
    print("\n转录结果:")
    for result in transcription_results:
        print(f"  - {result['title']}: {result['sentences']} 个句子")

print("\n下一步:")
print("1. 访问 https://supabase.com/dashboard 查看转录数据")
print("2. 在素材库页面测试分句功能")
print("3. 如需修正转录文本，可以在数据库中直接编辑")
