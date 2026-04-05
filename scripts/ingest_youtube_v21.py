#!/usr/bin/env python3
"""
YouTube 素材自动录入工具 - v2.1 优化版
改进：
1. LLM 标点恢复（Punctuation Restoration）
2. 优化断句逻辑（末尾滞后容差）
3. 基于标点的智能断句
"""

import os
import sys
import re
import json
import requests
import time
import random
from pathlib import Path
from supabase import create_client, Client
from typing import Optional, List, Dict, Tuple
from collections import Counter
from datetime import datetime
import yt_dlp

# 导入文本规范化工具
from text_normalizer import normalize_sentence_text

# ============ 配置 ============
SUPABASE_URL = "https://cuxotlijjnxbsirpdkgr.supabase.co"

def load_env():
    """加载环境变量"""
    env_path = Path(__file__).parent.parent / '.env.local'
    if not env_path.exists():
        raise FileNotFoundError(f".env.local 不存在: {env_path}")
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

load_env()

SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GLM_API_KEY = os.environ.get("GLM_API_KEY")

if not SUPABASE_KEY:
    raise ValueError("缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量")

if not GLM_API_KEY:
    raise ValueError("缺少 GLM_API_KEY 环境变量")

# 默认分类
DEFAULT_CATEGORY = "Science and Facts"
DEFAULT_DIFFICULTY = "B2"

# ==================== 语言配置 ====================

EXISTING_LANGUAGES = ['zh', 'zh_hant', 'vi']
GROUP_A = ['ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el']
GROUP_B = ['id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']
ALL_LANGUAGES = EXISTING_LANGUAGES + GROUP_A + GROUP_B

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

API_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAYS = [1, 2, 4]
BATCH_COOLDOWN = 5


# ============ 工具函数 ============

def log(msg: str, level: str = "INFO"):
    """简化日志输出"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {msg}", flush=True)


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


def title_to_slug(title: str) -> str:
    """将标题转换为 slug"""
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    if len(slug) > 100:
        slug = slug[:100]
    return slug


def clean_text(text: str) -> str:
    """清洗文本"""
    import html
    text = html.unescape(text)
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# ============ 新增：LLM 标点恢复 ============

def restore_punctuation_with_llm(full_text: str) -> str:
    """
    使用 LLM 恢复标点符号

    Args:
        full_text: 原始的自动生成字幕文本（无标点）

    Returns:
        添加了标点符号的文本
    """
    log(f"   🤖 使用 LLM 恢复标点符号...")

    prompt = f"""Please add punctuation to the following text. Add commas, periods, and capitalize the first letter of each sentence. Do not change the wording.

Text: {full_text}

Return only the text with punctuation added."""

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
            timeout=API_TIMEOUT
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


# ============ 改进的断句逻辑 ============

def merge_segments_improved(raw_segments: List[Dict]) -> List[Dict]:
    """
    改进的智能断句：v6.3 逻辑

    改进点：
    1. 先使用 LLM 恢复标点
    2. 基于标点符号断句（而不是仅仅基于时间）
    3. 末尾滞后容差：如果单词距离下一句 < 300ms，合并到当前句
    """
    log(f"   🔧 正在智能断句（原始片段: {len(raw_segments)}）...")

    if not raw_segments:
        return []

    # 🔴 第一步：合并所有片段为完整文本，使用 LLM 恢复标点
    full_text = ' '.join([s['text'].strip() for s in raw_segments])
    restored_text = restore_punctuation_with_llm(full_text)

    # 🔴 第二步：根据标点符号重新分配时间戳
    # 先按句子分割（基于标点）
    sentences = re.split(r'(?<=[.!?])\s+', restored_text)

    if not sentences:
        # 如果分割失败，使用原始逻辑
        log(f"   ⚠️ 标点分割失败，使用原始逻辑")
        sentences = [restored_text]

    # 🔴 第三步：为每个句子分配时间戳
    result = []
    current_seg_idx = 0
    seg_time = 0.0

    for sentence in sentences:
        if not sentence.strip():
            continue

        sentence_words = sentence.split()
        sentence_start = None
        sentence_end = None

        # 找到这个句子对应的字幕片段
        words_matched = 0

        while words_matched < len(sentence_words) and current_seg_idx < len(raw_segments):
            seg = raw_segments[current_seg_idx]
            seg_words = seg['text'].strip().split()

            if sentence_start is None:
                sentence_start = seg['start']

            # 匹配单词
            for seg_word in seg_words:
                if words_matched < len(sentence_words):
                    # 简单的单词匹配（可以改进为更复杂的逻辑）
                    words_matched += 1
                    sentence_end = seg['start'] + (seg['end'] - seg['start']) * (len(seg_words))
                else:
                    break

            # 🔴 末尾滞后容差检查
            if current_seg_idx < len(raw_segments) - 1:
                next_seg = raw_segments[current_seg_idx + 1]
                gap = next_seg['start'] - seg['end']

                # 如果下一个片段在 300ms 内，可能是被错误分割的
                if gap < 0.3 and words_matched < len(sentence_words):
                    # 合并到当前句子
                    current_seg_idx += 1
                    continue

            current_seg_idx += 1
            break

        if sentence_start and sentence_end:
            result.append({
                'text': sentence.strip(),
                'start': sentence_start,
                'end': sentence_end
            })

    log(f"   ✅ 断句完成: {len(result)} 条句子")

    return result


# 保留原有的 normalize_transcript 和其他函数（简化版）
# 为了节省篇幅，这里只展示核心改动


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

    log(f"   ✅ 格式化完成: {len(normalized)} 条句子")

    return normalized


# ============ 主函数（测试版） ============

def main():
    """主函数 - 测试模式"""
    if len(sys.argv) < 2:
        print("用法: python3 scripts/ingest_youtube_v21.py <YouTube_URL> [选项]")
        sys.exit(1)

    youtube_url = sys.argv[1]

    print("=" * 70)
    print("🎯 YouTube 素材自动录入工具 - v2.1 优化版（测试）")
    print("=" * 70)
    print(f"🔗 URL: {youtube_url}")

    try:
        # 连接 Supabase
        log("🔗 连接 Supabase...")
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        log("✅ 连接成功\n")

        # 1. 获取字幕
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
