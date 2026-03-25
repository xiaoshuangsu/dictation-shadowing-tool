#!/usr/bin/env python3
"""
批量素材导入脚本 v4.0
从 Engnovate 抓取多个 Dictation/Shadowing 练习

特点：
1. 解析页面的原生时间戳数据（data-start, data-duration）
2. 下载音频并上传到 R2
3. 使用 GLM API 进行翻译（三语：zh, zh_hant, vi）
4. 使用 GLM-4 进行智能挖空词识别（多候选词自动选择）
5. 存入 Supabase
6. 跳过重复（根据 source_url）
7. 容错运行（单个失败不影响整体）

🔒 跨域资源（CORS）规范：
- 数据库存储：R2 相对路径（如 audio/ielts-listening/slug.mp3）
- 前端访问：通过 Worker 代理（https://media.shadowhub.app）
- 前端组件：必须添加 crossOrigin="anonymous" 属性
- Worker 响应：必须返回 Access-Control-Allow-Origin: *

🎯 v4.0 新增功能（雅思挖空优化）：
- 剔除高价值事实词（数字、日期、价格、地址）
- 剔除专有名词（人名、地名、机构名、品牌名）
- 剔除纯逻辑连接词（although, however, moreover, therefore 等）
- 使用 should_skip_word() 综合判断函数
- GLM Prompt 明确禁止挖空这些词类

参考：
- src/components/VideoPlayer.tsx (line 467, 502)
- src/components/AudioPlayer.tsx (line 260)
- src/components/topics/MaterialCard.tsx (line 170)

版本历史：
- v4.0 (2026-03-25): 剔除事实词、专有名词、逻辑连接词
- v2.3 (2026-03-25): 方案3 - GLM-4 多候选词自动选择，提高挖空成功率；修正 Premium 逻辑（前200免费，之后付费）
- v2.2 (2026-03-25): 雅思专家级挖空协议 + 核心黑名单过滤 + 三语翻译
- v2.1 (2026-03-24): 雅思素材完整支持 + GLM-4 挖空词识别
"""
import os
import sys
import json
import re
import time
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from supabase import create_client
import boto3
from typing import Optional, List, Dict

# ==================== 加载环境变量 ====================
def load_env():
    """从 .env.local 加载环境变量"""
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

# ==================== 配置 ====================
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
R2_ACCOUNT_ID = os.environ.get('NEXT_PUBLIC_R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME')
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_PUBLIC_URL = "https://media.shadowhub.app"
GLM_API_KEY = os.environ.get('GLM_API_KEY')

# ==================== 跨域资源（CORS）配置 ====================
# 🔴 重要：所有素材资源必须通过 Worker 代理访问
#
# 1. R2 存储路径（相对路径，存储在数据库）
#    - 音频：audio/{category}/{slug}.mp3
#    - 封面：thumbnails/{category}-default.jpg
#    - 示例：audio/ielts-listening/cam-12-test-1-part-1.mp3
#
# 2. Worker 代理 URL（前端访问时自动添加）
#    - Worker：https://media.shadowhub.app
#    - 完整 URL：https://media.shadowhub.app/audio/ielts-listening/slug.mp3
#
# 3. Worker CORS 配置（必须设置）
#    - 响应头：Access-Control-Allow-Origin: *
#    - 响应头：Access-Control-Allow-Methods: GET, HEAD, OPTIONS
#
# 4. 前端组件要求（必须遵守）
#    - VideoPlayer：<video crossOrigin="anonymous" src={url} />
#    - AudioPlayer：<audio crossOrigin="anonymous" src={url} />
#    - MaterialCard：<img crossOrigin="anonymous" src={url} />
#
# 5. 禁止直接访问 R2 公共域名（缺少 CORS 头）
#    - ❌ 错误：https://r2.public-url.r2.dev/xxx.mp3
#    - ✅ 正确：https://media.shadowhub.app/xxx.mp3
#
# 参考文档：
# - claude-code-guide.md（第 301-307 行：核心开发规范）
# - src/components/VideoPlayer.tsx
# - src/components/AudioPlayer.tsx
# - src/components/topics/MaterialCard.tsx
# ============================================================

# 分类映射（根据前端代码）
CATEGORY_SLUG_MAP = {
    '日常生活': 'daily-life',
    '历史演讲': 'historical-speeches',
    '文化历史': 'culture-history',
    '心灵故事': 'heart-soul-stories',
    '艺术文化': 'arts-culture',
    'YouTube Vlog': 'youtube-vlog',
    '故事': 'stories',
    '人物访谈': 'interviews',
    'BBC Learning English': 'bbc-learning-english',
    'VOA Learning English': 'voa-learning-english',
    'TED演讲': 'ted-talks',
    '动画片': 'cartoons',
    'IELTS Listening': 'ielts-listening',
}

# ==================== 工具函数 ====================

