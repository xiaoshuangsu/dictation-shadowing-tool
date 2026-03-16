#!/usr/bin/env python3
"""
批量素材导入脚本
从 Engnovate 抓取多个 Dictation/Shadowing 练习

特点：
1. 解析页面的原生时间戳数据（data-start, data-duration）
2. 下载音频并上传到 R2
3. 使用 GLM API 进行翻译
4. 存入 Supabase
5. 跳过重复（根据 source_url）
6. 容错运行（单个失败不影响整体）
"""
import os
import sys
import json
import re
import time
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from supabase import create_client
import boto3
from typing import Optional, List, Dict

# ==================== 加载环境变量 ====================
def load_env():
    """从 .env.local 加载环境变量"""
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

# ==================== 配置 ====================
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
R2_ACCOUNT_ID = os.environ.get('NEXT_PUBLIC_R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME')
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_PUBLIC_URL = "https://media.shadowhub.app"
GLM_API_KEY = os.environ.get('GLM_API_KEY')

# 分类映射（根据前端代码）
CATEGORY_SLUG_MAP = {
    '日常生活': 'daily-life',
    '历史演讲': 'historical-speeches',
    '文化历史': 'culture-history',
    '心灵故事': 'heart-soul-stories',
    '艺术文化': 'arts-culture',
    'YouTube Vlog': 'youtube-vlog',
    '故事': 'stories',
    '人物访谈': 'interviews',
    'BBC Learning English': 'bbc-learning-english',
    'VOA Learning English': 'voa-learning-english',
    'TED演讲': 'ted-talks',
    '动画片': 'cartoons',
}

# ==================== 工具函数 ====================

def log(msg: str):
    """简化日志输出"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def slugify(text: str) -> str:
    """生成 URL 友好的 slug"""
    text = text.lower().strip()
    # 移除特殊字符
    text = re.sub(r'[^\w\s-]', '', text)
    # 替换空格为连字符
    text = re.sub(r'\s+', '-', text)
    # 移除多余连字符
    text = re.sub(r'-+', '-', text)
    return text.strip('-')[:100]

def check_duplicate(slug: str) -> bool:
    """检查 slug 是否已存在"""
    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        result = client.table('materials').select('*').eq('slug', slug).execute()
        return len(result.data) > 0
    except Exception as e:
        log(f"  ⚠ 检查重复时出错: {e}")
        return False

def fetch_page(url: str) -> Optional[str]:
    """抓取页面内容"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as e:
        log(f"  ❌ 抓取失败: {e}")
        return None

def parse_title(html: str) -> Optional[str]:
    """解析页面标题"""
    soup = BeautifulSoup(html, 'html.parser')

    # 尝试从 h1 获取
    h1 = soup.find('h1')
    if h1:
        title = h1.get_text().strip()
        # 移除后缀
        for suffix in ['English Dictation', 'Shadowing Exercise', '& Shadowing Exercise']:
            title = title.replace(suffix, '').strip()
        if title:
            return title

    # 尝试从 title 标签获取
    title_tag = soup.find('title')
    if title_tag:
        title = title_tag.get_text().strip()
        # 移除后缀
        for suffix in ['English Dictation', 'Shadowing Exercise', '& Shadowing Exercise']:
            title = title.replace(suffix, '').strip()
        if title:
            return title

    return None

def parse_audio_url(html: str) -> Optional[str]:
    """解析音频 URL"""
    soup = BeautifulSoup(html, 'html.parser')

    # 查找 audio 标签
    audio_tags = soup.find_all('audio')
    for audio in audio_tags:
        src = audio.get('src')
        if src and '.mp3' in src:
            return src

    # 搜索所有 .mp3 链接
    mp3_links = re.findall(r'https?://[^\s"\'<>]+\.mp3', html)
    if mp3_links:
        return mp3_links[0]

    return None

def parse_transcript(html: str) -> Optional[List[Dict]]:
    """解析 Transcript 内容和时间戳"""
    soup = BeautifulSoup(html, 'html.parser')
    transcript_lines = soup.find_all('div', class_='transcript-line')

    if not transcript_lines:
        return None

    sentences = []
    for line in transcript_lines:
        start = float(line.get('data-start', 0))
        duration = float(line.get('data-duration', 0))
        end = round(start + duration, 3)

        words_spans = line.find_all('span', class_='word')
        text = ' '.join([w.get_text() for w in words_spans]).strip()

        if text:
            sentences.append({
                'id': len(sentences) + 1,
                'text': text,
                'startTime': round(start, 3),
                'endTime': end,
                'translation': ''
            })

    return sentences

def download_audio(url: str, output_path: Path) -> Optional[Path]:
    """下载音频文件"""
    try:
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()

        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        file_size = output_path.stat().st_size
        log(f"  ✓ 下载完成: {file_size / 1024 / 1024:.2f} MB")
        return output_path
    except Exception as e:
        log(f"  ❌ 下载失败: {e}")
        return None

def upload_to_r2(file_path: Path, key: str) -> Optional[str]:
    """上传文件到 R2"""
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY
        )

        s3.upload_file(
            str(file_path),
            R2_BUCKET_NAME,
            key,
            ExtraArgs={'ContentType': 'audio/mpeg'}
        )

        log(f"  ✓ 上传成功")
        return key
    except Exception as e:
        log(f"  ❌ 上传失败: {e}")
        return None

