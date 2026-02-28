#!/usr/bin/env python3
"""
自动化添加 Bilibili 视频素材

功能：
1. 下载 Bilibili 视频（使用 yt-dlp）
2. 提取音频用于 Whisper 转录
3. 上传视频和音频到 Supabase Storage
4. 使用 Whisper 转录并生成分句
5. 翻译句子
6. 保存到数据库

用法：
    python3 add_bilibili_video.py

环境变量：
    SUPABASE_SERVICE_KEY - Supabase service key
"""

import os
import sys
import json
import time
import shutil
import subprocess
import re
from pathlib import Path
from typing import Dict, List, Optional

# 添加 Homebrew bin 到 PATH
sys.path.insert(0, '/opt/homebrew/bin')
os.environ['PATH'] = '/opt/homebrew/bin:' + os.environ.get('PATH', '')

import requests
import whisper
from supabase import create_client, Client

# ============ 配置 ============
SUPABASE_URL = "https://cuxotlijjnxbsirpdkgr.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not SUPABASE_KEY:
    raise ValueError("请设置环境变量 SUPABASE_SERVICE_KEY")

STORAGE_BUCKET = "engnovate-audio"

# ============ 工具函数 ============

def clean_filename(title: str) -> str:
    """清理文件名，移除不安全字符"""
    # 移除或替换不安全字符
    title = re.sub(r'[<>:"/\\|?*]', '', title)
    # 移除多余空格
    title = re.sub(r'\s+', ' ', title).strip()
    return title

def sanitize_for_url(filename: str) -> str:
    """将文件名转换为 URL 安全格式"""
    # 替换空格为 %20
    return filename.replace(' ', '%20')

