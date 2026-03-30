#!/usr/bin/env python3
"""
雅思听力素材翻译引擎 v4.0
支持 19 种语言的全语境翻译 + 重复检测 + 智能跳过

核心改进：
1. ✅ 19 种语言完整支持：zh, zh_hant, vi, ar, de, es, ja, ms, ru, tr, el, id, ko, pt, th, uk, bn, mn, hi
2. ✅ 增量翻译：只翻译缺失的语言
3. ✅ 智能跳过：19 语完整则跳过该素材
4. ✅ 重复检测：自动检测蒙古语等小语种的重复问题
5. ✅ 自动重试：对异常翻译使用更严厉的提示词重试

版本历史：
- v4.0 (2026-03-29): 重复检测 + 智能跳过
- v3.0 (2026-03-29): 19 语言支持 + 增量更新
- v2.0 (2026-03-26): 基于完整协议重构
"""
import os
import json
import requests
import time
from pathlib import Path
from supabase import create_client
from collections import Counter
import re
from typing import Dict, List, Tuple, Optional

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

# 19 种语言配置（完整列表）
ALL_LANGUAGES = [
    'zh',        # 简体中文
    'zh_hant',   # 繁體中文
    'vi',        # Tiếng Việt
    'ar',        # العربية
    'de',        # Deutsch
    'es',        # Español
    'ja',        # 日本語
    'ms',        # Bahasa Melayu
    'ru',        # Русский
    'tr',        # Türkçe
    'el',        # Ελληνικά
    'id',        # Bahasa Indonesia
    'ko',        # 한국어
    'pt',        # Português
    'th',        # ภาษาไทย
    'uk',        # Українська
    'bn',        # বাংলা
    'mn',        # Монгол
    'hi',        # हिन्दी
]

LANGUAGES = {
    'zh': {'name': '简体中文', 'system_prompt': 'zh-CN'},
    'zh_hant': {'name': '繁體中文', 'system_prompt': 'zh-TW'},
    'vi': {'name': 'Tiếng Việt', 'system_prompt': 'vi-VN'},
    'ar': {'name': 'العربية', 'system_prompt': 'ar-SA'},
    'de': {'name': 'Deutsch', 'system_prompt': 'de-DE'},
    'es': {'name': 'Español', 'system_prompt': 'es-ES'},
    'ja': {'name': '日本語', 'system_prompt': 'ja-JP'},
    'ms': {'name': 'Bahasa Melayu', 'system_prompt': 'ms-MY'},
    'ru': {'name': 'Русский', 'system_prompt': 'ru-RU'},
    'tr': {'name': 'Türkçe', 'system_prompt': 'tr-TR'},
    'el': {'name': 'Ελληνικά', 'system_prompt': 'el-GR'},
    'id': {'name': 'Bahasa Indonesia', 'system_prompt': 'id-ID'},
    'ko': {'name': '한국어', 'system_prompt': 'ko-KR'},
    'pt': {'name': 'Português', 'system_prompt': 'pt-PT'},
    'th': {'name': 'ภาษาไทย', 'system_prompt': 'th-TH'},
    'uk': {'name': 'Українська', 'system_prompt': 'uk-UA'},
    'bn': {'name': 'বাংলা', 'system_prompt': 'bn-BD'},
    'mn': {'name': 'Монгол', 'system_prompt': 'mn-MN'},
    'hi': {'name': 'हिन्दी', 'system_prompt': 'hi-IN'},
}

# ==================== 重复检测逻辑 ====================

