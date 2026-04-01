#!/usr/bin/env python3
"""
YouTube 素材自动录入工具 - v2.2 优化版
改进：
1. LLM 标点恢复
2. 简化时间戳对齐逻辑
3. 末尾滞后容差
"""

import os
import sys
import re
import json
import requests
import time
from pathlib import Path
from supabase import create_client, Client
from typing import List, Dict
from datetime import datetime
import yt_dlp

# 加载环境变量
env_path = Path(__file__).parent.parent / '.env.local'
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GLM_API_KEY = os.environ.get("GLM_API_KEY")

DEFAULT_CATEGORY = "Science and Facts"
DEFAULT_DIFFICULTY = "B2"

EXISTING_LANGUAGES = ['zh', 'zh_hant', 'vi']
GROUP_A = ['ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el']
GROUP_B = ['id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']

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

def log(msg: str):
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {msg}", flush=True),

API_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAYS = [1, 2, 4]
BATCH_COOLDOWN = 5




def extract_video_id(url: str) -> str:
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)',
        r'youtube\.com\/watch\?.*v=([^&\n?#]+)'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"无法从 URL 提取视频 ID: {url}")


def clean_text(text: str) -> str:
    import html
    text = html.unescape(text)
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def restore_punctuation_with_llm(full_text: str) -> str:
    """使用 LLM 恢复标点符号"""
    log(f"   🤖 使用 LLM 恢复标点符号...")

    prompt = f"""Please add punctuation to the following text. Add commas, periods, and capitalize the first letter of each sentence. Do not change the wording or add/remove words.

Text: {full_text}

Return only the text with punctuation added, nothing else."""

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
                "temperature": 0.1,
                "max_tokens": 1000
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            restored_text = result["choices"][0]["message"]["content"].strip()
            log(f"   ✅ 标点恢复完成")
            return restored_text
        else:
            log(f"   ⚠️ LLM 请求失败，使用原始文本")
            return full_text

    except Exception as e:
        log(f"   ⚠️ 标点恢复出错: {e}，使用原始文本")
        return full_text


def merge_segments_improved(raw_segments: List[Dict]) -> List[Dict]:
    """
    改进的智能断句：v6.3 逻辑
    
    步骤：
    1. 使用 LLM 恢复标点
    2. 根据标点分割句子
    3. 为每句话分配准确的时间戳
    """
    log(f"   🔧 正在智能断句（原始片段: {len(raw_segments)}）...")

    if not raw_segments:
        return []

    # 第一步：合并文本并恢复标点
    full_text = ' '.join([s['text'].strip() for s in raw_segments])
    restored_text = restore_punctuation_with_llm(full_text)

    # 第二步：按标点分割句子
    sentences = re.split(r'(?<=[.!?])\s+', restored_text)

    if not sentences or len(sentences) == 1:
        log(f"   ⚠️ 标点分割失败，使用原始逻辑")
        sentences = [restored_text]

    # 第三步：为每个句子分配时间戳（简化版）
    # 方法：按单词数比例分配时间
    total_words = len(restored_text.split())
    result = []
    word_idx = 0
    seg_idx = 0
    current_seg_words = []

    # 收集所有片段的单词和时间
    all_words = []
    for seg in raw_segments:
        seg_words = seg['text'].strip().split()
        for word in seg_words:
            all_words.append({
                'word': word,
                'start': seg['start'],
                'end': seg['end']
            })

    # 为每个句子分配时间戳
    word_cursor = 0

    for sentence in sentences:
        if not sentence.strip():
            continue

        sentence_words = sentence.split()

        if word_cursor + len(sentence_words) > len(all_words):
            # 超出范围，使用最后一个时间
            break

        # 句子开始时间
        start_time = all_words[word_cursor]['start']

        # 句子结束时间
        end_idx = word_cursor + len(sentence_words) - 1
        if end_idx < len(all_words):
            end_time = all_words[end_idx]['end']
        else:
            end_time = all_words[-1]['end']

        # 🔴 末尾滞后容差：检查下一个单词是否属于当前句
        if end_idx + 1 < len(all_words):
            next_word_time = all_words[end_idx + 1]['start']
            gap = next_word_time - end_time

            # 如果下一个单词在 300ms 内，且首字母小写，可能属于当前句
            if gap < 0.3:
                next_word = all_words[end_idx + 1]['word']
                if next_word and next_word[0].islower() and next_word not in ['i', 'i\'m', 'i\'ve']:
                    # 合并到当前句
                    end_time = all_words[end_idx + 1]['end']
                    word_cursor += 1

        result.append({
            'text': sentence.strip(),
            'start': start_time,
            'end': end_time
        })

        word_cursor += len(sentence_words)

    log(f"   ✅ 断句完成: {len(result)} 条句子")

    return result



# ============ 挖空逻辑（v6.2 核心）============

# 黑名单
STRICT_BLACKLIST = [
    # 代词/引导词
    'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
    'that', 'which', 'who', 'this', 'these', 'those',
    'my', 'your', 'his', 'hers', 'its', 'our', 'their', 'ours', 'theirs',
    'whom', 'whose',
    # 虚词/连词
    'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'if',
    'when', 'where', 'while', 'since', 'until', 'unless', 'although',
    # 简单介词
    'in', 'on', 'at', 'to', 'of', 'for', 'with', 'by', 'from', 'about',
    'into', 'onto', 'upon', 'within', 'without', 'during', 'before', 'after',
    # 基础系动词/助动词
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'have', 'has', 'had', 'having',
    # 语气词/感叹词
    'yes', 'no', 'okay', 'well', 'quite',
    # 低级/模糊词汇
    'things', 'stuff', 'know',
    # 问候语
    'hello', 'hi', 'hey', 'goodbye', 'bye', 'thanks', 'please',
    # 常见形容词
    'big', 'small', 'right', 'wrong', 'sure', 'clear',
    'nice', 'fine', 'alright', 'great', 'little',
    # 常见动词
    'say', 'says', 'said', 'tell', 'told', 'ask', 'get', 'make', 'take',
    'let', 'put', 'call', 'keep', 'give', 'find', 'show', 'hold',
    # 填充语
    'then', 'either', 'though', 'anyway', 'actually',
    # 情态助动词
    'can', 'could', 'would', 'should', 'may', 'might', 'must', 'shall',
    # 疑问代词
    'what',
    # 低级认知词/填充词
    'think', 'uh', 'hmm', 'um',
    # 感叹词
    'oh', 'ah', 'wow', 'hey', 'oops', 'ugh', 'ew', 'whoa', 'yeah', 'yay', 'aww',
    'phew', 'eek', 'yikes', 'gosh', 'jeez', 'man',
    # 其他
    'there', 'here', 'just', 'really', 'very'
]