def log(msg: str):
    """简化日志输出"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def slugify(text: str) -> str:
    """生成 URL 友好的 slug"""
    text = text.lower().strip()
    # 移除特殊字符
    text = re.sub(r'[^\w\s-]', '', text)
    # 替换空格为连字符
    text = re.sub(r'\s+', '-', text)
    # 移除多余连字符
    text = re.sub(r'-+', '-', text)
    return text.strip('-')[:100]

def is_ielts_material(url: str, html: str = None) -> bool:
    """检测是否为雅思素材

    Args:
        url: 页面 URL
        html: 页面 HTML（可选）

    Returns:
        是否为雅思素材
    """
    url_lower = url.lower()

    # 方式1: URL 检测
    if 'ielts' in url_lower or 'listening' in url_lower:
        return True

    # 方式2: HTML 检测（如果提供）
    if html:
        html_lower = html.lower()
        if 'ielts' in html_lower or 'cambridge' in html_lower:
            return True

    return False

def extract_ielts_info(url: str, html: str = None) -> dict:
    """从 URL 或页面提取雅思信息

    Args:
        url: 页面 URL
        html: 页面 HTML（可选）

    Returns:
        雅思信息字典 {
            'cam_num': '12',
            'test_num': '1',
            'part_num': '1',
            'is_ielts': True
        }

    支持的 URL 格式：
    - cam12-test1-part1
    - cambridge-ielts-12-listening-test-1-part-1
    - ielts-listening-cam-12-test-1-part-1
    """
    url_lower = url.lower()
    info = {'is_ielts': True, 'cam_num': None, 'test_num': None, 'part_num': None}

    # 提取 Cam 编号（Cam 4-18）
    # 支持格式：cam-13, cam13, cambridge-13, cambridge-ielts-13
    cam_match = re.search(r'cam(?:bridge)?[^\d]*(\d{1,2})', url_lower)
    if cam_match:
        info['cam_num'] = cam_match.group(1)

    # 提取 Test 编号（Test 1-4）
    test_match = re.search(r'test(?:\s*|\-*)(\d{1,2})', url_lower)
    if test_match:
        info['test_num'] = test_match.group(1)

    # 提取 Part 编号（Part 1-4）
    part_match = re.search(r'part(?:\s*|\-*)(\d{1,2})', url_lower)
    if part_match:
        info['part_num'] = part_match.group(1)

    # 如果 URL 没有提取到完整信息，尝试从 HTML 提取
    if html and not all([info['cam_num'], info['test_num'], info['part_num']]):
        soup = BeautifulSoup(html, 'html.parser')

        # 从 h1 标题提取
        h1 = soup.find('h1')
        if h1:
            title_text = h1.get_text().lower()

            # 尝试从标题提取信息
            if not info['cam_num']:
                cam_match = re.search(r'cam(?:bridge)?\s*(\d{1,2})', title_text)
                if cam_match:
                    info['cam_num'] = cam_match.group(1)

            if not info['test_num']:
                test_match = re.search(r'test(?:\s*)(\d{1,2})', title_text)
                if test_match:
                    info['test_num'] = test_match.group(1)

            if not info['part_num']:
                part_match = re.search(r'part(?:\s*)(\d{1,2})', title_text)
                if part_match:
                    info['part_num'] = part_match.group(1)

    return info

def get_ielts_difficulty(part_num: str) -> str:
    """根据雅思 Part 编号获取难度等级

    雅思难度分级：
    - Part 1 → B1
    - Part 2 → B2
    - Part 3 → C1
    - Part 4 → C2

    Args:
        part_num: Part 编号（字符串）

    Returns:
        难度等级（B1/B2/C1/C2）
    """
    difficulty_map = {
        '1': 'B1',
        '2': 'B2',
        '3': 'C1',
        '4': 'C2'
    }
    return difficulty_map.get(part_num, 'B1')

def format_ielts_title(ielts_info: dict) -> str:
    """生成雅思素材的规范标题

    格式：Cam {cam_num} Academic Listening Test {test_num} Part {part_num}

    Args:
        ielts_info: extract_ielts_info() 返回的信息字典

    Returns:
        规范标题
    """
    cam_num = ielts_info.get('cam_num', '12')
    test_num = ielts_info.get('test_num', '1')
    part_num = ielts_info.get('part_num', '1')

    return f"Cam {cam_num} Academic Listening Test {test_num} Part {part_num}"

def get_default_thumbnail(category: str) -> Optional[str]:
    """获取分类的默认封面路径

    R2 桶中应该有这些默认封面：
    - thumbnails/ielts-cover.jpg（雅思素材）
    - thumbnails/ted-talks-default.jpg
    - thumbnails/bbc-learning-default.jpg
    - thumbnails/science-default.jpg
    - thumbnails/daily-life-default.jpg

    Args:
        category: 素材分类

    Returns:
        封面路径或 None
    """
    category_lower = category.lower()

    # 雅思素材（统一使用 ielts-cover.jpg）
    if 'ielts' in category_lower or 'listening' in category_lower:
        return 'thumbnails/ielts-cover.jpg'

    # TED 演讲
    if 'ted' in category_lower:
        return 'thumbnails/ted-talks-default.jpg'

    # BBC Learning
    if 'bbc' in category_lower:
        return 'thumbnails/bbc-learning-default.jpg'

    # 日常生活
    if 'daily' in category_lower or 'life' in category_lower:
        return 'thumbnails/daily-life-default.jpg'

    # 科学科普
    if 'science' in category_lower or 'facts' in category_lower:
        return 'thumbnails/science-default.jpg'

    # 历史演讲
    if 'historical' in category_lower or 'speech' in category_lower:
        return 'thumbnails/historical-speeches-default.jpg'

    # 文化历史
    if 'culture' in category_lower or 'history' in category_lower:
        return 'thumbnails/culture-history-default.jpg'

    # 心灵故事
    if 'heart' in category_lower or 'soul' in category_lower or 'story' in category_lower:
        return 'thumbnails/heart-soul-stories-default.jpg'

    # 艺术文化
    if 'art' in category_lower:
        return 'thumbnails/arts-culture-default.jpg'

    # 人物访谈
    if 'interview' in category_lower:
        return 'thumbnails/interviews-default.jpg'

    # 动画片
    if 'cartoon' in category_lower:
        return 'thumbnails/cartoons-default.jpg'

    # Vlog
    if 'vlog' in category_lower:
        return 'thumbnails/youtube-vlog-default.jpg'

    # 默认封面（如果分类没有匹配）
    return 'thumbnails/default-cover.jpg'

def detect_category(url: str, html: str = None) -> str:
    """检测素材的分类

    Args:
        url: 页面 URL
        html: 页面 HTML（可选）

    Returns:
        分类名称
    """
    url_lower = url.lower()

    # 优先从 URL 检测
    if 'ielts' in url_lower or 'listening' in url_lower:
        return 'IELTS Listening'
    if 'ted' in url_lower:
        return 'TED Talks'
    if 'bbc' in url_lower:
        return 'BBC Learning English'
    if 'daily' in url_lower or 'life' in url_lower:
        return 'Daily Life'
    if 'science' in url_lower or 'facts' in url_lower:
        return 'Science and Facts'
    if 'historical' in url_lower or 'speech' in url_lower:
        return 'Historical Speeches'
    if 'culture' in url_lower:
        return 'Culture and History'
    if 'art' in url_lower:
        return 'Arts and Culture'
    if 'interview' in url_lower:
        return 'Interviews'
    if 'cartoon' in url_lower:
        return 'Cartoons'
    if 'vlog' in url_lower:
        return 'YouTube Vlog'

    # 如果 URL 没有信息，从 HTML 检测
    if html:
        html_lower = html.lower()
        if 'ielts' in html_lower or 'listening' in html_lower:
            return 'IELTS Listening'
        if 'ted' in html_lower:
            return 'TED Talks'
        # 可以添加更多检测规则...

    # 默认分类
    return 'Daily Life'

# ==================== GLM-4 挖空词识别 ====================

# 不同分类的挖空词识别 Prompt
BLANKS_PROMPTS = {
    'IELTS Listening': """你是一位英语教学专家，专注于设计高质量的词汇训练内容。

