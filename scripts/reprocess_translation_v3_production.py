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


# ==================== 污染检测逻辑（差异化策略）====================

def contains_chinese_pollution(text: str, target_lang: str) -> bool:
    """
    策略 A：非 CJK 语种的中文污染检测

    对于希腊语、俄语、乌克兰语、蒙古语、越南语、泰语等不使用汉字的语种，
    如果检测到任何中文汉字，直接判定为 FAIL 并重试。

    Args:
        text: 翻译结果
        target_lang: 目标语言代码

    Returns:
        True if contains Chinese pollution
    """
    # 策略 A：非 CJK 语种（新增 16 国中的非 CJK 语种）
    NON_CJK_LANGUAGES = [
        'ar', 'de', 'es', 'ms', 'ru', 'tr', 'el',
        'id', 'pt', 'th', 'uk', 'bn', 'mn', 'hi'
    ]

    # 策略 B：CJK 语种（新增 16 国中的日/韩）
    # 注意：zh 和 zh_hant 是原有语言，不在本次修改范围
    CJK_LANGUAGES = ['ja', 'ko']

    if target_lang in CJK_LANGUAGES:
        # CJK 语种允许汉字，跳过中文污染检测
        return False

    # 检测是否包含中文字符（CJK 统一汉字范围）
    chinese_char_pattern = re.compile(
        r'[\u4e00-\u9fff\u3400-\u4dbf\U00020000-\U0002a6df\U0002a700-\U0002b73f\U0002b740-\U0002b81f\U0002b820-\U0002ceaf]'
    )

    return bool(chinese_char_pattern.search(text))


def contains_prompt_keywords(text: str, lang_code: str) -> Tuple[bool, str]:
    """
    策略 C：通用 Prompt 指令关键词检测

    无论什么语种，只要包含 Prompt 指令词，一律重试。

    Args:
        text: 翻译结果
        lang_code: 目标语言代码

    Returns:
        (has_pollution, reason)
    """
    # 英文模板标签（必须检测）
    TEMPLATE_LABELS = ['Text:', 'Translation:', 'Original:', 'Source:']

    # 检查英文模板标签
    for label in TEMPLATE_LABELS:
        if label in text:
            return True, f"模板标签: '{label}'"

    # 各语言特定的指令关键词
    LANG_SPECIFIC_KEYWORDS = {
        'el': ['Κρίσιμο', 'ΚΡΙΣΙΜΟ', 'Αυστηρά', 'ΑΠΑΓΟΡΕΥΣΗ', 'Μετάφραση', 'ΚΑΙΝΟΤΟΜΙΚΟ'],
        'mn': ['Текст', 'Төрөл', 'Толгойлолт', 'Шуурган', 'Хориг', 'Орчуулга'],
        'uk': ['Критично', 'Критичне', 'Заборона', 'Вибачте', 'Переклад'],
        'ru': ['Критически', 'Строго', 'Запрет', 'Перевод'],
        'ar': ['حاسم', 'صارم', 'حظر', 'تعليمات', 'ترجمة'],
        'de': ['Kritisch', 'Streng', 'Verbot', 'Anweisungen'],
        'es': ['Crítico', 'Estricto', 'Prohibido', 'Instrucciones'],
        'ja': ['重要', '厳格', '禁止', '指示', '翻訳'],
        'ko': ['중요', '엄격', '금지', '지침', '번역'],
        'th': ['วิกฤต', 'เข้มงวด', 'ห้าม', 'คำสั่ง'],
        'vi': ['Quan trọng', 'Nghiêm ngặt', 'Hướng dẫn'],
        'id': ['Kritis', 'Ketat', 'Dilarang', 'Arahan'],
        'ms': ['Kritis', 'Ketat', 'Dilarang', 'Arahan'],
        'pt': ['Crítico', 'Estrito', 'Proibido', 'Instruções'],
        'tr': ['Kritik', 'Katı', 'Yasak', 'Talimatlar'],
        'hi': ['महत्वपूर्ण', 'कड़ाई', 'प्रतिबंध'],
        'bn': ['সমালোচনামূলক', 'কঠোর', 'নিষেধাজ্ঞা'],
    }

    # 检查语言特定关键词
    if lang_code in LANG_SPECIFIC_KEYWORDS:
        keywords = LANG_SPECIFIC_KEYWORDS[lang_code]
        text_upper = text.upper()

        for keyword in keywords:
            if keyword.upper() in text_upper:
                return True, f"指令关键词: '{keyword}'"

    return False, ""

