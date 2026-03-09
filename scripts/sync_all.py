#!/usr/bin/env python3
"""
本地视频 → R2 → Supabase 完整工厂流

功能：
1. FFmpeg: 压缩为 480p MP4，提取 WebP 封面
2. Whisper: 提取英文原文及时间戳
3. GLM API: 翻译每一句为优雅的中文
4. R2: 上传视频和封面
5. Supabase: 同步所有数据

用法：
  # 处理单个视频
  python3 scripts/sync_all.py "视频文件名.mp4" "分类"

  # 处理所有未上传的视频
  python3 scripts/sync_all.py --all "分类"

示例：
  python3 scripts/sync_all.py "video.mp4" "daily"
  python3 scripts/sync_all.py --all "daily"
"""

import os
import sys
import json
import subprocess
import shutil
import re
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import boto3
from botocore.exceptions import ClientError
from supabase import create_client
import requests  # 使用 requests 直接调用 GLM API

# ==================== 加载 .env.local ====================
# 加载项目根目录的 .env.local 文件
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# ==================== 设置 PATH ====================
# 确保 ffmpeg 能被找到
os.environ['PATH'] = '/opt/homebrew/bin:' + os.environ.get('PATH', '')

# ==================== 配置 ====================

# R2 配置
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "56f5f35ef68837e643bf13af9871c584")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "c6bf7a378f8786823b897975d895601d")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "8b75bb30c56e360a37070ca415871e5983c50e758119c18df201377651fbde21")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "shadowhub")
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_WORKER_URL = os.environ.get("NEXT_PUBLIC_R2_WORKER_URL", "https://r2-proxy.suxiaoshuang2020.workers.dev")

# Supabase 配置
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cuxotlijjnxbsirpdkgr.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_UeaK10sYGQPjB17Vg-IpcQ_ql3xHKMm")

# GLM API 配置
GLM_API_KEY = os.environ.get("GLM_API_KEY", "")

# 本地路径
VIDEO_DIR = Path("/Users/a/dictation/public/youtube_videos")

# ==================== 工具函数 ====================

def slugify(text: str) -> str:
    """将文本转换为 URL 友好的 slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    return text[:100]


def print_section(title: str):
    """打印分隔线"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


# ==================== R2 操作 ====================

def upload_to_r2(local_path: str, key: str, content_type: str) -> Optional[Dict]:
    """上传文件到 R2"""
    s3 = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY
    )

    try:
        file_size = os.path.getsize(local_path)
        size_mb = file_size / 1024 / 1024

        print(f"    上传中: {key} ({size_mb:.2f} MB)")
        s3.upload_file(
            local_path,
            R2_BUCKET_NAME,
            key,
            ExtraArgs={'ContentType': content_type}
        )

        public_url = f"{R2_WORKER_URL}/{key}"
        return {
            'success': True,
            'key': key,
            'public_url': public_url,
            'size': file_size
        }
    except ClientError as e:
        print(f"    ❌ 上传失败: {e}")
        return {
            'success': False,
            'error': str(e)
        }


# ==================== FFmpeg 处理 ====================

def compress_to_mp4(video_path: Path, output_path: Path) -> bool:
    """压缩视频为 480p MP4"""
    print(f"  🎬 压缩为 480p MP4...")
    cmd = [
        'ffmpeg',  # 直接使用 ffmpeg，PATH 已设置
        '-i', str(video_path),
        '-vf', 'scale=854:480',  # 480p 16:9
        '-c:v', 'libx264',
        '-crf', '28',
        '-preset', 'medium',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        str(output_path)
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True)
        original_size = video_path.stat().st_size / 1024 / 1024
        compressed_size = output_path.stat().st_size / 1024 / 1024
        ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0
        print(f"    ✅ 压缩完成: {original_size:.2f}MB → {compressed_size:.2f}MB ({ratio:.1f}% 减少)")
        return True
    except subprocess.CalledProcessError as e:
        print(f"    ❌ 压缩失败: {e}")
        return False


