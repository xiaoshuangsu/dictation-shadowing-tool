#!/usr/bin/env python3
"""
自动化素材导入脚本 - 单个素材测试
从 Engnovate 抓取 Dictation/Shadowing 练习

特点：
1. 解析页面的原生时间戳数据（data-start, data-duration）
2. 下载音频并上传到 R2
3. 使用 GLM API 进行翻译
4. 存入 Supabase
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

# 导入文本规范化工具
from text_normalizer import normalize_sentence_text

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
# 使用 R2 公共域名（根据指南，需要通过 Worker 代理）
R2_PUBLIC_URL = "https://media.shadowhub.app"
GLM_API_KEY = os.environ.get('GLM_API_KEY')

# ==================== 工具函数 ====================

def log(msg: str):
    """简化日志输出"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def fetch_page(url):
    """抓取页面内容"""
    log(f"抓取页面: {url}")
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.text

def parse_audio_url(html):
    """解析音频 URL"""
    log("搜索音频链接...")
    soup = BeautifulSoup(html, 'html.parser')

    # 查找 audio 标签
    audio_tags = soup.find_all('audio')
    for audio in audio_tags:
        src = audio.get('src')
        if src and '.mp3' in src:
            log(f"找到音频: {src}")
            return src

    # 搜索所有 .mp3 链接
    mp3_links = re.findall(r'https?://[^\s"\'<>]+\.mp3', html)
    if mp3_links:
        log(f"找到 MP3 链接: {mp3_links[0]}")
        return mp3_links[0]

    log("未找到音频链接")
    return None

def parse_transcript(html):
    """解析 Transcript 内容和时间戳"""
    log("解析 Transcript...")
    soup = BeautifulSoup(html, 'html.parser')

    transcript_lines = soup.find_all('div', class_='transcript-line')

    if not transcript_lines:
        log("未找到 transcript-line 元素")
        return None

    sentences = []
    for line in transcript_lines:
        # 获取时间戳
        start = float(line.get('data-start', 0))
        duration = float(line.get('data-duration', 0))
        end = round(start + duration, 3)

        # 获取文本（所有 word span）
        words_spans = line.find_all('span', class_='word')
        text = ' '.join([w.get_text() for w in words_spans])
        text = text.strip()

        # 🔧 文本规范化：修复连字符词空格问题
        text = normalize_sentence_text(text)

        if text:
            sentences.append({
                'id': len(sentences) + 1,
                'text': text,
                'startTime': round(start, 3),
                'endTime': end,
                'translation': ''
            })

    log(f"解析到 {len(sentences)} 个句子")
    return sentences

def download_audio(url, output_path):
    """下载音频文件"""
    log(f"下载音频: {url}")

    response = requests.get(url, stream=True, timeout=60)
    response.raise_for_status()

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

    file_size = output_path.stat().st_size
    log(f"下载完成: {file_size / 1024 / 1024:.2f} MB")
    return output_path

def upload_to_r2(file_path, key):
    """上传文件到 R2"""
    log(f"上传到 R2: {key}")

    s3 = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY
    )

    try:
        file_size = Path(file_path).stat().st_size

        s3.upload_file(
            file_path,
            R2_BUCKET_NAME,
            key,
            ExtraArgs={'ContentType': 'audio/mpeg'}
        )

        # 返回 R2 相对路径（前端会通过 getCdnUrl 拼接 Worker URL）
        log(f"上传成功")
        return key

    except Exception as e:
        log(f"上传失败: {e}")
        return None

def slugify(text):
    """生成 URL 友好的 slug"""
    text = text.lower().strip()
    # 移除特殊字符
    text = re.sub(r'[^\w\s-]', '', text)
    # 替换空格为连字符
    text = re.sub(r'\s+', '-', text)
    # 移除多余连字符
    text = re.sub(r'-+', '-', text)
    return text.strip('-')[:100]