# ==================== 标签清洗函数 ====================

def strip_labels(text: str, lang_code: str) -> str:
    """
    清洗翻译结果中的标签前缀（如 Español:, Text:, Translation:）

    Args:
        text: 翻译结果
        lang_code: 目标语言代码

    Returns:
        清洗后的翻译结果

    注意：
    - 白名单语种（zh, zh_hant, ja, ko, vi）不执行此逻辑
    - 其他语种执行标签剥离
    """
    # 白名单语种（使用汉字/谚文的语种）
    WHITELIST_LANGUAGES = ['zh', 'zh_hant', 'ja', 'ko', 'vi']

    if lang_code in WHITELIST_LANGUAGES:
        # 白名单语种不执行标签剥离，避免误伤正常内容
        return text

    lines = text.split('\n')
    cleaned_lines = []

    # 正则表达式：匹配行首的标签（字母+冒号）
    # 支持英文、西里尔字母（俄语/乌克兰语等）、拉丁扩展字母（西语、法语等）、孟加拉语
    label_pattern = re.compile(r'^[A-Za-z\u0400-\u04FF\u00C0-\u017F\u1E00-\u1EFF\u0980-\u09FF]+:\s*')

    for line in lines:
        # 移除包含 Text:, Source:, Original: 的整行
        if any(marker in line for marker in ['Text:', 'Source:', 'Original:', 'Texto:', 'Texto']):
            continue

        # 剥离行首的标签前缀
        line = label_pattern.sub('', line)

        # 只保留非空行
        if line.strip():
            cleaned_lines.append(line)

    return '\n'.join(cleaned_lines).strip()


# ==================== 翻译质量拦截函数（V4.1 新增）====================

