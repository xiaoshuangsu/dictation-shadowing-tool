#!/usr/bin/env python3
"""
使用 Edge TTS 为单词生成音频
"""

import asyncio
import json
import edge_tts
import os
from pathlib import Path

# 输入和输出目录
INPUT_FILE = '/Users/a/dictation/oxford_test.json'
OUTPUT_DIR = Path('/Users/a/dictation/tmp/word_audio')
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)


async def generate_audio_for_word(word_data: str) -> str:
    """为单个单词生成音频"""
    word = word_data['word']
    output_file = OUTPUT_DIR / f"{word}.mp3"

    print(f"  🔊 生成音频: {word}")

    try:
        # 使用 Edge TTS 生成音频
        communicate = edge_tts.Communicate(text=word, voice="en-US-GuyNeural")

        # 保存音频到文件
        await communicate.save(str(output_file))

        # 检查文件是否生成
        if output_file.exists():
            file_size = output_file.stat().st_size
            print(f"    ✅ 成功: {output_file} ({file_size} bytes)")
            return str(output_file)
        else:
            print(f"    ❌ 失败: 文件未生成")
            return None

    except Exception as e:
        print(f"    ❌ 错误: {e}")
        return None


async def main():
    print("=" * 70)
    print("Edge TTS 音频生成测试")
    print("=" * 70)
    print()

    # 读取单词数据
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        words = json.load(f)

    print(f"📖 读取到 {len(words)} 个单词")
    print()

    # 为每个单词生成音频
    for i, word_data in enumerate(words, 1):
        print(f"[{i}/{len(words)}] {word_data['word']}")
        audio_file = await generate_audio_for_word(word_data)

        if audio_file:
            word_data['audio_file'] = audio_file

        # 短暂延迟，避免过快调用
        await asyncio.sleep(0.5)

    # 更新 JSON 文件
    output_json = '/Users/a/dictation/oxford_test_with_audio.json'
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(words, f, indent=2, ensure_ascii=False)

    print()
    print("=" * 70)
    print(f"✅ 完成！")
    print(f"📁 音频文件: {OUTPUT_DIR}")
    print(f"📄 更新的 JSON: {output_json}")
    print("=" * 70)

    # 统计
    success_count = sum(1 for w in words if w.get('audio_file'))
    print()
    print(f"📊 统计:")
    print(f"  - 总单词: {len(words)}")
    print(f"  - 成功: {success_count}")
    print(f"  - 失败: {len(words) - success_count}")


if __name__ == '__main__':
    asyncio.run(main())