def extract_webp_thumbnail(video_path: Path, output_path: Path) -> bool:
    """提取 16:9 WebP 封面（强制小于 20KB）"""
    print(f"  🖼️  生成 WebP 封面 (16:9, <20KB)...")

    # 🔴 关键修复：使用更低的 quality 确保小于 20KB
    cmd = [
        'ffmpeg',
        '-i', str(video_path),
        '-ss', '00:00:01',
        '-vframes', '1',
        '-vf', 'scale=854:480',  # 16:9 480p
        '-c:v', 'libwebp',
        '-quality', '70',  # 🔴 降低质量到 70（原来是 85）
        '-method', '6',     # 更好的压缩方法
        '-y',
        str(output_path)
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True)
        size_kb = output_path.stat().st_size / 1024

        # 🔴 关键修复：检查文件大小，如果超过 20KB 则重新压缩
        if size_kb > 20:
            print(f"    ⚠️  文件过大 ({size_kb:.2f} KB)，重新压缩...")
            return _compress_thumbnail_to_size(output_path, 20)
        else:
            print(f"    ✅ 封面生成完成: {size_kb:.2f} KB")
            return True

    except subprocess.CalledProcessError:
        print(f"    ❌ WebP 封面生成失败，将使用 JPG")
        return False


def _compress_thumbnail_to_size(input_path: Path, max_kb: int) -> bool:
    """将缩略图压缩到指定大小以下"""
    import tempfile
    import shutil

    # 渐进式压缩，从 quality 50 开始
    for quality in range(50, 10, -10):
        with tempfile.NamedTemporaryFile(suffix='.webp', delete=False) as temp_file:
            temp_path = Path(temp_file.name)

            cmd = [
                'ffmpeg',
                '-i', str(input_path),
                '-vframes', '1',
                '-c:v', 'libwebp',
                '-quality', str(quality),
                '-method', '6',
                '-y',
                str(temp_path)
            ]

            try:
                subprocess.run(cmd, check=True, capture_output=True)
                size_kb = temp_path.stat().st_size / 1024

                if size_kb <= max_kb:
                    shutil.move(str(temp_path), str(input_path))
                    print(f"    ✅ 压缩成功: {size_kb:.2f} KB (quality: {quality})")
                    return True
                else:
                    temp_path.unlink()

            except subprocess.CalledProcessError:
                if temp_path.exists():
                    temp_path.unlink()
                continue

    # 如果质量压缩还不够，尝试降低分辨率
    print(f"    ⚠️  质量压缩不足，尝试降低分辨率...")
    for width in [640, 480, 320]:
        with tempfile.NamedTemporaryFile(suffix='.webp', delete=False) as temp_file:
            temp_path = Path(temp_file.name)

            cmd = [
                'ffmpeg',
                '-i', str(input_path),
                '-vf', f'scale={width}:-1',
                '-vframes', '1',
                '-c:v', 'libwebp',
                '-quality', '60',
                '-y',
                str(temp_path)
            ]

            try:
                subprocess.run(cmd, check=True, capture_output=True)
                size_kb = temp_path.stat().st_size / 1024

                if size_kb <= max_kb:
                    shutil.move(str(temp_path), str(input_path))
                    print(f"    ✅ 压缩成功: {size_kb:.2f} KB (分辨率: {width}w)")
                    return True
                else:
                    temp_path.unlink()

            except subprocess.CalledProcessError:
                if temp_path.exists():
                    temp_path.unlink()
                continue

    print(f"    ❌ 无法压缩到 {max_kb}KB 以下")
    return False


def extract_thumbnail_jpg(video_path: Path, output_path: Path) -> bool:
    """提取 JPG 封面（备用）"""
    print(f"  🖼️  生成 JPG 封面...")
    cmd = [
        'ffmpeg',
        '-i', str(video_path),
        '-ss', '00:00:01',
        '-vframes', '1',
        '-vf', 'scale=854:480',
        '-y',
        str(output_path)
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True)
        size_kb = output_path.stat().st_size / 1024
        print(f"    ✅ 封面生成完成: {size_kb:.2f} KB")
        return True
    except subprocess.CalledProcessError:
        print(f"    ❌ JPG 封面生成失败")
        return False