**核心目标**：选择最能体现英语语感、词汇量和表达能力的单词进行挖空。

**优先级策略**（按重要性排序）：
1. **体现语感的词汇** (50%)：如 cultivated, rarely, instead, significant, merely, particularly, essentially, primarily 等能展示语言精度的词
2. **核心词汇多样性** (30%)：功能性动词、描述性形容词、副词（如 maintain, consume, essential, effective）
3. **学术名词** (20%)：专业术语、概念词（如 photosynthesis, economy, cultivation, mechanism）

**全局去重规则**：
- **同一单词在整个素材中最多挖空1次**
- 只有当句子中没有其他可挖的词时，才考虑重复挖空（保底机制）
- 确保词汇多样性最大化

**严禁挖空的词类**：
1. **事实词**（数字、日期、价格、地址）：
   - 纯数字：1995, 20, 100, 3.5 等
   - 日期：January, Monday, 1990s, 15th 等
   - 价格：$15, 20 pounds 等
   - 地址：Street, Road, Avenue, Building, Room 等
2. **专有名词**：
   - 人名：John, Sarah, Dr. Smith, Professor Brown 等
   - 地名：London, Australia, Pacific, Amazon 等
   - 机构名：Cambridge, BBC, UNESCO 等
   - 品牌名：Nike, Google, Toyota 等
3. **纯逻辑连接词**：
   - although, however, moreover, therefore, consequently, nevertheless, nonetheless, thus, hence, meanwhile, furthermore, in addition, on the other hand

**保底机制**：
- **每一句必须至少有一个候选词**
- 如果句子中只有简单词，选择最核心的动词、名词或副词
- 避免返回空的 candidates 数组

**核心黑名单** (严禁挖空)：
- 代词：he, she, it, they, we, you, I, me, him, her, us, them, that, which, who, this, these, those, my, your, his, hers, its, our, their
- 虚词/连词：a, an, the, and, or, but, so, because, if
- 简单介词：in, on, at, to, of, for, with, by, from, about
- 基础动词：is, am, are, was, were, be, been, do, does, did, have, has, had
- 其他：there, here

**输出格式**（JSON，不要有任何其他文字）：
{
  "candidates": [
    {"word": "第一候选词", "index": 位置1, "reason": "理由"},
    {"word": "第二候选词", "index": 位置2, "reason": "理由"},
    {"word": "第三候选词", "index": 位置3, "reason": "理由"}
  ]
}

**重要限制**：
- **每个候选词必须是单个词**，不能是短语（如 "set up" 是短语，不能使用）
- 短语动词（如 set up, look for）请选择其中的核心词（如 set, look）

**示例**：
输入: Coffee bushes are cultivated in shaded areas.
输出: {"candidates": [{"word": "cultivated", "index": 3, "reason": "体现语感的动词"}, {"word": "shaded", "index": 6, "reason": "描述性形容词"}, {"word": "areas", "index": 7, "reason": "名词"}]}

输入: The conference was held in London in 1995.
输出: {"candidates": [{"word": "conference", "index": 2, "reason": "名词"}, {"word": "held", "index": 4, "reason": "动词"}]}

输入: However, the results showed significant improvement.
输出: {"candidates": [{"word": "results", "index": 3, "reason": "名词"}, {"word": "significant", "index": 5, "reason": "形容词"}, {"word": "improvement", "index": 6, "reason": "名词"}]}

输入: Europeans set up coffee plantations.
输出: {"candidates": [{"word": "plantations", "index": 4, "reason": "名词"}, {"word": "Europeans", "index": 0, "reason": "名词"}, {"word": "coffee", "index": 3, "reason": "名词"}]}
注意："set up" 是短语，不能选择，应该选择其他单个词

输入: {sentence}
输出:""",

    'TED Talks': """你是科普教育专家。请分析句子，找出科学术语或关键概念。

规则：
1. 优先挖空专业术语（如 happiness, decision, habit等）
2. 优先挖空抽象概念词
3. 不要挖空常用动词、介词、代词
4. 每句只挖 1 个词

输出格式（必须是有效的 JSON，不要有任何其他文字）：
{
  "word": "被挖空的词",
  "index": 词在句子中的位置（从0开始），
  "reason": "挖空理由"
}

输入: {sentence}
输出:""",

    'BBC Learning': """你是英语教学专家。请分析句子，找出重要的实词。

规则：
1. 优先挖空动词、名词、形容词（不要挖虚词）
2. 选择词频在 2000-5000 范围的词（不要太基础，也不要太难）
3. 不要挖空人名、地名
4. 每句只挖 1 个词

