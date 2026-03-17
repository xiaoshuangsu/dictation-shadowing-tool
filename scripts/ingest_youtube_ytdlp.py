#!/usr/bin/env python3
"""
YouTube 素材自动录入工具 - yt-dlp 版

功能：
1. 输入 YouTube URL
2. 使用 yt-dlp 获取字幕（绕过 PO Token 限制）
3. 获取视频元数据（标题、封面、时长）
4. 自动入库到 Supabase

特点：
- 稳定可靠，不依赖 DOM 结构
- 快速，无需启动浏览器
- 自动处理各种字幕格式
"""

import os
import sys
import re
import json
import requests
from pathlib import Path
from supabase import create_client, Client
from typing import Optional, List, Dict
import yt_dlp

# ============ 配置 ============
SUPABASE_URL = "https://cuxotlijjnxbsirpdkgr.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_KEY:
    raise ValueError("缺少 SUPABASE_SERVICE_KEY 环境变量")

# 默认分类
DEFAULT_CATEGORY = "Science and Facts"
DEFAULT_DIFFICULTY = "B2"


# ============ 工具函数 ============

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


def merge_segments(raw_segments: List[Dict]) -> List[Dict]:
    """
    智能断句：将细粒度的字幕片段合并成合理的句子

    算法规则（遵循 guide）：
    1. 标点 `?.!` 强制切分
    2. 逗号 `,` + 停顿 `> 0.8s` 强制切分
    3. 任何停顿 `> 0.8s` 强制切分
    """
    print(f"   🔧 正在智能断句（原始片段: {len(raw_segments)}）...")

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
                'text': current_sentence['text'].strip(),
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
            'text': current_sentence['text'].strip(),
            'start': current_sentence['start'],
            'end': current_sentence['end']
        })

    print(f"   ✅ 断句完成: {len(merged)} 条句子")

    return merged


def normalize_transcript(raw_segments: List[Dict]) -> List[Dict]:
    """
    格式化为数据库格式，实施"末端强切"和"强制真空带"逻辑
    """
    print(f"   🔧 正在格式化字幕...")

    # 🔴 配置参数
    END_CUT_OFFSET = 0.5  # 核心缩进：每句结尾减少 500ms（提升至 0.5s）
    MIN_DURATION = 0.2    # 最小时长：确保每句至少 0.2 秒（极短句保底）
    MIN_GAP = 0.2         # 强制真空带：确保句间至少 200ms 静音期

    normalized = []
    current_id = 1

    for i, segment in enumerate(raw_segments):
        text = clean_text(segment['text'])
        start = segment['start']
        end = segment['end']

        if not text or len(text) <= 1:
            continue

        # 🔴 第一步：应用核心缩进（0.5s）
        # final_end_time = max(start_time + 0.2, original_end_time - 0.5)
        new_end = end - END_CUT_OFFSET

        # 🔴 第二步：极短句保底
        # 确保每句至少有 0.2 秒播放时间
        final_end = max(start + MIN_DURATION, new_end)

        normalized.append({
            'id': current_id,
            'text': text,
            'startTime': round(start, 2),
            'endTime': round(final_end, 2),
            'translation': None
        })
        current_id += 1

    # 🔴 第三步：强制真空带
    # 确保上一句的结束和下一句的开始之间有至少 200ms 的绝对静音期
    print(f"   🔧 正在应用强制真空带...")
    adjustments = 0

    for i in range(len(normalized) - 1):
        current = normalized[i]
        next_sentence = normalized[i + 1]

        gap = next_sentence['startTime'] - current['endTime']

        # 如果两句挨得太近（间隔 < 0.2 秒），强行把当前句末尾往前提
        if gap < MIN_GAP:
            old_end = current['endTime']
            new_end = next_sentence['startTime'] - MIN_GAP

            # 确保调整后不会低于最小时长
            final_new_end = max(current['startTime'] + MIN_DURATION, new_end)

            current['endTime'] = round(final_new_end, 2)
            adjustments += 1

            if adjustments <= 3:  # 只打印前 3 次调整
                print(f"      句[{current['id']}]: {old_end}s → {current['endTime']}s（强制真空带）")

    print(f"   ✅ 格式化完成: {len(normalized)} 条句子")
    print(f"      - 核心缩进: -{END_CUT_OFFSET}s")
    print(f"      - 最小时长: {MIN_DURATION}s (极短句保底)")
    print(f"      - 强制真空带: {MIN_GAP}s")
    print(f"      - 调整次数: {adjustments} 次")

    if len(normalized) >= 3:
        print(f"\n   📝 预览（前3条）：")
        for i, item in enumerate(normalized[:3]):
            gap_to_next = ""
            if i < len(normalized) - 1:
                next_item = normalized[i + 1]
                gap = next_item['startTime'] - item['endTime']
                gap_to_next = f" (间隔: {gap:.2f}s)"
            print(f"      [{item['id']}] {item['startTime']}s - {item['endTime']}s{gap_to_next}")
            print(f"          {item['text']}")

    return normalized


