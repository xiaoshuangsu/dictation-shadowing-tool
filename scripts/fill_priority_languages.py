#!/usr/bin/env python3
"""
精准补录脚本 - 只补录 4 种重点攻坚语种
跳过中文（zh, zh_hant），只处理 ja, ko, bn, mn
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

# 只处理这 4 种语言
PRIORITY_LANGUAGES = ['ja', 'ko', 'bn', 'mn']

LANGUAGES = {
    'ja': '日本語',
    'ko': '한국어',
    'bn': 'বাংলা',
    'mn': 'Монгол',
}

# API 配置
API_TIMEOUT = 30
MAX_RETRIES = 3
REQUEST_DELAY = 0.5  # 500ms 延迟

# ══════════════════════════════════════════════════════════════════════════════
# 拦截函数
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
            return True, f"长度异常: {len(translation)} / {len(original_text)}"

    # 规则 4: 幻觉格式
    lines = translation.split('\n')
    if len(lines) >= 2:
        dash_count = sum(1 for line in lines[:3] if re.match(r'^\s*-\s+', line))
        if dash_count >= 2:
            return True, "幻觉格式: 多行横线列表"

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
                    return "", False

                return translation, True

            else:
                if attempt < MAX_RETRIES - 1:
                    time.sleep(1)
                    continue
                return "", False

        except Exception as e:
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
    print("🎯 精准补录 - 4 种重点攻坚语种")
    print("=" * 80)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    print("📊 任务配置:")
    print("  • 跳过语言: zh, zh_hant（已完整）")
    print("  • 攻坚语言: ja (日语), ko (韩语), bn (孟加拉语), mn (蒙古语)")
    print()

    # 获取所有素材
    print("📊 正在获取素材数据...")
    response = supabase.table('materials').select('id, slug, transcript').execute()
    materials = response.data

    print(f"✅ 获取到 {len(materials)} 个素材")
    print()

    # 统计任务
    total_to_translate = 0
    total_success = 0
    total_failed = 0
    total_intercepted = 0

    language_stats = {lang: {'success': 0, 'failed': 0} for lang in PRIORITY_LANGUAGES}

    # 找出需要处理的素材
    materials_to_process = []

    for material in materials:
        slug = material.get('slug')
        transcript = material.get('transcript', [])

        if not transcript:
            continue

        # 收集需要翻译的句子
        to_translate = []
        for sentence_idx, sentence in enumerate(transcript):
            translation = sentence.get('translation', {})
            original_text = sentence.get('text', '')

            for lang in PRIORITY_LANGUAGES:
                lang_text = translation.get(lang)
                # 只处理缺失或 [TODO_RETRY] 的
                if not lang_text or lang_text == '[TODO_RETRY]':
                    to_translate.append({
                        'sentence_idx': sentence_idx,
                        'lang': lang,
                        'original_text': original_text
                    })
                    total_to_translate += 1

        if to_translate:
            materials_to_process.append({
                'id': material['id'],
                'slug': slug,
                'transcript': transcript,
                'to_translate': to_translate
            })

    print(f"🎯 需要补录的素材: {len(materials_to_process)} 个")
    print(f"📝 需要翻译的条目: {total_to_translate:,} 条")
    print()
    print(f"⏱️  预计耗时: {total_to_translate * 2.5 / 3600:.1f} 小时")
    print()

    # 开始补录
    print("=" * 80)
    print("🚀 开始补录...")
    print("=" * 80)
    print()

    start_time = time.time()

    for mat_idx, mat in enumerate(materials_to_process, 1):
        material_id = mat['id']
        slug = mat['slug']
        transcript = mat['transcript']
        to_translate = mat['to_translate']

        print(f"[{mat_idx}/{len(materials_to_process)}] {slug[:60]}")
        print(f"  待翻译: {len(to_translate)} 条")

        # 批量翻译该素材的缺失部分
        mat_success = 0
        mat_failed = 0

        for item in to_translate:
            sentence_idx = item['sentence_idx']
            lang = item['lang']
            original_text = item['original_text']

            print(f"  🌐 [{lang}] #{sentence_idx + 1}...", end=" ")

            # 翻译
            translation, success = translate_with_interception(original_text, lang)

            if success and translation:
                # 写入数据库
                transcript[sentence_idx]['translation'][lang] = translation
                mat_success += 1
                total_success += 1
                language_stats[lang]['success'] += 1
                print(f"✅ ({len(translation)} 字符)")
            else:
                mat_failed += 1
                total_failed += 1
                language_stats[lang]['failed'] += 1
                print(f"❌ 失败")

            # 延迟
            time.sleep(REQUEST_DELAY)

        # 保存到数据库
        if mat_success > 0:
            supabase.table('materials').update({
                'transcript': transcript
            }).eq('id', material_id).execute()
            print(f"  💾 已保存: +{mat_success}")
        else:
            print(f"  ⏭️  无更新")

        print()

        # 每 10 个素材显示进度
        if mat_idx % 10 == 0:
            elapsed = time.time() - start_time
            speed = total_success / elapsed if elapsed > 0 else 0
            remaining = total_to_translate - total_success
            eta = remaining / speed if speed > 0 else 0

            print("=" * 80)
            print(f"📊 进度统计 [{mat_idx}/{len(materials_to_process)}]")
            print(f"  已完成: {total_success:,} / {total_to_translate:,} ({total_success*100//total_to_translate}%)")
            print(f"  速度: {speed:.1f} 条/秒")
            print(f"  预计剩余: {eta/3600:.1f} 小时")
            print("=" * 80)
            print()

    # 最终报告
    print()
    print("=" * 80)
    print("📊 最终报告")
    print("=" * 80)
    print(f"总处理: {total_success + total_failed:,} 条")
    print(f"✅ 成功: {total_success:,}")
    print(f"❌ 失败: {total_failed:,}")
    print()
    print("各语言统计:")
    for lang in PRIORITY_LANGUAGES:
        stats = language_stats[lang]
        print(f"  {lang} ({LANGUAGES[lang]}): +{stats['success']:,} | ❌ {stats['failed']:,}")
    print()
    print(f"完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)


if __name__ == '__main__':
    main()
