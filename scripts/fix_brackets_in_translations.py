#!/usr/bin/env python3
"""
修复翻译中的方括号问题
"""

import os
import sys
import json
from pathlib import Path
from supabase import create_client

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def clean_translation(translation: str) -> str:
    """清理翻译中的方括号"""
    if not translation:
        return translation

    cleaned = translation

    # 处理格式: "英文 [中文]" 或 "[中文]"
    if '[' in cleaned and ']' in cleaned:
        # 尝试提取方括号内的中文
        parts = cleaned.split('[')
        if len(parts) >= 2:
            # 获取最后一个方括号后的内容
            last_bracket_content = '['.join(parts[1:])
            if ']' in last_bracket_content:
                chinese_part = last_bracket_content[:last_bracket_content.rindex(']')]
                # 检查是否是纯中文（不包含英文字母）
                if not any(c in chinese_part for c in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'):
                    cleaned = chinese_part.strip()

    # 去除所有方括号（保险起见）
    cleaned = cleaned.replace('[', '').replace(']', '')

    return cleaned.strip()


def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("="*100)
    print("🔧 修复翻译中的方括号问题")
    print("="*100)

    # 查询所有素材
    result = supabase.table('materials').select('*').order('id').execute()
    materials = result.data

    fixed_count = 0
    bracket_count = 0

    for material in materials:
        transcript = material.get('transcript', [])
        if not transcript:
            continue

        updated = False
        updated_transcript = []

        for sent in transcript:
            translation = sent.get('translation')
            if not translation:
                updated_transcript.append(sent)
                continue

            # 处理旧的 string 格式和新的 Translation JSONB 格式
            if isinstance(translation, str):
                zh = translation
                new_translation = {}
            else:
                zh = translation.get('zh', '')
                new_translation = translation.copy()

            # 检查是否包含方括号
            if '[' in zh or ']' in zh:
                bracket_count += 1
                cleaned_zh = clean_translation(zh)
                if cleaned_zh != zh:
                    # 更新翻译
                    if isinstance(translation, str):
                        new_translation = {"zh": cleaned_zh}
                    else:
                        new_translation['zh'] = cleaned_zh
                    updated = True

            updated_transcript.append({
                **sent,
                'translation': new_translation
            })

        if updated:
            # 更新数据库
            try:
                supabase.table('materials').update({
                    'transcript': updated_transcript
                }).eq('id', material['id']).execute()

                fixed_count += 1
                print(f"✅ [{fixed_count}] {material['title'][:60]}")
            except Exception as e:
                print(f"❌ 更新失败: {material['title'][:50]} - {str(e)[:50]}")

    print(f"\n{'='*100}")
    print(f"✅ 修复完成")
    print(f"{'='*100}")
    print(f"📊 修复素材数: {fixed_count}")
    print(f"📊 清理方括号数: {bracket_count}")


if __name__ == "__main__":
    main()
