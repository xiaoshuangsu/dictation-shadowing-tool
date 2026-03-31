#!/usr/bin/env python3
"""
雅思听力素材翻译引擎 - 生产版本 v3.0
分批翻译模式：16 种语言拆分为两组，每组 8 种

核心优化：
- 分批处理：每组 8 种语言，成功后立即保存
- 智能断点续传：自动识别并补齐缺失的组
- 失败标记：GROUP_A 成功 + GROUP_B 失败 → TODO_RETRY_GROUP_B
- 实时进度：每 8 语完成立即显示
"""
import os
import json
import requests
import time
import random
from pathlib import Path
from supabase import create_client
from collections import Counter
import re
from typing import Dict, List, Tuple, Optional
from datetime import datetime

# ==================== 加载环境变量 ====================
def load_env():
    env_path = Path(__file__).parent.parent / '.env.local'
    if not env_path.exists():
        raise FileNotFoundError(f".env.local 不存在: {env_path}")
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

load_env()

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
GLM_API_KEY = os.environ.get('GLM_API_KEY')

# ==================== 语言配置 ====================

# 原有的 3 种语言
EXISTING_LANGUAGES = ['zh', 'zh_hant', 'vi']

# 新增的 16 种语言（分两组）
GROUP_A = ['ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el']
GROUP_B = ['id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']

ALL_LANGUAGES = EXISTING_LANGUAGES + GROUP_A + GROUP_B

LANGUAGES = {
    'zh': {'name': '简体中文'},
    'zh_hant': {'name': '繁體中文'},
    'vi': {'name': 'Tiếng Việt'},
    # Group A
    'ar': {'name': 'العربية'},
    'de': {'name': 'Deutsch'},
    'es': {'name': 'Español'},
    'ja': {'name': '日本語'},
    'ms': {'name': 'Bahasa Melayu'},
    'ru': {'name': 'Русский'},
    'tr': {'name': 'Türkçe'},
    'el': {'name': 'Ελληνικά'},
    # Group B
    'id': {'name': 'Bahasa Indonesia'},
    'ko': {'name': '한국어'},
    'pt': {'name': 'Português'},
    'th': {'name': 'ภาษาไทย'},
    'uk': {'name': 'Українська'},
    'bn': {'name': 'বাংলা'},
    'mn': {'name': 'Монгол'},
    'hi': {'name': 'हिन्दी'},
}

# 日志文件
LOG_FILE = Path(__file__).parent / 'translation_batch.log'
TODO_LIST_FILE = Path(__file__).parent / 'todo_retry_list.txt'

# 优化配置
API_TIMEOUT = 30  # 超时设为 30 秒
MAX_RETRIES = 3
RETRY_DELAYS = [1, 2, 4]
BATCH_COOLDOWN = 5  # 两批之间的冷却时间（秒）

def log_to_file(msg: str, level: str = 'INFO'):
    """记录到日志文件"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"[{timestamp}] [{level}] {msg}\n")

def log(msg: str, level: str = 'INFO'):
    """控制台日志（强制刷新）"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {msg}", flush=True)
    log_to_file(msg, level)

def log_todo(material_id: str, slug: str, group: str):
    """记录待重试素材到本地文件"""
    with open(TODO_LIST_FILE, 'a', encoding='utf-8') as f:
        f.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | {material_id} | {slug} | {group}\n")

# ==================== 重复检测逻辑 ====================

def detect_repetition(text: str, lang_code: str) -> Tuple[bool, str]:
    """检测文本中是否有重复词汇"""
    if lang_code == 'mn':
        words = text.split()
    elif lang_code in ['zh', 'zh_hant', 'ja', 'ko', 'th']:
        words = list(text)
    elif lang_code in ['ar', 'hi', 'bn']:
        words = text.split()
    else:
        words = re.findall(r'\b\w+\b', text.lower())

    if len(words) < 3:
        return False, "太短"

    word_counts = Counter(words)

    for word, count in word_counts.most_common():
        if count >= 3 and len(word) > 2:
            return True, f"重复: '{word}' ×{count}"

    return False, "正常"

# ==================== 翻译函数 ====================