def is_blacklisted(word: str) -> bool:
    """检查单词是否在黑名单中"""
    word_clean = word.lower().strip('.,!?;:"\'')
    return word_clean in STRICT_BLACKLIST


def is_contraction(word: str) -> bool:
    """检查是否为缩写代词"""
    word_clean = word.lower().strip('.,!?;:"\'')
    contraction_patterns = [
        r"^(you|it|that|what|who|there|here|i|we|they)['']re$",
        r"^(he|she|it|that|what|there|here)['']s$",
        r"^(i|you|we|they|he|she|it)['']ve$",
        r"^(i|you|we|they|he|she|it|would|could|should)['']d$",
        r"^(i|you|we|they|he|she|it)['']ll$",
        r"^let['']s$",
        r"^can['']t$",
        r"^won['']t$",
        r"^don['']t$"
    ]
    for pattern in contraction_patterns:
        if re.match(pattern, word_clean):
            return True
    return False


def is_fact_word(word: str) -> bool:
    """检查是否为事实词"""
    word_clean = word.lower().strip('.,!?;:"\'')
    if word_clean.replace('.', '').replace(',', '').isdigit():
        return True
    if any(c.isdigit() for c in word_clean):
        return True
    price_indicators = ['$', '£', '€', 'yen', 'yuan', 'dollar', 'pound', 'cent', 'euro']
    if any(indicator in word_clean for indicator in price_indicators):
        return True
    address_words = ['street', 'road', 'avenue', 'boulevard', 'lane', 'drive', 'way',
                     'building', 'room', 'floor', 'suite', 'apartment', 'flat']
    if word_clean in address_words:
        return True
    return False


def is_proper_noun(word: str, sentence_text: str = '', index: int = -1) -> bool:
    """检查是否为专有名词"""
    word_clean = word.strip('.,!?;:"\'')
    if word_clean and word_clean[0].isupper() and index > 0:
        return True
    place_names = ['london', 'paris', 'tokyo', 'new york', 'sydney', 'moscow', 'beijing', 'shanghai',
                   'america', 'american', 'britain', 'british', 'england', 'english',
                   'cambridge', 'oxford', 'yale', 'harvard', 'stanford']
    if word_clean.lower() in place_names:
        return True
    return False


def should_skip_word(word: str, sentence_text: str = '', index: int = -1) -> bool:
    """综合判断是否应该跳过该词"""
    if is_blacklisted(word):
        return True
    if is_contraction(word):
        return True
    if is_fact_word(word):
        return True
    if is_proper_noun(word, sentence_text, index):
        return True
    return False


def calculate_word_weight(word: str, sentence_text: str = '', index: int = -1) -> int:
    """计算单词的权重（0-12）"""
    if should_skip_word(word, sentence_text, index):
        return 0

    word_clean = word.lower().strip('.,!?;:"\'')
    word_length = len(word_clean)

    # 音节复杂度最高权重
    complex_words = ['available', 'throughout', 'refurbishment', 'significantly',
                     'particularly', 'especially', 'approximately', 'specifically']
    if word_clean in complex_words:
        return 12

    # 长单词提权
    if word_length >= 11:
        return 11
    if word_length >= 8 and word_length <= 10:
        return 10

    # 月份提权
    month_days = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december',
                  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    if word_clean in month_days:
        return 9

    # 副词
    if word_clean.endswith('ly'):
        return 10

    # 高级动词
    if word_clean.endswith('ing') or (word_clean.endswith('ed') and not word_clean.endswith('ted')):
        basic_verbs = ['going', 'doing', 'getting', 'using', 'making', 'taking', 'seeing']
        if word_clean not in basic_verbs:
            return 9

    # 形容词
    if word_clean.endswith('ive') or word_clean.endswith('ous') or word_clean.endswith('ent'):
        return 8

    # 名词
    if (word_clean.endswith('ment') or word_clean.endswith('tion') or
          word_clean.endswith('ness') or word_clean.endswith('ity')):
        return 5

    return 6


# 函数别名（兼容性）
merge_segments = merge_segments_improved


def generate_blanks_for_transcript(transcript: List[Dict]) -> Tuple[int, Dict]:
    """为整个 transcript 生成挖空数据

    Returns:
        (成功数量, 权重统计)
    """
    log(f"   🔧 正在生成挖空数据...")

    blanked_words = {}
    weight_stats = {10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0}
    success_count = 0

    for i, sentence in enumerate(transcript):
        sentence_text = sentence.get('text', '')
        words = sentence_text.split()

        if not words:
            sentence['blanks'] = []
            continue

        # 计算所有词的权重
        candidates = []
        for wi, word in enumerate(words):
            word_clean = word.lower().strip('.,!?;:"\'')

            # 跳过已挖1次的词
            if blanked_words.get(word_clean, 0) >= 1:
                continue

            # 使用 should_skip_word 判断
            if should_skip_word(word, sentence_text, wi):
                continue

            # 计算权重
            weight = calculate_word_weight(word, sentence_text, wi)
            if weight > 0:
                candidates.append((weight, wi, word))

        # 选择权重最高的词
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            weight, index, word = candidates[0]

            sentence['blanks'] = [{
                "word": word.strip('.,!?;:"\''),
                "index": index,
                "pos": f"权重{weight}",
                "is_core": True,
                "weight": weight
            }]

            # 更新全局计数
            word_lower = word.lower().strip('.,!?;:"\'')
            blanked_words[word_lower] = blanked_words.get(word_lower, 0) + 1

            # 统计权重
            if weight in weight_stats:
                weight_stats[weight] += 1

            success_count += 1
        else:
            sentence['blanks'] = []

        if (i + 1) % 5 == 0:
            log(f"      进度: {i+1}/{len(transcript)}")

        time.sleep(0.3)

    log(f"   ✅ 挖空完成: 成功 {success_count}, 跳过 {len(transcript) - success_count}")
    log(f"      权重分布: W10={weight_stats[10]}, W9={weight_stats[9]}, W8={weight_stats[8]}, W7={weight_stats[7]}, W6={weight_stats[6]}, W5={weight_stats[5]}")

    return success_count, weight_stats


# ============ 翻译逻辑
# ============ 翻译逻辑 ====================

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