def detect_repetition(text: str, lang_code: str) -> Tuple[bool, str]:
    """检测文本中是否有重复词汇

    Returns:
        (has_repetition, details): 是否有重复，详细信息
    """
    # 分词（针对不同语言使用不同的分词策略）
    if lang_code == 'mn':  # 蒙古语 - 按空格分词
        words = text.split()
    elif lang_code in ['zh', 'zh_hant', 'ja', 'ko', 'th']:  # CJK 语言 - 按字符
        words = list(text)
    elif lang_code in ['ar', 'hi', 'bn']:  # 其他复杂语言 - 按空格
        words = text.split()
    else:  # 拉丁文字 - 按空格和标点
        words = re.findall(r'\b\w+\b', text.lower())

    if len(words) < 3:
        return False, "文本太短"

    # 统计词频
    word_counts = Counter(words)

    # 检查是否有词重复 3 次以上
    for word, count in word_counts.most_common():
        if count >= 3 and len(word) > 2:  # 忽略短词（如标点、助词）
            return True, f"检测到重复词汇: '{word}' 出现 {count} 次"

    # 特殊检测：连续重复（如 "хүрэлт хүрэлт хүрэлт"）
    for i in range(len(words) - 2):
        if words[i] == words[i+1] == words[i+2] and len(words[i]) > 2:
            return True, f"检测到连续重复: '{words[i]}'"

    return False, "正常"

# ==================== 翻译函数 ====================

