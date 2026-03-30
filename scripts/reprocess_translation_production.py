#!/usr/bin/env python3
"""
雅思听力素材翻译引擎 - 生产版本
批量处理所有素材，支持 19 种语言

特性：
- ✅ 增量翻译：只翻译缺失的语言
- ✅ 幂等跳过：19 语完整则跳过
- ✅ 按素材落盘：每完成 1 个素材立刻保存
- ✅ 实时日志：显示处理进度
- ✅ 异常捕获：记录失败并继续
- ✅ 重复检测：蒙古语等小语种自动重试
- ✅ 随机休眠：防止 API 限流
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
from typing import Dict, List, Tuple, Optional
from datetime import datetime

# ==================== 加载环境变量 ====================
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

# ==================== 语言配置 ====================

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

# 日志文件
LOG_FILE = Path(__file__).parent / 'translation_batch.log'

def log_to_file(msg: str, level: str = 'INFO'):
    """记录到日志文件"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"[{timestamp}] [{level}] {msg}\n")

def log(msg: str, level: str = 'INFO'):
    """控制台日志"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {msg}")
    log_to_file(msg, level)

def log_error(msg: str):
    """错误日志（红色）"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"\033[91m[{timestamp}] ERROR: {msg}\033[0m")
    log_to_file(msg, 'ERROR')

# ==================== 重复检测逻辑 ====================

def detect_repetition(text: str, lang_code: str) -> Tuple[bool, str]:
    """检测文本中是否有重复词汇"""
    if lang_code == 'mn':
        words = text.split()
    elif lang_code in ['zh', 'zh_hant', 'ja', 'ko', 'th']:
        words = list(text)
    elif lang_code in ['ar', 'hi', 'bn']:
        words = text.split()
    else:
        words = re.findall(r'\b\w+\b', text.lower())

    if len(words) < 3:
        return False, "文本太短"

    word_counts = Counter(words)

    for word, count in word_counts.most_common():
        if count >= 3 and len(word) > 2:
            return True, f"检测到重复词汇: '{word}' 出现 {count} 次"

    for i in range(len(words) - 2):
        if words[i] == words[i+1] == words[i+2] and len(words[i]) > 2:
            return True, f"检测到连续重复: '{words[i]}'"

    return False, "正常"

# ==================== 翻译函数 ====================

def translate_with_retry(text: str, lang_code: str) -> Tuple[str, bool]:
    """翻译到指定语言（带重复检测和重试）"""
    lang_name = LANGUAGES[lang_code]['name']

    # 首次翻译
    prompt = f"""Translate the following English text to {lang_name}.

CRITICAL REQUIREMENTS:
- Avoid word repetition in all languages, especially in Mongolian (mn)
- Output only the direct translation without any redundant characters
- Be concise and natural

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
                    {
                        "role": "system",
                        "content": f"You are a professional translator. Translate accurately to {lang_name}. Avoid repetition."
                    },
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
        log_to_file(f"API 调用失败 ({lang_code}): {e}", 'ERROR')
        return text, False

    # 检测重复
    has_repetition, _ = detect_repetition(translation, lang_code)

    if has_repetition:
        # 重试
        retry_prompt = f"""Provide a single, non-repetitive translation for the following text.

CRITICAL:
- Translate to: {lang_name}
- Avoid word repetition at all costs
- Output only the direct translation

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
                        {
                            "role": "system",
                            "content": f"You are a professional translator. Provide clean, non-repetitive translation to {lang_name}."
                        },
                        {"role": "user", "content": retry_prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                translation = result["choices"][0]["message"]["content"].strip()
                return translation, True
        except:
            pass

    return translation, False

def check_material_complete(transcript: List[Dict]) -> Tuple[bool, List[str]]:
    """检查素材的翻译是否完整"""
    if not transcript or len(transcript) == 0:
        return False, ALL_LANGUAGES

    first_translation = transcript[0].get('translation', {})
    missing = [lang for lang in ALL_LANGUAGES if lang not in first_translation]

    return len(missing) == 0, missing

def reprocess_material(client, material: Dict) -> Tuple[bool, str]:
    """处理单个素材

    Returns:
        (success, message): (是否成功, 消息)
    """
    material_id = material.get('id')
    slug = material.get('slug')
    title = material.get('title', '')

    try:
        # 获取 transcript
        transcript = material.get('transcript')
        if isinstance(transcript, str):
            transcript = json.loads(transcript)

        if not transcript:
            return False, "transcript 为空"

        # 检查是否已完成（幂等跳过）
        is_complete, missing = check_material_complete(transcript)
        if is_complete:
            return True, f"[ID: {material_id}] Already up to date, skipping."

        # 处理每个句子
        success_count = 0
        fail_count = 0
        total_translations = 0
        retry_count = 0

        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            # 获取现有翻译
            existing_translations = sentence.get('translation', {})
            if isinstance(existing_translations, str):
                existing_translations = {}

            # 翻译缺失的语言
            new_translations = {}
            for lang in missing:
                if lang not in existing_translations:
                    translation, was_retried = translate_with_retry(sentence_text, lang)
                    new_translations[lang] = translation
                    total_translations += 1

                    if was_retried:
                        retry_count += 1

                    time.sleep(0.5)  # API 限流

            # 合并翻译
            merged_translations = {**existing_translations, **new_translations}
            sentence['translation'] = merged_translations
            success_count += 1

        # 保存到数据库（按素材落盘）
        client.table('materials').update({
            'transcript': transcript
        }).eq('id', material_id).execute()

        return True, f"✓ 翻译 {total_translations} 条，重试 {retry_count} 次"

    except Exception as e:
        error_msg = f"{slug}: {str(e)}"
        log_error(error_msg)
        import traceback
        log_to_file(traceback.format_exc(), 'ERROR')
        return False, error_msg

def main():
    """主函数：批量处理所有素材"""
    print("="*80)
    print("  雅思听力素材翻译 - 生产版本")
    print("  支持 19 种语言增量翻译")
    print("="*80)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"日志文件: {LOG_FILE}")
    print("="*80)

    # 连接数据库
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 获取所有素材
    log("正在获取所有素材...")
    result = client.table('materials').select('id, slug, title, transcript').execute()

    all_materials = result.data
    total_count = len(all_materials)

    log(f"总共 {total_count} 个素材")
    print("="*80)

    # 统计
    success_count = 0
    skipped_count = 0
    failed_count = 0
    failed_materials = []

    # 处理每个素材
    for i, material in enumerate(all_materials, 1):
        slug = material.get('slug', 'unknown')
        title = material.get('title', 'Unknown')

        print(f"\n处理素材 [{i}/{total_count}]: {title} ({slug})")

        # 处理素材
        success, message = reprocess_material(client, material)

        if success:
            if "skipping" in message.lower():
                skipped_count += 1
                print(f"  ⏭️  {message}")
            else:
                success_count += 1
                print(f"  ✅ {message}")
        else:
            failed_count += 1
            failed_materials.append(slug)
            print(f"  ❌ {message}")

        # 随机休眠 1-2 秒（防止 API 限流）
        if i < total_count:
            sleep_time = random.uniform(1.0, 2.0)
            time.sleep(sleep_time)

    # 最终统计
    print("\n" + "="*80)
    print("  处理完成")
    print("="*80)
    print(f"总素材数: {total_count}")
    print(f"成功处理: {success_count}")
    print(f"跳过已完成: {skipped_count}")
    print(f"失败: {failed_count}")
    print(f"完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if failed_materials:
        print("\n失败的素材:")
        for slug in failed_materials:
            print(f"  - {slug}")

    print("="*80)
    log(f"批量处理完成: 成功 {success_count}, 跳过 {skipped_count}, 失败 {failed_count}")

if __name__ == '__main__':
    main()
