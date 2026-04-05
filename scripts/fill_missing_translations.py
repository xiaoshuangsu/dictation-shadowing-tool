#!/usr/bin/env python3
"""
翻译补录脚本 - 精准补录缺失的翻译
仅针对 content IS NULL 或 [TODO_RETRY] 的记录
使用 XML 标签隔离 + 4 道拦截防线
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
from supabase import create_client
import requests

# ══════════════════════════════════════════════════════════════════════════════
# 配置
# ══════════════════════════════════════════════════════════════════════════════

env_path = project_root / '.env.local'
load_dotenv(env_path)

GLM_API_KEY = os.getenv('GLM_API_KEY')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 19 种语言
ALL_LANGUAGES = ['zh', 'zh_hant', 'vi', 'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el',
                 'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']

LANGUAGES = {
    'zh': '简体中文',
    'zh_hant': '繁體中文',
    'vi': 'Tiếng Việt',
    'ar': 'العربية',
    'de': 'Deutsch',
    'es': 'Español',
    'ja': '日本語',
    'ms': 'Bahasa Melayu',
    'ru': 'Русский',
    'tr': 'Türkçe',
    'el': 'Ελληνικά',
    'id': 'Bahasa Indonesia',
    'ko': '한국어',
    'pt': 'Português',
    'th': 'ภาษาไทย',
    'uk': 'Українська',
    'bn': 'বাংলা',
    'mn': 'Монгол',
    'hi': 'हिन्दी',
}

# API 配置
API_TIMEOUT = 30
MAX_RETRIES = 3
REQUEST_DELAY = 0.5  # 500ms 延迟

# ══════════════════════════════════════════════════════════════════════════════
# 拦截函数（从 reprocess_translation_v3_production.py 复制）
# ══════════════════════════════════════════════════════════════════════════════

def should_intercept_translation(translation: str, original_text: str, lang_code: str) -> Tuple[bool, str]:
    """拦截函数：检测翻译是否应该被拒绝"""
    if not translation or not isinstance(translation, str):
        return False, ""

    # 规则 1: XML 标签泄漏
    xml_tags = ['<translation_result>', '</translation_result>', '<instruction>', '</instruction>',
                '<source_text>', '</source_text>', '<?xml', '<!DOCTYPE']
    for tag in xml_tags:
        if tag in translation:
            return True, f"XML 标签泄漏: {tag}"

    # 规则 2: 指令词检测
    instruction_patterns = [
        r'\b(instructions?|instruction:|critical:|requirement:|avoid|translate:|translation:|text:)\b',
        r'(翻译|指令|要求|避免|重复|直接|提供|返回|输出)',
        r'(শব্দ\s*পুনরাবৃত্তি|সরাসরি\s*অনুবাদ|ক্রিটিক্যাল)',
    ]

    for pattern in instruction_patterns:
        if re.search(pattern, translation, re.IGNORECASE):
            match = re.search(pattern, translation, re.IGNORECASE)
            captured = match.group(0) if match else pattern
            if captured.strip().startswith('-') or any(char in captured for char in ['翻译', 'শব্দ', 'critical']):
                return True, f"指令词幻觉: '{captured[:50]}'"

    # 规则 3: 长度异常
    if original_text and len(original_text) > 0:
        if len(translation) > len(original_text) * 3:
            return True, f"长度异常: {len(translation)} / {len(original_text)} = {len(translation)/len(original_text):.1f}x"

    # 规则 4: 幻觉格式（多行横线列表）
    lines = translation.split('\n')
    if len(lines) >= 2:
        dash_count = sum(1 for line in lines[:3] if re.match(r'^\s*-\s+', line))
        if dash_count >= 2:
            return True, f"幻觉格式: 多行横线列表"

    return False, ""


def translate_with_interception(text: str, lang_code: str) -> Tuple[str, bool]:
    """翻译并应用拦截检查"""
    lang_name = LANGUAGES[lang_code]

    # XML 标签隔离 Prompt
    prompt = f"""<instruction>
Translate the following text to {lang_name}.
Return ONLY the raw translation string.
DO NOT include any preamble, apologies, meta-labels, or explanations.
Wrap the final result in <translation_result> tags.
</instruction>