def translate_with_retry(text: str, lang_code: str, full_context: str = "") -> Tuple[str, bool]:
    """翻译到指定语言（带重复检测和重试）

    Args:
        text: 要翻译的文本
        lang_code: 语言代码
        full_context: 完整上下文（可选）

    Returns:
        (translation, was_retried): 翻译结果，是否进行了重试
    """
    lang_name = LANGUAGES[lang_code]['name']

    # 首次翻译提示词
    if full_context:
        user_message = f"""Translate the following English text to {lang_name}.

CRITICAL REQUIREMENTS:
- Avoid word repetition in all languages, especially in Mongolian (mn)
- Output only the direct translation without any redundant characters
- Be concise and natural

**Full Context**:
{full_context}

**Current Sentence**:
{text}

**Translation**:"""
    else:
        user_message = f"""Translate the following English text to {lang_name}.

CRITICAL REQUIREMENTS:
- Avoid word repetition in all languages, especially in Mongolian (mn)
- Output only the direct translation without any redundant characters
- Be concise and natural

Text: {text}

Translation:"""

    # 首次翻译
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
                        "content": f"You are a professional translator. Translate accurately to {lang_name}. Avoid repetition and redundant output."
                    },
                    {"role": "user", "content": user_message}
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
        return text, False

    # 检测重复
    has_repetition, details = detect_repetition(translation, lang_code)

    if has_repetition:
        # 重试 - 使用更严厉的提示词
        retry_message = f"""Provide a single, non-repetitive translation for the following text.

CRITICAL REQUIREMENTS:
- Translate to: {lang_name}
- Avoid word repetition at all costs
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
                            "content": f"You are a professional translator. Provide a clean, non-repetitive translation to {lang_name}."
                        },
                        {"role": "user", "content": retry_message}
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

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def check_material_complete(transcript: List[Dict]) -> Tuple[bool, List[str]]:
    """检查素材的翻译是否完整（19 种语言都存在）

    Returns:
        (is_complete, missing_langs): 是否完整，缺失的语言列表
    """
    if not transcript or len(transcript) == 0:
        return False, ALL_LANGUAGES

    # 检查第一句的翻译
    first_translation = transcript[0].get('translation', {})

    # 找出缺失的语言
    missing = [lang for lang in ALL_LANGUAGES if lang not in first_translation]

    return len(missing) == 0, missing

def reprocess_material(slug: str, dry_run: bool = False, force_all: bool = False) -> bool:
    """重新翻译单个素材（智能增量更新）

    Args:
        slug: 素材的 slug
        dry_run: 是否为空跑模式（不写入数据库）
        force_all: 强制翻译所有语言（忽略已有翻译）

    Returns:
        是否成功
    """
    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        result = client.table('materials').select('*').eq('slug', slug).execute()

        if not result.data:
            log(f"  ❌ 素材不存在: {slug}")
            return False

        material = result.data[0]
        transcript = material.get('transcript')
        if isinstance(transcript, str):
            transcript = json.loads(transcript)

        log(f"  处理: {material['title']}")
        log(f"  句子数: {len(transcript)}")

        # 检查是否已完成（智能跳过）
        if not force_all:
            is_complete, missing = check_material_complete(transcript)
            if is_complete:
                log(f"  ⏭️  已跳过：所有 19 种语言完整")
                return True
            else:
                log(f"  📝 缺失语言: {len(missing)} 种 ({', '.join(missing[:5])}{'...' if len(missing) > 5 else ''})")
                target_languages = missing
        else:
            target_languages = ALL_LANGUAGES
            log(f"  🔄 强制模式：翻译所有 19 种语言")

        # 构建完整上下文
        full_context = '\n'.join([f"{i+1}. {s['text']}" for i, s in enumerate(transcript)])

        # 统计
        success_count = 0
        fail_count = 0
        total_translations = 0
        retry_count = 0

        # 翻译每个句子
        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            # 获取现有翻译（增量更新）
            existing_translations = sentence.get('translation', {})
            if isinstance(existing_translations, str):
                existing_translations = {}

            # 翻译缺失的语言
            new_translations = {}
            for lang in target_languages:
                if lang not in existing_translations:
                    translation, was_retried = translate_with_retry(
                        sentence_text,
                        lang,
                        full_context
                    )

                    new_translations[lang] = translation
                    total_translations += 1

                    if was_retried:
                        retry_count += 1

                    if (total_translations % 10 == 0):
                        log(f"    已翻译 {total_translations} 条（重试 {retry_count} 次）")

                    time.sleep(0.5)  # API 限流

            # 合并翻译（增量更新）
            merged_translations = {**existing_translations, **new_translations}
            sentence['translation'] = merged_translations
            success_count += 1

            if (i + 1) % 5 == 0:
                log(f"    进度: {i+1}/{len(transcript)}")

        log(f"  ✓ 翻译完成: 成功 {success_count}, 失败 {fail_count}")
        log(f"  📊 统计: 翻译 {total_translations} 条，重试 {retry_count} 次")

        # 验证 19 种语言
        if transcript:
            sample = transcript[0].get('translation', {})
            missing = [lang for lang in ALL_LANGUAGES if lang not in sample]
            if missing:
                log(f"  ⚠️ 缺少语言: {', '.join(missing)}")
            else:
                log(f"  ✅ 所有 19 种语言完整")

        # 打印示例 JSON（仅第一句）
        if transcript and len(transcript) > 0:
            print("\n" + "="*60)
            print("  📋 第一句翻译预览")
            print("="*60)
            first_trans = transcript[0]['translation']
            # 显示前 5 种语言
            for i, (lang, trans) in enumerate(list(first_trans.items())[:5]):
                print(f"  {lang}: {trans[:50]}{'...' if len(trans) > 50 else ''}")
            if len(first_trans) > 5:
                print(f"  ... 还有 {len(first_trans) - 5} 种语言")
            print("="*60)

        # 保存到数据库
        if not dry_run:
            client.table('materials').update({
                'transcript': transcript
            }).eq('slug', slug).execute()
            log(f"  ✅ 已保存到数据库")
        else:
            log(f"  🧪 空跑模式：未保存到数据库")

        return True

    except Exception as e:
        log(f"  ❌ 失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """主函数：批量处理素材"""
    # 测试单个素材
    test_slug = "corruption"

    print("="*80)
    print("  雅思听力翻译引擎 v4.0 - 19 语言智能增量更新")
    print("="*80)
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"模式: 空跑（DRY RUN）")
    print("="*80)

    # 执行翻译
    reprocess_material(test_slug, dry_run=True, force_all=False)

    print("\n" + "="*80)
    print("  测试完成")
    print("="*80)

if __name__ == '__main__':
    main()
