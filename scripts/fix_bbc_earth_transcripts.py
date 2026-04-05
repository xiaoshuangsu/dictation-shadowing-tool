#!/usr/bin/env python3
"""
修复 BBC Earth 视频的单词边界问题
直接更新数据库中的 transcript
"""
import os
import sys
import re
import json
import time
import yt_dlp
import requests
from pathlib import Path
from typing import List, Dict
from supabase import create_client

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

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("缺少必要的环境变量")


# ============ 工具函数 ============

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def extract_video_id(url: str) -> str:
    """从 URL 提取视频 ID"""
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
    """清洗文本"""
    import html
    text = html.unescape(text)
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def normalize_sentence_text(text: str) -> str:
    """规范化句子文本"""
    # 移除多余空格
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def merge_segments(raw_segments: List[Dict]) -> List[Dict]:
    """
    智能断句（带单词边界修复）
    """
    log(f"   🔧 正在智能断句（原始片段: {len(raw_segments)}）...")

    if not raw_segments:
        return []

    merged = []
    current_sentence = {
        'text': '',
        'start': raw_segments[0]['start'],
        'end': raw_segments[0]['end']
    }

    for i, segment in enumerate(raw_segments):
        text = segment['text'].strip()
        start = segment['start']
        end = segment['end']

        # 计算与前一个片段的停顿时间
        gap = start - current_sentence['end'] if i > 0 else 0

        # 检查是否需要切分
        should_split = False

        # 规则 1: 标点 `?.!` 强制切分
        if current_sentence['text'] and re.search(r'[.!?]\s*$', current_sentence['text']):
            should_split = True

        # 规则 2: 逗号 + 停顿 > 0.8s
        elif current_sentence['text'] and re.search(r',\s*$', current_sentence['text']) and gap > 0.8:
            should_split = True

        # 规则 3: 任何停顿 > 0.8s
        elif gap > 0.8:
            should_split = True

        if should_split and current_sentence['text']:
            # 保存当前句子
            merged.append({
                'text': normalize_sentence_text(current_sentence['text'].strip()),
                'start': current_sentence['start'],
                'end': current_sentence['end']
            })

            # 开始新句子
            current_sentence = {
                'text': text,
                'start': start,
                'end': end
            }
        else:
            # 合并到当前句子
            if current_sentence['text']:
                current_sentence['text'] += ' ' + text
            else:
                current_sentence['text'] = text
            current_sentence['end'] = end

    # 保存最后一个句子
    if current_sentence['text'].strip():
        merged.append({
            'text': normalize_sentence_text(current_sentence['text'].strip()),
            'start': current_sentence['start'],
            'end': current_sentence['end']
        })

    # 🔴 单词边界修复
    log(f"   🔧 正在修复单词边界...")
    fixed_count = 0

    for i in range(len(merged) - 1):
        current_text = merged[i]['text']
        next_text = merged[i + 1]['text']

        # 检查下一句的开头
        next_words = next_text.split()
        if next_words:
            first_word = next_words[0]

            # 如果第一个单词是小写开头且不是 "I"，可能是被分割的单词
            if first_word[0].islower() and first_word not in ['i', 'i\'m', 'i\'ve', 'i\'ll', 'i\'d']:
                # 将下一句的第一个词移到上一句末尾
                merged[i]['text'] = current_text + ' ' + first_word
                merged[i + 1]['text'] = ' '.join(next_words[1:])
                merged[i]['end'] = merged[i + 1]['start']
                fixed_count += 1

    if fixed_count > 0:
        log(f"   ✅ 修复了 {fixed_count} 个被分割的单词")

    log(f"   ✅ 断句完成: {len(merged)} 条句子")

    return merged


def fetch_youtube_subtitles(video_url: str) -> List[Dict]:
    """使用 yt-dlp 获取 YouTube 字幕"""
    log(f"📡 正在获取字幕...")

    ydl_opts = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)

        # 优先使用手动字幕，fallback 到自动字幕
        subtitle_url = None
        if 'subtitles' in info and 'en' in info['subtitles']:
            subtitle_url = info['subtitles']['en'][0]['url']
            log(f"   📌 字幕类型: 手动字幕")
        elif 'automatic_captions' in info and 'en' in info['automatic_captions']:
            subtitle_url = info['automatic_captions']['en'][0]['url']
            log(f"   📌 字幕类型: 自动生成字幕")

        if not subtitle_url:
            raise ValueError("该视频没有英文字幕")

        # 下载字幕内容
        response = requests.get(subtitle_url, timeout=10)
        response.raise_for_status()
        data = response.json()

        # 解析字幕
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

        log(f"   ✅ 字幕提取成功: {len(raw_segments)} 条")

        return raw_segments


