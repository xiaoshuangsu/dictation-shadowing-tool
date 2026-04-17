#!/usr/bin/env python3
"""
自动重试失败的翻译（支持 19 国语言）

支持两种模式：
1. 检测所有包含 [TODO_RETRY] 的翻译并重新请求 API
2. 针对指定素材 ID 补全所有缺失的翻译
"""
import os
import sys
import time
import json
import requests
from pathlib import Path
from typing import Dict, List, Tuple, Optional
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


def find_material_by_id(material_id: str) -> Optional[Dict]:
    """根据 ID 查找素材"""
    log(f"🔍 查找素材 ID: {material_id}")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    result = supabase.table('materials').select('id, title, transcript').eq('id', material_id).execute()

    if result.data:
        material = result.data[0]
        log(f"   ✅ 找到素材: {material['title']}")
        return {
            'id': material['id'],
            'title': material['title'],
            'transcript': material.get('transcript', [])
        }
    else:
        log(f"   ❌ 未找到素材")
        return None


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


def fix_material(material: Dict, fill_all: bool = False) -> Tuple[int, int]:
    """修复单个素材的失败翻译

    Args:
        material: 素材信息
        fill_all: 是否补全所有缺失的翻译（而不仅仅是 [TODO_RETRY]）
    """
    material_id = material['id']
    title = material['title']
    transcript = material['transcript']

    log(f"\n🔧 处理素材: {title}")
    if fill_all:
        log(f"   模式: 补全所有缺失翻译")
    else:
        log(f"   模式: 仅修复失败翻译")

    success_count = 0
    failed_count = 0

    for sentence_idx, sentence in enumerate(transcript):
        translation = sentence.get('translation', {})

        if not isinstance(translation, dict):
            translation = {}
            sentence['translation'] = translation

        text = sentence.get('text', '')

        # 检查每种语言
        for lang_code in LANGUAGES.keys():
            trans_text = translation.get(lang_code, "")

            # 判断是否需要翻译
            needs_translation = False
            if fill_all:
                # 补全模式：翻译所有缺失的语言
                needs_translation = not trans_text or trans_text == "[TODO_RETRY]"
            else:
                # 修复模式：仅修复失败的翻译
                needs_translation = trans_text == "[TODO_RETRY]"

            if needs_translation and text:
                # 重新翻译
                new_translation, success = translate_with_retry(text, lang_code)

                if success:
                    translation[lang_code] = new_translation
                    success_count += 1
                    if success_count % 10 == 0 or fill_all:
                        log(f"   ✅ [{sentence_idx+1}][{lang_code}] 修复成功")
                else:
                    failed_count += 1
                    if failed_count <= 5:
                        log(f"   ❌ [{sentence_idx+1}][{lang_code}] 仍然失败")

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

    # 解析命令行参数
    material_id = None
    fill_all = False

    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg.startswith('--material-id='):
                material_id = arg.split('=', 1)[1]
            elif arg == '--fill-all':
                fill_all = True
            elif arg == '--help' or arg == '-h':
                print("\n使用方法：")
                print("  python3 scripts/retry_failed_translations.py [选项]")
                print("\n选项：")
                print("  --material-id=<ID>  指定素材 ID（仅处理该素材）")
                print("  --fill-all          补全所有缺失的翻译（默认仅修复失败翻译）")
                print("  --help              显示此帮助信息")
                print("\n示例：")
                print("  # 处理所有失败翻译")
                print("  python3 scripts/retry_failed_translations.py")
                print("\n  # 补全指定素材的所有翻译")
                print("  python3 scripts/retry_failed_translations.py --material-id=xxx --fill-all")
                print("=" * 70)
                return

    if material_id:
        # 模式 1: 处理指定素材
        print(f"\n🎯 模式: 指定素材模式")
        print(f"🆔 素材 ID: {material_id}")
        print(f"📝 补全模式: {'是' if fill_all else '否（仅修复失败翻译）'}")

        material = find_material_by_id(material_id)
        if not material:
            log("\n❌ 未找到素材，退出")
            return

        # 统计待翻译数量
        transcript = material['transcript']
        if fill_all:
            pending = sum(
                1 for s in transcript
                for lang in LANGUAGES.keys()
                if lang not in s.get('translation', {}) or s['translation'].get(lang) == "[TODO_RETRY]"
            )
        else:
            pending = sum(
                1 for s in transcript
                for lang, trans in s.get('translation', {}).items()
                if trans == "[TODO_RETRY]"
            )

        log(f"\n📊 待翻译: {pending} 条")

        if pending == 0:
            log("\n✅ 所有翻译已完成")
            return

        # 处理
        success, failed = fix_material(material, fill_all=fill_all)

        # 最终报表
        print("\n" + "=" * 70)
        print("✅ 处理完成")
        print("=" * 70)
        print(f"\n📊 结果：")
        print(f"   成功: {success} 条")
        print(f"   失败: {failed} 条")
        print("=" * 70)

    else:
        # 模式 2: 处理所有失败翻译
        print(f"\n🎯 模式: 全局修复模式（仅修复失败翻译）")

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
