#!/usr/bin/env python3
"""
数据清洗脚本 - 修复 materials 表中 transcript 的 AI 幻觉

问题类型：
1. [TODO_RETRY] 占位符（翻译失败）
2. AI 幻觉（包含 Prompt 约束条件，如 "- শব্দ পুনরাবৃত্তি এড়াও"）

处理逻辑：
- 删除脏语言的翻译
- 保留其他正常语言的翻译
- 不标记 is_completed（因为这只是部分语言的问题）

作者：Claude Sonnet 4.5
日期：2026-04-04
"""

import os
import sys
import re
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
from supabase import create_client

# ══════════════════════════════════════════════════════════════════════════════
# 配置
# ══════════════════════════════════════════════════════════════════════════════

# 加载环境变量
env_path = project_root / '.env.local'
load_dotenv(env_path)

# Supabase 配置
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# 创建 Supabase 客户端
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 所有 19 种语言
ALL_19_LANGUAGES = [
    'en', 'zh', 'zh_hant', 'vi',
    'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el',
    'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi'
]

# ══════════════════════════════════════════════════════════════════════════════
# 检测规则
# ══════════════════════════════════════════════════════════════════════════════

def is_dirty_translation(text: str, lang_code: str) -> Tuple[bool, str]:
    """
    检测翻译是否为脏数据

    参数:
        text: 翻译文本
        lang_code: 语言代码

    返回:
        (是否脏数据, 原因)
    """
    if not text or not isinstance(text, str):
        return False, ""

    # 规则 1: [TODO_RETRY] 占位符
    if '[TODO_RETRY]' in text:
        return True, "[TODO_RETRY] 占位符"

    # 规则 2: 包含 "-" 开头的格式说明（AI 幻觉）
    if re.search(r'^\s*-\s+', text):
        return True, "包含 '-' 开头的格式说明"

    # 规则 3: 包含未闭合的方括号（非 TODO_RETRY）
    if ('[' in text or ']' in text) and '[TODO_RETRY]' not in text:
        return True, "包含方括号"

    # 规则 4: 包含中文关键词（非中文语言）
    if lang_code not in ['zh', 'zh_hant']:
        chinese_keywords = ['翻译', '指令', '重复', '提供', '避免', '直接', '返回', '格式']
        for keyword in chinese_keywords:
            if keyword in text:
                return True, f"包含中文关键词 '{keyword}'"

    # 规则 5: 包含英文指令词
    instruction_keywords = ['instruction', 'translate', 'format', 'return', 'json', 'prompt']
    text_lower = text.lower()
    for keyword in instruction_keywords:
        if keyword in text_lower and lang_code != 'en':
            return True, f"包含英文指令关键词 '{keyword}'"

    # 规则 6: 过长的文本（可能是 Prompt 残留）
    if len(text) > 500:
        return True, f"文本过长 ({len(text)} 字符)"

    return False, ""


# ══════════════════════════════════════════════════════════════════════════════
# 数据库操作
# ══════════════════════════════════════════════════════════════════════════════

def fetch_all_materials() -> List[Dict]:
    """
    获取所有素材（分批处理）
    """
    print("📊 正在获取素材数据...")

    all_materials = []
    offset = 0
    limit = 50

    while True:
        try:
            response = supabase.table('materials') \
                .select('id, slug, transcript') \
                .range(offset, offset + limit - 1) \
                .execute()

            if not response.data:
                break

            all_materials.extend(response.data)
            print(f"  已获取 {len(all_materials)} 条素材...")

            if len(response.data) < limit:
                break

            offset += limit

        except Exception as e:
            print(f"❌ 获取素材失败: {e}")
            break

    print(f"✅ 总共获取 {len(all_materials)} 条素材")
    return all_materials


def update_material_transcript(material_id: str, transcript: List) -> bool:
    """
    更新素材的 transcript 字段
    """
    try:
        supabase.table('materials').update({'transcript': transcript}).eq('id', material_id).execute()
        return True
    except Exception as e:
        print(f"❌ 更新失败: {e}")
        return False