def extract_audio_for_whisper(video_path: Path, output_path: Path) -> bool:
    """提取音频供 Whisper 使用"""
    print(f"  🎵 提取音频供 Whisper 使用...")
    cmd = [
        'ffmpeg',
        '-i', str(video_path),
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-y',
        str(output_path)
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"    ✅ 音频提取完成")
        return True
    except subprocess.CalledProcessError:
        print(f"    ❌ 音频提取失败")
        return False


def get_video_duration(video_path: Path) -> int:
    """获取视频时长（秒）"""
    cmd = [
        'ffprobe',  # 使用 ffprobe 获取更准确的时长
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        str(video_path)
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.stdout.strip():
            duration = float(result.stdout.strip())
            return int(duration)
    except Exception as e:
        pass

    # 备用方案：使用 ffmpeg
    cmd = [
        'ffmpeg',
        '-i', str(video_path),
        '-f', 'null',
        '-'
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, stderr=subprocess.STDOUT)
        for line in result.stdout.split('\n'):
            if 'Duration:' in line:
                match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', line)
                if match:
                    h, m, s = match.groups()
                    return int(int(h) * 3600 + int(m) * 60 + float(s))
    except:
        pass
    return 0


def detect_speech_start(video_path: Path) -> float:
    """
    使用 ffmpeg silencedetect 检测第一句人声的起始时间（全局偏移量）

    算法：
    1. 使用 -20dB 噪声门（更严格，只检测真正的人声）
    2. duration=0.5（至少 0.5 秒的连续声音才算对话）
    3. 找到第一个满足条件的 silence_end 作为人声起始点
    """
    print(f"  🔍 物理切片探测：检测第一句人声起始点...")

    cmd = [
        'ffmpeg',
        '-i', str(video_path),
        '-af', 'silencedetect=noise=-20dB:duration=0.5',
        '-f', 'null',
        '-'
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, stderr=subprocess.STDOUT)

        # 解析 silencedetect 输出
        silence_ends = []
        for line in result.stdout.split('\n'):
            if 'silence_end' in line:
                match = re.search(r'silence_end:\s*([\d.]+)', line)
                if match:
                    silence_ends.append(float(match.group(1)))

        if silence_ends:
            # 取第一个 silence_end 作为人声起始点（跳过前面的片头音乐）
            speech_start = silence_ends[0]
            print(f"  ✅ 检测到全局偏移量: {speech_start:.2f} 秒")
            print(f"  📊 共检测到 {len(silence_ends)} 个静音段")
            return speech_start
        else:
            print(f"  ⚠️  未检测到静音段，使用默认值 0")
            return 0.0

    except Exception as e:
        print(f"  ❌ 检测失败: {e}，使用默认值 0")
        return 0.0


# ==================== Whisper 转录 ====================

def transcribe_with_whisper(audio_path: Path) -> List[Dict]:
    """使用 Whisper 提取英文原文及时间戳"""
    print(f"  🎙️  使用 Whisper 转录...")

    # 使用系统的 python3
    cmd = [
        '/usr/bin/python3', '-m', 'whisper',
        str(audio_path),
        '--model', 'base',
        '--language', 'en',
        '--output_format', 'json',
        '--output_dir', str(audio_path.parent),
        '--task', 'transcribe'
    ]

    try:
        print(f"    执行转录...")
        result = subprocess.run(cmd, capture_output=True, text=True)

        # Whisper 会生成同名 JSON 文件
        json_path = audio_path.parent / f"{audio_path.stem}.json"

        if not json_path.exists():
            print(f"    ❌ Whisper 未生成 JSON 文件")
            if result.stderr:
                print(f"    stderr: {result.stderr[:500]}")
            return []

        with open(json_path, 'r', encoding='utf-8') as f:
            whisper_data = json.load(f)

        segments = whisper_data.get('segments', [])
        print(f"    ✅ 转录完成: {len(segments)} 个片段")

        return segments

    except FileNotFoundError:
        print(f"    ❌ Whisper 未安装，请运行: pip3 install openai-whisper")
        return []
    except Exception as e:
        print(f"    ❌ Whisper 转录失败: {e}")
        return []


# ==================== GLM 翻译 ====================

def translate_with_glm(english_sentences: List[Dict]) -> List[Dict]:
    """使用 GLM API 翻译每一句"""
    print(f"  🤖 使用 GLM-4 翻译...")

    if not GLM_API_KEY:
        print(f"    ⚠️  未设置 GLM_API_KEY，跳过翻译")
        return english_sentences

    try:
        # 构建翻译文本
        text_to_translate = "\n".join([
            f"{i+1}. {seg['text']}"
            for i, seg in enumerate(english_sentences)
        ])

        print(f"    翻译 {len(english_sentences)} 个句子...")

        prompt = f"""请将以下英文句子翻译成优雅、自然的中文。每句话都是独立的，请保持原意的同时让中文表达更加流畅。

英文原文：
{text_to_translate}

请按以下 JSON 格式返回，不要添加任何其他内容：
{{"translations": ["第一句中文", "第二句中文", ...]}}"""

        # 直接调用 GLM API
        url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GLM_API_KEY}"
        }
        data = {
            "model": "glm-4-flash",
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
        }

        response = requests.post(url, headers=headers, json=data, timeout=60)

        if response.status_code != 200:
            print(f"    ⚠️  GLM API 调用失败: HTTP {response.status_code}")
            print(f"    响应: {response.text[:500]}")
            return english_sentences

        result = response.json()
        response_text = result['choices'][0]['message']['content']

        # 提取 JSON
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if not json_match:
            print(f"    ⚠️  无法从响应中提取 JSON")
            print(f"    响应: {response_text[:500]}")
            return english_sentences

        translation_data = json.loads(json_match.group(0))
        translations = translation_data.get('translations', [])

        if len(translations) != len(english_sentences):
            print(f"    ⚠️  翻译数量不匹配: {len(translations)} vs {len(english_sentences)}")
            return english_sentences

        # 合并翻译
        result_sentences = []
        for i, seg in enumerate(english_sentences):
            result_sentences.append({
                'id': i + 1,
                'text': seg['text'],
                'startTime': float(seg['start']),
                'endTime': float(seg['end']),
                'translation': translations[i] if i < len(translations) else ''
            })

        print(f"    ✅ 翻译完成")
        return result_sentences

    except Exception as e:
        print(f"    ❌ GLM 翻译失败: {e}")
        import traceback
        traceback.print_exc()
        return english_sentences


