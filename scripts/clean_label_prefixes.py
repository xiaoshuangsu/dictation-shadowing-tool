#!/usr/bin/env python3
"""
清洗 16 国新语种数据中的标签前缀（Español:, Text:, Translation: 等）
"""
import os
import re
import json
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
from typing import Set, List, Dict

# 加载环境变量
load_dotenv(Path(__file__).parent.parent / '.env.local')

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

# 16 国新语种（不包括原有的 zh, zh_hant, vi）
NEW_LANGUAGES = [
    'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el',
    'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi'
]

# 白名单语种（不执行标签剥离）
WHITELIST_LANGUAGES = ['zh', 'zh_hant', 'ja', 'ko', 'vi']


def strip_labels(text: str, lang_code: str) -> str:
    """
    清洗翻译结果中的标签前缀
    """
    if lang_code in WHITELIST_LANGUAGES:
        return text

    lines = text.split('\n')
    cleaned_lines = []

    # 正则表达式：匹配行首的标签
    label_pattern = re.compile(r'^[A-Za-z\u0400-\u04FF\u00C0-\u017F\u1E00-\u1EFF]+:\s*')

    for line in lines:
        # 移除包含 Text:, Source:, Original: 的整行
        if any(marker in line for marker in ['Text:', 'Source:', 'Original:', 'Texto:']):
            continue

        # 剥离行首的标签前缀
        line = label_pattern.sub('', line)

        if line.strip():
            cleaned_lines.append(line)

    return '\n'.join(cleaned_lines).strip()


def clean_material(material: Dict) -> Dict:
    """
    清洗单个素材的翻译数据
    """
    material_id = material.get('id')
    slug = material.get('slug')
    title = material.get('title', '')

    try:
        transcript = material.get('transcript')
        if isinstance(transcript, str):
            transcript = json.loads(transcript)

        if not transcript:
            return {
                'material_id': material_id,
                'slug': slug,
                'title': title,
                'cleaned_count': 0,
                'has_changes': False
            }

        cleaned_count = 0
        modified = False

        for sentence in transcript:
            translation = sentence.get('translation', {})
            if not translation or not isinstance(translation, dict):
                continue

            for lang in NEW_LANGUAGES:
                if lang in translation and translation[lang] and translation[lang] != '[TODO_RETRY]':
                    original = translation[lang]
                    cleaned = strip_labels(original, lang)

                    if cleaned != original:
                        translation[lang] = cleaned
                        cleaned_count += 1
                        modified = True

        if modified:
            return {
                'material_id': material_id,
                'slug': slug,
                'title': title,
                'cleaned_count': cleaned_count,
                'has_changes': True,
                'transcript': transcript
            }

        return {
            'material_id': material_id,
            'slug': slug,
            'title': title,
            'cleaned_count': 0,
            'has_changes': False
        }

    except Exception as e:
        return {
            'material_id': material_id,
            'slug': slug,
            'title': title,
            'cleaned_count': 0,
            'has_changes': False,
            'error': str(e)
        }


def main():
    """主函数：批量清洗所有素材"""
    print("="*80)
    print("  清洗 16 国新语种数据中的标签前缀", flush=True)
    print("="*80)

    # 连接数据库
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 获取所有素材
    print("\n正在获取所有素材...")
    result = client.table('materials').select('id, slug, title, transcript').execute()

    all_materials = result.data
    total_count = len(all_materials)

    print(f"总共 {total_count} 个素材")
    print("="*80)

    # 统计
    total_cleaned = 0
    cleaned_materials = []

    # 处理每个素材
    for i, material in enumerate(all_materials, 1):
        slug = material.get('slug') or 'unknown'
        title = material.get('title') or 'Unknown'

        # 显示进度
        print(f"\r扫描进度: [{i}/{total_count}] {slug[:50]}...", end='', flush=True)

        # 清洗素材
        result = clean_material(material)

        if result['has_changes']:
            total_cleaned += result['cleaned_count']
            cleaned_materials.append(result)

            # 更新数据库
            client.table('materials').update({
                'transcript': result['transcript']
            }).eq('id', result['material_id']).execute()

    # 打印结果
    print("\n" + "="*80)
    print("  清洗完成", flush=True)
    print("="*80)
    print(f"总素材数: {total_count}")
    print(f"发现标签污染: {len(cleaned_materials)} 个素材")
    print(f"清洗条目: {total_cleaned} 条")
    print("="*80)

    # 显示被污染的素材详情（前 20 个）
    if cleaned_materials:
        print("\n被污染的素材详情（前 20 个）:")
        print("-"*80)
        for item in cleaned_materials[:20]:
            print(f"\n素材: {item['title'][:60]}... ({item['slug']})")
            print(f"  ID: {item['material_id']}")
            print(f"  清洗条目: {item['cleaned_count']}")
        print("-"*80)

        if len(cleaned_materials) > 20:
            print(f"\n... 还有 {len(cleaned_materials) - 20} 个素材")

    print("\n所有标签前缀已清洗完成！")
    print("="*80)


if __name__ == '__main__':
    main()
