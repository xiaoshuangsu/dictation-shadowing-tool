#!/usr/bin/env python3
"""
自动重试失败的翻译（支持 19 国语言）

检测所有包含 [TODO_RETRY] 的翻译并重新请求 API
"""
import os
import sys
import time
import json
import requests
from pathlib import Path
from typing import Dict, List, Tuple
from supabase import create_client

# ============ 配置 ============

# 加载环境变量
env_path = Path(__file__).parent.parent / '.env.local'
if not env_path.exists():
    raise FileNotFoundError(f".env.local 不存在: {env_path}")

with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GLM_API_KEY = os.environ.get("GLM_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY or not GLM_API_KEY:
    raise ValueError("缺少必要的环境变量")

# 语言配置
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

API_TIMEOUT = 30
MAX_RETRIES = 3


# ============ 工具函数 ============

def log(msg: str):
    """简化日志"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def translate_with_retry(text: str, lang_code: str) -> Tuple[str, bool]:
    """翻译单句到指定语言"""
    lang_name = LANGUAGES[lang_code]['name']
    prompt = f"Translate to {lang_name}: {text}"

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
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 500
                },
                timeout=API_TIMEOUT
            )

            if response.status_code == 200:
                result = response.json()
                translation = result["choices"][0]["message"]["content"].strip()

                # 简单验证：不能是原文，不能太短
                if translation != text and len(translation) > 5:
                    return translation, True
                elif attempt < MAX_RETRIES - 1:
                    time.sleep(1)
                    continue
                else:
                    return text, False

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)
                continue
            else:
                return text, False

    return text, False


def find_materials_with_failed_translations() -> List[Dict]:
    """查找所有有失败翻译的素材"""
    log("🔍 正在查找有失败翻译的素材...")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 查询所有素材
    result = supabase.table('materials').select('id, title, transcript').execute()

    materials_with_failures = []

    for material in result.data:
        transcript = material.get('transcript', [])
        failed_count = 0

        for sentence in transcript:
            translation = sentence.get('translation', {})
            if isinstance(translation, dict):
                for lang, trans_text in translation.items():
                    if trans_text == "[TODO_RETRY]":
                        failed_count += 1

        if failed_count > 0:
            materials_with_failures.append({
                'id': material['id'],
                'title': material['title'],
                'failed_count': failed_count,
                'transcript': transcript
            })

    log(f"   ✅ 找到 {len(materials_with_failures)} 个素材有失败翻译")

    return materials_with_failures


def fix_material(material: Dict) -> Tuple[int, int]:
    """修复单个素材的失败翻译"""
    material_id = material['id']
    title = material['title']
    transcript = material['transcript']

    log(f"\n🔧 处理素材: {title}")

    success_count = 0
    failed_count = 0

    for sentence_idx, sentence in enumerate(transcript):
        translation = sentence.get('translation', {})

        if not isinstance(translation, dict):
            continue

        # 检查每种语言
        for lang, trans_text in list(translation.items()):
            if trans_text == "[TODO_RETRY]":
                text = sentence.get('text', '')

                # 重新翻译
                new_translation, success = translate_with_retry(text, lang)

                if success:
                    translation[lang] = new_translation
                    success_count += 1
                    log(f"   ✅ [{sentence_idx+1}][{lang}] 修复成功")
                else:
                    failed_count += 1
                    log(f"   ❌ [{sentence_idx+1}][{lang}] 仍然失败")

                # API 限流
                time.sleep(0.5)

    # 更新数据库
    if success_count > 0:
        try:
            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            supabase.table('materials').update({
                'transcript': transcript
            }).eq('id', material_id).execute()

            log(f"   💾 已保存 {success_count} 条修复")
        except Exception as e:
            log(f"   ❌ 保存失败: {e}")

    return success_count, failed_count


# ============ 主函数 ============

def main():
    print("=" * 70)
    print("🔄 自动重试失败的翻译")
    print("=" * 70)

    # 查找有失败翻译的素材
    materials = find_materials_with_failed_translations()

    if not materials:
        log("\n✅ 没有发现失败翻译")
        return

    # 显示汇总
    log(f"\n📊 失败翻译汇总：")
    total_failures = 0
    for m in materials:
        log(f"   - {m['title'][:60]} ({m['failed_count']} 条)")
        total_failures += m['failed_count']

    log(f"\n   总计: {total_failures} 条失败翻译")

    # 逐个处理
    total_success = 0
    total_failed = 0

    for material in materials:
        success, failed = fix_material(material)
        total_success += success
        total_failed += failed

    # 最终报表
    print("\n" + "=" * 70)
    print("✅ 重试完成")
    print("=" * 70)
    print(f"\n📊 最终结果：")
    print(f"   成功修复: {total_success} 条")
    print(f"   仍然失败: {total_failed} 条")
    print("=" * 70)


if __name__ == '__main__':
    os.chdir('/Users/a/dictation')
    main()