def should_intercept_translation(translation: str, original_text: str, lang_code: str) -> Tuple[bool, str]:
    """
    拦截函数：检测翻译是否应该被拒绝（不入库）

    拦截规则：
    1. 包含 XML 标签（说明标签隔离失败）
    2. 包含常见指令词的各国语言变体
    3. 长度超过原文 3 倍（小语种幻觉通常会变长）

    Args:
        translation: 翻译结果
        original_text: 原文
        lang_code: 语言代码

    Returns:
        (should_intercept, reason): (是否拦截, 拦截原因)
    """
    if not translation or not isinstance(translation, str):
        return False, ""

    # 规则 1: 检测 XML 标签泄漏
    xml_tags = ['<translation_result>', '</translation_result>', '<instruction>', '</instruction>',
                '<source_text>', '</source_text>', '<?xml', '<!DOCTYPE']
    for tag in xml_tags:
        if tag in translation:
            return True, f"XML 标签泄漏: {tag}"

    # 规则 2: 检测常见指令词的各国语言变体
    instruction_patterns = [
        # 英语指令词
        r'\b(instructions?|instruction:|critical:|requirement:|avoid|translate:|translation:|text:|output:|return:)\b',
        r'\b(do not|don\'t|never|only|strictly|must|should)\s+(translate|return|output|include)\b',
        # 中文指令词
        r'(翻译|指令|要求|避免|重复|直接|提供|返回|输出|严格|禁止|不要)',
        # 孟加拉语指令词（已知幻觉）
        r'(শব্দ\s*পুনরাবৃত্তি|সরাসরি\s*অনুবাদ|ক্রিটিক্যাল|নির্দেশনা|টেক্সট:|অনুবাদ:)',
        # 印地语指令词
        r'(निर्देश|आवश्यकता|अनुवाद|पाठ|आउटपुट)',
        # 蒙古语指令词
        r'(заавар|шаардлага|орчуулга|текст|гаргах)',
        # 泰语指令词
        r'(คำแนะนำ|ข้อกำหนด|คำแปล|ข้อความ|ผลลัพธ์)',
        # 韩语指令词
        r'(지침|요구사항|번역|텍스트|출력)',
        # 日语指令词
        r'(指示|要件|翻訳|テキスト|出力)',
        # 阿拉伯语指令词
        r'(تعليمات|متطلب|ترجمة|النص|الإخراج)',
        # 俄语指令词
        r'(инструкци|требовани|перевод|текст|вывод)',
        # 越南语指令词
        r'(hướng dẫn|yêu cầu|dịch|văn bản|kết quả)',
        # 印尼语/马来语指令词
        r'(arahan|keperluan|terjemahan|teks|output)',
    ]

    translation_lower = translation.lower()

    for pattern in instruction_patterns:
        if re.search(pattern, translation, re.IGNORECASE):
            # 对于匹配的指令词，返回更具体的原因
            match = re.search(pattern, translation, re.IGNORECASE)
            captured = match.group(0) if match else pattern
            # 如果是中文或非 CJK 语言中的中文字符，或者是开头的指令格式
            if captured.strip().startswith('-') or any(char in captured for char in ['翻译', '指令', 'শব্দ', 'সরাসরি', 'критик', 'critical']):
                return True, f"指令词幻觉: '{captured[:50]}'"

    # 规则 3: 长度检测（超过原文 3 倍，且原文不为空）
    if original_text and len(original_text) > 0:
        original_length = len(original_text.strip())
        translated_length = len(translation.strip())

        if original_length > 0 and translated_length > original_length * 3:
            return True, f"长度异常: 原文 {original_length} 字符 → 译文 {translated_length} 字符 ({translated_length/original_length:.1f}x)"

    # 规则 4: 检测横线开头的多行列表格式（常见的幻觉格式）
    lines = translation.split('\n')
    if len(lines) >= 2:
        first_lines = lines[:3]
        dash_count = sum(1 for line in first_lines if re.match(r'^\s*-\s+', line))
        if dash_count >= 2:
            return True, f"幻觉格式: 多行横线列表 ({dash_count} 行)"

    return False, ""


def apply_interception_check(translation: str, original_text: str, lang_code: str) -> Tuple[str, bool]:
    """
    应用拦截检查，返回处理后的翻译

    Args:
        translation: 翻译结果
        original_text: 原文
        lang_code: 语言代码

    Returns:
        (processed_translation, is_valid): (处理后的翻译, 是否有效)
    """
    should_intercept, reason = should_intercept_translation(translation, original_text, lang_code)

    if should_intercept:
        log_to_file(f"🚫 拦截翻译 [{lang_code}]: {reason}", 'WARN')
        log_to_file(f"  原文: {original_text[:100]}{'...' if len(original_text) > 100 else ''}", 'DEBUG')
        log_to_file(f"  被拦截的译文: {translation[:200]}{'...' if len(translation) > 200 else ''}", 'DEBUG')
        # 返回空字符串表示无效翻译
        return "", False

    return translation, True


# ==================== 翻译函数（XML 标签隔离）====================

