#!/usr/bin/env python3
"""
YouTube 单视频处理脚本（静默模式）
严格遵守 ShadowHub 规范：每次只处理 1 个 URL
"""

import os
import sys
import json
import subprocess
import tempfile
import shutil
import re
import time
import io
import requests
from pathlib import Path
from typing import Dict, List, Optional

# 静默导入第三方库
try:
    import whisper
    import boto3
    from PIL import Image
    from supabase import create_client
except ImportError as e:
    print(f"缺少依赖: {e}")
    print("请运行: pip install openai-whisper boto3 pillow supabase requests")
    sys.exit(1)

# ==================== 加载环境变量 ====================
def load_env():
    """从 .env.local 加载环境变量"""
    env_path = Path(__file__).parent.parent / '.env.local'
    if not env_path.exists():
        raise FileNotFoundError(f".env.local 不存在: {env_path}")

    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

load_env()

# ==================== 配置 ====================
R2_ENDPOINT = f"https://{os.environ['NEXT_PUBLIC_R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
# 使用 R2 公共域名（移动端兼容，无需 Worker 代理）
R2_PUBLIC_URL = "https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev"
SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
GLM_API_KEY = os.environ['GLM_API_KEY']
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"

# 工作目录
WORK_DIR = Path(tempfile.gettempdir()) / "yt_single"
WORK_DIR.mkdir(exist_ok=True)