输出格式（必须是有效的 JSON，不要有任何其他文字）：
{
  "word": "被挖空的词",
  "index": 词在句子中的位置（从0开始），
  "pos": "词性（VB/NN/JJ）"
}

输入: {sentence}
输出:""",

    'Daily Life': """你是英语教学专家。请分析句子，找出适合挖空的"高频实词"。

规则：
1. 优先挖空动词、名词、形容词（不要挖虚词）
2. 选择日常生活中常用的词（词频适中）
3. 避免挖空人名、地名、专有名词
4. 每句只挖 1 个词

输出格式（必须是有效的 JSON，不要有任何其他文字）：
{
  "word": "被挖空的词",
  "index": 词在句子中的位置（从0开始），
  "pos": "词性（VB/NN/JJ）"
}

输入: {sentence}
输出:""",

    'Science and Facts': """你是科普教育专家。请分析句子，找出科学术语。

规则：
1. 优先挖空专业术语（如 orbit, planet, gravity, temperature）
2. 优先挖空数字、单位（如 365 days, 100 degrees）
3. 不要挖空常用动词
4. 每句只挖 1 个词

输出格式（必须是有效的 JSON，不要有任何其他文字）：
{
  "word": "被挖空的词",
  "index": 词在句子中的位置（从0开始），
  "reason": "挖空理由"
}

输入: {sentence}
输出:""",

    'default': """你是英语教学专家。请分析句子，找出适合挖空的实词。

规则：
1. 优先挖空动词、名词、形容词
2. 不要挖空冠词、介词、代词
3. 每句只挖 1 个词

输出格式（必须是有效的 JSON，不要有任何其他文字）：
{
  "word": "被挖空的词",
  "index": 词在句子中的位置（从0开始），
  "pos": "词性（VB/NN/JJ）"
}

