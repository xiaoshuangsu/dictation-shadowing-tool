#!/usr/bin/env python3
"""
YouTube 素材自动录入工具 - v2.2 优化版
改进：
1. LLM 标点恢复
2. 简化时间戳对齐逻辑
3. 末尾滞后容差
"""

import os
import sys
import re
import json
import requests
import time
from pathlib import Path
from supabase import create_client, Client
from typing import List, Dict
from datetime import datetime
import yt_dlp

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
GLM_API_KEY = os.environ.get("GLM_API_KEY")

DEFAULT_CATEGORY = "Science and Facts"
DEFAULT_DIFFICULTY = "B2"

EXISTING_LANGUAGES = ['zh', 'zh_hant', 'vi']
GROUP_A = ['ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el']
GROUP_B = ['id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']

LANGUAGES = {
    'zh': {'name': '简体中文'},
    'zh_hant': {'name': '繁體中文'},
    'vi': {'name': 'Tiếng Việt'},
    'ar': {'name': 'العربية'},
    'de': {'name': 'Deutsch'},
    'es': {'name': 'Español'},
    'ja': {'name': '日本語'},
    'ms': {'name': 'Bahasa Melayu'},
    'ru': {'name': 'Русский'},
    'tr': {'name': 'Türkçe'},
    'el': {'name': 'Ελληνικά'},
    'id': {'name': 'Bahasa Indonesia'},
    'ko': {'name': '한국어'},
    'pt': {'name': 'Português'},
    'th': {'name': 'ภาษาไทย'},
    'uk': {'name': 'Українська'},
    'bn': {'name': 'বাংলা'},
    'mn': {'name': 'Монгол'},
    'hi': {'name': 'हिन्दी'},
}

def log(msg: str):
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {msg}", flush=True)


def extract_video_id(url: str) -> str:
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)',
        r'youtube\.com\/watch\?.*v=([^&\n?#]+)'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"无法从 URL 提取视频 ID: {url}")