def log(msg: str):
    """只输出关键进度"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def slugify(text: str) -> str:
    """生成 URL 友好的 slug"""
    text = text.lower().strip()
    # 移除特殊字符
    text = re.sub(r'[^\w\s-]', '', text)
    # 空格转连字符
    text = re.sub(r'\s+', '-', text)
    # 移除多余连字符
    text = re.sub(r'-+', '-', text)
    return text.strip('-')[:100]


# ==================== 步骤 1: 下载视频 ====================
def download_video(youtube_url: str) -> Optional[Dict]:
    """下载视频并获取元数据"""
    log("下载视频...")
    output_file = WORK_DIR / "video.mp4"
    info_file = WORK_DIR / "info.json"

    # 先获取元数据
    info_cmd = [
        "/opt/homebrew/bin/yt-dlp",
        "--cookies-from-browser", "chrome",
        "--dump-json",
        "--no-playlist",
        youtube_url
    ]

    info_result = subprocess.run(info_cmd, capture_output=True, text=True)
    video_info = {}
    if info_result.returncode == 0:
        try:
            video_info = json.loads(info_result.stdout)
        except:
            pass

    # 再下载视频
    cmd = [
        "/opt/homebrew/bin/yt-dlp",
        "--cookies-from-browser", "chrome",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", str(output_file),
        "--no-playlist",
        youtube_url
    ]

    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0 or not output_file.exists():
        if result.stderr:
            print(f"下载错误: {result.stderr.decode()}")
        return None

    return {
        "path": output_file,
        "info": video_info
    }


# ==================== 步骤 2: 压缩视频 ====================
def compress_video(input_path: Path) -> Optional[Path]:
    """压缩视频到 480p"""
    log("压缩视频...")
    output_path = WORK_DIR / "video_480p.mp4"

    cmd = [
        "/opt/homebrew/bin/ffmpeg",
        "-i", str(input_path),
        "-vf", "scale=-2:480",
        "-vcodec", "libx264",
        "-crf", "30",
        "-preset", "medium",
        "-acodec", "aac",
        "-b:a", "128k",
        "-y",
        str(output_path)
    ]

    subprocess.run(cmd, capture_output=True)
    return output_path if output_path.exists() else None


# ==================== 步骤 3: 提取音频 ====================
def extract_audio(video_path: Path) -> Optional[Path]:
    """提取 MP3 音频"""
    log("提取音频...")
    output_path = WORK_DIR / "audio.mp3"

    cmd = [
        "/opt/homebrew/bin/ffmpeg",
        "-i", str(video_path),
        "-vn",
        "-acodec", "libmp3lame",
        "-b:a", "128k",
        "-y",
        str(output_path)
    ]

    subprocess.run(cmd, capture_output=True)
    return output_path if output_path.exists() else None


# ==================== 步骤 4: Whisper 转录 + 物理断句 ====================
def transcribe(audio_path: Path) -> Optional[List[Dict]]:
    """使用 Whisper 生成带时间戳的转录，并按规则物理断句"""
    log("Whisper 转录中...")

    try:
        model = whisper.load_model("base")
        result = model.transcribe(
            str(audio_path),
            language="en",
            word_timestamps=True,
            verbose=False
        )

        # 收集所有单词，用于断句
        all_words = []
        for seg in result["segments"]:
            if "words" in seg:
                for word_info in seg["words"]:
                    all_words.append({
                        "word": word_info["word"].strip(),
                        "start": word_info["start"],
                        "end": word_info["end"]
                    })
            else:
                # 如果没有 word 级时间戳，降级使用 segment
                all_words.append({
                    "word": seg["text"].strip(),
                    "start": seg["start"],
                    "end": seg["end"]
                })

        # 物理断句
        sentences = []
        current_sentence_words = []
        current_start = None

        for i, word in enumerate(all_words):
            if current_start is None:
                current_start = word["start"]
                current_sentence_words = [word]
                continue

            current_sentence_words.append(word)

            # 检查是否需要断句
            should_split = False

            # 规则1: 标点 `?.!` 强制切分
            if any(p in word["word"] for p in [".", "?", "!"]):
                should_split = True

            # 规则2: 逗号 + 停顿 > 0.8s
            elif "," in word["word"]:
                # 检查下一个词的停顿
                if i + 1 < len(all_words):
                    gap = all_words[i + 1]["start"] - word["end"]
                    if gap > 0.8:
                        should_split = True

            # 规则3: 任何停顿 > 0.8s
            else:
                if i + 1 < len(all_words):
                    gap = all_words[i + 1]["start"] - word["end"]
                    if gap > 0.8:
                        should_split = True

            if should_split:
                # 构建句子
                text = " ".join([w["word"] for w in current_sentence_words]).strip()
                sentences.append({
                    "id": len(sentences) + 1,
                    "text": text,
                    "startTime": round(current_start, 3),
                    "endTime": round(word["end"], 3),
                    "translation": ""
                })
                # 重置
                current_sentence_words = []
                current_start = None

        # 处理最后一个句子
        if current_sentence_words:
            text = "".join([w["word"] for w in current_sentence_words]).strip()
            if text:
                sentences.append({
                    "id": len(sentences) + 1,
                    "text": text,
                    "startTime": round(current_start, 3),
                    "endTime": round(current_sentence_words[-1]["end"], 3),
                    "translation": ""
                })

        log(f"转录完成: {len(sentences)} 句")
        return sentences

    except Exception as e:
        log(f"转录失败: {e}")
        return None


# ==================== 步骤 5: GLM 翻译 ====================
def translate_transcript(transcript: List[Dict]) -> List[Dict]:
    """使用 GLM API 翻译"""
    log(f"GLM 翻译 {len(transcript)} 句...")

    def translate_one(text: str) -> str:
        try:
            response = requests.post(
                f"{GLM_BASE_URL}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GLM_API_KEY}"
                },
                json={
                    "model": "glm-4-flash",
                    "messages": [
                        {"role": "system", "content": "你是专业的英汉翻译专家。将英文翻译成地道的中文口语，只返回翻译结果。"},
                        {"role": "user", "content": text}
                    ],
                    "temperature": 0.3
                },
                timeout=30
            )
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"].strip()
        except:
            pass
        return text

    for i, item in enumerate(transcript, 1):
        item["translation"] = translate_one(item["text"])
        if i % 10 == 0:
            log(f"翻译进度: {i}/{len(transcript)}")
        time.sleep(0.3)

    log("翻译完成")
    return transcript


# ==================== 步骤 6: 处理缩略图 ====================
def process_thumbnail(video_id: str) -> Optional[tuple]:
    """下载并压缩缩略图"""
    log("处理缩略图...")

    try:
        url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return None

        img = Image.open(io.BytesIO(resp.content))

        # 缩放到 480px 宽
        if img.width > 480:
            ratio = 480 / img.width
            new_h = int(img.height * ratio)
            img = img.resize((480, new_h), Image.Resampling.LANCZOS)

        # 压缩为 JPEG
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=75, optimize=True)
        data = output.getvalue()

        return data, f"thumbnails/{video_id}.jpg"

    except Exception as e:
        log(f"缩略图处理失败: {e}")
        return None


# ==================== 步骤 7: 上传 R2 ====================
def upload_to_r2(file_path: str = None, data: bytes = None,
                 key: str = None, content_type: str = None) -> Optional[str]:
    """上传到 R2，返回完整 URL"""
    s3 = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY']
    )

    try:
        if data:
            s3.put_object(
                Bucket=os.environ['R2_BUCKET_NAME'],
                Key=key,
                Body=data,
                ContentType=content_type
            )
        else:
            s3.upload_file(
                file_path,
                os.environ['R2_BUCKET_NAME'],
                key,
                ExtraArgs={'ContentType': content_type}
            )

        return f"{R2_PUBLIC_URL}/{key}"

    except Exception as e:
        log(f"R2 上传失败 {key}: {e}")
        return None


# ==================== 步骤 8: 同步 Supabase ====================
def sync_supabase(metadata: Dict, transcript: List[Dict],
                  video_url: str, audio_url: str,
                  thumbnail_url: str) -> bool:
    """同步到 Supabase"""
    log("同步到 Supabase...")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 检查是否已存在
    existing = supabase.table('materials').select('*').eq(
        'title', metadata['title']
    ).execute()

    # 获取音频文件大小
    audio_size = os.path.getsize(WORK_DIR / "audio.mp3") if (WORK_DIR / "audio.mp3").exists() else 0

    # 生成 SEO 字段
    slug = slugify(metadata['title'])

    # 生成 meta_title: [Title] | English Dictation & Shadowing
    meta_title = f"{metadata['title']} | English Dictation & Shadowing"

    # 生成 meta_description: 从转录文本提取前 150 字符
    if transcript and len(transcript) > 0:
        # 取前 5 句话作为描述
        desc_text = ' '.join([s.get('text', '') for s in transcript[:5]])
        desc_text = desc_text.replace('\n', ' ').strip()
        meta_description = desc_text[:150] + '...' if len(desc_text) > 150 else desc_text
    else:
        meta_description = f"Practice English listening and speaking with '{metadata['title']}' dictation exercise. Improve your English skills with interactive audio and text."

    # og_image: 复用缩略图路径
    og_image = thumbnail_url

    material_data = {
        'title': metadata['title'],
        'slug': slug,  # SEO: URL 友好的唯一标识
        'category': metadata.get('category', '故事'),
        'difficulty': metadata.get('difficulty', 'A2'),
        'audio_path': audio_url,
        'video_path': video_url,
        'thumbnail_path': thumbnail_url,
        'audio_size': audio_size,
        'duration': metadata.get('duration', 0),
        'transcript': transcript,
        'play_count': 0,
        # SEO 字段
        'meta_title': meta_title,
        'meta_description': meta_description,
        'og_image': og_image
    }

    try:
        if existing.data:
            # 更新
            material_id = existing.data[0]['id']
            supabase.table('materials').update(
                material_data
            ).eq('id', material_id).execute()
            log("更新现有记录")
        else:
            # 新增
            supabase.table('materials').insert(material_data).execute()
            log("创建新记录")

        return True

    except Exception as e:
        log(f"Supabase 同步失败: {e}")
        return False


# ==================== 主流程 ====================
def main():
    if len(sys.argv) < 2:
        print("用法: python3 scripts/youtube_single.py <YouTube_URL> [分类]")
        print("分类: story, ted, speech, daily, culture, bbc, voa (默认: story)")
        sys.exit(1)

    youtube_url = sys.argv[1]
    category_map = {
        'story': ('故事', 'A2'),
        'ted': ('TED演讲', 'B1'),
        'speech': ('历史演讲', 'B1'),
        'daily': ('日常生活', 'A2'),
        'culture': ('艺术文化', 'B2'),
        'bbc': ('BBC Learning English', 'A2'),
        'voa': ('VOA Learning English', 'A2')
    }
    category = sys.argv[2] if len(sys.argv) > 2 else 'story'

    if category not in category_map:
        log(f"无效分类: {category}")
        sys.exit(1)

    category_zh, difficulty = category_map[category]

    log("="*50)
    log(f"开始处理: {youtube_url}")
    log(f"分类: {category_zh} ({difficulty})")

    try:
        # 1. 下载
        result = download_video(youtube_url)
        if not result:
            log("下载失败")
            sys.exit(1)

        video_path = result["path"]
        info = result["info"]
        video_id = info.get("id", youtube_url.split("/")[-1])

        # 提取标题
        raw_title = info.get("title", "Unknown")
        # 提取英文部分（去掉中文字符）
        title = re.sub(r'[^\x00-\x7F]+', '', raw_title).strip()
        if not title:
            title = raw_title
        slug = slugify(title)

        log(f"标题: {title[:60]}...")
        log(f"Slug: {slug}")

        # 2. 压缩
        compressed = compress_video(video_path)
        if not compressed:
            compressed = video_path

        # 3. 提取音频
        audio_path = extract_audio(compressed)
        if not audio_path:
            log("音频提取失败")
            sys.exit(1)

        # 4. 转录
        transcript = transcribe(audio_path)
        if not transcript:
            log("转录失败")
            sys.exit(1)

        # 5. 翻译
        transcript = translate_transcript(transcript)

        # 6. 缩略图
        thumb_result = process_thumbnail(video_id)

        # 7. 上传 R2
        log("上传到 R2...")

        audio_key = f"audio/{slug}.mp3"
        audio_url = upload_to_r2(str(audio_path), key=audio_key,
                                content_type='audio/mpeg')

        video_key = f"videos/{slug}.mp4"
        video_url = upload_to_r2(str(compressed), key=video_key,
                                content_type='video/mp4')

        thumbnail_url = None
        if thumb_result:
            thumb_data, thumb_key = thumb_result
            thumbnail_url = upload_to_r2(data=thumb_data, key=thumb_key,
                                        content_type='image/jpeg')

        if not audio_url or not video_url:
            log("R2 上传失败")
            sys.exit(1)

        # 8. 同步 Supabase
        metadata = {
            'title': title,
            'category': category_zh,
            'difficulty': difficulty,
            'duration': info.get('duration', 0)
        }

        if sync_supabase(metadata, transcript, video_url,
                        audio_url, thumbnail_url):
            log("="*50)
            log("处理完成")
            log(f"标题: {title}")
            log(f"路径: /topics/dictation/{slug}")
            log("="*50)
        else:
            sys.exit(1)

    except Exception as e:
        log(f"错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        # 清理临时文件
        if WORK_DIR.exists():
            shutil.rmtree(WORK_DIR)


if __name__ == "__main__":
    main()