输入: {sentence}
输出:"""
}

# 核心黑名单（严禁挖空的词）
STRICT_BLACKLIST = [
    # 代词/引导词
    'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
    'that', 'which', 'who', 'this', 'these', 'those',
    'my', 'your', 'his', 'hers', 'its', 'our', 'their', 'ours', 'theirs',
    'whom', 'whose',
    # 虚词/连词
    'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'if',
    # 纯逻辑连接词（v4 新增）
    'although', 'however', 'moreover', 'therefore', 'consequently',
    'nevertheless', 'nonetheless', 'thus', 'hence', 'meanwhile',
    'furthermore', 'otherwise', 'accordingly', 'besides',
    # 简单介词
    'in', 'on', 'at', 'to', 'of', 'for', 'with', 'by', 'from', 'about',
    # 基础系动词/助动词（包括分词形式）
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'have', 'has', 'had', 'having',
    # 其他常见虚词
    'there', 'here'
]

def is_blacklisted(word: str) -> bool:
    """检查单词是否在黑名单中"""
    return word.lower().strip('.,!?;:"\'') in STRICT_BLACKLIST

# ==================== v4 新增：事实词与专有名词检测 ====================

def is_fact_word(word: str) -> bool:
    """检查是否为事实词（数字、日期、价格、地址相关）

    Args:
        word: 待检查的单词

    Returns:
        是否为事实词
    """
    word_clean = word.lower().strip('.,!?;:"\'')

    # 1. 纯数字
    if word_clean.replace('.', '').replace(',', '').isdigit():
        return True

    # 2. 包含数字的词（如 1990s, 15th, 3.5, 20%）
    if any(c.isdigit() for c in word_clean):
        return True

    # 3. 日期词汇
    date_words = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
        'year', 'month', 'week', 'day', 'date', 'time'
    ]
    if word_clean in date_words:
        return True

    # 4. 价格相关
    price_indicators = ['$', '£', '€', 'yen', 'yuan', 'dollar', 'pound', 'cent', 'euro']
    if any(indicator in word_clean for indicator in price_indicators):
        return True

    # 5. 地址相关（街道、建筑等）
    address_words = [
        'street', 'road', 'avenue', 'boulevard', 'lane', 'drive', 'way',
        'building', 'room', 'floor', 'suite', 'apartment', 'flat',
        'north', 'south', 'east', 'west', 'central', 'city', 'town'
    ]
    if word_clean in address_words:
        return True

    return False

def is_proper_noun(word: str, sentence_text: str = '', index: int = -1) -> bool:
    """检查是否为专有名词（人名、地名、机构名、品牌名）

    Args:
        word: 待检查的单词
        sentence_text: 完整句子（可选，用于上下文判断）
        index: 单词在句子中的位置（可选）

    Returns:
        是否为专有名词
    """
    word_clean = word.strip('.,!?;:"\'')

    # 1. 大写字母开头（非句首）通常是专有名词
    if word_clean and word_clean[0].isupper() and index > 0:
        return True

    # 2. 常见地名
    place_names = [
        'london', 'paris', 'tokyo', 'new york', 'sydney', 'moscow', 'beijing', 'shanghai',
        'america', 'american', 'britain', 'british', 'england', 'english', 'scotland', 'irish',
        'europe', 'european', 'asia', 'asian', 'africa', 'pacific', 'atlantic',
        'australia', 'australian', 'canada', 'canadian', 'india', 'indian',
        'cambridge', 'oxford', 'yale', 'harvard', 'stanford'
    ]
    if word_clean.lower() in place_names:
        return True

    # 3. 机构名
    institutions = [
        'cambridge', 'oxford', 'bbc', 'unesco', 'nasa', 'nato',
        'university', 'college', 'institute', 'association', 'organization'
    ]
    if word_clean.lower() in institutions:
        return True

    # 4. 品牌名
    brands = [
        'google', 'apple', 'microsoft', 'amazon', 'facebook', 'twitter',
        ' nike', 'toyota', 'honda', 'bmw', 'mercedes', 'sony', 'samsung'
    ]
    if word_clean.lower() in brands:
        return True

    return False

def should_skip_word(word: str, sentence_text: str = '', index: int = -1) -> bool:
    """综合判断是否应该跳过该词（不挖空）

    Args:
        word: 待检查的单词
        sentence_text: 完整句子（可选）
        index: 单词在句子中的位置（可选）

    Returns:
        是否应该跳过
    """
    # 1. 黑名单词
    if is_blacklisted(word):
        return True

    # 2. 事实词
    if is_fact_word(word):
        return True

    # 3. 专有名词
    if is_proper_noun(word, sentence_text, index):
        return True

    return False

def is_valid_single_word(word: str) -> bool:
    """检查是否为有效的单个词（不是短语）

    Args:
        word: 待检查的词

    Returns:
        是否为有效的单个词
    """
    # 移除标点符号
    word_clean = word.strip('.,!?;:"\'')

    # 检查是否包含空格（短语）
    if ' ' in word_clean:
        return False

    return True

def is_digit_word(word: str) -> bool:
    """检查是否为数字或日期词汇"""
    word_clean = word.lower().strip('.,!?;:"\'')
    # 纯数字
    if word_clean.isdigit():
        return True
    # 包含数字的词（如 1990s, 15th）
    if any(c.isdigit() for c in word_clean):
        return True
    # 常见日期词汇
    date_words = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december',
                  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
                  'year', 'month', 'week', 'day']
    if word_clean in date_words:
        return True
    return False

def fallback_blank_selection(sentence_text: str, blanked_words: dict = None, digit_count: int = 0, digit_limit: int = 2) -> Optional[Dict]:
    """保底机制：使用本地算法选择挖空词

    优先级：
    1. 非黑名单的动词、形容词、副词
    2. 避免重复词（已挖1次的词）
    3. 避免事实词、专有名词

    Args:
        sentence_text: 句子文本
        blanked_words: 已挖空单词的计数器
        digit_count: 当前数字挖空数量（已弃用，保留兼容性）
        digit_limit: 数字挖空限制（已弃用，保留兼容性）

    Returns:
        blanks 对象或 None
    """
    if blanked_words is None:
        blanked_words = {}

    words = sentence_text.split()

    # 词性标识（简单判断）
    def get_word_type(word):
        word_clean = word.lower().strip('.,!?;:"\'')
        if word_clean.endswith('ing'):
            return 'VBG'
        elif word_clean.endswith('ed'):
            return 'VBD'
        elif word_clean.endswith('ly'):
            return 'RB'
        elif word_clean.endswith('ment') or word_clean.endswith('tion') or word_clean.endswith('ness'):
            return 'NN'
        elif word_clean.endswith('ive') or word_clean.endswith('ous') or word_clean.endswith('ent'):
            return 'JJ'
        else:
            return 'UNK'

    # 优先选择动词、形容词、副词
    preferred_words = []
    for i, word in enumerate(words):
        word_clean = word.lower().strip('.,!?;:"\'')

        # 🔴 v4: 使用 should_skip_word 综合判断
        if should_skip_word(word, sentence_text, i):
            continue

        # 🔴 v4.1: 跳过已挖1次的词（绝不重复）
        if blanked_words.get(word_clean, 0) >= 1:
            continue

        # 分析词性
        word_type = get_word_type(word)

        # 优先级：VBG/VBD（动词）> RB（副词）> JJ（形容词）> NN（名词）
        if word_type in ['VBG', 'VBD']:
            preferred_words.insert(0, (i, word, word_type))
        elif word_type == 'RB':
            preferred_words.append((i, word, word_type))
        elif word_type == 'JJ':
            preferred_words.append((i, word, word_type))
        elif word_type == 'NN':
            preferred_words.append((i, word, word_type))
        else:
            preferred_words.append((i, word, word_type))

    # 返回第一个优先词
    if preferred_words:
        index, word, word_type = preferred_words[0]
        return {
            "word": word.strip('.,!?;:"\''),
            "index": index,
            "pos": word_type,
            "is_core": False
        }

    # 如果没有合适的词，返回 None（允许不挖空）
    return None

def generate_blanks_with_glm(sentence_text: str, category: str, blanked_words: dict = None, digit_count: int = 0, digit_limit: int = 2) -> Optional[Dict]:
    """使用 GLM-4 识别挖空词（v4.0：剔除事实词、专有名词、逻辑连接词）

    Args:
        sentence_text: 句子文本
        category: 素材分类
        blanked_words: 已挖空单词的计数器 {word: count}
        digit_count: 当前数字挖空数量（已弃用，保留兼容性）
        digit_limit: 数字挖空限制（已弃用，保留兼容性）

    Returns:
        blanks 对象或 None
        {
            "word": "earth",
            "index": 3,
            "pos": "NN",
            "is_core": true
        }
    """
    if blanked_words is None:
        blanked_words = {}

    # 根据分类选择 Prompt
    prompt = BLANKS_PROMPTS.get(category, BLANKS_PROMPTS['default'])
    full_prompt = prompt.replace('{sentence}', sentence_text)

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
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": sentence_text}
                ],
                "temperature": 0.3,
                "max_tokens": 300
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            content = result["choices"][0]["message"]["content"].strip()

            # 解析 JSON
            try:
                blank_data = json.loads(content)
            except:
                # 🔥 保底机制：如果 GLM 返回失败，使用本地算法
                return fallback_blank_selection(sentence_text, blanked_words, digit_count, digit_limit)

            # 检查是否有 candidates 字段
            if 'candidates' not in blank_data:
                # 🔥 保底机制：使用本地算法
                return fallback_blank_selection(sentence_text, blanked_words, digit_count, digit_limit)

            candidates = blank_data['candidates']

            if not candidates or len(candidates) == 0:
                # 🔥 保底机制：使用本地算法
                return fallback_blank_selection(sentence_text, blanked_words, digit_count, digit_limit)

            # 分词验证
            words = sentence_text.split()

            # 🔥 v4: 遍历候选词，应用所有过滤规则（包括事实词和专有名词）
            for candidate in candidates:
                if 'word' not in candidate or 'index' not in candidate:
                    continue

                index = candidate['index']
                word = candidate['word']

                # 🔴 v4.1: 验证是否为单个词（不能是短语）
                if not is_valid_single_word(word):
                    continue

                # 验证 index 范围
                if index < 0 or index >= len(words):
                    continue

                # 🔴 v4: 使用 should_skip_word 综合判断
                if should_skip_word(word, sentence_text, index):
                    continue

                # 🔴 全局去重：同一单词最多挖空1次（绝不重复）
                word_lower = word.lower()
                if blanked_words.get(word_lower, 0) >= 1:
                    continue

                # 找到符合条件的词，准备返回
                # 推断词性（简单判断）
                pos = candidate.get('pos', 'NN')
                if 'pos' not in candidate:
                    if word.endswith('ing'):
                        pos = "VBG"
                    elif word.endswith('ed'):
                        pos = "VBD"
                    elif word.endswith('ly'):
                        pos = "RB"
                    elif word[0].isupper() and index > 0:
                        pos = "NNP"
                    elif category in ['IELTS Listening']:
                        pos = "NN"  # 雅思倾向于名词
                    else:
                        pos = "NN"

                # 判断是否为核心词汇
                is_core = candidate.get('reason', '') != '' or category in ['IELTS Listening', 'TED Talks', 'Science and Facts']

                return {
                    "word": word,
                    "index": index,
                    "pos": pos,
                    "is_core": is_core
                }

            # 🔥 保底机制：所有候选词都不符合条件，使用本地算法
            return fallback_blank_selection(sentence_text, blanked_words, digit_count, digit_limit)

    except json.JSONDecodeError as e:
        print(f"  ⚠ GLM JSON 解析失败: {e}")
        # 🔥 保底机制：发生错误，使用本地算法
        return fallback_blank_selection(sentence_text, blanked_words, digit_count, digit_limit)
    except Exception as e:
        print(f"  ⚠ GLM 挖空识别失败: {e}")
        # 🔥 保底机制：发生错误，使用本地算法
        return fallback_blank_selection(sentence_text, blanked_words, digit_count, digit_limit)

def check_duplicate(slug: str) -> bool:
    """检查 slug 是否已存在"""
    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        result = client.table('materials').select('*').eq('slug', slug).execute()
        return len(result.data) > 0
    except Exception as e:
        log(f"  ⚠ 检查重复时出错: {e}")
        return False

def fetch_page(url: str) -> Optional[str]:
    """抓取页面内容"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as e:
        log(f"  ❌ 抓取失败: {e}")
        return None

