#!/usr/bin/env python3
"""
简体转繁体中文脚本（V1.0）
使用 GLM-4 API 将数据库中的简体中文翻译转换为地道的繁体中文（正体中文）
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from typing import List, Dict, Optional
from supabase import create_client
import requests

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# GLM API 配置
GLM_API_KEY = os.environ.get("GLM_API_KEY")

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# ══════════════════════════════════════════════════════════════════════════════
# System Prompt - 简体转繁体
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """你是一位专业的简繁转换专家。严格遵守以下规则：

【核心转换规则】：

1️⃣ 保持语气和风格：
- 口语文本保持口语化
- 学术文本保持严谨
- 励志文本保持文学性

2️⃣ 地区习惯用词转换（必须）：
- 信息 → 訊息
- 软件 → 軟體
- 视频 → 影片
- 网络 → 網路
- 数据 → 數據
- 服务器 → 伺服器
- 文件 → 檔案
- 程序 → 程式
- 项目 → 專案
- 操作系統 → 作業系統
- 鼠标 → 滑鼠
- 打印 → 列印
- 存储 → 儲存
- 内存 → 記憶體
- 硬盘 → 硬碟
- 处理器 → 處理器
- 芯片 → 晶片
- 游戏者 → 玩家（游戏语境）
- 在线 → 線上
- 离线 → 離線
- 账户 → 帳戶
- 登录 → 登入
- 注册 → 註冊
- 设置 → 設定
- 选项 → 選項
- 界面 → 介面
- 链接 → 連結
- 信息 → 資訊（计算机语境）
- 消息 → 訊息

3️⃣ 字符转换规则：
- 使用标准繁体字（正体中文）
- 避免使用异体字（除非是原文语境）
- 保持专业术语的一致性

【输出格式】：
⚠️ 只返回转换后的繁体文本，不要添加任何解释或标记
⚠️ 保持原文的标点符号和格式
"""

def convert_to_traditional_zh(text: str, context: str = "") -> Optional[str]:
    """将简体中文转换为繁体中文"""

    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    headers = {
        "Authorization": f"Bearer {GLM_API_KEY}",
        "Content-Type": "application/json"
    }

    user_content = f"""请将以下简体中文转换为地道的繁体中文（正体中文）。

转换要求：
1. 保持原有的口语或学术语气
2. 转换地区习惯用词（如『信息』变『訊息』，『软件』变『軟體』，『视频』变『影片』）
3. 仅返回转换后的繁体文本

{context}

原文（简体）：
{text}

