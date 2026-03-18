#!/usr/bin/env python3
"""
修复 Empty Your Mind 素材的 transcript 断句问题
将合并的句子拆分成独立的句子
"""

import os
import json
from pathlib import Path
from supabase import create_client
import re

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

MATERIAL_ID = "d96f97f5-cc6c-4c96-b768-6525572d9af2"


def split_merged_sentence(text: str) -> list:
    """
    拆分合并的句子（如对话后紧跟动作描述）

    示例：
    "Can you help me?" The old man smiled.
    → ["Can you help me?", "The old man smiled."]
    """
    # 检测模式：引号对话 + 空格 + 大写字母开头的句子
    pattern = r'([.!?]\?*")\s+(?=[A-Z])'

    parts = re.split(pattern, text)

    # 重组拆分后的句子
    result = []
    for i in range(0, len(parts) - 1, 2):
        # parts[i] 是对话前半部分
        # parts[i+1] 是标点+引号
        if i + 1 < len(parts):
            result.append(parts[i] + parts[i + 1])
        else:
            result.append(parts[i])

    # 处理最后一部分
    if len(parts) % 2 == 1:
        result.append(parts[-1])

    # 过滤空字符串
    return [p.strip() for p in result if p.strip()]


def fix_transcript():
    """修复 transcript 断句问题"""

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # 获取素材数据
    result = supabase.table('materials').select('*').eq('id', MATERIAL_ID).execute()

    if not result.data:
        print(f"❌ 未找到素材 ID: {MATERIAL_ID}")
        return

    material = result.data[0]
    transcript = material.get('transcript', [])

    print(f"📝 原始句数: {len(transcript)}")

    # 查找并修复第 29 句（索引 28）
    target_index = 28  # 第 29 句

    if target_index >= len(transcript):
        print(f"❌ 索引超出范围")
        return

    original_sentence = transcript[target_index].get('text', '')

    print(f"\n原始第 29 句：")
    print(f"  {original_sentence}")

    # 检测是否需要拆分
    # 模式："...?" 或 "...!" 或 "...." 后跟空格和大写字母
    if re.search(r'[.!?]\?*"\s+[A-Z]', original_sentence):
        print(f"\n⚠️  检测到合并句，需要拆分")

        # 拆分句子
        parts = split_merged_sentence(original_sentence)

        print(f"\n拆分后：")
        for i, part in enumerate(parts, 1):
            print(f"  {i}. {part}")

        # 更新 transcript
        # 保留原句的元数据（start, end 等）
        original_meta = {
            k: v for k, v in transcript[target_index].items()
            if k != 'text' and k != 'translation'
        }

        # 替换第 29 句为第一部分
        transcript[target_index]['text'] = parts[0]
        transcript[target_index]['translation'] = {}

        # 插入第二部分作为第 30 句
        new_sentence = original_meta.copy()
        new_sentence['text'] = parts[1]
        new_sentence['translation'] = {}

        transcript.insert(target_index + 1, new_sentence)

        print(f"\n✅ 修复完成")
        print(f"📝 新句数: {len(transcript)}")

        # 写入数据库
        try:
            supabase.table('materials').update({
                'transcript': transcript
            }).eq('id', MATERIAL_ID).execute()

            print(f"\n✅ 已更新到数据库")

            # 显示修复前后的对比
            print(f"\n修复对比：")
            print(f"  第 29 句：{transcript[target_index]['text']}")
            print(f"  第 30 句：{transcript[target_index + 1]['text']}")

        except Exception as e:
            print(f"\n❌ 数据库更新失败: {e}")
    else:
        print(f"\n✅ 未检测到合并句，无需修复")


if __name__ == "__main__":
    print("="*80)
    print("🔧 修复 Empty Your Mind 素材的 transcript 断句问题")
    print("="*80)

    fix_transcript()