def translate_with_retry(text: str, lang_code: str) -> Tuple[str, bool, int]:
    """翻译到指定语言（带指数退避重试）

    Returns:
        (translation, success, attempt_count)
    """
    lang_name = LANGUAGES[lang_code]['name']

    prompt = f"""Translate the following English text to {lang_name}.

CRITICAL:
- Avoid word repetition
- Output only the direct translation

Text: {text}

Translation:"""

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
                            "content": f"You are a professional translator. Avoid repetition."
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                },
                timeout=API_TIMEOUT
            )

            if response.status_code == 200:
                result = response.json()
                translation = result["choices"][0]["message"]["content"].strip()

                # 检测重复
                has_repetition, _ = detect_repetition(translation, lang_code)
                if has_repetition:
                    translation = translation.split('.')[0]
                    if len(translation) < 10:
                        translation = text

                return translation, True, attempt + 1

            else:
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    time.sleep(delay)
                    continue
                else:
                    return text, False, attempt + 1

        except requests.exceptions.Timeout:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                time.sleep(delay)
                continue
            else:
                return text, False, attempt + 1

        except requests.exceptions.ConnectionError as e:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                time.sleep(delay)
                continue
            else:
                return text, False, attempt + 1

        except Exception as e:
            return text, False, attempt + 1

    return text, False, MAX_RETRIES

def check_groups_status(transcript: List[Dict]) -> Tuple[bool, bool, List[str]]:
    """检查素材的两组翻译状态

    Returns:
        (group_a_complete, group_b_complete, missing_groups)
    """
    if not transcript or len(transcript) == 0:
        return False, False, ['GROUP_A', 'GROUP_B']

    first_translation = transcript[0].get('translation', {})

    # 检查 Group A
    group_a_complete = all(lang in first_translation for lang in GROUP_A)

    # 检查 Group B
    group_b_complete = all(lang in first_translation for lang in GROUP_B)

    # 检查原有语言
    existing_complete = all(lang in first_translation for lang in EXISTING_LANGUAGES)

    # 确定缺失的组
    missing = []
    if not existing_complete:
        missing.append('EXISTING')
    if not group_a_complete:
        missing.append('GROUP_A')
    if not group_b_complete:
        missing.append('GROUP_B')

    return group_a_complete, group_b_complete, missing

def translate_group(sentences: List[Dict], target_langs: List[str]) -> Tuple[int, int]:
    """翻译一组语言

    Returns:
        (success_count, failed_count)
    """
    success_count = 0
    failed_count = 0

    for i, sentence in enumerate(sentences):
        sentence_text = sentence.get('text', '')
        existing = sentence.get('translation', {})

        # 翻译目标组中的每种语言
        for lang in target_langs:
            if lang not in existing:
                translation, success, _ = translate_with_retry(sentence_text, lang)

                if success:
                    sentence['translation'][lang] = translation
                    success_count += 1
                else:
                    sentence['translation'][lang] = "[TODO_RETRY]"
                    failed_count += 1
                    log_to_file(f"翻译失败: {lang} → [TODO_RETRY] (句子{i+1})", 'WARN')

        # 每 5 个句子报告一次进度
        if (i + 1) % 5 == 0:
            log(f"  进度: {i+1}/{len(sentences)}, 成功: {success_count}, 失败: {failed_count}")

    return success_count, failed_count

def reprocess_material(client, material: Dict) -> Tuple[bool, str]:
    """处理单个素材（分批模式）"""
    material_id = material.get('id')
    slug = material.get('slug')
    title = material.get('title', '')

    try:
        # 获取 transcript
        transcript = material.get('transcript')
        if isinstance(transcript, str):
            transcript = json.loads(transcript)

        if not transcript:
            return False, "transcript 为空"

        # 检查各组状态
        group_a_complete, group_b_complete, missing = check_groups_status(transcript)

        # 如果两组都完成，跳过
        if group_a_complete and group_b_complete:
            return True, f"[ID: {material_id}] Already up to date (all 19 语), skipping."

        total_success = 0
        total_failed = 0

        # 处理 Group A（如果需要）
        if not group_a_complete and 'GROUP_A' in missing:
            log(f"  🔄 开始翻译 Group A (8 种语言)...")
            success_a, failed_a = translate_group(transcript, GROUP_A)

            # 立即保存 Group A 的结果
            client.table('materials').update({
                'transcript': transcript
            }).eq('id', material_id).execute()

            log(f"  ✅ Group A 完成: 成功 {success_a}, 失败 {failed_a}，已保存")
            total_success += success_a
            total_failed += failed_a

        # 处理 Group B（如果需要）
        if not group_b_complete and 'GROUP_B' in missing:
            # 两批之间的冷却时间
            log(f"  ⏸️ 冷却 {BATCH_COOLDOWN} 秒（缓解 API Rate Limit）...")
            time.sleep(BATCH_COOLDOWN)

            log(f"  🔄 开始翻译 Group B (8 种语言)...")
            success_b, failed_b = translate_group(transcript, GROUP_B)

            # 保存 Group B 的结果
            client.table('materials').update({
                'transcript': transcript
            }).eq('id', material_id).execute()

            log(f"  ✅ Group B 完成: 成功 {success_b}, 失败 {failed_b}，已保存")
            total_success += success_b
            total_failed += failed_b

            # 如果 Group B 有失败，记录到待重试列表
            if failed_b > 0:
                log_todo(material_id, slug, 'GROUP_B')

        # 构建状态消息
        status_msg = f"✓ 翻译 {total_success} 条"
        if total_failed > 0:
            status_msg += f"，失败 {total_failed} 条 [TODO_RETRY]"

        if group_a_complete and not group_b_complete and total_failed > 0:
            status_msg += " [TODO_RETRY_GROUP_B]"

        return True, status_msg

    except Exception as e:
        error_msg = f"{slug}: {str(e)}"
        log_error(error_msg)
        import traceback
        log_to_file(traceback.format_exc(), 'ERROR')
        return False, error_msg

