#!/usr/bin/env python3
"""
词典缓存预生成脚本 - V3.0
完整版：Oxford 3000 + 19 国翻译 + Edge TTS + R2 存储

功能：
1. Oxford 3000 数据源（新增）
2. Materials 表数据源（原有）
3. 19 国语言翻译
4. Edge TTS 音频生成
5. R2 持久化存储

使用方法：
  # 测试模式（20 个单词）
  python scripts/prepopulate_dictionary_cache_v3.py --test --oxford

  # 全量运行（Materials 表）
  python scripts/prepopulate_dictionary_cache_v3.py --all

作者：Claude Sonnet 4.5 + Sarah
日期：2026-04-01
版本：V3.0
"""

# ══════════════════════════════════════════════════════════════════════════════
# 模块 A：基础框架与配置
# ══════════════════════════════════════════════════════════════════════════════

import os
import sys
import json
import time
import re
import asyncio
import logging
import argparse
from pathlib import Path
from typing import Set, List, Dict, Optional, Tuple
from datetime import datetime

# 第三方库
from dotenv import load_dotenv
from supabase import create_client
import requests
import edge_tts
import boto3
from botocore.client import Config
from bs4 import BeautifulSoup

# ══════════════════════════════════════════════════════════════════════════════
# A.1 日志配置
# ══════════════════════════════════════════════════════════════════════════════

# 创建日志目录
log_dir = Path(__file__).parent.parent / 'logs'
log_dir.mkdir(exist_ok=True)

# 日志文件名（带时间戳）
log_file = log_dir / f'prepopulate_v3_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'

# 配置日志格式
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# A.2 环境变量加载
# ══════════════════════════════════════════════════════════════════════════════

# 加载 .env.local 文件
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

# 验证必要的环境变量
required_env_vars = [
    'GLM_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME'
]

missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    logger.error(f"❌ 缺少环境变量: {', '.join(missing_vars)}")
    logger.error(f"请在 .env.local 文件中配置这些变量")
    sys.exit(1)

logger.info("✅ 环境变量加载成功")

# ══════════════════════════════════════════════════════════════════════════════
# A.3 配置常量
# ══════════════════════════════════════════════════════════════════════════════

# GLM API 配置
GLM_API_KEY = os.getenv('GLM_API_KEY')
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
GLM_MODEL = "glm-4-flash"

# Supabase 配置
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_TABLE = 'dictionary_cache'

# R2 配置
R2_ACCOUNT_ID = os.getenv('NEXT_PUBLIC_R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', 'shadowhub')
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Worker 代理 URL（用于访问 R2 资源）
WORKER_PROXY_URL = "https://media.shadowhub.app"

# R2 音频存储路径前缀
R2_AUDIO_PATH_PREFIX = "audio/dictionary"

# ══════════════════════════════════════════════════════════════════════════════
# A.4 19 国语言配置
# ══════════════════════════════════════════════════════════════════════════════

# 原有的 3 种语言（已存在于旧数据中）
EXISTING_LANGUAGES = ['zh', 'zh_hant', 'vi']

# 新增的 16 种语言（分两组，确保稳定性）
GROUP_A = ['ar', 'de', 'es', 'fr', 'ja', 'ms', 'ru', 'tr', 'el']  # 9 种（含法语）
GROUP_B = ['id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']  # 8 种

# 全部 19 种语言（不含 en）
ALL_19_LANGUAGES = EXISTING_LANGUAGES + GROUP_A + GROUP_B

# 语言显示名称（用于日志输出）
LANGUAGE_NAMES = {
    'zh': '简体中文',
    'zh_hant': '繁體中文',
    'vi': 'Tiếng Việt',
    'ar': 'العربية',
    'de': 'Deutsch',
    'es': 'Español',
    'fr': 'Français',
    'ja': '日本語',
    'ms': 'Bahasa Melayu',
    'ru': 'Русский',
    'tr': 'Türçe',
    'el': 'Ελληνικά',
    'id': 'Bahasa Indonesia',
    'ko': '한국어',
    'pt': 'Português',
    'th': 'ภาษาไทย',
    'uk': 'Українська',
    'bn': 'বাংলা',
    'mn': 'Монгол',
    'hi': 'हिन्दी',
    'en': 'English'
}

logger.info(f"🌍 支持 19 国语言: {len(ALL_19_LANGUAGES)} 种")

# ══════════════════════════════════════════════════════════════════════════════
# A.5 数据库连接
# ══════════════════════════════════════════════════════════════════════════════

# 创建 Supabase 客户端
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

logger.info(f"🔗 Supabase 连接成功: {SUPABASE_URL}")
logger.info(f"📊 目标表: {SUPABASE_TABLE}")


# ══════════════════════════════════════════════════════════════════════════════
# A.6 R2 客户端初始化函数
# ══════════════════════════════════════════════════════════════════════════════

def get_r2_client():
    """
    创建 R2 (S3 兼容) 客户端

    返回:
        boto3.client: S3 客户端实例
    """
    return boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )


logger.info("☁️  R2 配置完成")
logger.info(f"   Bucket: {R2_BUCKET_NAME}")
logger.info(f"   Endpoint: {R2_ENDPOINT}")
logger.info(f"   Proxy: {WORKER_PROXY_URL}")

# ══════════════════════════════════════════════════════════════════════════════
# 模块 A 结束
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# 模块 B：OxfordScraper 抓取模块
# ══════════════════════════════════════════════════════════════════════════════

# 新增导入（用于随机延迟）
import random