<source_text>
{text}
</source_text>"""

    for attempt in range(MAX_RETRIES):
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
                            "content": "You translate text between languages. Return ONLY the translated text."
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500,
                    "presence_penalty": 0.5,
                    "frequency_penalty": 0.5
                },
                timeout=API_TIMEOUT
            )

            if response.status_code == 200:
                result = response.json()
                raw_response = result["choices"][0]["message"]["content"].strip()

                # 解析 XML 标签
                tag_pattern = re.compile(r'<translation_result>\s*(.*?)\s*</translation_result>', re.DOTALL)
                match = tag_pattern.search(raw_response)

                if match:
                    translation = match.group(1).strip()
                else:
                    translation = raw_response

                # 应用拦截检查
                should_intercept, reason = should_intercept_translation(translation, text, lang_code)

                if should_intercept:
                    print(f"    🚫 拦截: {reason}")
                    return "", False

                return translation, True

            else:
                print(f"    ⚠️  API 错误: {response.status_code}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(1)
                    continue
                return "", False

        except Exception as e:
            print(f"    ❌ 请求失败: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)
                continue
            return "", False

    return "", False


# ══════════════════════════════════════════════════════════════════════════════
# 主函数
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 80)
    print("🎯 翻译补录 - 精准补录缺失翻译")
    print("=" * 80)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # 获取所有素材
    print("📊 正在获取素材数据...")
    response = supabase.table('materials').select('id, slug, transcript').execute()
    materials = response.data

    print(f"✅ 获取到 {len(materials)} 个素材")
    print()

    # 统计缺失
    total_translations = 0
    total_success = 0
    total_failed = 0
    total_intercepted = 0

    language_stats = {lang: {'missing': 0, 'success': 0, 'failed': 0} for lang in ALL_LANGUAGES}

    # 处理每个素材
    for mat_idx, material in enumerate(materials, 1):
        material_id = material['id']
        slug = material.get('slug')
        transcript = material.get('transcript', [])

        if not transcript:
            continue

        # 统计该素材的缺失翻译
        missing_in_material = []
        for sentence_idx, sentence in enumerate(transcript):
            translation = sentence.get('translation', {})
            for lang in ALL_LANGUAGES:
                lang_text = translation.get(lang)
                if not lang_text or lang_text == '[TODO_RETRY]':
                    missing_in_material.append((sentence_idx, lang, sentence.get('text', '')))

        if not missing_in_material:
            continue

        print(f"[{mat_idx}/{len(materials)}] {slug[:60]}")
        print(f"  缺失: {len(missing_in_material)} 条翻译")

        # 补录翻译
        material_modified = False
        success_count = 0
        failed_count = 0
        intercepted_count = 0

        for sentence_idx, lang, original_text in missing_in_material:
            print(f"  🌐 [{lang}] 句子 #{sentence_idx + 1}...", end=" ")

            # 翻译
            translation, success = translate_with_interception(original_text, lang)

            if success and translation:
                # 写入数据库
                transcript[sentence_idx]['translation'][lang] = translation
                material_modified = True
                success_count += 1
                total_success += 1
                language_stats[lang]['success'] += 1
                print(f"✅ ({len(translation)} 字符)")
            else:
                if not translation:
                    intercepted_count += 1
                    total_intercepted += 1
                    language_stats[lang]['failed'] += 1
                    print(f"🚫 拦截")
                else:
                    failed_count += 1
                    total_failed += 1
                    language_stats[lang]['failed'] += 1
                    print(f"❌ 失败")

            # 延迟（防止 API 限制）
            time.sleep(REQUEST_DELAY)

        # 保存到数据库
        if material_modified:
            supabase.table('materials').update({
                'transcript': transcript
            }).eq('id', material_id).execute()
            print(f"  💾 已保存: +{success_count} | ❌ {failed_count} | 🚫 {intercepted_count}")
        else:
            print(f"  ⏭️  无更新")

        print()

        # 每 10 个素材显示一次统计
        if mat_idx % 10 == 0:
            print("=" * 80)
            print(f"📊 进度统计 [{mat_idx}/{len(materials)}]")
            print(f"  成功: {total_success:,} | 失败: {total_failed:,} | 拦截: {total_intercepted:,}")
            print("=" * 80)
            print()

    # 最终报告
    print("=" * 80)
    print("📊 最终报告")
    print("=" * 80)
    print(f"总处理: {total_success + total_failed + total_intercepted:,} 条")
    print(f"✅ 成功: {total_success:,}")
    print(f"❌ 失败: {total_failed:,}")
    print(f"🚫 拦截: {total_intercepted:,}")
    print()
    print("各语言统计:")
    for lang in ALL_LANGUAGES:
        stats = language_stats[lang]
        if stats['success'] > 0 or stats['failed'] > 0:
            print(f"  {lang}: +{stats['success']:,} | ❌ {stats['failed']:,}")
    print()
    print("=" * 80)
    print(f"完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)


if __name__ == '__main__':
    main()