def main():
    """主函数：批量处理所有素材"""
    print("="*80, flush=True)
    print("  雅思听力素材翻译 - 生产版本 v3.0", flush=True)
    print("  分批翻译模式：16 语拆分为两组，每组 8 种", flush=True)
    print("="*80, flush=True)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"API 超时: {API_TIMEOUT} 秒", flush=True)
    print(f"最大重试: {MAX_RETRIES} 次", flush=True)
    print(f"重试延迟: {RETRY_DELAYS} 秒（指数退避）", flush=True)
    print(f"日志文件: {LOG_FILE}", flush=True)
    print(f"TODO 列表: {TODO_LIST_FILE}", flush=True)
    print("="*80, flush=True)

    print(f"\n语言分组:")
    print(f"  原有 (3 种): zh, zh_hant, vi")
    print(f"  Group A (8 种): {', '.join(GROUP_A)}")
    print(f"  Group B (8 种): {', '.join(GROUP_B)}")
    print("="*80, flush=True)

    # 连接数据库
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 获取所有素材
    log("正在获取所有素材...")
    result = client.table('materials').select('id, slug, title, transcript').execute()

    all_materials = result.data
    total_count = len(all_materials)

    log(f"总共 {total_count} 个素材")
    print("="*80, flush=True)

    # 统计
    success_count = 0
    skipped_count = 0
    failed_count = 0
    failed_materials = []

    # 处理每个素材
    for i, material in enumerate(all_materials, 1):
        slug = material.get('slug', 'unknown')
        title = material.get('title', 'Unknown')

        print(f"\n处理素材 [{i}/{total_count}]: {title[:60]}... ({slug})", flush=True)

        # 处理素材
        success, message = reprocess_material(client, material)

        if success:
            if "skipping" in message.lower():
                skipped_count += 1
                print(f"  ⏭️  {message}", flush=True)
            else:
                success_count += 1
                print(f"  ✅ {message}", flush=True)
        else:
            failed_count += 1
            failed_materials.append(slug)
            print(f"  ❌ {message}", flush=True)

        # 随机休眠 1-2 秒（防止 API 限流）
        if i < total_count:
            sleep_time = random.uniform(1.0, 2.0)
            time.sleep(sleep_time)

    # 最终统计
    print("\n" + "="*80, flush=True)
    print("  处理完成", flush=True)
    print("="*80, flush=True)
    print(f"总素材数: {total_count}", flush=True)
    print(f"成功处理: {success_count}", flush=True)
    print(f"跳过已完成: {skipped_count}", flush=True)
    print(f"失败: {failed_count}", flush=True)
    print(f"完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)

    if failed_materials:
        print("\n失败的素材:", flush=True)
        for slug in failed_materials:
            print(f"  - {slug}", flush=True)

    # 显示 TODO 列表统计
    try:
        if TODO_LIST_FILE.exists():
            with open(TODO_LIST_FILE, 'r', encoding='utf-8') as f:
                todo_lines = f.readlines()
                if todo_lines:
                    print(f"\n待重试列表 ({TODO_LIST_FILE}):")
                    print(f"  总计: {len(todo_lines)} 条记录")
    except:
        pass

    print("="*80, flush=True)
    log(f"批量处理完成: 成功 {success_count}, 跳过 {skipped_count}, 失败 {failed_count}")

if __name__ == '__main__':
    main()
