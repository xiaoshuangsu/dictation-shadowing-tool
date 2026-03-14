#!/usr/bin/env python3
"""
重新转录音频文件，修复时间戳问题

用法：
python scripts/retranscribe_audio.py "empty-your-mind"
"""

import sys
import os
import json
import requests
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.supabase.client import supabase


def get_cdn_url(relative_path: str) -> str:
    """获取完整的 CDN URL"""
    if relative_path.startswith('http'):
        return relative_path
    return f"https://media.shadowhub.app/{relative_path}"


def retranscribe_audio(slug: str):
    """重新转录指定素材的音频"""
    print(f"🎯 开始重新转录素材: {slug}")

    # 1. 从数据库获取素材信息
    print(f"📦 从数据库获取素材信息...")
    { "data": material } = supabase.table('materials').select('*').eq('title', 'Empty Your Mind - A Powerful Motivational Story for Your Life').single()

    if not material:
        print(f"❌ 错误：找不到素材")
        return

    print(f"✅ 找到素材: {material['title']}")
    print(f"   音频路径: {material['audio_path']}")
    print(f"   视频: {material.get('video_path', 'N/A')}")
    print(f"   时长: {material.get('duration', 'N/A')}")

    # 2. 下载音频文件
    audio_url = get_cdn_url(material['audio_path'])
    audio_filename = f"/tmp/{slug}.mp3"

    print(f"⬇️  下载音频文件...")
    print(f"   URL: {audio_url}")

    response = requests.get(audio_url)
    response.raise_for_status()

    with open(audio_filename, 'wb') as f:
        f.write(response.content)

    print(f"✅ 音频已保存: {audio_filename} ({len(response.content) / 1024 / 1024:.1f} MB)")

    # 3. 使用 Whisper 转录
    print(f"🎙️  开始 Whisper 转录...")
    print(f"   这可能需要几分钟，请耐心等待...")

    import subprocess

    # 调用 Whisper 转录脚本（使用现有的 watch-media 脚本逻辑）
    cmd = [
        'python',
        'scripts/transcribe.py',
        audio_filename,
        '--output', f'/tmp/{slug}_transcript.json'
    ]

    print(f"   执行命令: {' '.join(cmd)}")

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"❌ Whisper 转录失败:")
        print(f"   错误输出: {result.stderr}")
        return

    print(f"✅ Whisper 转录完成")

    # 4. 读取生成的转录文件
    transcript_file = f"/tmp/{slug}_transcript.json"

    with open(transcript_file, 'r') as f:
        transcript_data = json.load(f)

    print(f"✅ 已读取转录文件，共 {len(transcript_data)} 个句子")

    # 5. 更新数据库
    print(f"💾 更新数据库...")

    { "error": update_error } = supabase.table('materials').update({
        'transcript': transcript_data
    }).eq('id', material['id']).execute()

    if update_error:
        print(f"❌ 数据库更新失败: {update_error}")
        return

    print(f"✅ 数据库更新成功！")
    print(f"   已更新 {len(transcript_data)} 个句子")

    # 6. 清理临时文件
    os.remove(audio_filename)
    os.remove(transcript_file)
    print(f"🧹 临时文件已清理")

    print(f"\n🎉 完成！素材 '{slug}' 的转录已重新生成")

    # 显示前 3 个句子的时间戳作为示例
    print(f"\n📋 前 3 个句子的新时间戳:")
    for i, sentence in enumerate(transcript_data[:3]):
        print(f"   {i+1}. [{sentence.get('startTime')} - {sentence.get('endTime')}] {sentence.get('text', '')[:50]}...")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python scripts/retranscribe_audio.py <slug>")
        print("示例: python scripts/retranscribe_audio.py empty-your-mind")
        sys.exit(1)

    slug = sys.argv[1]
    retranscribe_audio(slug)