def extract_translation_from_response(response_text: str, original_text: str) -> str:
    """从 GLM 响应中提取纯翻译内容（修复 prompt 干扰问题）"""
    # 移除原文（如果被包含在响应中）
    if original_text in response_text:
        parts = response_text.split(original_text)
        if len(parts) > 1:
            response_text = parts[-1]

    # 查找翻译标记之后的内容
    translation_markers = [
        '译文:', '翻译:', '翻譯:', 'Translation:', 'Traducción:',
        'Übersetzung:', 'Traduction:', '翻訳:', '번역:',
        'แปล:', 'Переклад:', 'Перевод:'
    ]

    for marker in translation_markers:
        if marker in response_text:
            parts = response_text.split(marker)
            if len(parts) > 1:
                response_text = parts[-1].strip()
                break

    # 移除包含原文标记的部分
    text_markers = ['原文:', '文字:', 'Text:', 'Texto:', 'Текст:', 'テキスト:']
    for marker in text_markers:
        if marker in response_text:
            parts = response_text.split(marker)
            if len(parts) > 1:
                response_text = parts[0].strip()

    # 移除指令行
    lines = response_text.split('\n')
    cleaned_lines = []

    for line in lines:
        line = line.strip()
        # 跳过包含 CRITICAL、关键、- 等指令的行
        if any(prefix in line for prefix in ['CRITICAL:', '关键：', '關鍵：', 'Important:', '- ']):
            if any(marker in line for marker in ['译文:', '翻译:', '翻譯:', 'Translation:']):
                if ':' in line:
                    line = line.split(':', 1)[1].strip()
            else:
                continue
        if line:
            cleaned_lines.append(line)

    result = '\n'.join(cleaned_lines).strip()

    # 如果结果太短或等于原文，返回 None
    if len(result) < 10 or result == original_text:
        return None

    return result


def translate_with_retry(text: str, lang_code: str) -> Tuple[str, bool, int]:
    """翻译到指定语言（带指数退避重试 + prompt 干扰修复）"""
    lang_name = LANGUAGES[lang_code]['name']

    # 使用简化的 prompt，减少干扰
    prompt = f"""Translate to {lang_name}: {text}"""

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
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                },
                timeout=API_TIMEOUT
            )

            if response.status_code == 200:
                result = response.json()
                raw_content = result["choices"][0]["message"]["content"].strip()

                # 提取翻译内容
                translation = extract_translation_from_response(raw_content, text)

                if translation:
                    # 检测重复
                    has_repetition, _ = detect_repetition(translation, lang_code)
                    if has_repetition:
                        translation = translation.split('.')[0]
                        if len(translation) < 10:
                            translation = text

                    return translation, True, attempt + 1
                elif attempt < MAX_RETRIES - 1:
                    # 提取失败，重试
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    time.sleep(delay)
                    continue
                else:
                    # 最后尝试：直接使用最后一行
                    cleaned = raw_content.split('\n')[-1].strip()
                    if cleaned and cleaned != text and len(cleaned) > 10:
                        return cleaned, True, attempt + 1
                    return text, False, attempt + 1

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

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                time.sleep(delay)
                continue
            else:
                return text, False, attempt + 1

    return text, False, MAX_RETRIES


def translate_group(transcript: List[Dict], target_langs: List[str]) -> Tuple[int, int]:
    """翻译一组语言

    Returns:
        (success_count, failed_count)
    """
    success_count = 0
    failed_count = 0

    for i, sentence in enumerate(transcript):
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

        # 每 5 个句子报告一次进度
        if (i + 1) % 5 == 0:
            log(f"      进度: {i+1}/{len(transcript)}, 成功: {success_count}, 失败: {failed_count}")

    return success_count, failed_count


def generate_translations_for_transcript(transcript: List[Dict]) -> Tuple[int, int, List[str]]:
    """为整个 transcript 生成翻译（19种语言：原有3种 + 新增16种）

    Returns:
        (total_success, total_failed, failed_groups)
    """
    log(f"   🔧 正在生成翻译（19国语言）...")

    total_success = 0
    total_failed = 0
    failed_groups = []

    # 🆕 处理原有语言（zh, zh_hant, vi）
    log(f"   🔄 开始翻译原有语言 (3 种: zh, zh_hant, vi)...")
    success_existing, failed_existing = translate_group(transcript, EXISTING_LANGUAGES)
    log(f"   ✅ 原有语言完成: 成功 {success_existing}, 失败 {failed_existing}")

    total_success += success_existing
    total_failed += failed_existing

    if failed_existing > 0:
        failed_groups.append('EXISTING')

    # 处理 Group A
    log(f"   🔄 开始翻译 Group A (8 种语言)...")
    success_a, failed_a = translate_group(transcript, GROUP_A)
    log(f"   ✅ Group A 完成: 成功 {success_a}, 失败 {failed_a}")

    total_success += success_a
    total_failed += failed_a

    if failed_a > 0:
        failed_groups.append('GROUP_A')

    # 冷却时间（原有语言和 Group A 之间）
    if failed_existing == 0 and failed_a == 0:
        log(f"   ⏸️ 冷却 {BATCH_COOLDOWN} 秒（缓解 API Rate Limit）...")
        time.sleep(BATCH_COOLDOWN)

    # 处理 Group B（仅当 Group A 全部成功时）
    if failed_a == 0:
        log(f"   🔄 开始翻译 Group B (8 种语言)...")
        success_b, failed_b = translate_group(transcript, GROUP_B)
        log(f"   ✅ Group B 完成: 成功 {success_b}, 失败 {failed_b}")

        total_success += success_b
        total_failed += failed_b

        if failed_b > 0:
            failed_groups.append('GROUP_B')
    else:
        log(f"   ⚠️  Group A 有失败，跳过 Group B（需手动重试）")
        # 标记 Group B 为待重试
        failed_groups.append('GROUP_B')

        # 为 Group B 添加占位符
        for sentence in transcript:
            for lang in GROUP_B:
                if lang not in sentence.get('translation', {}):
                    sentence['translation'][lang] = "[TODO_RETRY]"

    return total_success, total_failed, failed_groups


# ============ yt-dlp 字幕抓取
# ============ yt-dlp 字幕抓取 ============