def parse_title(html: str, url: str = None) -> Optional[str]:
    """解析页面标题

    Args:
        html: 页面 HTML
        url: 页面 URL（可选，用于检测雅思素材）

    Returns:
        清洗后的标题，雅思素材使用规范命名
    """
    soup = BeautifulSoup(html, 'html.parser')

    # 尝试从 h1 获取
    h1 = soup.find('h1')
    if h1:
        title = h1.get_text().strip()
        # 移除后缀
        for suffix in ['English Dictation', 'Shadowing Exercise', '& Shadowing Exercise']:
            title = title.replace(suffix, '').strip()
        if title:
            # 🔥 雅思素材：使用规范命名
            if url and is_ielts_material(url, html):
                ielts_info = extract_ielts_info(url, html)
                if all([ielts_info['cam_num'], ielts_info['test_num'], ielts_info['part_num']]):
                    return format_ielts_title(ielts_info)
            return title

    # 尝试从 title 标签获取
    title_tag = soup.find('title')
    if title_tag:
        title = title_tag.get_text().strip()
        # 移除后缀
        for suffix in ['English Dictation', 'Shadowing Exercise', '& Shadowing Exercise']:
            title = title.replace(suffix, '').strip()
        if title:
            # 🔥 雅思素材：使用规范命名
            if url and is_ielts_material(url, html):
                ielts_info = extract_ielts_info(url, html)
                if all([ielts_info['cam_num'], ielts_info['test_num'], ielts_info['part_num']]):
                    return format_ielts_title(ielts_info)
            return title

    return None

def parse_audio_url(html: str) -> Optional[str]:
    """解析音频 URL"""
    soup = BeautifulSoup(html, 'html.parser')

    # 查找 audio 标签
    audio_tags = soup.find_all('audio')
    for audio in audio_tags:
        src = audio.get('src')
        if src and '.mp3' in src:
            return src

    # 搜索所有 .mp3 链接
    mp3_links = re.findall(r'https?://[^\s"\'<>]+\.mp3', html)
    if mp3_links:
        return mp3_links[0]

    return None