def clean_text(text: str) -> str:
    import html
    text = html.unescape(text)
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def restore_punctuation_with_llm(full_text: str) -> str:
    """使用 LLM 恢复标点符号"""
    log(f"   🤖 使用 LLM 恢复标点符号...")

    prompt = f"""Please add punctuation to the following text. Add commas, periods, and capitalize the first letter of each sentence. Do not change the wording or add/remove words.

Text: {full_text}

Return only the text with punctuation added, nothing else."""

    try:
        response = requests.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GLM_API_KEY}"
            },
            json={
                "model": "glm-4-flash",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 1000
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            restored_text = result["choices"][0]["message"]["content"].strip()
            log(f"   ✅ 标点恢复完成")
            return restored_text
        else:
            log(f"   ⚠️ LLM 请求失败，使用原始文本")
            return full_text

    except Exception as e:
        log(f"   ⚠️ 标点恢复出错: {e}，使用原始文本")
        return full_text


def merge_segments_improved(raw_segments: List[Dict]) -> List[Dict]:
    """
    改进的智能断句：v6.3 逻辑
    
    步骤：
    1. 使用 LLM 恢复标点
    2. 根据标点分割句子
    3. 为每句话分配准确的时间戳
    """
    log(f"   🔧 正在智能断句（原始片段: {len(raw_segments)}）...")

    if not raw_segments:
        return []

    # 第一步：合并文本并恢复标点
    full_text = ' '.join([s['text'].strip() for s in raw_segments])
    restored_text = restore_punctuation_with_llm(full_text)

    # 第二步：按标点分割句子
    sentences = re.split(r'(?<=[.!?])\s+', restored_text)

    if not sentences or len(sentences) == 1:
        log(f"   ⚠️ 标点分割失败，使用原始逻辑")
        sentences = [restored_text]

    # 第三步：为每个句子分配时间戳（简化版）
    # 方法：按单词数比例分配时间
    total_words = len(restored_text.split())
    result = []
    word_idx = 0
    seg_idx = 0
    current_seg_words = []

    # 收集所有片段的单词和时间
    all_words = []
    for seg in raw_segments:
        seg_words = seg['text'].strip().split()
        for word in seg_words:
            all_words.append({
                'word': word,
                'start': seg['start'],
                'end': seg['end']
            })

    # 为每个句子分配时间戳
    word_cursor = 0

    for sentence in sentences:
        if not sentence.strip():
            continue

        sentence_words = sentence.split()

        if word_cursor + len(sentence_words) > len(all_words):
            # 超出范围，使用最后一个时间
            break

        # 句子开始时间
        start_time = all_words[word_cursor]['start']

        # 句子结束时间
        end_idx = word_cursor + len(sentence_words) - 1
        if end_idx < len(all_words):
            end_time = all_words[end_idx]['end']
        else:
            end_time = all_words[-1]['end']

        # 🔴 末尾滞后容差：检查下一个单词是否属于当前句
        if end_idx + 1 < len(all_words):
            next_word_time = all_words[end_idx + 1]['start']
            gap = next_word_time - end_time

            # 如果下一个单词在 300ms 内，且首字母小写，可能属于当前句
            if gap < 0.3:
                next_word = all_words[end_idx + 1]['word']
                if next_word and next_word[0].islower() and next_word not in ['i', 'i\'m', 'i\'ve']:
                    # 合并到当前句
                    end_time = all_words[end_idx + 1]['end']
                    word_cursor += 1

        result.append({
            'text': sentence.strip(),
            'start': start_time,
            'end': end_time
        })

        word_cursor += len(sentence_words)

    log(f"   ✅ 断句完成: {len(result)} 条句子")

    return result


def normalize_transcript(raw_segments: List[Dict]) -> List[Dict]:
    """格式化字幕"""
    log(f"   🔧 正在格式化字幕...")

    END_CUT_OFFSET = 0.5
    MIN_DURATION = 0.2
    MIN_GAP = 0.2

    normalized = []
    current_id = 1

    for i, segment in enumerate(raw_segments):
        text = clean_text(segment['text'])
        start = segment['start']
        end = segment['end']

        if not text or len(text) <= 1:
            continue

        new_end = end - END_CUT_OFFSET
        final_end = max(start + MIN_DURATION, new_end)

        normalized.append({
            'id': current_id,
            'text': text,
            'startTime': round(start, 2),
            'endTime': round(final_end, 2),
            'translation': {},
            'blanks': []
        })
        current_id += 1

    # 强制真空带
    adjustments = 0
    for i in range(len(normalized) - 1):
        current = normalized[i]
        next_sentence = normalized[i + 1]

        gap = next_sentence['startTime'] - current['endTime']

        if gap < MIN_GAP:
            new_end = next_sentence['startTime'] - MIN_GAP
            final_new_end = max(current['startTime'] + MIN_DURATION, new_end)
            current['endTime'] = round(final_new_end, 2)
            adjustments += 1

    log(f"   ✅ 格式化完成: {len(normalized)} 条句子")

    return normalized


def main():
    """主函数 - 测试模式"""
    if len(sys.argv) < 2:
        print("用法: python3 scripts/ingest_youtube_v22.py <YouTube_URL>")
        sys.exit(1)

    youtube_url = sys.argv[1]

    print("=" * 70)
    print("🎯 YouTube 素材自动录入工具 - v2.2 优化版（测试）")
    print("=" * 70)
    print(f"🔗 URL: {youtube_url}")

    try:
        # 获取字幕
        log("🎬 使用 yt-dlp 获取视频信息...")
        video_id = extract_video_id(youtube_url)

        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)

            print(f"   ✅ 标题: {info['title']}")
            print(f"   ✅ 时长: {info['duration'] // 60}分{info['duration'] % 60}秒")

            # 获取字幕（自动生成）
            if 'automatic_captions' in info and 'en' in info['automatic_captions']:
                subtitle_url = info['automatic_captions']['en'][0]['url']
                response = requests.get(subtitle_url, timeout=10)
                response.raise_for_status()
                data = response.json()

                events = data.get('events', [])
                raw_segments = []

                for event in events:
                    if 'segs' in event:
                        text = ''.join([seg.get('utf8', '') for seg in event['segs']])
                        text = text.strip()

                        if text:
                            start_ms = event.get('tStartMs', 0)
                            duration_ms = event.get('dDurationMs', 0)

                            raw_segments.append({
                                'text': text,
                                'start': start_ms / 1000,
                                'end': (start_ms + duration_ms) / 1000
                            })

                print(f"   ✅ 字幕提取成功: {len(raw_segments)} 条原始片段")

                # 2. 改进的断句
                merged = merge_segments_improved(raw_segments)

                # 3. 格式化
                transcript = normalize_transcript(merged)

                print("\n" + "=" * 70)
                print("📊 断句结果预览：")
                print("=" * 70)

                for i, sentence in enumerate(transcript[:5], 1):
                    print(f"{i}. {sentence['text']}")
                    print(f"   时间: {sentence['startTime']}s - {sentence['endTime']}s")

                if len(transcript) > 5:
                    print(f"\n... 还有 {len(transcript) - 5} 条句子")

                print("=" * 70)

            else:
                print("   ❌ 该视频没有英文字幕")
                sys.exit(1)

    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    os.chdir('/Users/a/dictation')
    main()