# ============ yt-dlp 字幕抓取 ============

def fetch_youtube_metadata(video_url: str) -> Dict:
    """使用 yt-dlp 获取 YouTube 视频元数据和字幕"""
    print(f"🎬 使用 yt-dlp 获取视频信息...")

    result = {
        'video_id': None,
        'title': None,
        'duration': None,
        'thumbnail': None,
        'subtitles': None,
        'captions_found': False
    }

    try:
        video_id = extract_video_id(video_url)
        result['video_id'] = video_id
        result['thumbnail'] = f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg"

        # 配置 yt-dlp
        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }

        print(f"   📡 正在获取视频信息...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)

            # 提取标题
            if info.get('title'):
                result['title'] = info['title']
                print(f"   ✅ 标题: {info['title']}")

            # 提取时长
            if info.get('duration'):
                result['duration'] = info['duration']
                minutes = info['duration'] // 60
                seconds = info['duration'] % 60
                print(f"   ✅ 时长: {minutes}分{seconds}秒")

            # 提取字幕
            print(f"   📝 正在获取字幕...")
            if 'subtitles' in info and 'en' in info['subtitles']:
                subtitle_url = info['subtitles']['en'][0]['url']

                # 下载字幕内容
                response = requests.get(subtitle_url, timeout=10)
                response.raise_for_status()
                data = response.json()

                # 解析字幕
                events = data.get('events', [])
                raw_segments = []

                for event in events:
                    if 'segs' in event:
                        # 拼接文本片段
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

                if raw_segments:
                    # 🔴 使用智能断句算法
                    merged_segments = merge_segments(raw_segments)
                    result['subtitles'] = merged_segments
                    result['captions_found'] = True
                    print(f"   ✅ 字幕提取成功: {len(merged_segments)} 条")
                else:
                    print(f"   ⚠️  字幕解析后为空")
            else:
                print(f"   ⚠️  该视频没有英文字幕")

    except Exception as e:
        print(f"   ❌ 错误: {e}")
        import traceback
        traceback.print_exc()

    return result


# ============ 数据库操作 ============

def upsert_material(client: Client, metadata: Dict, transcript: List[Dict], category: str, difficulty: str) -> bool:
    """入库素材"""
    video_id = metadata['video_id']
    title = metadata['title']
    slug = title_to_slug(title)

    print(f"\n💾 正在入库素材...")
    print(f"   📌 视频 ID: {video_id}")
    print(f"   📌 标题: {title}")
    print(f"   📌 Slug: {slug}")
    print(f"   📚 分类: {category}")
    print(f"   📊 难度: {difficulty}")
    print(f"   📝 字幕条数: {len(transcript)}")

    # 检查是否已存在
    existing = client.table('materials').select('*').eq('youtube_id', video_id).execute()

    material_data = {
        'title': title,
        'slug': slug,
        'category': category,
        'difficulty': difficulty,
        'source_type': 'youtube',
        'youtube_id': video_id,
        'audio_path': f'youtube:{video_id}',
        'audio_size': 0,  # YouTube 视频设置占位值
        'video_path': None,
        'thumbnail_path': metadata.get('thumbnail'),
        'duration': metadata.get('duration'),
        'transcript': transcript,
        'play_count': 0,
        # SEO 字段
        'meta_title': f"{title} | English Dictation & Shadowing",
        'meta_description': clean_text(' '.join([s['text'] for s in transcript[:10]]))[:150] if transcript else None,
        'og_image': metadata.get('thumbnail'),
    }

    try:
        if existing.data:
            material_id = existing.data[0]['id']
            print(f"   ⚠️  素材已存在 (ID: {material_id})，正在更新...")
            client.table('materials').update(material_data).eq('id', material_id).execute()
            print(f"   ✅ 更新成功")
        else:
            result = client.table('materials').insert(material_data).execute()
            material_id = result.data[0]['id']
            print(f"   ✅ 创建成功 (ID: {material_id})")

        return True

    except Exception as e:
        print(f"   ❌ 入库失败: {e}")
        import traceback
        traceback.print_exc()
        return False


# ============ 主函数 ============

def print_help():
    """打印帮助信息"""
    print("=" * 70)
    print("🎯 YouTube 素材自动录入工具 - yt-dlp 版")
    print("=" * 70)
    print("")
    print("使用方法：")
    print("  python3 scripts/ingest_youtube_ytdlp.py <YouTube_URL> [选项]")
    print("")
    print("选项：")
    print("  --category <分类>    素材分类（默认: YouTube Vlog）")
    print("  --difficulty <难度>  难度等级（默认: B2）")
    print("  --help              显示此帮助信息")
    print("")
    print("=" * 70)


def main():
    """主函数"""
    if len(sys.argv) < 2 or '--help' in sys.argv or '-h' in sys.argv:
        print_help()
        sys.exit(0 if '--help' in sys.argv or '-h' in sys.argv else 1)

    youtube_url = sys.argv[1]

    # 解析选项
    category = DEFAULT_CATEGORY
    difficulty = DEFAULT_DIFFICULTY

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--category' and i + 1 < len(sys.argv):
            category = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--difficulty' and i + 1 < len(sys.argv):
            difficulty = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    print("=" * 70)
    print("🎯 YouTube 素材自动录入工具 - yt-dlp 版")
    print("=" * 70)
    print(f"🔗 URL: {youtube_url}")
    print(f"📚 分类: {category}")
    print(f"📊 难度: {difficulty}")
    print("=" * 70)

    try:
        # 连接 Supabase
        print("🔗 连接 Supabase...")
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ 连接成功\n")

        # 抓取视频元数据和字幕
        metadata = fetch_youtube_metadata(youtube_url)

        if not metadata['title']:
            print("\n❌ 无法提取视频标题")
            sys.exit(1)

        if not metadata['subtitles']:
            print("\n❌ 无法提取字幕")
            sys.exit(1)

        # 格式化字幕
        transcript = normalize_transcript(metadata['subtitles'])

        if not transcript:
            print("\n❌ 字幕解析失败")
            sys.exit(1)

        # 入库
        success = upsert_material(client, metadata, transcript, category, difficulty)

        if success:
            print("\n" + "=" * 70)
            print("✅ 素材录入成功！")
            print("=" * 70)
            print(f"📹 视频 ID: {metadata['video_id']}")
            print(f"📌 标题: {metadata['title']}")
            print(f"📝 字幕条数: {len(transcript)}")
            print(f"⏱️  时长: {metadata['duration'] // 60 if metadata.get('duration') else '?'}分{metadata['duration'] % 60 if metadata.get('duration') else '?'}秒")
            print(f"\n💡 测试页面: http://localhost:3000/topics/")
            print("=" * 70)
        else:
            print("\n❌ 入库失败")
            sys.exit(1)

    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    os.chdir('/Users/a/dictation')
    main()
