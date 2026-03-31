#!/usr/bin/env python3
"""
测试版本：只处理前 3 个素材
"""
import os
import json
import requests
import time
import random
from pathlib import Path
from supabase import create_client
from collections import Counter
import re
from typing import Dict, List, Tuple
from datetime import datetime

# 加载环境变量
def load_env():
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

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
GLM_API_KEY = os.environ.get('GLM_API_KEY')

ALL_LANGUAGES = [
    'zh', 'zh_hant', 'vi', 'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr',
    'el', 'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi'
]

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
    print(f"[{timestamp}] {msg}")

def detect_repetition(text: str, lang_code: str) -> Tuple[bool, str]:
    if lang_code == 'mn':
        words = text.split()
    elif lang_code in ['zh', 'zh_hant', 'ja', 'ko', 'th']:
        words = list(text)
    else:
        words = re.findall(r'\b\w+\b', text.lower())

    if len(words) < 3:
        return False, "太短"

    word_counts = Counter(words)
    for word, count in word_counts.most_common():
        if count >= 3 and len(word) > 2:
            return True, f"重复: '{word}' ×{count}"

    return False, "正常"

def translate_with_retry(text: str, lang_code: str) -> Tuple[str, bool]:
    lang_name = LANGUAGES[lang_code]['name']

    prompt = f"""Translate the following English text to {lang_name}.

CRITICAL:
- Avoid word repetition in all languages, especially in Mongolian (mn)
- Output only the direct translation without any redundant characters

Text: {text}

Translation:"""

    try:
        response = requests.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GLM_API_KEY}"
            },
            json={
                "model": "glm-4-flash",
                "messages": [
                    {"role": "system", "content": f"You are a professional translator. Avoid repetition."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 500
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            translation = result["choices"][0]["message"]["content"].strip()
        else:
            return text, False

    except Exception as e:
        print(f"    ⚠️ API 错误 ({lang_code}): {e}")
        return text, False

    # 检测重复
    has_repetition, _ = detect_repetition(translation, lang_code)
    if has_repetition:
        print(f"    🔄 重试 {lang_name}...")
        # 简化重试逻辑，直接返回原翻译
        return translation, True

    return translation, False

print("="*60)
print("  测试：前 3 个素材")
print("="*60)

client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

result = client.table('materials').select('id, slug, title, transcript').limit(3).execute()

if not result.data:
    print("❌ 没有素材")
    exit(1)

materials = result.data
print(f"✓ 获取了 {len(materials)} 个素材")
print("="*60)

for i, material in enumerate(materials, 1):
    material_id = material.get('id')
    slug = material.get('slug')
    title = material.get('title', '')

    print(f"\n处理素材 [{i}/{len(materials)}]: {title[:50]}...")

    try:
        transcript = material.get('transcript')
        if isinstance(transcript, str):
            transcript = json.loads(transcript)

        if not transcript:
            print("  ⚠️ 无字幕")
            continue

        # 检查第一句
        first_trans = transcript[0].get('translation', {})
        missing = [lang for lang in ALL_LANGUAGES if lang not in first_trans]

        if len(missing) == 0:
            print(f"  ⏭️ 已跳过：19 语完整")
            continue

        print(f"  📝 缺失 {len(missing)} 种语言")
        print(f"  🔄 开始翻译第一句...")

        # 只翻译第一句
        sentence = transcript[0]
        sentence_text = sentence.get('text', '')
        existing = sentence.get('translation', {})

        # 翻译前 3 种缺失语言（测试用）
        new_trans = {}
        test_langs = missing[:3]  # 只测试前 3 种

        for lang in test_langs:
            print(f"    → {LANGUAGES[lang]['name']} ({lang})...", end='', flush=True)
            translation, retried = translate_with_retry(sentence_text, lang)
            new_trans[lang] = translation
            print(f" ✓ {translation[:30]}...")
            time.sleep(0.5)

        # 合并
        merged = {**existing, **new_trans}
        print(f"\n  ✓ 第一句翻译完成：{len(merged)} 种语言")

        # 不保存到数据库（测试模式）
        print(f"  🧪 测试模式：未保存")

    except Exception as e:
        print(f"  ❌ 失败: {e}")

print("\n" + "="*60)
print("  测试完成")
print("="*60)