def fetch_youtube_metadata(video_url: str) -> Dict:
    """使用 yt-dlp 获取 YouTube 视频元数据和字幕"""
    log(f"🎬 使用 yt-dlp 获取视频信息...")

    result = {
        'video_id': None,
        'title': None,
        'duration': None,
        'thumbnail': None,
        'subtitles': None,
        'captions_found': False
    }

    try:
        video_id = extract_video_id(video_url)
        result['video_id'] = video_id
        result['thumbnail'] = f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg"

        # 配置 yt-dlp
        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }

        log(f"   📡 正在获取视频信息...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)

            # 提取标题
            if info.get('title'):
                result['title'] = info['title']
                log(f"   ✅ 标题: {info['title']}")

            # 提取时长
            if info.get('duration'):
                result['duration'] = info['duration']
                minutes = info['duration'] // 60
                seconds = info['duration'] % 60
                log(f"   ✅ 时长: {minutes}分{seconds}秒")

            # 提取字幕（优先手动字幕，fallback 到自动字幕）
            log(f"   📝 正在获取字幕...")

            subtitle_url = None
            subtitle_type = None

            # 优先使用手动字幕
            if 'subtitles' in info and 'en' in info['subtitles']:
                subtitle_url = info['subtitles']['en'][0]['url']
                subtitle_type = "手动字幕"
            # Fallback 到自动字幕
            elif 'automatic_captions' in info and 'en' in info['automatic_captions']:
                subtitle_url = info['automatic_captions']['en'][0]['url']
                subtitle_type = "自动生成字幕"

            if subtitle_url:
                log(f"   📌 字幕类型: {subtitle_type}")

                # 下载字幕内容
                response = requests.get(subtitle_url, timeout=10)
                response.raise_for_status()
                data = response.json()

                # 解析字幕
                events = data.get('events', [])
                raw_segments = []

                for event in events:
                    if 'segs' in event:
                        text = ''.join([seg.get('utf8', '') for seg in event['segs']])
                        text = text.strip()

                        if text:
                            start_ms = event.get('tStartMs', 0)
                            duration_ms = event.get('dDurationMs', 0)

                            raw_segments.append({
                                'text': text,
                                'start': start_ms / 1000,
                                'end': (start_ms + duration_ms) / 1000
                            })

                if raw_segments:
                    # 🔴 使用智能断句算法
                    merged_segments = merge_segments(raw_segments)
                    result['subtitles'] = merged_segments
                    result['captions_found'] = True
                    log(f"   ✅ 字幕提取成功: {len(merged_segments)} 条")
                else:
                    log(f"   ⚠️  字幕解析后为空")
            else:
                log(f"   ⚠️  该视频没有英文字幕")

    except Exception as e:
        log(f"   ❌ 错误: {e}")
        import traceback
        traceback.print_exc()

    return result


# ============ 数据库操作
# ============ 数据库操作 ============

def upsert_material(client: Client, metadata: Dict, transcript: List[Dict],
                   category: str, difficulty: str, failed_groups: List[str]) -> bool:
    """入库素材"""
    video_id = metadata['video_id']
    title = metadata['title']
    slug = title_to_slug(title)

    log(f"\n💾 正在入库素材...")
    log(f"   📌 视频 ID: {video_id}")
    log(f"   📌 标题: {title}")
    log(f"   📌 Slug: {slug}")
    log(f"   📚 分类: {category}")
    log(f"   📊 难度: {difficulty}")
    log(f"   📝 字幕条数: {len(transcript)}")

    if failed_groups:
        log(f"   ⚠️  待重试组: {', '.join(failed_groups)}")

    # 检查是否已存在
    existing = client.table('materials').select('*').eq('youtube_id', video_id).execute()

    material_data = {
        'title': title,
        'slug': slug,
        'category': category,
        'difficulty': difficulty,
        'source_type': 'youtube',  # 🎯 确保 source_type 标记为 youtube
        'youtube_id': video_id,     # 🎯 确保 youtube_id 字段存在
        'audio_path': f'youtube:{video_id}',
        'audio_size': 0,
        'video_path': None,
        'thumbnail_path': metadata.get('thumbnail'),
        'duration': metadata.get('duration'),
        'transcript': transcript,
        'play_count': 0,
        # SEO 字段
        'meta_title': f"{title} | English Dictation & Shadowing",
        'meta_description': clean_text(' '.join([s['text'] for s in transcript[:10]]))[:150] if transcript else None,
        'og_image': metadata.get('thumbnail'),
    }

    try:
        if existing.data:
            material_id = existing.data[0]['id']
            log(f"   ⚠️  素材已存在 (ID: {material_id})，正在更新...")
            client.table('materials').update(material_data).eq('id', material_id).execute()
            log(f"   ✅ 更新成功")
        else:
            result = client.table('materials').insert(material_data).execute()
            material_id = result.data[0]['id']
            log(f"   ✅ 创建成功 (ID: {material_id})")

        return True

    except Exception as e:
        log(f"   ❌ 入库失败: {e}")
        import traceback
        traceback.print_exc()
        return False


# ============ 主函数 ============

def print_help():
    """打印帮助信息"""
    print("=" * 70)
    print("🎯 YouTube 素材自动录入工具 - v2.0 完整版")
    print("=" * 70)
    print("")
    print("功能：")
    print("  1. yt-dlp 获取字幕（绕过 PO Token）")
    print("  2. 智能断句 + 文本规范化 + 时间轴优化")
    print("  3. 智能挖空（v6.2 逻辑）")
    print("  4. 16国语言翻译（Group A + Group B）")
    print("  5. 入库 Supabase（前端开箱即用）")
    print("")
    print("使用方法：")
    print("  python3 scripts/ingest_youtube_ytdlp.py <YouTube_URL> [选项]")
    print("")
    print("选项：")
    print("  --category <分类>    素材分类（默认: Science and Facts）")
    print("  --difficulty <难度>  难度等级（默认: B2）")
    print("  --help              显示此帮助信息")
    print("")
    print("=" * 70)


def normalize_transcript(raw_segments: List[Dict]) -> List[Dict]:
    """
    格式化为数据库格式，实施"末端强切"和"强制真空带"逻辑
    """
    log(f"   🔧 正在格式化字幕...")

    # 🔴 配置参数
    END_CUT_OFFSET = 0.5  # 核心缩进：每句结尾减少 500ms
    MIN_DURATION = 0.2    # 最小时长：确保每句至少 0.2 秒
    MIN_GAP = 0.2         # 强制真空带：确保句间至少 200ms 静音期

    normalized = []
    current_id = 1

    for i, segment in enumerate(raw_segments):
        text = clean_text(segment['text'])
        start = segment['start']
        end = segment['end']

        if not text or len(text) <= 1:
            continue

        # 🔴 第一步：应用核心缩进（0.5s）
        new_end = end - END_CUT_OFFSET

        # 🔴 第二步：极短句保底
        final_end = max(start + MIN_DURATION, new_end)

        normalized.append({
            'id': current_id,
            'text': text,
            'startTime': round(start, 2),
            'endTime': round(final_end, 2),
            'translation': {},  # 🆕 初始化为空字典
            'blanks': []        # 🆕 初始化为空数组
        })
        current_id += 1

    # 🔴 第三步：强制真空带
    log(f"   🔧 正在应用强制真空带...")
    adjustments = 0

    for i in range(len(normalized) - 1):
        current = normalized[i]
        next_sentence = normalized[i + 1]

        gap = next_sentence['startTime'] - current['endTime']

        if gap < MIN_GAP:
            old_end = current['endTime']
            new_end = next_sentence['startTime'] - MIN_GAP
            final_new_end = max(current['startTime'] + MIN_DURATION, new_end)
            current['endTime'] = round(final_new_end, 2)
            adjustments += 1

    log(f"   ✅ 格式化完成: {len(normalized)} 条句子")
    log(f"      - 核心缩进: -{END_CUT_OFFSET}s, 最小时长: {MIN_DURATION}s, 强制真空带: {MIN_GAP}s")
    log(f"      - 调整次数: {adjustments} 次")

    return normalized


# ============ 挖空逻辑（v6.2 核心）============

# 黑名单
STRICT_BLACKLIST = [
    # 代词/引导词
    'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
    'that', 'which', 'who', 'this', 'these', 'those',
    'my', 'your', 'his', 'hers', 'its', 'our', 'their', 'ours', 'theirs',
    'whom', 'whose',
    # 虚词/连词
    'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'if',
    'when', 'where', 'while', 'since', 'until', 'unless', 'although',
    # 简单介词
    'in', 'on', 'at', 'to', 'of', 'for', 'with', 'by', 'from', 'about',
    'into', 'onto', 'upon', 'within', 'without', 'during', 'before', 'after',
    # 基础系动词/助动词
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'have', 'has', 'had', 'having',
    # 语气词/感叹词
    'yes', 'no', 'okay', 'well', 'quite',
    # 低级/模糊词汇
    'things', 'stuff', 'know',
    # 问候语
    'hello', 'hi', 'hey', 'goodbye', 'bye', 'thanks', 'please',
    # 常见形容词
    'big', 'small', 'right', 'wrong', 'sure', 'clear',
    'nice', 'fine', 'alright', 'great', 'little',
    # 常见动词
    'say', 'says', 'said', 'tell', 'told', 'ask', 'get', 'make', 'take',
    'let', 'put', 'call', 'keep', 'give', 'find', 'show', 'hold',
    # 填充语
    'then', 'either', 'though', 'anyway', 'actually',
    # 情态助动词
    'can', 'could', 'would', 'should', 'may', 'might', 'must', 'shall',
    # 疑问代词
    'what',
    # 低级认知词/填充词
    'think', 'uh', 'hmm', 'um',
    # 感叹词
    'oh', 'ah', 'wow', 'hey', 'oops', 'ugh', 'ew', 'whoa', 'yeah', 'yay', 'aww',
    'phew', 'eek', 'yikes', 'gosh', 'jeez', 'man',
    # 其他
    'there', 'here', 'just', 'really', 'very'
]


def is_blacklisted(word: str) -> bool:
    """检查单词是否在黑名单中"""
    word_clean = word.lower().strip('.,!?;:"\'')
    return word_clean in STRICT_BLACKLIST


def is_contraction(word: str) -> bool:
    """检查是否为缩写代词"""
    word_clean = word.lower().strip('.,!?;:"\'')
    contraction_patterns = [
        r"^(you|it|that|what|who|there|here|i|we|they)['']re$",
        r"^(he|she|it|that|what|there|here)['']s$",
        r"^(i|you|we|they|he|she|it)['']ve$",
        r"^(i|you|we|they|he|she|it|would|could|should)['']d$",
        r"^(i|you|we|they|he|she|it)['']ll$",
        r"^let['']s$",
        r"^can['']t$",
        r"^won['']t$",
        r"^don['']t$"
    ]
    for pattern in contraction_patterns:
        if re.match(pattern, word_clean):
            return True
    return False


def is_fact_word(word: str) -> bool:
    """检查是否为事实词"""
    word_clean = word.lower().strip('.,!?;:"\'')
    if word_clean.replace('.', '').replace(',', '').isdigit():
        return True
    if any(c.isdigit() for c in word_clean):
        return True
    price_indicators = ['$', '£', '€', 'yen', 'yuan', 'dollar', 'pound', 'cent', 'euro']
    if any(indicator in word_clean for indicator in price_indicators):
        return True
    address_words = ['street', 'road', 'avenue', 'boulevard', 'lane', 'drive', 'way',
                     'building', 'room', 'floor', 'suite', 'apartment', 'flat']
    if word_clean in address_words:
        return True
    return False


def is_proper_noun(word: str, sentence_text: str = '', index: int = -1) -> bool:
    """检查是否为专有名词"""
    word_clean = word.strip('.,!?;:"\'')
    if word_clean and word_clean[0].isupper() and index > 0:
        return True
    place_names = ['london', 'paris', 'tokyo', 'new york', 'sydney', 'moscow', 'beijing', 'shanghai',
                   'america', 'american', 'britain', 'british', 'england', 'english',
                   'cambridge', 'oxford', 'yale', 'harvard', 'stanford']
    if word_clean.lower() in place_names:
        return True
    return False


def should_skip_word(word: str, sentence_text: str = '', index: int = -1) -> bool:
    """综合判断是否应该跳过该词"""
    if is_blacklisted(word):
        return True
    if is_contraction(word):
        return True
    if is_fact_word(word):
        return True
    if is_proper_noun(word, sentence_text, index):
        return True
    return False


def calculate_word_weight(word: str, sentence_text: str = '', index: int = -1) -> int:
    """计算单词的权重（0-12）"""
    if should_skip_word(word, sentence_text, index):
        return 0

    word_clean = word.lower().strip('.,!?;:"\'')
    word_length = len(word_clean)

    # 音节复杂度最高权重
    complex_words = ['available', 'throughout', 'refurbishment', 'significantly',
                     'particularly', 'especially', 'approximately', 'specifically']
    if word_clean in complex_words:
        return 12

    # 长单词提权
    if word_length >= 11:
        return 11
    if word_length >= 8 and word_length <= 10:
        return 10

    # 月份提权
    month_days = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december',
                  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    if word_clean in month_days:
        return 9

    # 副词
    if word_clean.endswith('ly'):
        return 10

    # 高级动词
    if word_clean.endswith('ing') or (word_clean.endswith('ed') and not word_clean.endswith('ted')):
        basic_verbs = ['going', 'doing', 'getting', 'using', 'making', 'taking', 'seeing']
        if word_clean not in basic_verbs:
            return 9

    # 形容词
    if word_clean.endswith('ive') or word_clean.endswith('ous') or word_clean.endswith('ent'):
        return 8

    # 名词
    if (word_clean.endswith('ment') or word_clean.endswith('tion') or
          word_clean.endswith('ness') or word_clean.endswith('ity')):
        return 5

    return 6


def generate_blanks_for_transcript(transcript: List[Dict]) -> Tuple[int, Dict]:
    """为整个 transcript 生成挖空数据

    Returns:
        (成功数量, 权重统计)
    """
    log(f"   🔧 正在生成挖空数据...")

    blanked_words = {}
    weight_stats = {10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0}
    success_count = 0

    for i, sentence in enumerate(transcript):
        sentence_text = sentence.get('text', '')
        words = sentence_text.split()

        if not words:
            sentence['blanks'] = []
            continue

        # 计算所有词的权重
        candidates = []
        for wi, word in enumerate(words):
            word_clean = word.lower().strip('.,!?;:"\'')

            # 跳过已挖1次的词
            if blanked_words.get(word_clean, 0) >= 1:
                continue

            # 使用 should_skip_word 判断
            if should_skip_word(word, sentence_text, wi):
                continue

            # 计算权重
            weight = calculate_word_weight(word, sentence_text, wi)
            if weight > 0:
                candidates.append((weight, wi, word))

        # 选择权重最高的词
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            weight, index, word = candidates[0]

            sentence['blanks'] = [{
                "word": word.strip('.,!?;:"\''),
                "index": index,
                "pos": f"权重{weight}",
                "is_core": True,
                "weight": weight
            }]

            # 更新全局计数
            word_lower = word.lower().strip('.,!?;:"\'')
            blanked_words[word_lower] = blanked_words.get(word_lower, 0) + 1

            # 统计权重
            if weight in weight_stats:
                weight_stats[weight] += 1

            success_count += 1
        else:
            sentence['blanks'] = []

        if (i + 1) % 5 == 0:
            log(f"      进度: {i+1}/{len(transcript)}")

        time.sleep(0.3)

    log(f"   ✅ 挖空完成: 成功 {success_count}, 跳过 {len(transcript) - success_count}")
    log(f"      权重分布: W10={weight_stats[10]}, W9={weight_stats[9]}, W8={weight_stats[8]}, W7={weight_stats[7]}, W6={weight_stats[6]}, W5={weight_stats[5]}")

    return success_count, weight_stats


# ============ 翻译逻辑 ====================

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


def extract_translation_from_response(response_text: str, original_text: str) -> str:
    """从 GLM 响应中提取纯翻译内容（修复 prompt 干扰问题）"""
    # 移除原文（如果被包含在响应中）
    if original_text in response_text:
        parts = response_text.split(original_text)
        if len(parts) > 1:
            response_text = parts[-1]

    # 查找翻译标记之后的内容
    translation_markers = [
        '译文:', '翻译:', '翻譯:', 'Translation:', 'Traducción:',
        'Übersetzung:', 'Traduction:', '翻訳:', '번역:',
        'แปล:', 'Переклад:', 'Перевод:'
    ]

    for marker in translation_markers:
        if marker in response_text:
            parts = response_text.split(marker)
            if len(parts) > 1:
                response_text = parts[-1].strip()
                break

    # 移除包含原文标记的部分
    text_markers = ['原文:', '文字:', 'Text:', 'Texto:', 'Текст:', 'テキスト:']
    for marker in text_markers:
        if marker in response_text:
            parts = response_text.split(marker)
            if len(parts) > 1:
                response_text = parts[0].strip()

    # 移除指令行
    lines = response_text.split('\n')
    cleaned_lines = []

    for line in lines:
        line = line.strip()
        # 跳过包含 CRITICAL、关键、- 等指令的行
        if any(prefix in line for prefix in ['CRITICAL:', '关键：', '關鍵：', 'Important:', '- ']):
            if any(marker in line for marker in ['译文:', '翻译:', '翻譯:', 'Translation:']):
                if ':' in line:
                    line = line.split(':', 1)[1].strip()
            else:
                continue
        if line:
            cleaned_lines.append(line)

    result = '\n'.join(cleaned_lines).strip()

    # 如果结果太短或等于原文，返回 None
    if len(result) < 10 or result == original_text:
        return None

    return result


def translate_with_retry(text: str, lang_code: str) -> Tuple[str, bool, int]:
    """翻译到指定语言（带指数退避重试 + prompt 干扰修复）"""
    lang_name = LANGUAGES[lang_code]['name']

    # 使用简化的 prompt，减少干扰
    prompt = f"""Translate to {lang_name}: {text}"""

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
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                },
                timeout=API_TIMEOUT
            )

            if response.status_code == 200:
                result = response.json()
                raw_content = result["choices"][0]["message"]["content"].strip()

                # 提取翻译内容
                translation = extract_translation_from_response(raw_content, text)

                if translation:
                    # 检测重复
                    has_repetition, _ = detect_repetition(translation, lang_code)
                    if has_repetition:
                        translation = translation.split('.')[0]
                        if len(translation) < 10:
                            translation = text

                    return translation, True, attempt + 1
                elif attempt < MAX_RETRIES - 1:
                    # 提取失败，重试
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    time.sleep(delay)
                    continue
                else:
                    # 最后尝试：直接使用最后一行
                    cleaned = raw_content.split('\n')[-1].strip()
                    if cleaned and cleaned != text and len(cleaned) > 10:
                        return cleaned, True, attempt + 1
                    return text, False, attempt + 1

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

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                time.sleep(delay)
                continue
            else:
                return text, False, attempt + 1

    return text, False, MAX_RETRIES