def translate_with_glm(sentences):
    """使用 GLM API 翻译"""
    log(f"GLM 翻译 {len(sentences)} 句...")

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
                log(f"翻译进度: {i}/{len(sentences)}")

            time.sleep(0.3)  # 避免 API 限流

        except Exception as e:
            log(f"翻译失败 (第{i}句): {e}")
            sentence['translation'] = sentence['text']  # 降级：保留原文

    log("翻译完成")
    return sentences

def save_to_supabase(title, slug, audio_path, transcript):
    """保存到 Supabase"""
    log("保存到 Supabase...")

    if not SUPABASE_SERVICE_ROLE_KEY:
        log("错误: 请设置 SUPABASE_SERVICE_ROLE_KEY")
        return False

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 计算音频时长（最后一句的结束时间）- 需要整数
    duration = int(transcript[-1]['endTime']) if transcript else 0

    # 检查是否已存在
    existing = client.table('materials').select('*').eq('slug', slug).execute()

    # 构建 material_data
    material_data = {
        'title': title,
        'slug': slug,
        'category': '日常生活',  # 使用中文分类名，与前端映射表一致
        'difficulty': 'A2',
        'audio_path': audio_path,
        'video_path': None,
        'thumbnail_path': None,
        'audio_size': 0,  # 可选：后续可获取实际文件大小
        'duration': duration,
        'transcript': transcript,
        'play_count': 0,
        # SEO 字段
        'meta_title': f"{title} | English Dictation & Shadowing",
        'meta_description': f"Practice English listening and speaking with '{title}' dictation exercise. Improve your English skills with interactive audio and text.",
        'og_image': None
    }

    if existing.data:
        log(f"素材已存在: {slug}")
        material_id = existing.data[0]['id']
        client.table('materials').update(material_data).eq('id', material_id).execute()
        log("更新成功")
    else:
        log("创建新记录...")
        result = client.table('materials').insert(material_data).execute()
        material_id = result.data[0]['id']
        log(f"创建成功 (ID: {material_id})")

    return True

def main():
    target_url = "https://engnovate.com/dictation-shadowing-exercises/if-i-live-to-be/"

    print("="*60)
    print("  自动化素材导入 - 单素材测试")
    print("="*60)
    print(f"目标 URL: {target_url}")
    print()

    try:
        # 1. 抓取页面
        html = fetch_page(target_url)

        # 2. 解析音频 URL
        audio_url = parse_audio_url(html)
        if not audio_url:
            log("未找到音频链接，无法继续")
            return

        # 3. 解析 Transcript（带时间戳）
        sentences = parse_transcript(html)
        if not sentences or len(sentences) < 5:
            log("Transcript 句子太少，无法使用")
            return

        log(f"提取成功:")
        log(f"  音频 URL: {audio_url}")
        log(f"  句子数量: {len(sentences)}")

        # 4. 下载音频
        temp_dir = Path("/tmp/ingest_single")
        temp_dir.mkdir(exist_ok=True)

        # 从 URL 生成文件名
        filename = audio_url.split('/')[-1].split('?')[0]
        audio_path = temp_dir / filename

        audio_path = download_audio(audio_url, audio_path)

        # 5. GLM 翻译
        sentences = translate_with_glm(sentences)

        # 6. 上传到 R2
        slug = slugify("If I Live To Be")
        audio_key = f"audio/{slug}.mp3"

        r2_key = upload_to_r2(audio_path, audio_key)
        if not r2_key:
            log("上传失败，无法继续")
            return

        # 7. 保存到 Supabase
        if save_to_supabase("If I Live To Be", slug, r2_key, sentences):
            print("\n" + "="*60)
            print("  素材导入完成!")
            print("="*60)
            print(f"  Slug: {slug}")
            print(f"  音频路径: {r2_key}")
            print(f"  访问链接: /topics/dictation/{slug}")
            print("="*60)
        else:
            print("\n保存到数据库失败")

    except Exception as e:
        print(f"\n发生错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