def parse_transcript(html: str, category: str = 'Daily Life') -> Optional[List[Dict]]:
    """解析 Transcript 内容和时间戳，并生成挖空数据

    Args:
        html: 页面 HTML
        category: 素材分类（用于选择挖空策略）

    Returns:
        Transcript 数组，包含挖空数据
    """
    soup = BeautifulSoup(html, 'html.parser')
    transcript_lines = soup.find_all('div', class_='transcript-line')

    if not transcript_lines:
        return None

    sentences = []
    blank_count = 0  # 统计成功生成挖空的句子数
    blanked_words = {}  # 🔥 全局去重：记录已挖空的单词及其次数
    digit_count = 0     # 🔥 数字计数器：限制数字挖空不超过2个

    for line in transcript_lines:
        start = float(line.get('data-start', 0))
        duration = float(line.get('data-duration', 0))
        end = round(start + duration, 3)

        words_spans = line.find_all('span', class_='word')

        # 🔴 关键修复：正确处理标点符号，避免产生空格
        # 将所有词组合成一个字符串，但标点符号前不留空格
        text_parts = []
        for span in words_spans:
            word_text = span.get_text().strip()
            if not word_text:
                continue
            # 如果是标点符号（.,!?等），直接拼接到前一个词
            if word_text in ['.', ',', '!', '?', ';', ':', "'", '"', ')', ']', '}', '⟩']:
                if text_parts:
                    # 将标点符号拼接到前一个词（移除末尾的空格）
                    text_parts[-1] = text_parts[-1] + word_text
                else:
                    text_parts.append(word_text)
            else:
                # 普通单词，添加空格分隔
                text_parts.append(word_text)

        text = ' '.join(text_parts).strip()

        if text:
            # 🔥 使用 GLM-4 识别挖空词（传入所有计数器）
            blanks = []
            blank_info = generate_blanks_with_glm(text, category, blanked_words, digit_count, digit_limit=2)
            if blank_info:
                blanks.append(blank_info)
                # 更新全局计数
                word_lower = blank_info['word'].lower()
                blanked_words[word_lower] = blanked_words.get(word_lower, 0) + 1

                # 🔥 更新事实词计数（用于统计）
                if is_fact_word(blank_info['word']):
                    digit_count += 1

                blank_count += 1

            sentences.append({
                'id': len(sentences) + 1,
                'text': text,
                'startTime': round(start, 3),
                'endTime': end,
                'translation': '',  # 稍后填充
                'blanks': blanks  # 🔥 挖空数据
            })

    log(f"  ✓ 挖空词识别: {blank_count}/{len(sentences)} 句成功 (数字: {digit_count})")
    return sentences

def download_audio(url: str, output_path: Path) -> Optional[Path]:
    """下载音频文件"""
    try:
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()

        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        file_size = output_path.stat().st_size
        log(f"  ✓ 下载完成: {file_size / 1024 / 1024:.2f} MB")
        return output_path
    except Exception as e:
        log(f"  ❌ 下载失败: {e}")
        return None

def upload_to_r2(file_path: Path, key: str) -> Optional[str]:
    """上传文件到 R2"""
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY
        )

        s3.upload_file(
            str(file_path),
            R2_BUCKET_NAME,
            key,
            ExtraArgs={'ContentType': 'audio/mpeg'}
        )

        log(f"  ✓ 上传成功")
        return key
    except Exception as e:
        log(f"  ❌ 上传失败: {e}")
        return None

def translate_with_glm(sentences: List[Dict]) -> List[Dict]:
    """使用 GLM API 翻译成三语（中文简体、中文繁体、越南语）"""
    api_url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

    for i, sentence in enumerate(sentences, 1):
        try:
            # 翻译成三语
            translations = {}

            # 1. 中文简体
            response_zh = requests.post(
                api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GLM_API_KEY}"
                },
                json={
                    "model": "glm-4-flash",
                    "messages": [
                        {"role": "system", "content": "你是专业的英汉翻译专家。将英文翻译成地道的中文简体口语，只返回翻译结果，不要有任何其他文字。"},
                        {"role": "user", "content": sentence['text']}
                    ],
                    "temperature": 0.3
                },
                timeout=30
            )

            if response_zh.status_code == 200:
                result = response_zh.json()
                translations['zh'] = result["choices"][0]["message"]["content"].strip()

            time.sleep(0.3)

            # 2. 中文繁体（使用 zh_hant 以匹配前端代码）
            response_zh_tw = requests.post(
                api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GLM_API_KEY}"
                },
                json={
                    "model": "glm-4-flash",
                    "messages": [
                        {"role": "system", "content": "你是专业的英汉翻译专家。将英文翻译成地道的中文繁体口语（台湾/香港常用），只返回翻译结果，不要有任何其他文字。"},
                        {"role": "user", "content": sentence['text']}
                    ],
                    "temperature": 0.3
                },
                timeout=30
            )

            if response_zh_tw.status_code == 200:
                result = response_zh_tw.json()
                translations['zh_hant'] = result["choices"][0]["message"]["content"].strip()

            time.sleep(0.3)

            # 3. 越南语
            response_vi = requests.post(
                api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GLM_API_KEY}"
                },
                json={
                    "model": "glm-4-flash",
                    "messages": [
                        {"role": "system", "content": "你是专业的英越翻译专家。将英文翻译成地道的越南语，只返回翻译结果，不要有任何其他文字。"},
                        {"role": "user", "content": sentence['text']}
                    ],
                    "temperature": 0.3
                },
                timeout=30
            )

            if response_vi.status_code == 200:
                result = response_vi.json()
                translations['vi'] = result["choices"][0]["message"]["content"].strip()

            # 设置翻译结果
            sentence['translation'] = translations

            if i % 5 == 0:
                log(f"  翻译进度: {i}/{len(sentences)}")

            time.sleep(0.3)

        except Exception as e:
            log(f"  ⚠ 翻译失败 (第{i}句): {e}")
            sentence['translation'] = {'zh': sentence['text'], 'zh_hant': sentence['text'], 'vi': sentence['text']}

    return sentences