def translate_group(transcript: List[Dict], target_langs: List[str]) -> Tuple[int, int]:
    """翻译一组语言

    Returns:
        (success_count, failed_count)
    """
    success_count = 0
    failed_count = 0

    for i, sentence in enumerate(transcript):
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

        # 每 5 个句子报告一次进度
        if (i + 1) % 5 == 0:
            log(f"      进度: {i+1}/{len(transcript)}, 成功: {success_count}, 失败: {failed_count}")

    return success_count, failed_count


def generate_translations_for_transcript(transcript: List[Dict]) -> Tuple[int, int, List[str]]:
    """为整个 transcript 生成翻译（19种语言：原有3种 + 新增16种）

    Returns:
        (total_success, total_failed, failed_groups)
    """
    log(f"   🔧 正在生成翻译（19国语言）...")

    total_success = 0
    total_failed = 0
    failed_groups = []

    # 🆕 处理原有语言（zh, zh_hant, vi）
    log(f"   🔄 开始翻译原有语言 (3 种: zh, zh_hant, vi)...")
    success_existing, failed_existing = translate_group(transcript, EXISTING_LANGUAGES)
    log(f"   ✅ 原有语言完成: 成功 {success_existing}, 失败 {failed_existing}")

    total_success += success_existing
    total_failed += failed_existing

    if failed_existing > 0:
        failed_groups.append('EXISTING')

    # 处理 Group A
    log(f"   🔄 开始翻译 Group A (8 种语言)...")
    success_a, failed_a = translate_group(transcript, GROUP_A)
    log(f"   ✅ Group A 完成: 成功 {success_a}, 失败 {failed_a}")

    total_success += success_a
    total_failed += failed_a

    if failed_a > 0:
        failed_groups.append('GROUP_A')

    # 冷却时间（原有语言和 Group A 之间）
    if failed_existing == 0 and failed_a == 0:
        log(f"   ⏸️ 冷却 {BATCH_COOLDOWN} 秒（缓解 API Rate Limit）...")
        time.sleep(BATCH_COOLDOWN)

    # 处理 Group B（仅当 Group A 全部成功时）
    if failed_a == 0:
        log(f"   🔄 开始翻译 Group B (8 种语言)...")
        success_b, failed_b = translate_group(transcript, GROUP_B)
        log(f"   ✅ Group B 完成: 成功 {success_b}, 失败 {failed_b}")

        total_success += success_b
        total_failed += failed_b

        if failed_b > 0:
            failed_groups.append('GROUP_B')
    else:
        log(f"   ⚠️  Group A 有失败，跳过 Group B（需手动重试）")
        # 标记 Group B 为待重试
        failed_groups.append('GROUP_B')

        # 为 Group B 添加占位符
        for sentence in transcript:
            for lang in GROUP_B:
                if lang not in sentence.get('translation', {}):
                    sentence['translation'][lang] = "[TODO_RETRY]"

    return total_success, total_failed, failed_groups