def translate_with_glm(sentences: List[Dict]) -> List[Dict]:
    """使用 GLM API 翻译"""
    api_url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

    for i, sentence in enumerate(sentences, 1):
        try:
            response = requests.post(
                api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GLM_API_KEY}"
                },
                json={
                    "model": "glm-4-flash",
                    "messages": [
                        {"role": "system", "content": "你是专业的英汉翻译专家。将英文翻译成地道的中文口语，只返回翻译结果。"},
                        {"role": "user", "content": sentence['text']}
                    ],
                    "temperature": 0.3
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                translation = result["choices"][0]["message"]["content"].strip()
                sentence['translation'] = translation

            if i % 5 == 0:
                log(f"  翻译进度: {i}/{len(sentences)}")

            time.sleep(0.3)

        except Exception as e:
            log(f"  ⚠ 翻译失败 (第{i}句): {e}")
            sentence['translation'] = sentence['text']

    return sentences

def save_to_supabase(title: str, slug: str, audio_path: str, transcript: List[Dict]) -> bool:
    """保存到 Supabase"""
    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        duration = int(transcript[-1]['endTime']) if transcript else 0

        material_data = {
            'title': title,
            'slug': slug,
            'category': '日常生活',
            'difficulty': 'A2',
            'audio_path': audio_path,
            'video_path': None,
            'thumbnail_path': None,
            'audio_size': 0,
            'duration': duration,
            'transcript': transcript,
            'play_count': 0,
            'meta_title': f"{title} | English Dictation & Shadowing",
            'meta_description': f"Practice English listening and speaking with '{title}' dictation exercise. Improve your English skills with interactive audio and text.",
            'og_image': None
        }

        result = client.table('materials').insert(material_data).execute()
        log(f"  ✓ 数据库保存成功 (ID: {result.data[0]['id']})")
        return True

    except Exception as e:
        log(f"  ❌ 数据库保存失败: {e}")
        return False

def process_url(url: str, index: int, total: int) -> bool:
    """处理单个 URL"""
    print(f"\n{'='*70}")
    print(f"[{index}/{total}] 正在处理: {url}")
    print(f"{'='*70}")

    try:
        # 1. 抓取页面
        html = fetch_page(url)
        if not html:
            return False

        # 2. 解析标题
        title = parse_title(html)
        if not title:
            log("  ❌ 无法解析标题")
            return False

        log(f"  标题: {title}")

        # 3. 生成 slug 并检查重复
        slug = slugify(title)
        if check_duplicate(slug):
            log("  ⏭ 跳过（已存在）")
            return True

        # 4. 解析音频 URL
        audio_url = parse_audio_url(html)
        if not audio_url:
            log("  ❌ 未找到音频链接")
            return False

        log(f"  音频: {audio_url}")

        # 5. 解析 Transcript
        sentences = parse_transcript(html)
        if not sentences or len(sentences) < 3:
            log("  ❌ Transcript 解析失败或句子太少")
            return False

        log(f"  句子数: {len(sentences)}")

        # 6. 下载音频
        temp_dir = Path("/tmp/ingest_bulk")
        temp_dir.mkdir(exist_ok=True)

        filename = audio_url.split('/')[-1].split('?')[0]
        audio_path = temp_dir / filename

        audio_path = download_audio(audio_url, audio_path)
        if not audio_path:
            return False

        # 7. GLM 翻译
        log(f"  开始翻译...")
        sentences = translate_with_glm(sentences)

        # 8. 上传到 R2
        audio_key = f"audio/{slug}.mp3"

        r2_key = upload_to_r2(audio_path, audio_key)
        if not r2_key:
            return False

        # 9. 保存到 Supabase
        if save_to_supabase(title, slug, r2_key, sentences):
            log(f"✅ [{index}/{total}] 导入成功!")
            print(f"   访问链接: /topics/daily-life/{slug}/")
            return True
        else:
            return False

    except Exception as e:
        log(f"❌ 处理失败: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        # 清理临时文件
        try:
            if 'audio_path' in locals() and audio_path.exists():
                audio_path.unlink()
        except:
            pass

def main():
    # 读取 URL 列表
    urls_file = Path(__file__).parent.parent / 'urls.txt'

    if not urls_file.exists():
        log(f"错误: URLs 文件不存在: {urls_file}")
        sys.exit(1)

    with open(urls_file) as f:
        urls = [line.strip() for line in f if line.strip()]

    if not urls:
        log("错误: URLs 文件为空")
        sys.exit(1)

    print("="*70)
    print("  批量素材导入")
    print("="*70)
    print(f"总数: {len(urls)} 个 URL")
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)

    # 统计
    success_count = 0
    skip_count = 0
    fail_count = 0

    # 处理每个 URL
    for i, url in enumerate(urls, 1):
        try:
            result = process_url(url, i, len(urls))

            if result:
                success_count += 1
            else:
                fail_count += 1

        except KeyboardInterrupt:
            log("\n⚠ 用户中断")
            break
        except Exception as e:
            log(f"❌ 未知错误: {e}")
            fail_count += 1

    # 最终统计
    print("\n" + "="*70)
    print("  批量导入完成")
    print("="*70)
    print(f"成功: {success_count}")
    print(f"失败: {fail_count}")
    print(f"总计: {len(urls)}")
    print("="*70)

if __name__ == '__main__':
    main()