# ==================== 标题处理 ====================

def clean_title(title: str) -> str:
    """清理视频标题，保留核心英文内容"""
    title = Path(title).stem

    # 先提取方括号中的主题（如果有）
    bracket_match = re.search(r'\[(.*?)\]', title)
    topic = bracket_match.group(1) if bracket_match else ""

    # 移除方括号内容（稍后可能会添加回去）
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'【.*?】', '', title)
    title = re.sub(r'（.*?）', '', title)
    title = re.sub(r'\(.*?\)', '', title)

    # 移除常见后缀
    for suffix in ['- Easy Dialogue', ' - Easy Dialogue', 'English educational animation for Kids',
                   'for Kids', 'English conversation', 'educational animation',
                   'Easy Dialogue', 'English educational', 'English video',
                   ' - English video', 'English video for Kids']:
        title = title.replace(suffix, '')

    # 移除多余空格和符号
    title = re.sub(r'\s+', ' ', title).strip()
    title = title.strip(' -_|，。！？.')

    # 如果标题为空或太短，使用主题
    if not title or len(title) < 3:
        title = topic if topic else f"Video {datetime.now().strftime('%Y%m%d')}"
    # 如果有主题且标题不重复，可以组合
    elif topic and topic.lower() not in title.lower():
        # 简单的组合，避免太长
        if len(title) < 50:
            title = f"{title}"

    return title