def download_bilibili_video(url: str, output_dir: Path) -> Dict[str, str]:
    """
    下载 Bilibili 视频

    Returns:
        dict with keys: video_path, audio_path, title, thumbnail_path
    """
    print(f"📥 下载 Bilibili 视频...")
    print(f"  URL: {url}")

    output_template = str(output_dir / "%(title)s.%(ext)s")

    # 使用 yt-dlp 下载视频和缩略图
    cmd = [
        'yt-dlp',
        '--write-thumbnail',
        '--convert-thumbnails', 'jpg',
        '--format', 'mp4',
        '-o', output_template,
        url
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("  ✅ 视频下载完成")
    except subprocess.CalledProcessError as e:
        print(f"  ❌ 下载失败: {e.stderr}")
        raise

    # 查找下载的视频文件
    video_files = list(output_dir.glob("*.mp4"))
    if not video_files:
        raise FileNotFoundError("未找到下载的视频文件")

    video_path = video_files[0]
    title = video_path.stem

    # 提取音频
    print(f"  🎵 提取音频...")
    audio_path = output_dir / f"{title}.mp3"
    cmd = [
        'ffmpeg',
        '-i', str(video_path),
        '-vn',
        '-acodec', 'libmp3lame',
        '-q:a', '2',
        str(audio_path)
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("  ✅ 音频提取完成")
    except subprocess.CalledProcessError as e:
        print(f"  ❌ 音频提取失败: {e.stderr}")
        raise

    # 查找缩略图
    thumbnail_files = list(output_dir.glob("*.jpg")) + list(output_dir.glob("*.png"))
    thumbnail_path = thumbnail_files[0] if thumbnail_files else None

    return {
        'video_path': str(video_path),
        'audio_path': str(audio_path),
        'title': title,
        'thumbnail_path': str(thumbnail_path) if thumbnail_path else None
    }

def upload_to_supabase(file_path: str, folder: str) -> str:
    """
    上传文件到 Supabase Storage

    Args:
        file_path: 本地文件路径
        folder: Storage 文件夹名称（如 'audio', 'videos', 'thumbnails'）

    Returns:
        上传后的文件路径（用于构建 URL）
    """
    filename = Path(file_path).name
    storage_path = f"{folder}/{filename}"

    print(f"  📤 上传 {folder}/{filename}...")

    with open(file_path, 'rb') as f:
        client.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=f,
            file_options={'content-type': 'application/octet-stream'}
        )

    print(f"  ✅ 上传完成")
    return storage_path

def split_words_to_sentences(words, title: str):
    """
    智能分句规则（针对连贯说话优化）
    """
    if not words:
        return []

    sentences = []
    current_sentence_words = []
    sentence_start = words[0]['start']

    LONG_PAUSE_THRESHOLD = 1.5
    SHORT_PAUSE_THRESHOLD = 0.6
    MAX_SENTENCE_DURATION = 30
    MAX_SENTENCE_WORDS = 50

    for i, word in enumerate(words):
        current_sentence_words.append(word)
        word_text = word['word'].strip()
        should_end = False

        if i < len(words) - 1:
            next_word = words[i + 1]
            pause = next_word['start'] - word['end']
            current_duration = word['end'] - sentence_start
            current_word_count = len(current_sentence_words)
            is_long_sentence = current_duration > MAX_SENTENCE_DURATION or current_word_count > MAX_SENTENCE_WORDS

            if pause > LONG_PAUSE_THRESHOLD:
                should_end = True
            elif word_text.endswith(('.', '?', '!')) and pause > SHORT_PAUSE_THRESHOLD:
                should_end = True
            elif is_long_sentence and word_text.endswith(('.', '?', '!')):
                should_end = True

        if should_end and current_sentence_words:
            text = ''.join([w['word'] for w in current_sentence_words]).strip()
            if text and len(text) > 2:
                sentences.append({
                    'id': len(sentences) + 1,
                    'text': text,
                    'start': sentence_start,
                    'end': word['end']
                })
                current_sentence_words = []
                if i < len(words) - 1:
                    sentence_start = words[i + 1]['start']

    if current_sentence_words:
        text = ''.join([w['word'] for w in current_sentence_words]).strip()
        if text and len(text) > 2:
            sentences.append({
                'id': len(sentences) + 1,
                'text': text,
                'start': sentence_start,
                'end': current_sentence_words[-1]['end']
            })

    return sentences

def translate_sentence(text: str) -> str:
    """使用 MyMemory API 翻译句子"""
    try:
        url = f"https://api.mymemory.translated.net/get?q={text}&langpair=en|zh-CN"
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get('responseStatus') == 200:
            return data['responseData']['translatedText']
    except Exception as e:
        print(f"    ⚠️  翻译失败: {e}")

    return None

def get_video_duration(file_path: str) -> float:
    """获取视频时长（秒）"""
    cmd = [
        'ffprobe',
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        file_path
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except:
        return 0

def main():
    """主函数"""
    print("=" * 70)
    print("🎬 Bilibili 视频素材自动化添加工具")
    print("=" * 70)

    # 初始化 Supabase
    print("🔗 连接 Supabase...")
    global client
    client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取用户输入
    print("\n" + "=" * 70)
    print("请输入视频信息：")
    print("=" * 70)

    bilibili_url = input("\n1️⃣  Bilibili 视频 URL: ").strip()
    if not bilibili_url:
        print("❌ URL 不能为空")
        return

    custom_title = input("\n2️⃣  自定义标题（留空使用视频原标题）: ").strip()
    difficulty = input("\n3️⃣  难度级别 (beginner/intermediate/advanced): ").strip() or "intermediate"

    # 创建临时目录
    temp_dir = Path("/tmp/bilibili_video")
    temp_dir.mkdir(exist_ok=True)

    try:
        # 步骤1: 下载视频
        print(f"\n{'='*70}")
        print(f"📥 第1步: 下载视频")
        print(f"{'='*70}")

        video_info = download_bilibili_video(bilibili_url, temp_dir)

        video_path = video_info['video_path']
        audio_path = video_info['audio_path']
        video_title = custom_title or video_info['title']
        clean_title = clean_filename(video_title)

        print(f"\n  📌 标题: {video_title}")
        print(f"  📹 视频文件: {Path(video_path).name}")
        print(f"  🎵 音频文件: {Path(audio_path).name}")

        # 步骤2: 转录
        print(f"\n{'='*70}")
        print(f"🎤 第2步: 转录音频")
        print(f"{'='*70}")

        print(f"  🎯 加载 Whisper 模型 (base)...")
        model = whisper.load_model('base')

        print(f"  🎤 正在转录...")
        result = model.transcribe(
            audio_path,
            language='en',
            word_timestamps=True,
            fp16=False
        )

        all_words = []
        for segment in result['segments']:
            if 'words' in segment:
                all_words.extend(segment['words'])

        print(f"  ✅ 转录完成，共 {len(all_words)} 个词")

        # 步骤3: 分句
        print(f"\n{'='*70}")
        print(f"📝 第3步: 分割句子")
        print(f"{'='*70}")

        sentences = split_words_to_sentences(all_words, video_title)
        print(f"  ✅ 生成 {len(sentences)} 句")

        # 步骤4: 翻译
        print(f"\n{'='*70}")
        print(f"🌐 第4步: 翻译")
        print(f"{'='*70}")

        for i, sentence in enumerate(sentences):
            if sentence['text']:
                translation = translate_sentence(sentence['text'])
                if translation:
                    sentence['translation'] = translation
                    print(f"    [{i+1}/{len(sentences)}] {sentence['text'][:30]}... → {sentence['translation'][:20]}...")

                time.sleep(0.5)

        # 步骤5: 上传文件
        print(f"\n{'='*70}")
        print(f"📤 第5步: 上传文件到 Supabase")
        print(f"{'='*70}")

        # 重命名文件
        video_filename = f"{clean_title}.mp4"
        audio_filename = f"{clean_title}.mp3"
        thumbnail_filename = f"{clean_title}.jpg"

        new_video_path = temp_dir / video_filename
        new_audio_path = temp_dir / audio_filename
        new_thumbnail_path = temp_dir / thumbnail_filename

        shutil.move(video_path, new_video_path)
        shutil.move(audio_path, new_audio_path)

        if video_info.get('thumbnail_path'):
            shutil.move(video_info['thumbnail_path'], new_thumbnail_path)

        # 上传视频
        video_storage_path = upload_to_supabase(str(new_video_path), 'videos')

        # 上传音频
        audio_storage_path = upload_to_supabase(str(new_audio_path), 'audio')

        # 上传缩略图
        thumbnail_storage_path = None
        if new_thumbnail_path.exists():
            thumbnail_storage_path = upload_to_supabase(str(new_thumbnail_path), 'thumbnails')

        # 步骤6: 保存到数据库
        print(f"\n{'='*70}")
        print(f"💾 第6步: 保存到数据库")
        print(f"{'='*70}")

        # 获取视频时长和文件大小
        duration = get_video_duration(str(new_video_path))
        video_size = os.path.getsize(str(new_video_path))

        transcript_data = [
            {
                'id': s['id'],
                'text': s['text'],
                'startTime': f"{s['start']:.2f}",
                'endTime': f"{s['end']:.2f}",
                'translation': s.get('translation')
            }
            for s in sentences
        ]

        material_data = {
            'title': video_title,
            'category': '故事',
            'difficulty': difficulty,
            'audio_path': sanitize_for_url(audio_storage_path),
            'video_path': sanitize_for_url(video_storage_path),
            'thumbnail_path': sanitize_for_url(thumbnail_storage_path) if thumbnail_storage_path else None,
            'duration': int(duration),
            'transcript': transcript_data,
            'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S')
        }

        client.table('materials').insert(material_data).execute()

        print(f"  ✅ 保存成功!")

        # 步骤7: 更新 materialSlugs.ts
        print(f"\n{'='*70}")
        print(f"📝 第7步: 更新 materialSlugs.ts")
        print(f"{'='*70}")

        slug = clean_title.lower().replace(' ', '-').replace("'", '')
        slug = re.sub(r'[^\w\-]', '', slug)

        print(f"\n  请手动添加以下内容到 src/lib/data/materialSlugs.ts:")
        print(f"  {{ slug: \"{slug}\" }},")

        # 清理临时文件
        shutil.rmtree(temp_dir)

        # 显示结果
        print(f"\n{'='*70}")
        print(f"✅ 完成！")
        print(f"{'='*70}")
        print(f"📌 标题: {video_title}")
        print(f"📝 总句数: {len(sentences)}")
        print(f"⏱️  时长: {duration:.1f} 秒")
        print(f"🎨 难度: {difficulty}")
        print(f"📂 Slug: {slug}")
        print(f"\n🔗 在线练习: https://xiaoshuangsu.github.io/dictation-shadowing-tool/")
        print(f"{'='*70}")

    except Exception as e:
        print(f"\n❌ 处理失败: {e}")
        import traceback
        traceback.print_exc()

        # 清理临时文件
        if temp_dir.exists():
            shutil.rmtree(temp_dir)

if __name__ == '__main__':
    main()