def save_to_supabase(title: str, slug: str, audio_path: str, transcript: List[Dict], category: str = 'IELTS Listening') -> bool:
    """保存到 Supabase

    Args:
        title: 标题
        slug: URL slug
        audio_path: 音频路径
        transcript: Transcript 数据
        category: 素材分类（用于设置默认封面和难度）
    """
    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        duration = int(transcript[-1]['endTime']) if transcript else 0

        # 🔥 根据分类获取默认封面
        thumbnail_path = get_default_thumbnail(category)

        # 🔥 自动设置难度等级
        difficulty = 'B1'  # 默认难度
        if 'IELTS Listening' in category or 'ielts' in category.lower():
            # 从标题中提取 Part 编号
            part_match = re.search(r'Part (\d+)', title, re.IGNORECASE)
            if part_match:
                part_num = part_match.group(1)
                difficulty = get_ielts_difficulty(part_num)
                log(f"  📊 雅思难度: Part {part_num} → {difficulty}")

        # 🔥 自动 Pro 标记：前200个素材免费，之后付费
        # 查询当前素材总数
        try:
            count_result = client.table('materials').select('id', count='exact').execute()
            total_count = count_result.count if hasattr(count_result, 'count') else len(count_result.data)
            is_premium = total_count >= 200
            if is_premium:
                log(f"  🔒 Premium 素材: 当前已有 {total_count} 个素材，新素材标记为付费")
            else:
                log(f"  🆓 免费素材: 当前已有 {total_count}/200 个素材")
        except Exception as e:
            # 查询失败时默认免费
            log(f"  ⚠ 无法查询素材总数，默认免费: {e}")
            is_premium = False

        material_data = {
            'title': title,
            'slug': slug,
            'category': category,
            'difficulty': difficulty,
            'audio_path': audio_path,
            'video_path': None,
            'thumbnail_path': thumbnail_path,  # 🔥 使用默认封面
            'audio_size': 0,
            'duration': duration,
            'transcript': transcript,
            'play_count': 0,
            'is_premium': is_premium,  # 🔥 Premium 标记
            'meta_title': f"{title} | English Dictation & Shadowing",
            'meta_description': f"Practice English listening and speaking with '{title}' dictation exercise. Improve your English skills with interactive audio and text.",
            'og_image': None
        }

        result = client.table('materials').insert(material_data).execute()
        log(f"  ✓ 数据库保存成功 (ID: {result.data[0]['id']})")
        if thumbnail_path:
            log(f"  📸 默认封面: {thumbnail_path}")
        return True

    except Exception as e:
        log(f"  ❌ 数据库保存失败: {e}")
        return False

def process_url(url: str, index: int, total: int) -> bool:
    """处理单个 URL"""
    print(f"\n{'='*70}")
    print(f"[{index}/{total}] 正在处理: {url}")
    print(f"{'='*70}")

    try:
        # 1. 抓取页面
        html = fetch_page(url)
        if not html:
            return False

        # 2. 检测分类（用于设置默认封面）
        category = detect_category(url, html)
        log(f"  分类: {category}")

        # 3. 解析标题（传入 URL 用于雅思素材检测）
        title = parse_title(html, url)
        if not title:
            log("  ❌ 无法解析标题")
            return False

        log(f"  标题: {title}")

        # 4. 生成 slug 并检查重复
        # 🔥 雅思素材：使用规范的 slug 格式
        if is_ielts_material(url, html):
            ielts_info = extract_ielts_info(url, html)
            if all([ielts_info['cam_num'], ielts_info['test_num'], ielts_info['part_num']]):
                # 规范格式：cam-{cam_num}-academic-listening-test-{test_num}-part-{part_num}
                slug = f"cam-{ielts_info['cam_num']}-academic-listening-test-{ielts_info['test_num']}-part-{ielts_info['part_num']}"
                log(f"  🔖 IELTS 规范 Slug: {slug}")
            else:
                slug = slugify(title)
        else:
            slug = slugify(title)

        if check_duplicate(slug):
            log("  ⏭ 跳过（已存在）")
            return True

        # 5. 解析音频 URL
        audio_url = parse_audio_url(html)
        if not audio_url:
            log("  ❌ 未找到音频链接")
            return False

        log(f"  音频: {audio_url}")

        # 6. 解析 Transcript（传入 category 用于挖空词识别）
        sentences = parse_transcript(html, category)
        if not sentences or len(sentences) < 3:
            log("  ❌ Transcript 解析失败或句子太少")
            return False

        log(f"  句子数: {len(sentences)}")

        # 7. 下载音频
        temp_dir = Path("/tmp/ingest_bulk")
        temp_dir.mkdir(exist_ok=True)

        filename = audio_url.split('/')[-1].split('?')[0]
        audio_path = temp_dir / filename

        audio_path = download_audio(audio_url, audio_path)
        if not audio_path:
            return False

        # 8. GLM 翻译
        log(f"  开始翻译...")
        sentences = translate_with_glm(sentences)

        # 9. 上传到 R2
        audio_key = f"audio/{category.lower().replace(' ', '-')}/{slug}.mp3"

        r2_key = upload_to_r2(audio_path, audio_key)
        if not r2_key:
            return False

        # 10. 保存到 Supabase（传入 category）
        if save_to_supabase(title, slug, r2_key, sentences, category):
            log(f"✅ [{index}/{total}] 导入成功!")
            print(f"   访问链接: /topics/{category.lower().replace(' ', '-')}/{slug}/")
            return True
        else:
            return False

    except Exception as e:
        log(f"❌ 处理失败: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        # 清理临时文件
        try:
            if 'audio_path' in locals() and audio_path.exists():
                audio_path.unlink()
        except:
            pass

def main():
    # 读取 URL 列表
    urls_file = Path('/tmp/cam14_remaining.txt')  # 临时使用 Cam 14 剩余素材

    if not urls_file.exists():
        log(f"错误: URLs 文件不存在: {urls_file}")
        sys.exit(1)

    with open(urls_file) as f:
        urls = [line.strip() for line in f if line.strip()]

    if not urls:
        log("错误: URLs 文件为空")
        sys.exit(1)

    print("="*70)
    print("  批量素材导入")
    print("="*70)
    print(f"总数: {len(urls)} 个 URL")
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)

    # 统计
    success_count = 0
    skip_count = 0
    fail_count = 0

    # 处理每个 URL
    for i, url in enumerate(urls, 1):
        try:
            result = process_url(url, i, len(urls))

            if result:
                success_count += 1
            else:
                fail_count += 1

        except KeyboardInterrupt:
            log("\n⚠ 用户中断")
            break
        except Exception as e:
            log(f"❌ 未知错误: {e}")
            fail_count += 1

    # 最终统计
    print("\n" + "="*70)
    print("  批量导入完成")
    print("="*70)
    print(f"成功: {success_count}")
    print(f"失败: {fail_count}")
    print(f"总计: {len(urls)}")
    print("="*70)

if __name__ == '__main__':
    main()
