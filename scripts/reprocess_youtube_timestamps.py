#!/usr/bin/env python3
"""
重新处理 YouTube 素材的时间戳（修复"念多了"问题）

策略：
1. 从数据库读取素材
2. 重新获取 YouTube 字幕
3. 使用新的断句逻辑重新生成 transcript
4. 更新数据库
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import yt_dlp
import requests
import re
from typing import List, Dict

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


def log(msg: str):
    print(f"[{msg}]")


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


def merge_segments_v2(raw_segments: List[Dict]) -> List[Dict]:
    """
    改进的断句逻辑：修复句子边界时间戳重叠问题
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

    # 第三步：为每个句子分配时间戳（修复版）
    # 收集所有单词和时间
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
    result = []

    for sentence in sentences:
        if not sentence.strip():
            continue

        sentence_words = sentence.split()

        if word_cursor + len(sentence_words) > len(all_words):
            break

        # 句子开始时间
        start_time = all_words[word_cursor]['start']

        # 句子结束时间
        end_idx = word_cursor + len(sentence_words) - 1
        if end_idx < len(all_words):
            end_time = all_words[end_idx]['end']
        else:
            end_time = all_words[-1]['end']

        # 🔴 禁用句子边界强制切分
        # 原因：YouTube 自动字幕的时间戳粒度太粗，强制切分会导致音频截断
        # 解决方案：使用原始片段的完整时间戳，接受可能念一点下一句的内容
        # 在前端通过 endBuffer 参数来微调停止时间

        result.append({
            'text': sentence.strip(),
            'start': start_time,
            'end': end_time
        })

        word_cursor += len(sentence_words)

    log(f"   ✅ 断句完成: {len(result)} 条句子")
    return result


def normalize_transcript_v2(raw_segments: List[Dict]) -> List[Dict]:
    """
    格式化为数据库格式（v2 版本：更保守的时间戳处理）
    """
    log(f"   🔧 正在格式化字幕...")

    # 配置参数
    END_CUT_OFFSET = 0.5  # 每句结尾减少 500ms
    MIN_DURATION = 0.2    # 最小时长
    MIN_GAP = 0.3         # 句间最小间隔（增加到 300ms）

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

        # 极短句保底
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
    log(f"      - 调整次数: {adjustments} 次")

    return normalized


def reprocess_material(material_id: str, youtube_id: str) -> bool:
    """重新处理单个素材"""
    log(f"\n{'='*60}")
    log(f"重新处理素材: {youtube_id}")
    log(f"{'='*60}\n")

    try:
        # 1. 获取原始字幕
        log(f"🎬 步骤 1: 获取原始字幕")

        video_url = f"https://youtu.be/{youtube_id}"

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios', 'web'],
                }
            },
            'nocheckcertificate': True,
        }

        raw_segments = []

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)

            subtitle_url = None
            if 'subtitles' in info and 'en' in info['subtitles']:
                subtitle_url = info['subtitles']['en'][0]['url']
            elif 'automatic_captions' in info and 'en' in info['automatic_captions']:
                subtitle_url = info['automatic_captions']['en'][0]['url']

            if subtitle_url:
                response = requests.get(subtitle_url, timeout=10)
                response.raise_for_status()
                data = response.json()

                events = data.get('events', [])

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

        if not raw_segments:
            log(f"   ❌ 无法获取字幕")
            return False

        log(f"   ✅ 获取到 {len(raw_segments)} 个原始片段")

        # 2. 重新断句
        log(f"\n🎬 步骤 2: 重新断句")
        merged_segments = merge_segments_v2(raw_segments)

        # 3. 格式化
        log(f"\n🎬 步骤 3: 格式化时间戳")
        transcript = normalize_transcript_v2(merged_segments)

        # 4. 更新数据库
        log(f"\n🎬 步骤 4: 更新数据库")

        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

        # 读取现有素材（保留翻译和挖空数据）
        existing = supabase.table('materials').select('*').eq('id', material_id).execute()

        if existing.data:
            old_transcript = existing.data[0].get('transcript', [])

            # 迁移翻译和挖空数据
            for i, new_sentence in enumerate(transcript):
                if i < len(old_transcript):
                    old_sentence = old_transcript[i]
                    new_sentence['translation'] = old_sentence.get('translation', {})
                    new_sentence['blanks'] = old_sentence.get('blanks', [])

            # 更新
            supabase.table('materials').update({
                'transcript': transcript
            }).eq('id', material_id).execute()

            log(f"   ✅ 更新成功")

            # 显示对比
            log(f"\n📊 修复前后对比：")
            for i in range(min(3, len(transcript) - 1)):
                new_gap = transcript[i + 1]['startTime'] - transcript[i]['endTime']
                log(f"   句子 {i+1}: end={transcript[i]['endTime']}s, 间隔={new_gap:.3f}s")

            return True
        else:
            log(f"   ❌ 素材不存在")
            return False

    except Exception as e:
        log(f"   ❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='重新处理 YouTube 素材时间戳')
    parser.add_argument('--youtube-id', type=str, required=True, help='YouTube 视频 ID')
    parser.add_argument('--material-id', type=str, help='素材 ID（可选，自动查询）')

    args = parser.parse_args()

    # 如果没有提供 material_id，自动查询
    material_id = args.material_id
    if not material_id:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        result = supabase.table('materials').select('id').eq('youtube_id', args.youtube_id).execute()

        if result.data:
            material_id = result.data[0]['id']
        else:
            log(f"❌ 未找到视频: {args.youtube_id}")
            sys.exit(1)

    success = reprocess_material(material_id, args.youtube_id)

    if success:
        log(f"\n{'='*60}")
        log(f"✅ 重新处理完成！")
        log(f"{'='*60}")
        sys.exit(0)
    else:
        log(f"\n{'='*60}")
        log(f"❌ 重新处理失败")
        log(f"{'='*60}")
        sys.exit(1)