繁体转换："""

    payload = {
        "model": "glm-4-flash",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.1,
        "max_tokens": 2000
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        result = response.json()

        if 'choices' in result and len(result['choices']) > 0:
            traditional = result['choices'][0]['message']['content'].strip()
            # 清理可能的引号包裹
            traditional = traditional.strip('"').strip("'").strip()
            return traditional
        else:
            print(f"      ⚠️  API 返回格式异常")
            return None

    except Exception as e:
        print(f"      ❌ 转换失败: {str(e)[:50]}")
        return None


def process_material(material_id: str, video_title: str, transcript: List[Dict], supabase_client) -> Dict:
    """
    处理单个素材的简转繁
    返回: {
        'success': bool,
        'reason': Optional[str],
        'converted_count': int
    }
    """

    # 静默模式：只打印简要信息
    print(f"   📝 {video_title[:50]}... ", end="", flush=True)

    # 统计需要转换的句子
    sentences_to_convert = []
    for sent in transcript:
        text = sent.get('text', '').strip()
        if not text:
            continue

        trans = sent.get('translation')
        if not isinstance(trans, dict):
            continue

        zh_simplfied = trans.get('zh', '').strip()
        if not zh_simplfied:
            continue

        # 检查是否已有繁体翻译
        if trans.get('zh_hant', '').strip():
            continue

        sentences_to_convert.append({
            'index': transcript.index(sent),
            'zh_simplified': zh_simplfied,
            'text_context': text[:100]  # 提供英文原文上下文
        })

    if not sentences_to_convert:
        print("⏭️  已跳过（已有繁体或无简体）")
        return {
            'success': True,
            'reason': 'skip',
            'converted_count': 0
        }

    converted_count = 0
    updated_transcript = []

    # 创建 transcript 副本
    for sent in transcript:
        sent_copy = sent.copy()
        trans = sent_copy.get('translation')

        if isinstance(trans, dict):
            zh_simplified = trans.get('zh', '').strip()
            if zh_simplified and not trans.get('zh_hant', '').strip():
                # 需要转换
                text_context = sent.get('text', '')[:100]
                context = f"\n原文上下文：{text_context}"

                traditional = convert_to_traditional_zh(zh_simplified, context)

                if traditional:
                    trans['zh_hant'] = traditional
                    sent_copy['translation'] = trans
                    converted_count += 1
                # 转换失败时保持原样，继续处理

        updated_transcript.append(sent_copy)

    if converted_count == 0:
        print("⚠️  转换失败")
        return {
            'success': False,
            'reason': 'conversion_failed',
            'converted_count': 0
        }

    # 写入数据库
    try:
        supabase_client.table('materials').update({
            'transcript': updated_transcript
        }).eq('id', material_id).execute()

        print(f"✅ {converted_count} 句")
        return {
            'success': True,
            'reason': None,
            'converted_count': converted_count
        }

    except Exception as e:
        print(f"❌ 数据库更新失败: {str(e)[:50]}")
        return {
            'success': False,
            'reason': f'db_error: {str(e)[:50]}',
            'converted_count': converted_count
        }


def main():
    """主函数"""

    MODE = os.environ.get("MODE", "full")  # full | demo | single
    SINGLE_ID = os.environ.get("SINGLE_ID")
    LIMIT = int(os.environ.get("LIMIT", "0"))

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("="*100)
    print("🔤 简体转繁体中文脚本 V1.0")
    print("="*100)
    print(f"\n📋 模式: {MODE}")

    # 统计结果
    stats = {
        'success': [],           # 成功处理
        'skipped': [],           # 已跳过（已有繁体）
        'failed': []             # 失败
    }

    if MODE == "single":
        # 单个素材模式
        print(f"\n🎯 素材 ID: {SINGLE_ID}")

        result = supabase.table('materials').select('*').eq('id', SINGLE_ID).execute()
        if not result.data:
            print(f"❌ 未找到素材")
            return

        material = result.data[0]
        process_result = process_material(
            material['id'],
            material['title'],
            material.get('transcript', []),
            supabase
        )

        if process_result['success']:
            if process_result['reason'] == 'skip':
                stats['skipped'].append(material['title'])
            else:
                stats['success'].append((material['title'], process_result['converted_count']))
        else:
            stats['failed'].append((material['title'], process_result['reason']))

    elif MODE == "demo":
        # 演示模式：只处理 5 个素材
        demo_titles = [
            "April Fool's Day Joke _ English Conversation",
            "IELTS Speaking Part 2 - Describe a book you recently read",
            "What Is Climate Change?",
            "Business English - How to give a presentation",
            "3 tips to boost your confidence - TED-Ed"
        ]

        print(f"\n🎯 演示素材: {len(demo_titles)} 个")
        print(f"{'='*100}\n")

        for title in demo_titles:
            result = supabase.table('materials').select('*').eq('title', title).execute()
            if result.data:
                material = result.data[0]
                process_result = process_material(
                    material['id'],
                    material['title'],
                    material.get('transcript', []),
                    supabase
                )

                if process_result['success']:
                    if process_result['reason'] == 'skip':
                        stats['skipped'].append(material['title'])
                    else:
                        stats['success'].append((material['title'], process_result['converted_count']))
                else:
                    stats['failed'].append((material['title'], process_result['reason']))

                time.sleep(0.5)  # 避免 API 频率限制

    else:
        # 全量模式
        print(f"\n🚀 全量模式")
        print(f"="*100)
        print(f"[模式]：每 20 条 Commit 一次")
        print(f"="*100)

        # 查询所有素材
        result = supabase.table('materials').select('*').order('id').execute()
        materials = result.data

        if LIMIT > 0:
            materials = materials[:LIMIT]
            print(f"\n📊 限制处理前 {LIMIT} 个素材")

        print(f"\n📊 总素材数: {len(materials)}")
        print(f"="*100)

        # 全量处理
        commit_count = 0
        for idx, material in enumerate(materials):
            current_num = idx + 1

            # 每 20 条打印一次批次信息
            if current_num % 20 == 1:
                print(f"\n{'='*100}")
                print(f"📦 批次 {((current_num-1)//20)+1} | 处理 {current_num}-{min(current_num+19, len(materials))}")
                print(f"{'='*100}\n")

            process_result = process_material(
                material['id'],
                material['title'],
                material.get('transcript', []),
                supabase
            )

            if process_result['success']:
                if process_result['reason'] == 'skip':
                    stats['skipped'].append(material['title'])
                else:
                    stats['success'].append((material['title'], process_result['converted_count']))
                    commit_count += 1

                    # 每 20 条 commit 一次
                    if commit_count % 20 == 0:
                        print(f"\n   📦 已处理 {commit_count} 个素材")
            else:
                stats['failed'].append((material['title'], process_result['reason']))

            time.sleep(0.2)  # 避免 API 频率限制

            # 每 20 个打印进度
            if current_num % 20 == 0 or current_num == len(materials):
                success_count = len([x for x in stats['success']])
                skip_count = len(stats['skipped'])
                failed_count = len(stats['failed'])
                print(f"\n   📊 进度: {current_num}/{len(materials)} | 成功: {success_count} | 跳过: {skip_count} | 失败: {failed_count}")

    # ═════════════════════════════════════════════════════════════════════════
    # 结果汇报
    # ═════════════════════════════════════════════════════════════════════════
    print(f"\n{'='*100}")
    print(f"✅ 转换任务完成")
    print(f"{'='*100}")

    total_converted = sum([count for _, count in stats['success']])

    print(f"\n📊 统计结果:")
    print(f"\n   ✅ 成功处理: {len(stats['success'])} 个素材 (共 {total_converted} 句)")
    print(f"   ⏭️  已跳过: {len(stats['skipped'])} 个")
    print(f"   ❌ 失败: {len(stats['failed'])} 个")

    if stats['failed'] and len(stats['failed']) <= 10:
        print(f"\n   ❌ 失败列表:")
        for i, (title, reason) in enumerate(stats['failed'], 1):
            print(f"      {i}. {title[:60]}")
            print(f"         原因: {reason}")

    print(f"\n{'='*100}")


if __name__ == "__main__":
    main()
