#!/usr/bin/env python3
"""
使用 Whisper 的 word_timestamps=True 重新生成精确的 transcript
切分规则：
1. 遇到 ?, !, . 分为一句
2. 如果单词末尾是 , 且与下一词的间隙 > 0.5s，分为一句
3. 即便没有标点，如果单词间隙 > 0.8s，分为一句
"""

import os
import sys
import requests
from pathlib import Path
from typing import List, Dict, Optional
from supabase import create_client

# 设置 ffmpeg 路径
os.environ['PATH'] = '/opt/homebrew/bin:' + os.environ.get('PATH', '')

# ==================== 配置 ====================
# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# OpenAI 配置
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://cuxotlijjnxbsirpdkgr.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def download_audio(url: str, local_path: str) -> bool:
    """下载音频文件"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        with open(local_path, 'wb') as f:
            f.write(response.content)
        return True
    except Exception as e:
        print(f"    ❌ 下载失败: {e}")
        return False

def transcribe_with_word_timestamps(audio_path: str) -> Optional[Dict]:
    """使用本地 Whisper 转录音频，获取词级时间戳"""
    try:
        import whisper

        print(f"    正在转录（使用本地 Whisper small 模型，word timestamps=True）...")
        print(f"    参数: no_speech_threshold=0.6, logprob_threshold=-1.0")
        # 使用 small 模型
        # 注意：不设置 temperature、beam_size 等参数，以保留词级标点符号
        model = whisper.load_model("small")
        result = model.transcribe(
            audio_path,
            word_timestamps=True,
            fp16=False,
            no_speech_threshold=0.6,  # 更敏感的静音检测
            logprob_threshold=-1.0,      # 禁用 logprob 过滤
        )

        print(f"    ✅ 转录成功")
        return result
    except Exception as e:
        print(f"    ❌ 转录失败: {e}")
        return None

def segment_sentences(words: List[Dict]) -> List[Dict]:
    """
    根据词级时间戳切分句子

    切分规则：
    1. 遇到 ?, !, . 分为一句
    2. 如果单词末尾是 , 且与下一词的间隙 > 0.5s，分为一句
    3. 即便没有标点，如果单词间隙 > 0.8s，分为一句
    """
    if not words:
        return []

    segments = []
    current_segment_words = []

    for i, word in enumerate(words):
        current_segment_words.append(word)

        # 获取当前单词
        current_word = word.get('word', '').strip()
        current_end = word.get('end', 0)

        # 检查是否需要切分
        should_split = False

        # 规则1: 遇到 ?, !, .
        if current_word.endswith(('.', '?', '!')):
            should_split = True

        # 规则2: 单词末尾是 , 且与下一词的间隙 > 0.5s
        elif current_word.endswith(','):
            if i + 1 < len(words):
                next_word_start = words[i + 1].get('start', 0)
                gap = next_word_start - current_end
                if gap > 0.5:
                    should_split = True

        # 规则3: 单词间隙 > 0.8s（即使没有标点）
        else:
            if i + 1 < len(words):
                next_word_start = words[i + 1].get('start', 0)
                gap = next_word_start - current_end
                if gap > 0.8:
                    should_split = True

        # 如果需要切分，创建句子
        if should_split:
            if current_segment_words:
                # 句子的开始时间是第一个词的开始
                start_time = current_segment_words[0].get('start', 0)
                # 句子的结束时间是最后一个词的结束
                end_time = current_segment_words[-1].get('end', 0)
                # 句子文本
                text = ''.join([w.get('word', '') for w in current_segment_words]).strip()

                segments.append({
                    'id': len(segments) + 1,
                    'text': text,
                    'startTime': round(start_time, 3),
                    'endTime': round(end_time, 3)
                })

                current_segment_words = []

    # 处理最后一个句子（如果有剩余）
    if current_segment_words:
        start_time = current_segment_words[0].get('start', 0)
        end_time = current_segment_words[-1].get('end', 0)
        text = ''.join([w.get('word', '') for w in current_segment_words]).strip()

        segments.append({
            'id': len(segments) + 1,
            'text': text,
            'startTime': round(start_time, 3),
            'endTime': round(end_time, 3)
        })

    return segments

def remove_duplicate_sentences(segments: List[Dict]) -> List[Dict]:
    """
    去除重复的句子

    去重规则：
    1. 完全相同的文本，只保留第一条
    2. 检查连续的重复句子
    """
    if not segments:
        return []

    print(f"\n  去重前: {len(segments)} 句")

    # 查找重复的句子
    text_to_indices = {}  # 文本 -> 索引列表
    for i, seg in enumerate(segments):
        text = seg.get('text', '').strip()
        if text not in text_to_indices:
            text_to_indices[text] = []
        text_to_indices[text].append(i)

    # 标记要删除的索引
    to_remove = set()
    for text, indices in text_to_indices.items():
        if len(indices) > 1:
            print(f"    发现重复: '{text}' 重复 {len(indices)} 次，索引: {indices}")
            # 保留第一条，删除其余的
            for idx in indices[1:]:
                to_remove.add(idx)

    # 移除重复的句子
    dedup_segments = [seg for i, seg in enumerate(segments) if i not in to_remove]

    # 重新编号 ID
    for i, seg in enumerate(dedup_segments):
        seg['id'] = i + 1

    print(f"  去重后: {len(dedup_segments)} 句")
    if len(to_remove) > 0:
        print(f"  ✅ 删除了 {len(to_remove)} 个重复句子")

    return dedup_segments

def process_material(material_title: str):
    """处理单个素材"""
    print("=" * 70)
    print(f"  处理素材: {material_title}")
    print("=" * 70)

    # 连接 Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取素材信息
    result = supabase.table('materials').select('*').eq('title', material_title).execute()

    if not result.data:
        print(f"  ❌ 未找到素材: {material_title}")
        return

    material = result.data[0]
    material_id = material['id']
    audio_url = material.get('audio_path', '')

    if not audio_url.startswith('http'):
        print(f"  ❌ 音频 URL 无效: {audio_url}")
        return

    print(f"  音频 URL: {audio_url}")

    # 下载音频
    temp_audio_path = f"/tmp/{material_title.replace(' ', '_').replace('/', '_')}.mp3"
    print(f"\n  下载音频到: {temp_audio_path}")
    if not download_audio(audio_url, temp_audio_path):
        return

    # 转录音频
    print(f"\n  使用 Whisper API 转录...")
    transcription = transcribe_with_word_timestamps(temp_audio_path)

    if not transcription:
        return

    # 获取词级时间戳（从 segments 中提取）
    segments_data = transcription.get('segments', [])
    words = []

    for seg in segments_data:
        seg_words = seg.get('words', [])
        words.extend(seg_words)

    if not words:
        print(f"  ❌ 未获取到词级时间戳")
        return

    print(f"\n  获取到 {len(words)} 个词的时间戳")

    # 显示前几个词的时间戳
    print(f"\n  前10个词的时间戳:")
    for i, word in enumerate(words[:10]):
        print(f"    [{word.get('start', 0):.3f}s - {word.get('end', 0):.3f}s] {word.get('word', '')}")

    # 切分句子
    print(f"\n  根据规则切分句子...")
    segments = segment_sentences(words)

    print(f"\n  切分结果（共 {len(segments)} 句）:")
    for i, seg in enumerate(segments[:10]):  # 只显示前10句
        print(f"    {i+1}. [{seg['startTime']}s - {seg['endTime']}s] {seg['text']}")

    # 去除重复的句子
    print(f"\n  去除重复句子...")
    segments = remove_duplicate_sentences(segments)

    print(f"\n  最终 transcript（去重后）: {len(segments)} 句")
    for i, seg in enumerate(segments[:10]):  # 只显示前10句
        print(f"    {i+1}. [{seg['startTime']}s - {seg['endTime']}s] {seg['text']}")

    # 更新 Supabase
    print(f"\n  更新 Supabase...")
    try:
        update_result = supabase.table('materials').update({
            'transcript': segments
        }).eq('id', material_id).execute()
        print(f"  ✅ Supabase 已更新")
    except Exception as e:
        print(f"  ❌ 更新 Supabase 失败: {e}")

    # 清理临时文件
    try:
        os.remove(temp_audio_path)
    except:
        pass

    print("\n" + "=" * 70)
    print(f"  ✅ 处理完成")
    print("=" * 70)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python regenerate_transcript_with_word_timestamps.py '素材标题'")
        print("示例: python regenerate_transcript_with_word_timestamps.py 'Advice'")
        sys.exit(1)

    material_title = sys.argv[1]
    process_material(material_title)