def normalize_transcript(raw_segments: List[Dict]) -> List[Dict]:
    """格式化字幕（应用时间轴优化）"""
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

        # 应用核心缩进
        new_end = end - END_CUT_OFFSET
        final_end = max(start + MIN_DURATION, new_end)

        normalized.append({
            'id': current_id,
            'text': text,
            'startTime': round(start, 2),
            'endTime': round(final_end, 2),
        })
        current_id += 1

    # 强制真空带
    log(f"   🔧 正在应用强制真空带...")
    adjustments = 0

    for i in range(len(normalized) - 1):
        current = normalized[i]
        next_sentence = normalized[i + 1]

        gap = next_sentence['startTime'] - current['endTime']

        if gap < MIN_GAP:
            old_end = current['endTime']
            new_end = next_sentence['startTime'] - MIN_GAP
            final_new_end = max(current['startTime'] + MIN_DURATION, new_end)
            current['endTime'] = round(final_new_end, 2)
            adjustments += 1

    log(f"   ✅ 格式化完成: {len(normalized)} 条句子")
    log(f"      - 核心缩进: -{END_CUT_OFFSET}s, 最小时长: {MIN_DURATION}s, 强制真空带: {MIN_GAP}s")
    log(f"      - 调整次数: {adjustments} 次")

    return normalized


def fix_material_video(video_url: str, material_id: str):
    """修复单个素材的字幕"""
    log(f"\n{'='*70}")
    log(f"🔧 处理视频: {video_url}")
    log(f"📌 素材 ID: {material_id}")
    log(f"{'='*70}")

    # 1. 获取原始字幕
    raw_segments = fetch_youtube_subtitles(video_url)

    # 2. 智能断句（带单词边界修复）
    merged_segments = merge_segments(raw_segments)

    # 3. 格式化字幕
    new_transcript = normalize_transcript(merged_segments)

    # 4. 获取原素材数据（保留翻译和挖空）
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    result = supabase.table('materials').select('*').eq('id', material_id).execute()

    if not result.data:
        log(f"❌ 未找到素材: {material_id}")
        return

    old_material = result.data[0]
    old_transcript = old_material.get('transcript', [])

    log(f"\n📊 对比：")
    log(f"   旧句子数: {len(old_transcript)}")
    log(f"   新句子数: {len(new_transcript)}")

    # 5. 保留翻译和挖空数据
    log(f"\n🔧 正在迁移翻译和挖空数据...")

    min_len = min(len(old_transcript), len(new_transcript))
    migrated_translation = 0
    migrated_blanks = 0

    for i in range(min_len):
        old_sentence = old_transcript[i]
        new_sentence = new_transcript[i]

        # 迁移翻译
        if 'translation' in old_sentence:
            new_sentence['translation'] = old_sentence['translation']
            migrated_translation += 1

        # 迁移挖空
        if 'blanks' in old_sentence:
            new_sentence['blanks'] = old_sentence['blanks']
            migrated_blanks += 1

    log(f"   ✅ 迁移翻译: {migrated_translation} 条")
    log(f"   ✅ 迁移挖空: {migrated_blanks} 条")

    # 6. 更新数据库
    log(f"\n💾 正在更新数据库...")

    try:
        supabase.table('materials').update({
            'transcript': new_transcript
        }).eq('id', material_id).execute()

        log(f"   ✅ 更新成功")

    except Exception as e:
        log(f"   ❌ 更新失败: {e}")
        import traceback
        traceback.print_exc()


# ============ 主函数 ============

def main():
    print("=" * 70)
    print("🔧 修复 BBC Earth 视频字幕")
    print("=" * 70)

    # BBC Earth 视频列表
    videos = [
        {
            'url': 'https://youtu.be/q3uXXh1sHcI',
            'id': 'f7afca23-d753-440b-9beb-b61a61be1dc0',
            'title': 'Baby Penguin Tries To Make Friends'
        },
        {
            'url': 'https://youtu.be/-7l7SMN9NUM',
            'id': 'a6ecd0f6-9e5e-4dec-ad5e-c4db802a87c6',
            'title': 'Tracking the Elusive Giant Anteater'
        },
        {
            'url': 'https://youtu.be/d-Kri0vGf2c',
            'id': 'd18706b6-48a7-4975-be77-8a19adde4183',
            'title': 'Starving Wolf Hunts Caribou'
        },
    ]

    log(f"\n📊 待修复视频数: {len(videos)}\n")

    for video in videos:
        fix_material_video(video['url'], video['id'])

    print("\n" + "=" * 70)
    print("✅ 全部完成")
    print("=" * 70)


if __name__ == '__main__':
    os.chdir('/Users/a/dictation')
    main()
