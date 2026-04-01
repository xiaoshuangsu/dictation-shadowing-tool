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
GROUP_A = ['ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el']  # 8 种
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
    parser.add_argument('--limit', type=int, default=3, help='单词数量限制')
    args = parser.parse_args()

    print("=" * 70)
    print("词典缓存预生成脚本 V3.0")
    print("=" * 70)
    print()

    # 创建临时音频目录
    temp_audio_dir = Path('/tmp/dictation_word_audio')
    temp_audio_dir.mkdir(exist_ok=True, parents=True)

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