# ══════════════════════════════════════════════════════════════════════════════
# 主函数
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 80)
    print("🧹 数据清洗脚本 - 修复 materials 表中的 AI 幻觉")
    print("=" * 80)
    print()

    # 统计
    total_materials = 0
    dirty_materials = 0
    total_dirty_translations = 0
    cleaned_materials = 0

    # 语言分布统计
    language_dirty_count: Dict[str, int] = {lang: 0 for lang in ALL_19_LANGUAGES}
    reason_count: Dict[str, int] = {}

    # 获取所有素材
    materials = fetch_all_materials()
    total_materials = len(materials)

    if total_materials == 0:
        print("⚠️  没有找到素材")
        return

    print(f"\n🔍 开始检测脏数据...")
    print("-" * 80)

    for idx, material in enumerate(materials, 1):
        material_id = material['id']
        slug = material['slug']
        transcript = material.get('transcript', [])

        if not transcript:
            continue

        transcript_modified = False
        material_dirty_count = 0

        # 检查每个句子的翻译
        for sentence_idx, sentence in enumerate(transcript):
            translation = sentence.get('translation', {})
            if not translation:
                continue

            dirty_languages = []

            # 检查每种语言的翻译（使用 list() 避免迭代时修改字典）
            for lang_code, translation_text in list(translation.items()):
                if lang_code not in ALL_19_LANGUAGES:
                    continue

                is_dirty, reason = is_dirty_translation(translation_text, lang_code)

                if is_dirty:
                    dirty_languages.append((lang_code, reason))
                    language_dirty_count[lang_code] += 1
                    total_dirty_translations += 1
                    material_dirty_count += 1
                    reason_count[reason] = reason_count.get(reason, 0) + 1

                    # 从句子中删除此语言的翻译
                    del sentence['translation'][lang_code]
                    transcript_modified = True

        # 如果发现脏数据，更新数据库
        if transcript_modified:
            dirty_materials += 1
            print(f"\n[#{idx}] {slug}")
            print(f"  ID: {material_id}")
            print(f"  脏数据: {material_dirty_count} 条翻译")

            # 更新数据库
            if update_material_transcript(material_id, transcript):
                print(f"  ✅ transcript 已更新")
                cleaned_materials += 1
            else:
                print(f"  ❌ 更新失败")

        # 进度显示
        if idx % 50 == 0:
            print(f"\n📊 进度: {idx}/{total_materials} ({idx*100//total_materials}%)")
            print(f"  发现脏数据素材: {dirty_materials}")
            print(f"  清洗脏翻译条目: {total_dirty_translations}")

    # 总结报告
    print("\n" + "=" * 80)
    print("📊 清洗报告")
    print("=" * 80)
    print(f"总素材数: {total_materials}")
    print(f"发现脏数据素材: {dirty_materials} ({dirty_materials*100//total_materials if total_materials > 0 else 0}%)")
    print(f"发现脏翻译条目: {total_dirty_translations}")
    print(f"成功清洗素材: {cleaned_materials}")

    print("\n" + "-" * 80)
    print("📈 脏数据原因分布:")
    print("-" * 80)

    for reason, count in sorted(reason_count.items(), key=lambda x: x[1], reverse=True):
        print(f"  {reason}: {count} 条")

    print("\n" + "-" * 80)
    print("📈 脏数据语言分布:")
    print("-" * 80)

    # 按脏数据数量排序
    sorted_langs = sorted(language_dirty_count.items(), key=lambda x: x[1], reverse=True)

    for lang_code, count in sorted_langs:
        if count > 0:
            print(f"  {lang_code}: {count} 条")

    print("\n" + "=" * 80)
    print("✅ 清洗完成！")
    print("=" * 80)
    print("\n💡 提示：")
    print("  1. 脏语言的翻译已被删除")
    print("  2. 其他语言的翻译保持不变")
    print("  3. 可以重新运行翻译脚本来修复这些缺失的翻译")


if __name__ == '__main__':
    main()