class OxfordScraper:
    """
    Oxford 3000 单词抓取器

    从 engnovate.com 抓取 Oxford 3000 单词数据
    """

    # Oxford 3000 分类页面 URL
    CATEGORY_URL = "https://engnovate.com/flashcards/?category=oxford-3000"

    # 请求头（模拟浏览器）
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    # 延迟范围（秒）
    MIN_DELAY = 1.0
    MAX_DELAY = 2.0

    def __init__(self, max_words: Optional[int] = None):
        """
        初始化抓取器

        参数:
            max_words: 最大抓取单词数量（None 表示无限制）
        """
        self.max_words = max_words
        self.words_collected = 0
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

        logger.info("📚 OxfordScraper 初始化完成")
        if max_words:
            logger.info(f"   限制: 最多 {max_words} 个单词")

    def _random_delay(self):
        """随机延迟，避免被反爬"""
        delay = random.uniform(self.MIN_DELAY, self.MAX_DELAY)
        logger.debug(f"   ⏱️  延迟 {delay:.2f} 秒")
        time.sleep(delay)

    def _fetch_page(self, url: str) -> Optional[str]:
        """
        获取页面 HTML

        参数:
            url: 目标 URL

        返回:
            页面 HTML 文本（失败返回 None）
        """
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return response.text

        except requests.Timeout:
            logger.error(f"   ❌ 请求超时: {url}")
            return None

        except requests.RequestException as e:
            logger.error(f"   ❌ 请求失败: {url} - {e}")
            return None

    def _extract_learn_links(self, html: str) -> List[str]:
        """
        从分类页面提取所有 "Learn" 链接

        参数:
            html: 分类页面 HTML

        返回:
            Learn 页面 URL 列表
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            learn_links = []

            for link in soup.find_all('a'):
                if link.text.strip() == 'Learn':
                    href = link.get('href')
                    if href and '/flashcards/' in href:
                        # 补全完整 URL
                        if href.startswith('/'):
                            href = 'https://engnovate.com' + href
                        learn_links.append(href)

            logger.info(f"   ✅ 找到 {len(learn_links)} 个 Learn 页面")
            return learn_links

        except Exception as e:
            logger.error(f"   ❌ 解析分类页失败: {e}")
            return []

    def _extract_word_from_page(self, html: str) -> Optional[Dict]:
        """
        从 Learn 页面提取单词数据

        参数:
            html: Learn 页面 HTML

        返回:
            单词数据字典（失败返回 None）
            {
                'word': str,
                'part_of_speech': str,
                'phonetic': str,
                'definition': str,
                'dictionary_example': str,  # 注意：不覆盖素材例句
                'source': 'oxford3000'
            }
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            text = soup.get_text(separator='\n')
            lines = text.split('\n')

            word_data = None
            i = 0

            while i < len(lines):
                line = lines[i].strip()

                # 跳过空行和无关内容
                if not line or len(line) > 50:
                    i += 1
                    continue

                # 检查是否为单词（全小写字母）
                if line.islower() and line.isalpha() and 3 <= len(line) <= 12:
                    word = line

                    # 检查下一行是否包含词性和音标
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()

                        # 匹配词性和音标（格式：(n) /wɜːd/）
                        if next_line.startswith('(') and ')' in next_line:
                            # 提取词性
                            pos_match = re.search(r'\((v|n|adj|adv|prep|art|pron|conj|interj)\)', next_line)
                            part_of_speech = pos_match.group(1) if pos_match else ''

                            # 提取音标
                            ipa_match = re.search(r'/[^/]+/', next_line)
                            phonetic = ipa_match.group(0) if ipa_match else ''

                            # 提取释义和例句
                            definition = ''
                            dictionary_example = ''

                            j = i + 2
                            while j < len(lines) and j < i + 20:
                                def_line = lines[j].strip()

                                # 遇到新单词，停止解析
                                if not def_line:
                                    j += 1
                                    continue

                                if def_line.islower() and def_line.isalpha() and len(def_line) <= 12:
                                    break

                                # 遇到分隔符或无关内容，停止
                                if def_line in ['---', 'Flip', 'Type', 'Terms', 'Menu', 'Comment']:
                                    break

                                # 提取例句
                                if def_line.startswith('Example:'):
                                    dictionary_example = def_line.replace('Example:', '').strip()
                                elif not def_line.startswith('('):
                                    # 过滤掉导航栏文字
                                    if any(keyword in def_line.lower() for keyword in ['menu', 'comment', 'reply', 'login', 'register']):
                                        j += 1
                                        continue

                                    # 累积释义
                                    if definition:
                                        definition += ' ' + def_line
                                    else:
                                        definition = def_line

                                j += 1

                            # 验证数据完整性
                            if definition and 10 < len(definition) < 300:
                                word_data = {
                                    'word': word,
                                    'part_of_speech': part_of_speech,
                                    'phonetic': phonetic,
                                    'definition': definition.strip(),
                                    'dictionary_example': dictionary_example,  # 关键字段
                                    'source': 'oxford3000'
                                }
                                i = j
                                break

                i += 1

            return word_data

        except Exception as e:
            logger.error(f"   ❌ 解析单词页失败: {e}")
            return None

    def get_all_words(self) -> List[Dict]:
        """
        抓取所有 Oxford 3000 单词

        返回:
            单词数据列表
        """
        logger.info("=" * 70)
        logger.info("📚 开始抓取 Oxford 3000 单词")
        logger.info("=" * 70)

        all_words = []

        # 步骤 1：获取分类页面
        logger.info(f"\n[1/2] 获取分类页面: {self.CATEGORY_URL}")
        category_html = self._fetch_page(self.CATEGORY_URL)

        if not category_html:
            logger.error("❌ 无法获取分类页面，抓取终止")
            return all_words

        self._random_delay()

        # 步骤 2：提取 Learn 链接
        logger.info("\n[2/2] 提取 Learn 链接...")
        learn_links = self._extract_learn_links(category_html)

        if not learn_links:
            logger.warning("⚠️  未找到任何 Learn 链接")
            return all_words

        # 步骤 3：逐个抓取单词
        logger.info(f"\n[3/3] 开始抓取单词（共 {len(learn_links)} 个 Learn 页面）")
        logger.info("-" * 70)

        for idx, learn_url in enumerate(learn_links, 1):
            # 检查是否达到限制
            if self.max_words and self.words_collected >= self.max_words:
                logger.info(f"\n✅ 已达到限制 ({self.max_words} 个单词)，停止抓取")
                break

            logger.info(f"\n📄 [{idx}/{len(learn_links)}] {learn_url}")

            # 获取 Learn 页面
            html = self._fetch_page(learn_url)
            if not html:
                logger.warning(f"   ⚠️  跳过此页面")
                self._random_delay()
                continue

            self._random_delay()

            # 提取单词（可能一个页面有多个单词）
            page_words = self._extract_words_from_learn_page(html)

            if page_words:
                for word_data in page_words:
                    all_words.append(word_data)
                    self.words_collected += 1

                    logger.info(f"   ✅ [{self.words_collected}] {word_data['word']} - {word_data['part_of_speech']}")

                    # 检查是否达到限制
                    if self.max_words and self.words_collected >= self.max_words:
                        break

        # 总结
        logger.info("\n" + "=" * 70)
        logger.info("📊 抓取完成")
        logger.info("=" * 70)
        logger.info(f"✅ 总计抓取: {len(all_words)} 个单词")

        return all_words

    def _extract_words_from_learn_page(self, html: str) -> List[Dict]:
        """
        从 Learn 页面提取所有单词

        参数:
            html: Learn 页面 HTML

        返回:
            单词数据列表
        """
        words = []

        try:
            soup = BeautifulSoup(html, 'html.parser')
            text = soup.get_text(separator='\n')
            lines = text.split('\n')

            i = 0
            while i < len(lines):
                line = lines[i].strip()

                # 跳过空行和无关内容
                if not line or len(line) > 50:
                    i += 1
                    continue

                # 检查是否为单词
                if line.islower() and line.isalpha() and 3 <= len(line) <= 12:
                    word_data = self._extract_word_from_context(lines, i)
                    if word_data:
                        words.append(word_data)
                        # 跳过已处理的内容
                        i += 15
                        continue

                i += 1

            return words

        except Exception as e:
            logger.error(f"   ❌ 解析 Learn 页面失败: {e}")
            return []

    def _extract_word_from_context(self, lines: List[str], start_idx: int) -> Optional[Dict]:
        """
        从上下文中提取单词数据

        参数:
            lines: 文本行列表
            start_idx: 开始索引

        返回:
            单词数据字典
        """
        try:
            word = lines[start_idx].strip()

            # 向下搜索词性行（允许空行）
            part_of_speech = ''
            phonetic = ''
            pos_idx = -1

            for j in range(start_idx + 1, min(start_idx + 20, len(lines))):
                next_line = lines[j].strip()

                # 检查是否包含词性和音标
                if next_line.startswith('(') and ')' in next_line and '/' in next_line:
                    # 提取词性
                    pos_match = re.search(r'\((v|n|adj|adv|prep|art|pron|conj|interj)\)', next_line)
                    part_of_speech = pos_match.group(1) if pos_match else ''

                    # 提取音标
                    ipa_match = re.search(r'/[^/]+/', next_line)
                    phonetic = ipa_match.group(0) if ipa_match else ''

                    pos_idx = j
                    break

            # 如果找不到词性行，返回 None
            if pos_idx == -1:
                return None

            # 提取释义和例句
            definition = ''
            dictionary_example = ''

            j = pos_idx + 1
            while j < len(lines) and j < pos_idx + 20:
                def_line = lines[j].strip()

                if not def_line:
                    j += 1
                    continue

                # 遇到新单词，停止
                if def_line.islower() and def_line.isalpha() and len(def_line) <= 12:
                    break

                # 遇到无关内容，停止
                if def_line in ['---', 'Flip', 'Type', 'Terms', 'Menu', 'Comment']:
                    break

                # 提取例句
                if def_line.startswith('Example:'):
                    dictionary_example = def_line.replace('Example:', '').strip()
                elif not def_line.startswith('('):
                    # 过滤导航栏文字
                    if any(keyword in def_line.lower() for keyword in ['menu', 'comment', 'reply', 'login', 'register']):
                        j += 1
                        continue

                    if definition:
                        definition += ' ' + def_line
                    else:
                        definition = def_line

                j += 1

            # 验证数据
            if definition and 10 < len(definition) < 300:
                return {
                    'word': word,
                    'part_of_speech': part_of_speech,
                    'phonetic': phonetic,
                    'definition': definition.strip(),
                    'dictionary_example': dictionary_example,
                    'source': 'oxford3000'
                }

            return None

        except Exception as e:
            logger.debug(f"   ⚠️  提取单词失败: {e}")
            return None