def determine_difficulty(category: str, title: str = "") -> str:
    """根据分类和标题确定难度"""
    difficulty_map = {
        'daily': 'A1',
        'story': 'A2',
        'speech': 'B1',
        'culture': 'B2'
    }

    base_difficulty = difficulty_map.get(category, 'A2')

    if 'Kids' in title or 'Easy' in title:
        return 'A1'
    elif 'B5L' in title:
        return 'A2'

    return base_difficulty


# ==================== 主处理函数 ====================

def process_video(video_path: Path, category: str, supabase) -> bool:
    """处理单个视频"""

    original_title = video_path.stem
    print_section(f"处理: {original_title}")

    # 清理标题
    title = clean_title(original_title)
    slug = slugify(title)

    print(f"  📝 原标题: {original_title}")
    print(f"  📝 简化标题: {title}")
    print(f"  📝 Slug: {slug}")

    # 检查素材是否已存在
    print(f"  检查素材是否已存在...")
    existing = supabase.table('materials').select('*').eq('title', title).execute()

    material_id = None
    if existing.data:
        # 检查是否是失败的记录
        material = existing.data[0]
        transcript = material.get('transcript', [])
        is_failed = False
        if transcript and len(transcript) > 0:
            text = transcript[0].get('text', '')
            if 'Please' in text or 'edit' in text.lower() or 'Language: en' in text:
                is_failed = True

        if is_failed:
            # 删除失败的记录
            print(f"  🗑️  删除旧的失败记录...")
            supabase.table('materials').delete().eq('id', material['id']).execute()
            print(f"     已删除: {material['id']}")
        else:
            print(f"  ⚠️  素材已存在且转录正常，跳过")
            print(f"     UUID: {material['id']}")
            return False

    # 创建临时目录
    temp_dir = Path(f'/tmp/sync_all_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
    temp_dir.mkdir(exist_ok=True)

    try:
        # ============ 步骤 1: FFmpeg 处理 ============
        print_section("步骤 1/5: FFmpeg 压缩与提取")

        # 压缩为 MP4
        compressed_video_path = temp_dir / f'{slug}.mp4'
        if not compress_to_mp4(video_path, compressed_video_path):
            shutil.rmtree(temp_dir)
            return False

        # 提取 WebP 封面
        thumbnail_path = temp_dir / f'{slug}.webp'
        thumbnail_ext = 'webp'

        if not extract_webp_thumbnail(compressed_video_path, thumbnail_path):
            # WebP 失败，使用 JPG
            thumbnail_path = temp_dir / f'{slug}.jpg'
            thumbnail_ext = 'jpeg'
            if not extract_thumbnail_jpg(compressed_video_path, thumbnail_path):
                thumbnail_path = None

        # 提取音频供 Whisper 使用
        whisper_audio_path = temp_dir / f'{slug}_whisper.wav'
        if not extract_audio_for_whisper(compressed_video_path, whisper_audio_path):
            shutil.rmtree(temp_dir)
            return False

        # 获取时长
        duration = get_video_duration(compressed_video_path)
        print(f"  ⏱️  总时长: {duration} 秒")

        # ============ 步骤 2: Whisper 转录 ============
        print_section("步骤 2/5: Whisper 转录")

        whisper_segments = transcribe_with_whisper(whisper_audio_path)

        if not whisper_segments:
            print(f"  ⚠️  Whisper 转录失败，使用默认句子")
            whisper_segments = [{'text': 'Please add transcript', 'start': 0.0, 'end': 5.0}]

        # 检测人声起始点（跳过片头音乐）
        speech_start_offset = detect_speech_start(compressed_video_path)

        # 应用偏移量到所有 Whisper 时间戳
        if speech_start_offset > 0:
            print(f"  ⏩ 应用时间偏移: +{speech_start_offset:.2f} 秒")
            for seg in whisper_segments:
                seg['start'] += speech_start_offset
                seg['end'] += speech_start_offset

        # ============ 步骤 3: GLM 翻译 ============
        print_section("步骤 3/5: GLM 翻译")

        sentences = translate_with_glm(whisper_segments)

        if not sentences or sentences == whisper_segments:
            # 备用：使用 Whisper 原始数据
            sentences = [{
                'id': i + 1,
                'text': seg['text'],
                'startTime': float(seg['start']),
                'endTime': float(seg['end']),
                'translation': ''
            } for i, seg in enumerate(whisper_segments)]

        print(f"  📝 生成 {len(sentences)} 个句子")
        if sentences:
            print(f"     示例: {sentences[0]['text']}")
            if sentences[0].get('translation'):
                print(f"     翻译: {sentences[0]['translation']}")

        # ============ 步骤 4: 上传到 R2 ============
        print_section("步骤 4/5: 上传到 R2")

        # 上传视频
        video_key = f"youtube_videos/{slug}.mp4"
        video_result = upload_to_r2(str(compressed_video_path), video_key, 'video/mp4')

        if not video_result or not video_result['success']:
            print("  ❌ 视频上传失败")
            shutil.rmtree(temp_dir)
            return False
        print(f"  ✅ 视频: {video_result['public_url']}")

        # 上传音频（从压缩视频提取 MP3）
        audio_path = temp_dir / f'{slug}.mp3'
        cmd = ['ffmpeg', '-i', str(compressed_video_path), '-vn', '-acodec', 'libmp3lame',
               '-q:a', '2', '-y', str(audio_path)]
        subprocess.run(cmd, capture_output=True)

        audio_key = f"audio/{slug}.mp3"
        audio_result = upload_to_r2(str(audio_path), audio_key, 'audio/mpeg')

        if not audio_result or not audio_result['success']:
            print("  ❌ 音频上传失败")
            shutil.rmtree(temp_dir)
            return False
        print(f"  ✅ 音频: {audio_result['public_url']}")

        # 上传封面
        thumbnail_result = None
        if thumbnail_path and thumbnail_path.exists():
            thumbnail_key = f"thumbnails/{slug}.{thumbnail_ext}"
            thumbnail_mime = 'image/webp' if thumbnail_ext == 'webp' else 'image/jpeg'
            thumbnail_result = upload_to_r2(str(thumbnail_path), thumbnail_key, thumbnail_mime)
            if thumbnail_result and thumbnail_result['success']:
                print(f"  ✅ 封面: {thumbnail_result['public_url']}")

        # ============ 步骤 5: 写入 Supabase ============
        print_section("步骤 5/5: 写入 Supabase")

        category_map = {
            'daily': '日常生活',
            'story': '故事',
            'speech': '历史演讲',
            'culture': '艺术文化'
        }
        category_zh = category_map.get(category, category)
        difficulty = determine_difficulty(category, title)

        material_data = {
            'title': title,
            'category': category_zh,
            'difficulty': difficulty,
            'audio_path': audio_result['public_url'],
            'thumbnail_path': thumbnail_result['public_url'] if thumbnail_result else None,
            'audio_size': audio_result['size'],
            'duration': int(duration),
            'transcript': sentences,
            'play_count': 0
        }

        print(f"  📝 标题: {title}")
        print(f"  📂 分类: {category_zh}")
        print(f"  📊 难度: {difficulty}")
        print(f"  📝 句子数: {len(sentences)}")

        result = supabase.table('materials').insert(material_data).execute()

        if not result.data:
            print("  ❌ 插入失败")
            shutil.rmtree(temp_dir)
            return False

        material_id = result.data[0]['id']
        print(f"  ✅ 成功插入到 Supabase")
        print(f"     UUID: {material_id}")

        # 完成
        shutil.rmtree(temp_dir)

        print()
        print("=" * 70)
        print()
        print("🎉 该素材已在 R2 托管，并在 Supabase 中上线，可以开始练习！")
        print()
        print("=" * 70)
        print()
        print("📌 基本信息：")
        print(f"   标题: {title}")
        print(f"   分类: {category_zh}")
        print(f"   难度: {difficulty}")
        print(f"   时长: {duration} 秒")
        print(f"   句子数: {len(sentences)}")
        print()
        print("🔗 资源链接（R2，中国可访问）：")
        print(f"   📹 视频: {video_result['public_url']}")
        print(f"   🎵 音频: {audio_result['public_url']}")
        if thumbnail_result:
            print(f"   🖼️  封面: {thumbnail_result['public_url']}")
        print()
        print("📄 练习链接：")
        print(f"   听写: http://localhost:3000/topics/dictation/{slug}")
        print(f"   跟读: http://localhost:3000/topics/shadowing/{slug}")
        print()
        print("=" * 70)

        return True

    except Exception as e:
        print(f"\n❌ 处理失败: {e}")
        import traceback
        traceback.print_exc()

        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        return False


# ==================== 主函数 ====================

def main():
    if len(sys.argv) < 3:
        print("用法：")
        print("  # 处理单个视频")
        print("  python3 scripts/sync_all.py \"视频文件名.mp4\" \"分类\"")
        print()
        print("  # 处理所有未上传的视频")
        print("  python3 scripts/sync_all.py --all \"分类\"")
        print()
        print("示例：")
        print("  python3 scripts/sync_all.py \"video.mp4\" \"daily\"")
        print("  python3 scripts/sync_all.py --all \"daily\"")
        print()
        print("分类选项：")
        print("  daily   - 日常生活")
        print("  story   - 故事")
        print("  speech  - 历史演讲")
        print("  culture - 艺术文化")
        print()
        print("环境变量：")
        print("  GLM_API_KEY - 智谱 AI API 密钥（用于翻译）")
        sys.exit(1)

    category_map = {
        'daily': '日常生活',
        'story': '故事',
        'speech': '历史演讲',
        'culture': '艺术文化'
    }

    arg1 = sys.argv[1]
    category = sys.argv[2]

    if category not in category_map:
        print(f"❌ 无效分类: {category}")
        print(f"有效分类: {', '.join(category_map.keys())}")
        sys.exit(1)

    print_section("🎬 本地视频 → R2 → Supabase 完整工厂流")
    print(f"📂 分类: {category} ({category_map[category]})")

    print_section("连接服务")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("  ✅ Supabase 连接成功")

    if GLM_API_KEY:
        print("  ✅ GLM API 已配置")
    else:
        print("  ⚠️  未设置 GLM_API_KEY，将跳过翻译")

    # 检查 ffmpeg
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        print("  ✅ FFmpeg 可用")
    except:
        print("  ❌ FFmpeg 不可用，请确保已安装")
        sys.exit(1)

    if not VIDEO_DIR.exists():
        print(f"  ❌ 视频目录不存在: {VIDEO_DIR}")
        sys.exit(1)

    video_files = []

    if arg1 == "--all":
        video_files = list(VIDEO_DIR.glob("*.mp4"))
        print(f"  📁 找到 {len(video_files)} 个视频文件")
    else:
        video_path = VIDEO_DIR / arg1
        if not video_path.exists():
            print(f"  ❌ 视频文件不存在: {video_path}")
            sys.exit(1)
        video_files = [video_path]

    if not video_files:
        print("  ❌ 未找到视频文件")
        sys.exit(1)

    # 处理视频
    success_count = 0
    skip_count = 0
    fail_count = 0

    for idx, video_path in enumerate(video_files, 1):
        print(f"\n{'='*70}")
        print(f"进度: {idx}/{len(video_files)}")
        print(f"{'='*70}")

        result = process_video(video_path, category, supabase)

        if result:
            success_count += 1
        else:
            existing = supabase.table('materials').select('*').eq('title', clean_title(video_path.stem)).execute()
            if existing.data:
                skip_count += 1
            else:
                fail_count += 1

    # 统计
    print(f"\n{'='*70}")
    print("📊 处理完成统计")
    print(f"{'='*70}")
    print(f"✅ 成功: {success_count}")
    print(f"⏭️  跳过: {skip_count}")
    print(f"❌ 失败: {fail_count}")
    print(f"{'='*70}\n")


if __name__ == '__main__':
    main()