def translate_with_retry(text: str, lang_code: str) -> Tuple[str, bool, int]:
    """翻译到指定语言（带指数退避重试 + XML 标签隔离）

    Returns:
        (translation, success, attempt_count)
    """
    lang_name = LANGUAGES[lang_code]['name']

    # XML 标签隔离 Prompt（V5.0 - 物理隔离）
    prompt = f"""<instruction>
Translate the following text to {lang_name}.
Return ONLY the raw translation string.
DO NOT include any preamble, apologies, meta-labels, or explanations.
Wrap the final result in <translation_result> tags.
</instruction>

<source_text>
{text}
</source_text>"""

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
                            "content": "You translate text between languages. Return ONLY the translated text. Never include instructions, meta-talk, or repeat the prompt. Output pure translation only."
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500,
                    "presence_penalty": 0.5,      # 减少重复
                    "frequency_penalty": 0.5      # 惩罚频繁重复
                },
                timeout=API_TIMEOUT
            )

            if response.status_code == 200:
                result = response.json()
                raw_response = result["choices"][0]["message"]["content"].strip()

                # ✅ 解析 <translation_result> 标签
                # 提取标签内的内容，丢弃标签外的所有碎碎念或解释
                tag_pattern = re.compile(r'<translation_result>\s*(.*?)\s*</translation_result>', re.DOTALL)
                match = tag_pattern.search(raw_response)

                if match:
                    translation = match.group(1).strip()
                else:
                    # 如果模型没有使用标签，尝试使用整个响应（但要进行严格检测）
                    translation = raw_response
                    log_to_file(f"标签检测失败: {lang_code} 未找到 <translation_result> 标签", 'WARN')

                # ✅ 清洗标签前缀（Español:, Text:, Translation: 等）
                translation = strip_labels(translation, lang_code)

                # ✅ 长度检测：如果翻译后长度超过原文的 5 倍（且原文很短），则触发重试
                # 这通常意味着模型在输出废话或重复指令
                original_length = len(text)
                translated_length = len(translation)
                if original_length < 50 and translated_length > original_length * 5:
                    log_to_file(f"长度检测: {lang_code} 触发重试 (原文 {original_length} 字符 → 译文 {translated_length} 字符, 尝试 {attempt + 1}/{MAX_RETRIES})", 'WARN')
                    log_to_file(f"  原文: {text}", 'DEBUG')
                    log_to_file(f"  模型返回: {translation[:200]}", 'DEBUG')
                    if attempt < MAX_RETRIES - 1:
                        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                        time.sleep(delay)
                        continue  # 重试
                    else:
                        # 最终失败时记录完整的原始响应
                        log_to_file(f"❌ 翻译失败: {lang_code} 已达最大重试次数（长度异常）", 'ERROR')
                        log_to_file(f"原文: {text}", 'ERROR')
                        log_to_file(f"模型原始返回:\n{raw_response}", 'ERROR')
                        return text, False, attempt + 1  # 失败

                # ✅ 策略 A + C：非 CJK 语种的中文污染检测 + Prompt 关键词检测
                has_keywords, keyword_reason = contains_prompt_keywords(translation, lang_code)
                if has_keywords:
                    log_to_file(f"关键词检测: {lang_code} 触发重试 ({keyword_reason}, 尝试 {attempt + 1}/{MAX_RETRIES})", 'WARN')
                    log_to_file(f"  原文: {text[:100]}{'...' if len(text) > 100 else ''}", 'DEBUG')
                    log_to_file(f"  模型返回: {translation[:200]}", 'DEBUG')
                    if attempt < MAX_RETRIES - 1:
                        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                        time.sleep(delay)
                        continue  # 重试
                    else:
                        log_to_file(f"❌ 翻译失败: {lang_code} 已达最大重试次数（关键词污染）", 'ERROR')
                        log_to_file(f"原文: {text}", 'ERROR')
                        log_to_file(f"模型原始返回:\n{raw_response}", 'ERROR')
                        return text, False, attempt + 1  # 失败

                # ✅ 策略 A：非 CJK 语种的中文污染检测
                if contains_chinese_pollution(translation, lang_code):
                    # 🔍 记录原始响应文本用于调试
                    log_to_file(f"中文污染检测: {lang_code} 触发重试 (尝试 {attempt + 1}/{MAX_RETRIES})", 'WARN')
                    log_to_file(f"  原文: {text[:100]}{'...' if len(text) > 100 else ''}", 'DEBUG')
                    log_to_file(f"  模型返回: {translation[:200]}", 'DEBUG')
                    if attempt < MAX_RETRIES - 1:
                        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                        time.sleep(delay)
                        continue  # 重试
                    else:
                        # 最终失败时记录完整的原始响应
                        log_to_file(f"❌ 翻译失败: {lang_code} 已达最大重试次数", 'ERROR')
                        log_to_file(f"原文: {text}", 'ERROR')
                        log_to_file(f"模型原始返回:\n{translation}", 'ERROR')
                        return text, False, attempt + 1  # 失败

                # 检测重复
                has_repetition, _ = detect_repetition(translation, lang_code)
                if has_repetition:
                    translation = translation.split('.')[0]
                    if len(translation) < 10:
                        translation = text

                # ✅ V4.1 新增：翻译质量拦截检查（在入库前最后一道防线）
                final_translation, is_valid = apply_interception_check(translation, text, lang_code)
                if not is_valid:
                    # 拦截的翻译返回失败
                    return text, False, attempt + 1

                return final_translation, True, attempt + 1

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