# ============ yt-dlp 字幕抓取 ============

def fetch_youtube_metadata(video_url: str) -> Dict:
    """使用 yt-dlp 获取 YouTube 视频元数据和字幕"""
    log(f"🎬 使用 yt-dlp 获取视频信息...")

    result = {
        'video_id': None,
        'title': None,
        'duration': None,
        'thumbnail': None,
        'subtitles': None,
        'captions_found': False
    }

    try:
        video_id = extract_video_id(video_url)
        result['video_id'] = video_id
        result['thumbnail'] = f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg"

        # 配置 yt-dlp
        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }

        log(f"   📡 正在获取视频信息...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)

            # 提取标题
            if info.get('title'):
                result['title'] = info['title']
                log(f"   ✅ 标题: {info['title']}")

            # 提取时长
            if info.get('duration'):
                result['duration'] = info['duration']
                minutes = info['duration'] // 60
                seconds = info['duration'] % 60
                log(f"   ✅ 时长: {minutes}分{seconds}秒")

            # 提取字幕（优先手动字幕，fallback 到自动字幕）
            log(f"   📝 正在获取字幕...")

            subtitle_url = None
            subtitle_type = None

            # 优先使用手动字幕
            if 'subtitles' in info and 'en' in info['subtitles']:
                subtitle_url = info['subtitles']['en'][0]['url']
                subtitle_type = "手动字幕"
            # Fallback 到自动字幕
            elif 'automatic_captions' in info and 'en' in info['automatic_captions']:
                subtitle_url = info['automatic_captions']['en'][0]['url']
                subtitle_type = "自动生成字幕"

            if subtitle_url:
                log(f"   📌 字幕类型: {subtitle_type}")

                # 下载字幕内容
                response = requests.get(subtitle_url, timeout=10)
                response.raise_for_status()
                data = response.json()

                # 解析字幕
                events = data.get('events', [])
                raw_segments = []

                for event in events:
                    if 'segs' in event:
                        text = ''.join([seg.get('utf8', '') for seg in event['segs']])
                        text = text.strip()

                        if text:
                            start_ms = event.get('tStartMs', 0)
                            duration_ms = event.get('dDurationMs', 0)

                            raw_segments.append({
                                'text': text,
                                'start': start_ms / 1000,
                                'end': (start_ms + duration_ms) / 1000
                            })

                if raw_segments:
                    # 🔴 使用智能断句算法
                    merged_segments = merge_segments(raw_segments)
                    result['subtitles'] = merged_segments
                    result['captions_found'] = True
                    log(f"   ✅ 字幕提取成功: {len(merged_segments)} 条")
                else:
                    log(f"   ⚠️  字幕解析后为空")
            else:
                log(f"   ⚠️  该视频没有英文字幕")

    except Exception as e:
        log(f"   ❌ 错误: {e}")
        import traceback
        traceback.print_exc()

    return result


# ============ 数据库操作 ============

def upsert_material(client: Client, metadata: Dict, transcript: List[Dict],
                   category: str, difficulty: str, failed_groups: List[str]) -> bool:
    """入库素材"""
    video_id = metadata['video_id']
    title = metadata['title']
    slug = title_to_slug(title)

    log(f"\n💾 正在入库素材...")
    log(f"   📌 视频 ID: {video_id}")
    log(f"   📌 标题: {title}")
    log(f"   📌 Slug: {slug}")
    log(f"   📚 分类: {category}")
    log(f"   📊 难度: {difficulty}")
    log(f"   📝 字幕条数: {len(transcript)}")

    if failed_groups:
        log(f"   ⚠️  待重试组: {', '.join(failed_groups)}")

    # 检查是否已存在
    existing = client.table('materials').select('*').eq('youtube_id', video_id).execute()

    material_data = {
        'title': title,
        'slug': slug,
        'category': category,
        'difficulty': difficulty,
        'source_type': 'youtube',  # 🎯 确保 source_type 标记为 youtube
        'youtube_id': video_id,     # 🎯 确保 youtube_id 字段存在
        'audio_path': f'youtube:{video_id}',
        'audio_size': 0,
        'video_path': None,
        'thumbnail_path': metadata.get('thumbnail'),
        'duration': metadata.get('duration'),
        'transcript': transcript,
        'play_count': 0,
        # SEO 字段
        'meta_title': f"{title} | English Dictation & Shadowing",
        'meta_description': clean_text(' '.join([s['text'] for s in transcript[:10]]))[:150] if transcript else None,
        'og_image': metadata.get('thumbnail'),
    }

    try:
        if existing.data:
            material_id = existing.data[0]['id']
            log(f"   ⚠️  素材已存在 (ID: {material_id})，正在更新...")
            client.table('materials').update(material_data).eq('id', material_id).execute()
            log(f"   ✅ 更新成功")
        else:
            result = client.table('materials').insert(material_data).execute()
            material_id = result.data[0]['id']
            log(f"   ✅ 创建成功 (ID: {material_id})")

        return True

    except Exception as e:
        log(f"   ❌ 入库失败: {e}")
        import traceback
        traceback.print_exc()
        return False


# ============ 主函数 ============

def print_help():
    """打印帮助信息"""
    print("=" * 70)
    print("🎯 YouTube 素材自动录入工具 - v2.0 完整版")
    print("=" * 70)
    print("")
    print("功能：")
    print("  1. yt-dlp 获取字幕（绕过 PO Token）")
    print("  2. 智能断句 + 文本规范化 + 时间轴优化")
    print("  3. 智能挖空（v6.2 逻辑）")
    print("  4. 16国语言翻译（Group A + Group B）")
    print("  5. 入库 Supabase（前端开箱即用）")
    print("")
    print("使用方法：")
    print("  python3 scripts/ingest_youtube_ytdlp.py <YouTube_URL> [选项]")
    print("")
    print("选项：")
    print("  --category <分类>    素材分类（默认: Science and Facts）")
    print("  --difficulty <难度>  难度等级（默认: B2）")
    print("  --help              显示此帮助信息")
    print("")
    print("=" * 70)


def main():
    """主函数"""
    if len(sys.argv) < 2 or '--help' in sys.argv or '-h' in sys.argv:
        print_help()
        sys.exit(0 if '--help' in sys.argv or '-h' in sys.argv else 1)

    youtube_url = sys.argv[1]

    # 解析选项
    category = DEFAULT_CATEGORY
    difficulty = DEFAULT_DIFFICULTY

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--category' and i + 1 < len(sys.argv):
            category = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--difficulty' and i + 1 < len(sys.argv):
            difficulty = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    print("=" * 70)
    print("🎯 YouTube 素材自动录入工具 - v2.0 完整版")
    print("=" * 70)
    print(f"🔗 URL: {youtube_url}")
    print(f"📚 分类: {category}")
    print(f"📊 难度: {difficulty}")
    print("=" * 70)

    try:
        # 连接 Supabase
        log("🔗 连接 Supabase...")
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        log("✅ 连接成功\n")

        # 1. 抓取视频元数据和字幕
        metadata = fetch_youtube_metadata(youtube_url)

        if not metadata['title']:
            print("\n❌ 无法提取视频标题")
            sys.exit(1)

        if not metadata['subtitles']:
            print("\n❌ 无法提取字幕")
            sys.exit(1)

        # 2. 格式化字幕（智能断句 + 时间轴优化）
        transcript = normalize_transcript(metadata['subtitles'])

        if not transcript:
            print("\n❌ 字幕解析失败")
            sys.exit(1)

        # 3. 智能挖空（v6.2 逻辑）
        blank_count, weight_stats = generate_blanks_for_transcript(transcript)

        # 4. 16国语言翻译（Group A + Group B）
        translate_success, translate_failed, failed_groups = generate_translations_for_transcript(transcript)

        # 5. 入库
        success = upsert_material(client, metadata, transcript, category, difficulty, failed_groups)

        if success:
            print("\n" + "=" * 70)
            print("✅ 素材录入成功！")
            print("=" * 70)
            print(f"📹 视频 ID: {metadata['video_id']}")
            print(f"📌 标题: {metadata['title']}")
            print(f"📝 字幕条数: {len(transcript)}")
            print(f"🔍 挖空成功: {blank_count}")
            print(f"🌍 翻译成功: {translate_success}, 失败: {translate_failed}")
            if failed_groups:
                print(f"⚠️  待重试组: {', '.join(failed_groups)}")
            print(f"⏱️  时长: {metadata['duration'] // 60 if metadata.get('duration') else '?'}分{metadata['duration'] % 60 if metadata.get('duration') else '?'}秒")
            print(f"\n💡 测试页面: http://localhost:3000/topics/")
            print("=" * 70)
        else:
            print("\n❌ 入库失败")
            sys.exit(1)

    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    os.chdir('/Users/a/dictation')
    main()


def main():
    """主函数"""
    if len(sys.argv) < 2 or '--help' in sys.argv or '-h' in sys.argv:
        print_help()
        sys.exit(0 if '--help' in sys.argv or '-h' in sys.argv else 1)

    youtube_url = sys.argv[1]

    # 解析选项
    category = DEFAULT_CATEGORY
    difficulty = DEFAULT_DIFFICULTY

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--category' and i + 1 < len(sys.argv):
            category = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--difficulty' and i + 1 < len(sys.argv):
            difficulty = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    print("=" * 70)
    print("🎯 YouTube 素材自动录入工具 - v2.0 完整版")
    print("=" * 70)
    print(f"🔗 URL: {youtube_url}")
    print(f"📚 分类: {category}")
    print(f"📊 难度: {difficulty}")
    print("=" * 70)

    try:
        # 连接 Supabase
        log("🔗 连接 Supabase...")
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        log("✅ 连接成功\n")

        # 1. 抓取视频元数据和字幕
        metadata = fetch_youtube_metadata(youtube_url)

        if not metadata['title']:
            print("\n❌ 无法提取视频标题")
            sys.exit(1)

        if not metadata['subtitles']:
            print("\n❌ 无法提取字幕")
            sys.exit(1)

        # 2. 格式化字幕（智能断句 + 时间轴优化）
        transcript = normalize_transcript(metadata['subtitles'])

        if not transcript:
            print("\n❌ 字幕解析失败")
            sys.exit(1)

        # 3. 智能挖空（v6.2 逻辑）
        blank_count, weight_stats = generate_blanks_for_transcript(transcript)

        # 4. 16国语言翻译（Group A + Group B）
        translate_success, translate_failed, failed_groups = generate_translations_for_transcript(transcript)

        # 5. 入库
        success = upsert_material(client, metadata, transcript, category, difficulty, failed_groups)

        if success:
            print("\n" + "=" * 70)
            print("✅ 素材录入成功！")
            print("=" * 70)
            print(f"📹 视频 ID: {metadata['video_id']}")
            print(f"📌 标题: {metadata['title']}")
            print(f"📝 字幕条数: {len(transcript)}")
            print(f"🔍 挖空成功: {blank_count}")
            print(f"🌍 翻译成功: {translate_success}, 失败: {translate_failed}")
            if failed_groups:
                print(f"⚠️  待重试组: {', '.join(failed_groups)}")
            print(f"⏱️  时长: {metadata['duration'] // 60 if metadata.get('duration') else '?'}分{metadata['duration'] % 60 if metadata.get('duration') else '?'}秒")
            print(f"\n💡 测试页面: http://localhost:3000/topics/")
            print("=" * 70)
        else:
            print("\n❌ 入库失败")
            sys.exit(1)

    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    os.chdir('/Users/a/dictation')
    main()