# ══════════════════════════════════════════════════════════════════════════════
# 模块 B 结束
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# 模块 C：19 国语言翻译（简化版 - 仅包含基础语言）
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# 模块 C：19 国语言翻译引擎
# ══════════════════════════════════════════════════════════════════════════════

class TranslationEngine:
    """
    19 国语言翻译引擎

    使用 GLM API 进行批量翻译，支持指数退避重试
    """

    # 重试配置
    MAX_RETRIES = 3
    INITIAL_BACKOFF = 2.0  # 初始退避时间（秒）
    BACKOFF_MULTIPLIER = 2.0  # 退避倍数

    # Prompt 模板（紧凑 JSON 格式，降低 Token 消耗）
    SYSTEM_PROMPT = """你是专业多语言词典翻译引擎。将英文释义翻译为19种语言。

{languages_prompt}

单词：{word}
释义：{definition}

严格返回紧凑JSON（无额外文字）：
{json_template}"""

    # 语言 Prompt 模板
    LANGUAGE_PROMPTS = {
        'zh': '简中',
        'zh_hant': '繁中',
        'vi': '越南',
        'ar': '阿拉伯',
        'de': '德语',
        'es': '西语',
        'fr': '法语',
        'ja': '日语',
        'ms': '马来',
        'ru': '俄语',
        'tr': '土语',
        'el': '希腊',
        'id': '印尼',
        'ko': '韩语',
        'pt': '葡语',
        'th': '泰语',
        'uk': '乌克',
        'bn': '孟加',
        'mn': '蒙语',
        'hi': '印地'
    }

    def __init__(self):
        """初始化翻译引擎"""
        logger.info("🌍 TranslationEngine 初始化完成")
        logger.info(f"   支持 {len(ALL_19_LANGUAGES)} 种语言")

    def translate(self, word: str, en_definition: str) -> Dict[str, str]:
        """
        翻译为 19 国语言

        参数:
            word: 单词
            en_definition: 英文释义

        返回:
            翻译字典 {'en': '...', 'zh': '...', 'zh_hant': '...', ...}
        """
        translations = {'en': en_definition}

        # 分组翻译（确保稳定性）
        # 第一组：原有 3 种 + Group A
        group1_langs = EXISTING_LANGUAGES + GROUP_A
        group1_result = self._translate_with_retry(
            word, en_definition, group1_langs, "Group 1"
        )
        translations.update(group1_result)

        # 冷却时间（缓解 Rate Limit）
        time.sleep(1)

        # 第二组：Group B
        group2_result = self._translate_with_retry(
            word, en_definition, GROUP_B, "Group 2"
        )
        translations.update(group2_result)

        return translations

    def _translate_with_retry(
        self,
        word: str,
        en_definition: str,
        target_languages: List[str],
        group_name: str
    ) -> Dict[str, str]:
        """
        带重试的翻译请求

        参数:
            word: 单词
            en_definition: 英文释义
            target_languages: 目标语言列表
            group_name: 分组名称（用于日志）

        返回:
            翻译字典
        """
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                result = self._call_glm_api(word, en_definition, target_languages)
                logger.info(f"  ✅ {group_name} 翻译完成")
                return result

            except Exception as e:
                if attempt < self.MAX_RETRIES:
                    # 指数退避
                    backoff_time = self.INITIAL_BACKOFF * (self.BACKOFF_MULTIPLIER ** (attempt - 1))
                    logger.warning(
                        f"  ⚠️  {group_name} 翻译失败（尝试 {attempt}/{self.MAX_RETRIES}）: {e}"
                    )
                    logger.warning(f"  ⏱️  等待 {backoff_time:.1f} 秒后重试...")
                    time.sleep(backoff_time)
                else:
                    logger.error(f"  ❌ {group_name} 翻译失败（已达最大重试次数）: {e}")
                    # 返回空字典（不影响其他语言）
                    return {}

        return {}

    def _call_glm_api(
        self,
        word: str,
        en_definition: str,
        target_languages: List[str]
    ) -> Dict[str, str]:
        """
        调用 GLM API 进行翻译

        参数:
            word: 单词
            en_definition: 英文释义
            target_languages: 目标语言列表

        返回:
            翻译字典

        异常:
            requests.RequestException: API 请求失败
            json.JSONDecodeError: JSON 解析失败
        """
        # 构建 Prompt
        languages_prompt = " ".join([
            f"{self.LANGUAGE_PROMPTS[lang]}({lang})"
            for lang in target_languages
        ])

        json_template = "{" + ", ".join([f'"{lang}": "翻译"' for lang in target_languages]) + "}"

        system_content = self.SYSTEM_PROMPT.format(
            languages_prompt=languages_prompt,
            word=word,
            definition=en_definition,
            json_template=json_template
        )

        # 调用 API
        response = requests.post(
            f"{GLM_BASE_URL}/chat/completions",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {GLM_API_KEY}'
            },
            json={
                'model': GLM_MODEL,
                'messages': [
                    {
                        'role': 'system',
                        'content': system_content
                    },
                    {
                        'role': 'user',
                        'content': word
                    }
                ],
                'temperature': 0.3,
                'max_tokens': 800,
                'top_p': 0.7
            },
            timeout=30
        )

        # 检查响应状态
        if response.status_code != 200:
            raise requests.RequestException(
                f"GLM API 错误 ({response.status_code}): {response.text}"
            )

        # 解析响应
        data = response.json()
        content = data.get('choices', [{}])[0].get('message', {}).get('content')

        if not content:
            raise ValueError("GLM API 返回空内容")

        # 解析 JSON
        try:
            result = json.loads(content)
            return result
        except json.JSONDecodeError:
            # 尝试提取 JSON（兼容性处理）
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                result = json.loads(json_match.group(0))
                return result

            raise ValueError(f"无法解析 GLM 响应: {content[:200]}...")