def translate_vietnamese_with_retry(text: str) -> Tuple[str, bool, int]:
    """越南语专用翻译函数（老版 Prompt - 稳定版）

    Returns:
        (translation, success, attempt_count)
    """
    # 老版 Prompt（针对越南语优化，非 XML 标签隔离）
    prompt = f"""Translate the following English text to Vietnamese.

Rules:
1. Output ONLY the Vietnamese translation
2. No English or Chinese characters in the output
3. Pure Vietnamese text only, no labels or explanations

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
                            "content": "You are a professional translator. Output ONLY pure Vietnamese translation text. No English, no Chinese, no explanations."
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500,
                    "presence_penalty": 0.5,
                    "frequency_penalty": 0.5
                },
                timeout=API_TIMEOUT
            )

            if response.status_code == 200:
                result = response.json()
                translation = result["choices"][0]["message"]["content"].strip()

                # ✅ 长度检测
                original_length = len(text)
                translated_length = len(translation)
                if original_length < 50 and translated_length > original_length * 5:
                    log_to_file(f"长度检测: vi 触发重试 (原文 {original_length} → 译文 {translated_length}, 尝试 {attempt + 1}/{MAX_RETRIES})", 'WARN')
                    log_to_file(f"  原文: {text}", 'DEBUG')
                    log_to_file(f"  模型返回: {translation[:200]}", 'DEBUG')
                    if attempt < MAX_RETRIES - 1:
                        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                        time.sleep(delay)
                        continue
                    else:
                        log_to_file(f"❌ 翻译失败: vi 已达最大重试次数（长度异常）", 'ERROR')
                        return text, False, attempt + 1

                # ✅ 中文污染检测（越南语不使用汉字）
                if contains_chinese_pollution(translation, 'vi'):
                    log_to_file(f"中文污染检测: vi 触发重试 (尝试 {attempt + 1}/{MAX_RETRIES})", 'WARN')
                    log_to_file(f"  原文: {text[:100]}", 'DEBUG')
                    log_to_file(f"  模型返回: {translation[:200]}", 'DEBUG')
                    if attempt < MAX_RETRIES - 1:
                        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                        time.sleep(delay)
                        continue
                    else:
                        log_to_file(f"❌ 翻译失败: vi 已达最大重试次数（中文污染）", 'ERROR')
                        return text, False, attempt + 1

                # ✅ 指令关键词检测
                has_keywords, keyword_reason = contains_prompt_keywords(translation, 'vi')
                if has_keywords:
                    log_to_file(f"关键词检测: vi 触发重试 ({keyword_reason}, 尝试 {attempt + 1}/{MAX_RETRIES})", 'WARN')
                    log_to_file(f"  原文: {text[:100]}", 'DEBUG')
                    log_to_file(f"  模型返回: {translation[:200]}", 'DEBUG')
                    if attempt < MAX_RETRIES - 1:
                        delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                        time.sleep(delay)
                        continue
                    else:
                        log_to_file(f"❌ 翻译失败: vi 已达最大重试次数（关键词污染）", 'ERROR')
                        return text, False, attempt + 1

                # 检测重复
                has_repetition, _ = detect_repetition(translation, 'vi')
                if has_repetition:
                    translation = translation.split('.')[0]
                    if len(translation) < 10:
                        translation = text

                # ✅ V4.1 新增：翻译质量拦截检查（在入库前最后一道防线）
                final_translation, is_valid = apply_interception_check(translation, text, 'vi')
                if not is_valid:
                    # 拦截的翻译返回失败
                    return text, False, attempt + 1

                return final_translation, True, attempt + 1

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
            return text, False, attempt + 1

    return text, False, MAX_RETRIES

def check_groups_status(transcript: List[Dict]) -> Tuple[bool, bool, List[str]]:
    """检查素材的两组翻译状态

    Returns:
        (group_a_complete, group_b_complete, missing_groups)

    注意：需要检查翻译是否为 [TODO_RETRY]，如果有则视为未完成
    """
    if not transcript or len(transcript) == 0:
        return False, False, ['GROUP_A', 'GROUP_B']

    first_translation = transcript[0].get('translation', {})

    # 检查 Group A（需要存在且不是 [TODO_RETRY]）
    group_a_complete = all(
        lang in first_translation and first_translation[lang] != '[TODO_RETRY]'
        for lang in GROUP_A
    )

    # 检查 Group B（需要存在且不是 [TODO_RETRY]）
    group_b_complete = all(
        lang in first_translation and first_translation[lang] != '[TODO_RETRY]'
        for lang in GROUP_B
    )

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
            # 如果语言不存在，或者是 [TODO_RETRY]，则重新翻译
            if lang not in existing or existing[lang] == '[TODO_RETRY]':
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

        # ========== 越南语特殊处理（老版 Prompt）==========
        # 检查是否有越南语需要补课（仅处理 TODO_RETRY 或空的记录）
        vietnamese_needs_update = False
        for sentence in transcript:
            vi_translation = sentence.get('translation', {}).get('vi')
            if not vi_translation or vi_translation == '[TODO_RETRY]':
                vietnamese_needs_update = True
                break

        if vietnamese_needs_update:
            log(f"  🇻🇳 开始补课越南语（老版 Prompt）...")
            vi_success = 0
            vi_failed = 0

            for i, sentence in enumerate(transcript):
                sentence_text = sentence.get('text', '')
                vi_translation = sentence.get('translation', {}).get('vi')

                # 仅处理 TODO_RETRY 或空的记录
                if not vi_translation or vi_translation == '[TODO_RETRY]':
                    translation, success, _ = translate_vietnamese_with_retry(sentence_text)

                    if success:
                        sentence['translation']['vi'] = translation
                        vi_success += 1
                    else:
                        sentence['translation']['vi'] = "[TODO_RETRY]"
                        vi_failed += 1
                        log_to_file(f"越南语翻译失败: [TODO_RETRY] (句子{i+1})", 'WARN')

            # 保存越南语的结果
            client.table('materials').update({
                'transcript': transcript
            }).eq('id', material_id).execute()

            log(f"  ✅ 越南语补课完成: 成功 {vi_success}, 失败 {vi_failed}，已保存")
            total_success += vi_success
            total_failed += vi_failed

        # 构建状态消息
        status_msg = f"✓ 翻译 {total_success} 条"
        if total_failed > 0:
            status_msg += f"，失败 {total_failed} 条 [TODO_RETRY]"

        if group_a_complete and not group_b_complete and total_failed > 0:
            status_msg += " [TODO_RETRY_GROUP_B]"

        return True, status_msg

    except Exception as e:
        error_msg = f"{slug}: {str(e)}"
        log(error_msg, 'ERROR')
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

        # 每 10 个素材打印一次进度统计
        if i % 10 == 0:
            progress_pct = (i / total_count) * 100
            print("\n" + "="*80, flush=True)
            print(f"  进度统计 [{i}/{total_count}] - {progress_pct:.1f}%", flush=True)
            print("="*80, flush=True)
            print(f"  已处理: {i} | 成功: {success_count} | 跳过: {skipped_count} | 失败: {failed_count}", flush=True)
            print(f"  成功率: {(success_count / i * 100):.1f}%", flush=True)
            print("="*80, flush=True)

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
