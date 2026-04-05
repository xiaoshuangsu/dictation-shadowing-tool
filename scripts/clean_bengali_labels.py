#!/usr/bin/env python3
"""
清洗孟加拉语（bn）中的标签前缀（টেক্সট:, সঠিক: 等）
"""
import os
import re
import json
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# 加载环境变量
load_dotenv(Path(__file__).parent.parent / '.env.local')

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')


def strip_bengali_labels(text: str) -> str:
    """
    清洗孟加拉语翻译结果中的标签前缀
    """
    lines = text.split('\n')
    cleaned_lines = []

    # 正则表达式：匹配行首的标签（包括孟加拉语字符）
    label_pattern = re.compile(r'^[A-Za-z\u0400-\u04FF\u00C0-\u017F\u1E00-\u1EFF\u0980-\u09FF]+:\s*')

    for line in lines:
        # 移除包含常见标签标记的整行
        if any(marker in line for marker in ['Text:', 'Source:', 'Original:', 'Texto:']):
            continue

        # 剥离行首的标签前缀
        line = label_pattern.sub('', line)

        if line.strip():
            cleaned_lines.append(line)

    return '\n'.join(cleaned_lines).strip()


def main():
    """主函数：清洗所有孟加拉语记录"""
    print("="*80)
    print("  清洗孟加拉语（bn）中的标签前缀", flush=True)
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
    cleaned_count = 0
    cleaned_materials = []

    # 处理每个素材
    for i, material in enumerate(all_materials, 1):
        slug = material.get('slug') or 'unknown'
        title = material.get('title') or 'Unknown'

        # 显示进度
        print(f"\r扫描进度: [{i}/{total_count}] {slug[:50]}...", end='', flush=True)

        try:
            transcript = material.get('transcript')
            if isinstance(transcript, str):
                transcript = json.loads(transcript)

            if not transcript:
                continue

            modified = False
            material_cleaned = 0

            for sentence in transcript:
                translation = sentence.get('translation', {})
                if not translation or not isinstance(translation, dict):
                    continue

                # 处理孟加拉语
                if 'bn' in translation and translation['bn'] and translation['bn'] != '[TODO_RETRY]':
                    original = translation['bn']
                    cleaned = strip_bengali_labels(original)

                    if cleaned != original:
                        translation['bn'] = cleaned
                        material_cleaned += 1
                        modified = True

            if modified:
                # 更新数据库
                client.table('materials').update({
                    'transcript': transcript
                }).eq('id', material['id']).execute()

                cleaned_count += material_cleaned
                cleaned_materials.append({
                    'title': title[:60],
                    'slug': slug,
                    'cleaned': material_cleaned
                })

        except Exception as e:
            print(f"\n错误处理 {slug}: {str(e)}")

    # 打印结果
    print("\n" + "="*80)
    print("  清洗完成", flush=True)
    print("="*80)
    print(f"总素材数: {total_count}")
    print(f"发现标签污染: {len(cleaned_materials)} 个素材")
    print(f"清洗条目: {cleaned_count} 条")
    print("="*80)

    # 显示被污染的素材详情
    if cleaned_materials:
        print("\n被污染的素材详情:")
        print("-"*80)
        for item in cleaned_materials[:20]:
            print(f"  {item['title'][:50]}... ({item['slug']})")
            print(f"    清洗条目: {item['cleaned']}")
        print("-"*80)

        if len(cleaned_materials) > 20:
            print(f"\n... 还有 {len(cleaned_materials) - 20} 个素材")

    print("\n所有孟加拉语标签前缀已清洗完成！")
    print("="*80)


if __name__ == '__main__':
    main()