# 创建全局翻译引擎实例
translation_engine = TranslationEngine()


# ══════════════════════════════════════════════════════════════════════════════
# 模块 H：智能批量翻译引擎（增量补齐模式）
# ══════════════════════════════════════════════════════════════════════════════

class SmartTranslationEngine:
    """
    智能批量翻译引擎

    支持增量补齐模式：
    - 只翻译缺失的语言
    - 智能分批（每批最多 10 种语言）
    - 断点续传支持
    """

    def __init__(self, batch_size: int = 10):
        """
        初始化智能翻译引擎

        参数:
            batch_size: 每批翻译的最大语言数量
        """
        self.batch_size = batch_size
        self.base_engine = TranslationEngine()
        logger.info(f"🧠 SmartTranslationEngine 初始化完成")
        logger.info(f"   批处理大小: {batch_size} 种语言/批")

    def translate_with_patch_mode(
        self,
        word: str,
        en_definition: str,
        existing_translations: Dict[str, str]
    ) -> Dict[str, str]:
        """
        增量补齐模式翻译

        参数:
            word: 单词
            en_definition: 英文释义
            existing_translations: 现有翻译字典

        返回:
            完整翻译字典（包含现有翻译）
        """
        # 1. 识别缺失的语言
        missing_languages = self._get_missing_languages(existing_translations)

        if not missing_languages:
            logger.debug(f"   ✅ {word} 翻译已完整，跳过")
            return existing_translations

        logger.info(f"   📝 缺失语言: {len(missing_languages)} 种 - {', '.join(missing_languages[:5])}{'...' if len(missing_languages) > 5 else ''}")

        # 2. 分批翻译
        merged_translations = existing_translations.copy()
        batches = self._create_batches(missing_languages, self.batch_size)

        for batch_idx, batch_languages in enumerate(batches, 1):
            logger.info(f"   🔄 批次 {batch_idx}/{len(batches)}: {len(batch_languages)} 种语言")

            try:
                # 调用基础翻译引擎
                batch_result = self._translate_batch_with_retry(
                    word, en_definition, batch_languages, batch_idx
                )

                # 合并结果
                merged_translations.update(batch_result)
                logger.info(f"   ✅ 批次 {batch_idx} 完成")

                # 批次间冷却（避免 Rate Limit）
                if batch_idx < len(batches):
                    time.sleep(1.5)

            except Exception as e:
                logger.error(f"   ❌ 批次 {batch_idx} 失败: {e}")
                # 继续处理下一批次（降级策略）

        return merged_translations

    def _get_missing_languages(self, existing: Dict[str, str]) -> List[str]:
        """
        识别缺失的语言

        参数:
            existing: 现有翻译字典

        返回:
            缺失的语言列表
        """
        existing_keys = set(existing.keys())
        standard_keys = set(ALL_19_LANGUAGES)
        missing = standard_keys - existing_keys
        return sorted(list(missing))

    def _create_batches(self, languages: List[str], batch_size: int) -> List[List[str]]:
        """
        创建批次

        参数:
            languages: 语言列表
            batch_size: 批次大小

        返回:
            批次列表
        """
        batches = []
        for i in range(0, len(languages), batch_size):
            batch = languages[i:i + batch_size]
            batches.append(batch)
        return batches

    def _translate_batch_with_retry(
        self,
        word: str,
        en_definition: str,
        target_languages: List[str],
        batch_idx: int
    ) -> Dict[str, str]:
        """
        带重试的批量翻译

        参数:
            word: 单词
            en_definition: 英文释义
            target_languages: 目标语言列表
            batch_idx: 批次索引（用于日志）

        返回:
            翻译字典
        """
        max_retries = 3

        for attempt in range(1, max_retries + 1):
            try:
                # 直接调用基础引擎的 API
                result = self.base_engine._call_glm_api(word, en_definition, target_languages)
                return result

            except Exception as e:
                if attempt < max_retries:
                    backoff = 2.0 ** (attempt - 1)
                    logger.warning(f"   ⚠️  批次 {batch_idx} 重试 {attempt}/{max_retries}: {e}")
                    logger.warning(f"   ⏱️  等待 {backoff:.1f} 秒...")
                    time.sleep(backoff)
                else:
                    logger.error(f"   ❌ 批次 {batch_idx} 最终失败: {e}")
                    return {}

        return {}


# ══════════════════════════════════════════════════════════════════════════════
# 模块 D：Edge TTS 音频生成
# ══════════════════════════════════════════════════════════════════════════════

async def generate_audio(word: str, output_dir: Path) -> Optional[str]:
    """
    使用 Edge TTS 生成音频

    参数:
        word: 单词
        output_dir: 输出目录

    返回:
        音频文件路径（失败返回 None）
    """
    audio_file = output_dir / f"{word}.mp3"

    try:
        communicate = edge_tts.Communicate(text=word, voice="en-US-GuyNeural")
        await communicate.save(str(audio_file))

        if audio_file.exists():
            file_size = audio_file.stat().st_size
            logger.info(f"    ✅ 音频生成: {audio_file.name} ({file_size} bytes)")
            return str(audio_file)
        else:
            logger.warning(f"    ⚠️  音频文件未生成")
            return None

    except Exception as e:
        logger.error(f"    ❌ Edge TTS 失败: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
# 模块 E：R2 上传
# ══════════════════════════════════════════════════════════════════════════════

def upload_to_r2(local_path: str, word: str) -> Optional[str]:
    """
    上传音频到 R2

    参数:
        local_path: 本地音频文件路径
        word: 单词

    返回:
        R2 URL（失败返回 None）
    """
    r2_key = f"{R2_AUDIO_PATH_PREFIX}/{word}.mp3"

    try:
        s3 = get_r2_client()
        s3.upload_file(
            local_path,
            R2_BUCKET_NAME,
            r2_key,
            ExtraArgs={'ContentType': 'audio/mpeg'}
        )

        # 返回 Worker 代理 URL
        worker_url = f"{WORKER_PROXY_URL}/{r2_key}"
        logger.info(f"    ✅ R2 上传成功: {worker_url}")
        return worker_url

    except Exception as e:
        logger.error(f"    ❌ R2 上传失败: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
# 模块 F：数据保存
# ══════════════════════════════════════════════════════════════════════════════

def save_to_cache(
    word: str,
    phonetic: str,
    translations: Dict[str, str],
    dictionary_example: str,
    audio_r2_url: Optional[str] = None
) -> bool:
    """
    保存单词到 dictionary_cache 表

    参数:
        word: 单词
        phonetic: 音标
        translations: 翻译字典（JSONB）
        dictionary_example: 词典例句
        audio_r2_url: R2 音频 URL

    返回:
        是否成功
    """
    try:
        # 准备数据（向后兼容：同时填充 definitions 和 translations）
        en_definition = translations.get('en', '')

        # 构造旧格式的 definitions（用于向后兼容）
        definitions = {
            'en': en_definition,
            'zh-CN': translations.get('zh', ''),
            'zh-Hant': translations.get('zh_hant', ''),
            'vi': translations.get('vi', '')
        }

        cache_data = {
            'word': word,
            'phonetic': phonetic,
            'definitions': definitions,  # 旧字段（向后兼容）
            'translations': translations,  # 新字段（19 国语言）
            'example': dictionary_example,
            'audio_r2_url': audio_r2_url,
            'hit_count': 0
        }

        supabase.table(SUPABASE_TABLE).upsert(
            cache_data,
            on_conflict='word'
        ).execute()

        logger.info(f"  ✅ 入库成功: {word}")
        return True

    except Exception as e:
        logger.error(f"  ❌ 入库失败: {word} - {e}")
        return False


# ══════════════════════════════════════════════════════════════════════════════
# 模块 G：断点续传与进度报告
# ══════════════════════════════════════════════════════════════════════════════

class CheckpointManager:
    """
    断点续传管理器

    保存和恢复处理进度，支持中断后继续
    """

    def __init__(self, checkpoint_file: str):
        """
        初始化检查点管理器

        参数:
            checkpoint_file: 检查点文件路径
        """
        self.checkpoint_file = Path(checkpoint_file)
        self.checkpoint_file.parent.mkdir(exist_ok=True, parents=True)
        self.data = self._load_checkpoint()

    def _load_checkpoint(self) -> Dict:
        """加载检查点文件"""
        if self.checkpoint_file.exists():
            try:
                with open(self.checkpoint_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                logger.info(f"✅ 加载检查点: {self.checkpoint_file}")
                return data
            except Exception as e:
                logger.warning(f"⚠️  检查点文件损坏，重新创建: {e}")
                return self._create_empty_checkpoint()
        else:
            return self._create_empty_checkpoint()

    def _create_empty_checkpoint(self) -> Dict:
        """创建空的检查点数据"""
        return {
            'processed_words': [],
            'failed_words': [],
            'last_word': None,
            'timestamp': None,
            'statistics': {
                'success': 0,
                'failed': 0,
                'skipped': 0
            }
        }

    def save_checkpoint(self, word: str, status: str):
        """
        保存检查点

        参数:
            word: 当前处理的单词
            status: 状态 ('success', 'failed', 'skipped')
        """
        if status == 'success':
            if word not in self.data['processed_words']:
                self.data['processed_words'].append(word)
            self.data['statistics']['success'] = len(self.data['processed_words'])
        elif status == 'failed':
            if word not in self.data['failed_words']:
                self.data['failed_words'].append(word)
            self.data['statistics']['failed'] = len(self.data['failed_words'])
        elif status == 'skipped':
            self.data['statistics']['skipped'] += 1

        self.data['last_word'] = word
        self.data['timestamp'] = datetime.now().isoformat()

        try:
            with open(self.checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ 保存检查点失败: {e}")

    def is_processed(self, word: str) -> bool:
        """
        检查单词是否已处理

        参数:
            word: 单词

        返回:
            是否已处理
        """
        return word in self.data['processed_words']

    def get_resume_position(self, words: List[str]) -> int:
        """
        获取恢复位置

        参数:
            words: 单词列表

        返回:
            恢复索引（0 表示从头开始）
        """
        if not self.data['last_word']:
            return 0

        try:
            idx = words.index(self.data['last_word'])
            return idx + 1
        except ValueError:
            return 0

    def get_statistics(self) -> Dict:
        """获取统计信息"""
        return self.data['statistics']


class ProgressReporter:
    """
    进度报告器

    定期输出处理进度汇总
    """

    def __init__(self, total: int, report_interval: int, silent: bool = False):
        """
        初始化进度报告器

        参数:
            total: 总单词数
            report_interval: 报告间隔（单词数）
            silent: 是否静默模式
        """
        self.total = total
        self.report_interval = report_interval
        self.silent = silent
        self.success = 0
        self.failed = 0
        self.skipped = 0
        self.start_time = time.time()

    def update(self, status: str):
        """
        更新计数

        参数:
            status: 状态 ('success', 'failed', 'skipped')
        """
        if status == 'success':
            self.success += 1
        elif status == 'failed':
            self.failed += 1
        elif status == 'skipped':
            self.skipped += 1

    def maybe_report(self, current: int, word: str = ''):
        """
        定期报告进度

        参数:
            current: 当前处理索引（1-based）
            word: 当前单词（可选）
        """
        if current % self.report_interval == 0 or current == self.total:
            self._report(current, word)

    def _report(self, current: int, word: str):
        """输出进度报告"""
        elapsed = time.time() - self.start_time
        avg_time = elapsed / current if current > 0 else 0
        remaining = (self.total - current) * avg_time if current > 0 else 0

        # 静默模式：简化输出
        if self.silent:
            logger.info(
                f"📊 进度: {current}/{self.total} | "
                f"✅ {self.success} | ❌ {self.failed} | ⏭️ {self.skipped} | "
                f"⏱️ {remaining/60:.1f}分钟剩余"
            )
        else:
            logger.info("-" * 70)
            logger.info(f"📊 进度报告 [{current}/{self.total}]")
            if word:
                logger.info(f"   当前单词: {word}")
            logger.info(f"   ✅ 成功: {self.success}")
            logger.info(f"   ❌ 失败: {self.failed}")
            logger.info(f"   ⏭️ 跳过: {self.skipped}")
            logger.info(f"   ⏱️  已用时: {elapsed/60:.1f} 分钟")
            logger.info(f"   📈 剩余: {remaining/60:.1f} 分钟")
            logger.info("-" * 70)

    def final_report(self):
        """输出最终报告"""
        elapsed = time.time() - self.start_time
        logger.info("")
        logger.info("=" * 70)
        logger.info("📊 最终统计")
        logger.info("=" * 70)
        logger.info(f"✅ 成功: {self.success}/{self.total}")
        logger.info(f"❌ 失败: {self.failed}")
        logger.info(f"⏭️ 跳过: {self.skipped}")
        logger.info(f"⏱️  总耗时: {elapsed/60:.1f} 分钟")
        logger.info(f"📈 平均速度: {elapsed/self.total:.1f} 秒/词" if self.total > 0 else "")


class SilentModeLogger:
    """
    静默模式日志控制器

    在静默模式下减少日志输出
    """

    def __init__(self, enabled: bool = False):
        """
        初始化静默模式控制器

        参数:
            enabled: 是否启用静默模式
        """
        self.enabled = enabled
        self.original_level = None

    def enable(self):
        """启用静默模式"""
        if self.enabled and self.original_level is None:
            self.original_level = logger.level
            logger.setLevel(logging.WARNING)

    def disable(self):
        """禁用静默模式"""
        if self.enabled and self.original_level is not None:
            logger.setLevel(self.original_level)
            self.original_level = None

    def __enter__(self):
        self.enable()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disable()


# ══════════════════════════════════════════════════════════════════════════════
# 主函数
# ══════════════════════════════════════════════════════════════════════════════

def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='词典缓存预生成脚本 V3.0',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--test', action='store_true', help='测试模式（3 个单词）')
    parser.add_argument('--oxford', action='store_true', help='使用 Oxford 3000 数据源')
    parser.add_argument('--all', action='store_true', help='处理所有 dictionary_cache 表中的单词')
    parser.add_argument('--limit', type=int, default=3, help='单词数量限制')
    parser.add_argument('--only-audio', action='store_true', help='仅补录音频（跳过已存在 R2 链接的条目）')
    parser.add_argument('--delay', type=float, default=0.5, help='TTS 请求间隔秒数（避免限流）')
    parser.add_argument('--patch-mode', action='store_true', help='增量补齐模式：只更新缺失的语言')
    parser.add_argument('--silent', action='store_true', help='静默模式：减少日志输出')
    parser.add_argument('--batch-size', type=int, default=10, help='每批翻译的语言数量（默认：10，推荐：8-10）')
    parser.add_argument('--checkpoint-file', type=str, default='scripts/patch_checkpoint.json', help='断点续传文件路径')
    parser.add_argument('--report-interval', type=int, default=50, help='进度报告间隔（单词数，默认：50）')
    args = parser.parse_args()

    print("=" * 70)
    print("词典缓存预生成脚本 V3.0")
    print("=" * 70)
    print()

    # 增量补齐模式
    if args.patch_mode:
        logger.info("🔧 增量补齐模式")
        logger.info("-" * 70)

        # 初始化组件
        checkpoint_manager = CheckpointManager(args.checkpoint_file)
        progress_reporter = ProgressReporter(
            total=0,  # 会在分析后更新
            report_interval=args.report_interval,
            silent=args.silent
        )
        silent_mode = SilentModeLogger(enabled=args.silent)

        # 启用静默模式
        silent_mode.enable()

        # 分析单词翻译状态
        logger.info("[步骤 1/4] 分析单词翻译状态...")
        response_all = supabase.table('dictionary_cache').select('word', 'translations').not_.is_('translations', 'null').execute()

        all_words_data = response_all.data
        all_words = [w['word'] for w in all_words_data]
        logger.info(f"📊 总单词数: {len(all_words)}")

        incomplete_words = []
        complete_words = []

        for word_entry in all_words_data:
            word = word_entry['word']
            translations_raw = word_entry.get('translations')

            try:
                if isinstance(translations_raw, str):
                    translations = json.loads(translations_raw)
                elif isinstance(translations_raw, dict):
                    translations = translations_raw
                else:
                    continue

                if translations is None:
                    continue

                existing_keys = set(translations.keys())
                standard_keys = set(ALL_19_LANGUAGES)
                missing_keys = standard_keys - existing_keys

                if len(missing_keys) > 0:
                    incomplete_words.append({
                        'word': word,
                        'existing_keys': existing_keys,
                        'missing_keys': sorted(list(missing_keys)),
                        'translations': translations
                    })
                else:
                    complete_words.append({
                        'word': word,
                        'translations': translations
                    })

            except (json.JSONDecodeError, TypeError, AttributeError):
                continue

        logger.info(f"✅ 翻译不全: {len(incomplete_words)} 个")
        logger.info(f"✅ 翻译完整（缺法语）: {len(complete_words)} 个")

        # 创建补齐计划
        logger.info("[步骤 2/4] 创建补齐计划...")

        patch_plan = []

        # 逻辑 A：翻译不全的单词，补齐所有缺失语言
        for word_info in incomplete_words:
            patch_plan.append({
                'word': word_info['word'],
                'existing_translations': word_info['translations'],
                'target_languages': word_info['missing_keys'],
                'mode': '补齐缺失',
                'missing_count': len(word_info['missing_keys'])
            })

        # 逻辑 B：翻译完整的单词，只补法语
        for word_info in complete_words:
            if 'fr' not in word_info['translations']:
                patch_plan.append({
                    'word': word_info['word'],
                    'existing_translations': word_info['translations'],
                    'target_languages': ['fr'],
                    'mode': '补齐法语',
                    'missing_count': 1
                })

        logger.info(f"📋 补齐计划: {len(patch_plan)} 个单词")
        logger.info(f"   - 翻译不全: {len(incomplete_words)} 个")
        logger.info(f"   - 补法语: {len(complete_words)} 个")

        # 测试模式限制
        if args.test:
            logger.info(f"⚠️  测试模式: 只处理前 {args.limit} 个单词")
            patch_plan = patch_plan[:args.limit]

        # 更新进度报告器
        progress_reporter.total = len(patch_plan)

        # 获取恢复位置
        resume_idx = checkpoint_manager.get_resume_position([p['word'] for p in patch_plan])
        if resume_idx > 0:
            logger.info(f"🔄 从第 {resume_idx + 1} 个单词恢复处理")

        # 初始化智能翻译引擎
        smart_engine = SmartTranslationEngine(batch_size=args.batch_size)

        # 执行补齐
        logger.info("[步骤 3/4] 执行增量补齐...")
        logger.info("-" * 70)

        # 禁用静默模式以显示处理详情
        silent_mode.disable()

        for idx, task in enumerate(patch_plan[resume_idx:], start=resume_idx + 1):
            word = task['word']
            existing_translations = task['existing_translations']
            target_languages = task['target_languages']
            mode = task['mode']

            # 检查是否已处理
            if checkpoint_manager.is_processed(word):
                logger.info(f"\n[{idx}/{len(patch_plan)}] ⏭️ {word} (已处理，跳过)")
                progress_reporter.update('skipped')
                progress_reporter.maybe_report(idx, word)
                continue

            # 重新启用静默模式（如果不是报告时间）
            if not args.silent or idx % args.report_interval != 0:
                silent_mode.enable()

            logger.info(f"\n[{idx}/{len(patch_plan)}] {word} ({mode})")
            logger.info(f"   缺失: {len(target_languages)} 种语言")

            try:
                # 获取英文释义
                response = supabase.table('dictionary_cache').select('definitions').eq('word', word).execute()
                en_definition = word  # 默认值

                if response.data:
                    definitions = response.data[0].get('definitions', {})
                    if isinstance(definitions, str):
                        definitions = json.loads(definitions)
                    en_definition = definitions.get('en', word)

                # 智能补齐翻译
                updated_translations = smart_engine.translate_with_patch_mode(
                    word, en_definition, existing_translations
                )

                # 更新数据库
                update_response = supabase.table('dictionary_cache').update({
                    'translations': updated_translations
                }).eq('word', word).execute()

                if update_response.data:
                    logger.info(f"   ✅ 补齐成功")
                    checkpoint_manager.save_checkpoint(word, 'success')
                    progress_reporter.update('success')
                else:
                    logger.error(f"   ❌ 数据库更新失败")
                    checkpoint_manager.save_checkpoint(word, 'failed')
                    progress_reporter.update('failed')

            except Exception as e:
                logger.error(f"   ❌ 处理失败: {e}")
                checkpoint_manager.save_checkpoint(word, 'failed')
                progress_reporter.update('failed')

            # 进度报告
            progress_reporter.maybe_report(idx, word)

            # 延迟
            time.sleep(0.5)

        # 最终报告
        progress_reporter.final_report()

        logger.info("[步骤 4/4] 补齐完成")
        logger.info(f"📁 检查点文件: {args.checkpoint_file}")
        return

    # 创建临时音频目录
    temp_audio_dir = Path('/tmp/dictation_word_audio')
    temp_audio_dir.mkdir(exist_ok=True, parents=True)

    # 仅音频补录模式
    if args.only_audio:
        logger.info("🎵 仅音频补录模式（跳过已存在 R2 链接的条目）")
        logger.info(f"⏱️  TTS 请求间隔: {args.delay} 秒")
        logger.info("-" * 70)

        # 查询缺失音频的单词
        response = supabase.table('dictionary_cache').select('word', 'phonetic', 'example').is_('audio_r2_url', 'null').execute()

        words_to_process = response.data
        logger.info(f"📊 缺失音频的单词数: {len(words_to_process)}")

        if not words_to_process:
            logger.info("✅ 所有单词都有音频，无需处理")
            return

        # 处理单词
        success_count = 0
        failed_words = []

        for idx, word_entry in enumerate(words_to_process, 1):
            word = word_entry['word']
            phonetic = word_entry.get('phonetic', '')
            example = word_entry.get('dictionary_example', '')

            logger.info(f"\n[{idx}/{len(words_to_process)}] 补录音频: {word}")

            # 跳过 "for" 单词（Bug 数据）
            if word == 'for' and not phonetic:
                logger.warning(f"⚠️  跳过无效 'for' 条目（无音标）")
                failed_words.append(word)
                continue

            try:
                # 1. 生成音频
                audio_file = asyncio.run(generate_audio(word, temp_audio_dir))

                if not audio_file:
                    logger.error(f"❌ 音频生成失败: {word}")
                    failed_words.append(word)
                    time.sleep(args.delay)
                    continue

                # 2. 上传到 R2
                audio_r2_url = upload_to_r2(audio_file, word)

                if not audio_r2_url:
                    logger.error(f"❌ R2 上传失败: {word}")
                    failed_words.append(word)
                    time.sleep(args.delay)
                    continue

                # 3. 更新数据库（只更新 audio_r2_url）
                update_response = supabase.table('dictionary_cache').update({
                    'audio_r2_url': audio_r2_url
                }).eq('word', word).execute()

                if update_response.data:
                    logger.info(f"✅ 音频补录成功: {word}")
                    success_count += 1
                else:
                    logger.error(f"❌ 数据库更新失败: {word}")
                    failed_words.append(word)

            except Exception as e:
                logger.error(f"❌ 处理失败: {word} - {str(e)}")
                failed_words.append(word)

            # 延迟，避免 TTS 限流
            time.sleep(args.delay)

        # 总结
        logger.info("\n" + "=" * 70)
        logger.info("📊 音频补录完成")
        logger.info("=" * 70)
        logger.info(f"✅ 成功: {success_count}/{len(words_to_process)}")

        if failed_words:
            logger.warning(f"⚠️  失败: {len(failed_words)} 个单词")
            logger.warning(f"失败列表: {', '.join(failed_words[:10])}{'...' if len(failed_words) > 10 else ''}")

        logger.info(f"📁 音频目录: {temp_audio_dir}")
        return

    # 正常模式（翻译 + 音频）
    # 创建 Oxford 抓取器
    scraper = OxfordScraper(max_words=args.limit)

    # 抓取单词
    words = scraper.get_all_words()

    if not words:
        logger.warning("⚠️  未抓取到任何单词")
        return

    # 处理单词
    logger.info(f"\n🔄 开始处理 {len(words)} 个单词（19 国语言翻译）")
    logger.info("-" * 70)

    success_count = 0

    for idx, word_data in enumerate(words, 1):
        word = word_data['word']
        logger.info(f"\n[{idx}/{len(words)}] 处理: {word}")

        # 1. 翻译为 19 国语言（使用 TranslationEngine）
        translations = translation_engine.translate(
            word,
            word_data['definition']
        )

        # 2. 生成音频
        audio_file = asyncio.run(generate_audio(word, temp_audio_dir))

        # 3. 上传到 R2
        audio_r2_url = None
        if audio_file:
            audio_r2_url = upload_to_r2(audio_file, word)

        # 4. 保存到数据库
        if save_to_cache(
            word=word,
            phonetic=word_data['phonetic'],
            translations=translations,
            dictionary_example=word_data['dictionary_example'],
            audio_r2_url=audio_r2_url
        ):
            success_count += 1

    # 总结
    logger.info("\n" + "=" * 70)
    logger.info("📊 处理完成")
    logger.info("=" * 70)
    logger.info(f"✅ 成功: {success_count}/{len(words)}")
    logger.info(f"📁 音频目录: {temp_audio_dir}")


if __name__ == '__main__':
    main()
