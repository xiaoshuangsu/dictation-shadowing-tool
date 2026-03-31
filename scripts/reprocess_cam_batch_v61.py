#!/usr/bin/env python3
"""
批量重新处理雅思素材挖空逻辑 v6.2（增强版日志）
语言习得导向（Language Acquisition）的智能挖空

特点：
1. ✅ 完整的日志记录（避免对话中断后丢失进度）
2. ✅ 断点续传功能（跳过已处理的素材）
3. ✅ 结构化 Markdown 日志
4. ✅ 0 挖空预警和原因分析
5. ✅ 索引位移校验
6. ✅ 分类进度标记

日志文件位置：
- scripts/logs/recloze_audit_{日期}.md - 结构化 Markdown 日志
- logs/cam_reprocess_progress.json - 进度文件（支持断点续传）

使用方法：
1. 处理单个素材：python3 scripts/reprocess_cam_batch_v61.py --slug cam-10-academic-listening-test-3-part-2
2. 处理批量素材：python3 scripts/reprocess_cam_batch_v61.py --batch /tmp/cam_batch.txt
3. 继续未完成的任务：python3 scripts/reprocess_cam_batch_v61.py --resume
"""
import os
import sys
import json
import requests
import time
import re
import random
import argparse
from pathlib import Path
from datetime import datetime
from supabase import create_client
from typing import Optional, List, Dict, Tuple, Set

# ==================== 日志配置 ====================
LOG_DIR = Path(__file__).parent.parent / 'scripts' / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

PROGRESS_DIR = Path(__file__).parent.parent / 'logs'
PROGRESS_DIR.mkdir(parents=True, exist_ok=True)

DATE_STR = datetime.now().strftime('%Y%m%d')
TIMESTAMP = datetime.now().strftime('%Y%m%d_%H%M%S')
MARKDOWN_LOG_FILE = LOG_DIR / f'recloze_audit_{DATE_STR}.md'
PROGRESS_FILE = PROGRESS_DIR / 'cam_reprocess_progress.json'

class MarkdownLogger:
    """结构化 Markdown 日志器"""
    def __init__(self, log_file: Path):
        self.log_file = log_file
        self.start_time = datetime.now()
        self.batch_results = []  # 存储每批次的结果
        self.zero_blanks_warnings = []  # 0 挖空预警
        self.index_validations = []  # 索引校验结果
        self.category_progress = {}  # 分类进度

        # 初始化日志文件
        if not log_file.exists():
            self._init_log_file()

    def _init_log_file(self):
        """初始化日志文件"""
        with open(self.log_file, 'w', encoding='utf-8') as f:
            f.write(f"# CAM 素材挖空重处理审计日志\n\n")
            f.write(f"**开始时间**: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"**脚本版本**: v6.2\n")
            f.write(f"**挖空逻辑**: 语言习得导向（Language Acquisition）\n\n")
            f.write("---\n\n")
            f.write("## 目录\n\n")
            f.write("- [执行摘要](#执行摘要)\n")
            f.write("- [批次处理详情](#批次处理详情)\n")
            f.write("- [0 挖空预警](#0-挖空预警)\n")
            f.write("- [索引位移校验](#索引位移校验)\n")
            f.write("- [异常记录](#异常记录)\n\n")
            f.write("---\n\n")

    def log_batch_result(self, result: dict):
        """记录批次处理结果"""
        self.batch_results.append(result)
        self._append_to_file(f"### 批次 {len(self.batch_results)}: {result.get('slug', 'Unknown')}\n\n")
        self._append_to_file(f"| 字段 | 值 |\n")
        self._append_to_file(f"|------|------|\n")
        self._append_to_file(f"| **素材 ID** | `{result.get('slug', 'N/A')}` |\n")
        self._append_to_file(f"| **分类** | {result.get('category', 'N/A')} |\n")
        self._append_to_file(f"| **标题** | {result.get('title', 'N/A')} |\n")
        self._append_to_file(f"| **原挖空数** | {result.get('old_blank_count', 0)} |\n")
        self._append_to_file(f"| **新挖空数** | {result.get('new_blank_count', 0)} |\n")

        stats = result.get('stats', {})
        if stats:
            weights = stats.get('weights', {})
            self._append_to_file(f"| **权重分布** | W10={weights.get(10, 0)}, W9={weights.get(9, 0)}, W8={weights.get(8, 0)}, W6={weights.get(6, 0)}, W5={weights.get(5, 0)} |\n")

        status = result.get('status', 'Unknown')
        status_emoji = "✅" if status == "Success" else "❌"
        self._append_to_file(f"| **状态** | {status_emoji} {status} |\n")

        if result.get('error'):
            self._append_to_file(f"| **错误** | `{result['error']}` |\n")

        self._append_to_file("\n")

        # 记录分类进度
        category = result.get('category', 'Unknown')
        if category not in self.category_progress:
            self.category_progress[category] = {'completed': 0, 'total': 0}
        self.category_progress[category]['completed'] += 1

    def log_zero_blank_warning(self, slug: str, title: str, category: str, text_preview: str, analysis: str):
        """记录 0 挖空预警"""
        warning = {
            'slug': slug,
            'title': title,
            'category': category,
            'text_preview': text_preview,
            'analysis': analysis
        }
        self.zero_blanks_warnings.append(warning)

    def log_index_validation(self, slug: str, validations: List[dict]):
        """记录索引校验结果"""
        self.index_validations.append({
            'slug': slug,
            'validations': validations
        })

    def update_category_progress(self, category: str, total: int):
        """更新分类进度"""
        if category not in self.category_progress:
            self.category_progress[category] = {'completed': 0, 'total': 0}
        self.category_progress[category]['total'] = total

    def mark_category_complete(self, category: str):
        """标记分类完成"""
        if category in self.category_progress:
            self.category_progress[category]['complete'] = True
            self._append_to_file(f"\n#### ✅ 分类完成: {category}\n\n")
            self._append_to_file(f"- 已完成: {self.category_progress[category]['completed']}/{self.category_progress[category]['total']}\n\n")

    def _append_to_file(self, content: str):
        """追加内容到文件"""
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(content)

    def generate_summary(self):
        """生成最终总结"""
        total = len(self.batch_results)
        success = sum(1 for r in self.batch_results if r.get('status') == 'Success')
        failed = total - success
        zero_blanks = sum(1 for r in self.batch_results if r.get('new_blank_count', 0) == 0)

        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()

        # 在文件开头插入执行摘要
        summary = f"## 执行摘要\n\n"
        summary += f"| 指标 | 数值 |\n"
        summary += f"|------|------|\n"
        summary += f"| **Total Processed** | {total} |\n"
        summary += f"| **Success** | {success} ✅ |\n"
        summary += f"| **Failed** | {failed} ❌ |\n"
        summary += f"| **Zero Blanks** | {zero_blanks} ⚠️ |\n"
        summary += f"| **处理时长** | {duration:.1f} 秒 |\n"
        summary += f"| **结束时间** | {end_time.strftime('%Y-%m-%d %H:%M:%S')} |\n\n"

        # 分类进度
        summary += "### 分类进度\n\n"
        for category, progress in self.category_progress.items():
            complete_emoji = "✅" if progress.get('complete') else "⏳"
            summary += f"- {complete_emoji} **{category}**: {progress['completed']}/{progress['total']}\n"
        summary += "\n"

        summary += "---\n\n"

        # 0 挖空预警章节
        if self.zero_blanks_warnings:
            summary += "## 0 挖空预警 ⚠️\n\n"
            summary += "以下素材在新逻辑下结果为 0，需要人工审核：\n\n"

            for i, warning in enumerate(self.zero_blanks_warnings, 1):
                summary += f"### {i}. {warning['slug']}\n\n"
                summary += f"- **分类**: {warning['category']}\n"
                summary += f"- **标题**: {warning['title']}\n"
                summary += f"- **原因分析**: {warning['analysis']}\n\n"
                summary += f"**文本预览（前 200 字符）**:\n```\n"
                summary += warning['text_preview'][:200] + "\n"
                summary += "```\n\n"
            summary += "---\n\n"

        # 索引位移校验章节
        if self.index_validations:
            summary += "## 索引位移校验\n\n"
            summary += "随机抽样验证索引匹配的准确性：\n\n"

            for item in self.index_validations:
                summary += f"### {item['slug']}\n\n"
                summary += "| 单词 | 上下文 | 索引 | 状态 |\n"
                summary += "|------|--------|------|------|\n"

                for val in item['validations']:
                    emoji = "✅" if val['valid'] else "❌"
                    summary += f"| `{val['word']}` | {val['context'][:40]}... | {val['index']} | {emoji} |\n"

                summary += "\n"
            summary += "---\n\n"

        # 异常记录章节
        failed_items = [r for r in self.batch_results if r.get('status') == 'Failed']
        if failed_items:
            summary += "## 异常记录 ❌\n\n"
            summary += "以下素材处理失败：\n\n"

            for item in failed_items:
                summary += f"- **{item['slug']}**: `{item.get('error', 'Unknown error')}`\n"

            summary += "\n"
            summary += "---\n\n"

        # 批次处理详情章节标题
        summary += "## 批次处理详情\n\n"

        # 读取现有内容
        with open(self.log_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # 在文件开头插入摘要（在标题之后）
        lines = content.split('\n')
        insert_pos = 0
        for i, line in enumerate(lines):
            if line.startswith('---'):
                insert_pos = i + 2
                break

        new_content = '\n'.join(lines[:insert_pos]) + '\n\n' + summary + '\n'.join(lines[insert_pos:])

        with open(self.log_file, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"\n📊 结构化日志已生成: {self.log_file}")
        print(f"   - Total Processed: {total}")
        print(f"   - Success: {success} ✅")
        print(f"   - Failed: {failed} ❌")
        print(f"   - Zero Blanks: {zero_blanks} ⚠️")

class Logger:
    """带文件输出的日志器（用于控制台日志）"""
    def __init__(self):
        self.start_time = datetime.now()

    def info(self, msg: str, print_to_console: bool = True):
        """记录信息日志"""
        if print_to_console:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

    def success(self, msg: str, print_to_console: bool = True):
        """记录成功日志"""
        if print_to_console:
            print(f"✅ [{datetime.now().strftime('%H:%M:%S')}] {msg}")

    def warning(self, msg: str, print_to_console: bool = True):
        """记录警告日志"""
        if print_to_console:
            print(f"⚠️  [{datetime.now().strftime('%H:%M:%S')}] {msg}")

    def error(self, msg: str, print_to_console: bool = True):
        """记录错误日志"""
        if print_to_console:
            print(f"❌ [{datetime.now().strftime('%H:%M:%S')}] {msg}")

# 全局日志器
logger = Logger()
md_logger = None

# ==================== 进度管理 ====================
class ProgressManager:
    """进度管理器（支持断点续传）"""
    def __init__(self, progress_file: Path):
        self.progress_file = progress_file
        self.data = self.load()

    def load(self) -> dict:
        """加载进度文件"""
        if self.progress_file.exists():
            try:
                with open(self.progress_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {
            'started_at': None,
            'completed': [],
            'failed': [],
            'pending': [],
            'total': 0
        }

    def save(self):
        """保存进度文件"""
        with open(self.progress_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False)

    def is_completed(self, slug: str) -> bool:
        """检查素材是否已完成"""
        return slug in self.data['completed']

    def is_failed(self, slug: str) -> bool:
        """检查素材是否已失败"""
        return slug in self.data['failed']

    def mark_completed(self, slug: str):
        """标记为已完成"""
        if slug not in self.data['completed']:
            self.data['completed'].append(slug)
            if slug in self.data['pending']:
                self.data['pending'].remove(slug)
            if slug in self.data['failed']:
                self.data['failed'].remove(slug)
            self.save()

    def mark_failed(self, slug: str, error: str = ''):
        """标记为失败"""
        if slug not in self.data['failed']:
            self.data['failed'].append({'slug': slug, 'error': error, 'time': datetime.now().isoformat()})
            if slug in self.data['pending']:
                self.data['pending'].remove(slug)
            self.save()

    def set_pending(self, slugs: List[str]):
        """设置待处理列表"""
        # 过滤掉已完成的
        self.data['pending'] = [s for s in slugs if s not in self.data['completed']]
        self.data['total'] = len(slugs)
        if not self.data['started_at']:
            self.data['started_at'] = datetime.now().isoformat()
        self.save()

    def get_summary(self) -> dict:
        """获取进度摘要"""
        return {
            'total': self.data['total'],
            'completed': len(self.data['completed']),
            'failed': len(self.data['failed']),
            'pending': len(self.data['pending']),
            'started_at': self.data['started_at']
        }

# 全局进度管理器
progress_mgr = None

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
GLM_API_KEY = os.environ.get('GLM_API_KEY')

# ==================== 核心黑名单（v6.2） ====================
STRICT_BLACKLIST = [
    # ===== 代词/引导词 =====
    'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
    'that', 'which', 'who', 'this', 'these', 'those',
    'my', 'your', 'his', 'hers', 'its', 'our', 'their', 'ours', 'theirs',
    'whom', 'whose',

    # ===== 虚词/连词 =====
    'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'if',
    'when', 'where', 'while', 'since', 'until', 'unless', 'although',

    # ===== 简单介词 =====
    'in', 'on', 'at', 'to', 'of', 'for', 'with', 'by', 'from', 'about',
    'into', 'onto', 'upon', 'within', 'without', 'during', 'before', 'after',

    # ===== 基础系动词/助动词 =====
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'have', 'has', 'had', 'having',

    # ===== 🔥 v6.2 新增：感叹词（无听写训练价值） =====
    'oh', 'ah', 'hey', 'wow', 'ow', 'ew', 'uh', 'umm', 'mm', 'hmm', 'ooh',

    # ===== 纯语气词/感叹词 =====
    'yes', 'no', 'okay', 'well', 'quite',

    # ===== 低级/模糊词汇 =====
    'things', 'stuff', 'know',

    # ===== 问候语 =====
    'hello', 'hi', 'goodbye', 'bye', 'thanks', 'please',

    # ===== 常见形容词（低价值）=====
    'good', 'bad', 'big', 'small', 'right', 'wrong', 'sure', 'clear',
    'nice', 'fine', 'okay', 'alright', 'great', 'little',

    # ===== 常见动词（低价值）=====
    'say', 'says', 'said', 'tell', 'told', 'ask', 'get', 'make', 'go', 'come', 'take',
    'let', 'put', 'call', 'keep', 'give', 'find', 'show', 'hold',

    # ===== 填充语/虚词（句末或句中）=====
    'then', 'too', 'either', 'though', 'anyway', 'actually',

    # ===== 情态助动词 =====
    'can', 'could', 'would', 'should', 'may', 'might', 'must', 'shall',

    # ===== 疑问代词 =====
    'what',

    # ===== 低级认知词/填充词 =====
    'think',

    # ===== 其他 =====
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
        r"^can['']t$", r"^won['']t$", r"^don['']t$"
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
    address_words = [
        'street', 'road', 'avenue', 'boulevard', 'lane', 'drive', 'way',
        'building', 'room', 'floor', 'suite', 'apartment', 'flat',
        'north', 'south', 'east', 'west', 'central', 'city', 'town'
    ]
    if word_clean in address_words:
        return True
    return False

def is_proper_noun(word: str, sentence_text: str = '', index: int = -1) -> bool:
    """检查是否为专有名词"""
    word_clean = word.strip('.,!?;:"\'')
    if word_clean and word_clean[0].isupper() and index > 0:
        return True
    place_names = [
        'london', 'paris', 'tokyo', 'new york', 'sydney', 'moscow', 'beijing', 'shanghai',
        'america', 'american', 'britain', 'british', 'england', 'english', 'scotland', 'irish',
        'europe', 'european', 'asia', 'asian', 'africa', 'pacific', 'atlantic',
        'australia', 'australian', 'canada', 'canadian', 'india', 'indian',
        'cambridge', 'oxford', 'yale', 'harvard', 'stanford'
    ]
    if word_clean.lower() in place_names:
        return True
    institutions = [
        'cambridge', 'oxford', 'bbc', 'unesco', 'nasa', 'nato',
        'university', 'college', 'institute', 'association', 'organization'
    ]
    if word_clean.lower() in institutions:
        return True
    brands = [
        'google', 'apple', 'microsoft', 'amazon', 'facebook', 'twitter',
        'nike', 'toyota', 'honda', 'bmw', 'mercedes', 'sony', 'samsung'
    ]
    if word_clean.lower() in brands:
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

    complex_words = [
        'available', 'throughout', 'refurbishment', 'significantly',
        'particularly', 'especially', 'approximately', 'specifically',
        'automatically', 'immediately', 'successfully', 'additionally',
        'fundamental', 'intelligent', 'excellent', 'difference',
        'experience', 'important', 'environment', 'government',
        'necessary', 'unnecessary', 'essentially', 'initially',
        'eventually', 'actually', 'naturally', 'originally',
        'September', 'February', 'Wednesday', 'Saturday',
        'dictionary', 'university', 'opportunity', 'responsibility'
    ]
    if word_clean in complex_words:
        return 12

    if word_length >= 8 and word_length <= 10:
        if (not word_clean.endswith('ly') and
            word_clean not in ['something', 'anything', 'nothing', 'someone']):
            return 10
    elif word_length >= 11:
        return 11

    month_days = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ]
    if word_clean in month_days:
        return 9

    adverbs_weight_10 = [
        'massively', 'throughout', 'normally', 'extremely',
        'particularly', 'especially', 'significantly', 'considerably',
        'absolutely', 'completely', 'entirely', 'totally',
        'frequently', 'regularly', 'constantly', 'continuously',
        'relatively', 'comparatively', 'approximately',
        'ultimately', 'eventually', 'initially', 'originally',
        'effectively', 'efficiently', 'successfully'
    ]
    if word_clean in adverbs_weight_10:
        return 10
    if word_clean.endswith('ly'):
        high_quality_adverbs = [
            'rarely', 'merely', 'barely', 'hardly', 'scarcely',
            'recently', 'currently', 'previously', 'formerly',
            'primarily', 'mainly', 'chiefly', 'largely'
        ]
        if word_clean in high_quality_adverbs:
            return 10
        else:
            return 9

    if (word_clean.endswith('ing') or
        (word_clean.endswith('ed') and not word_clean.endswith('ted') and not word_clean.endswith('ded'))):
        basic_verbs = ['going', 'doing', 'getting', 'using', 'making', 'taking', 'seeing']
        if word_clean not in basic_verbs:
            return 9

    advanced_verbs = [
        'refurbishment', 'thriving', 'indicates', 'stolen', 'support',
        'offer', 'maintain', 'consume', 'cultivate', 'harvest',
        'demonstrate', 'illustrate', 'establish', 'implement',
        'organise', 'organising', 'organised', 'expect', 'expecting', 'expected',
        'call', 'calling', 'called'
    ]
    if any(root in word_clean for root in advanced_verbs):
        return 9

    professional_verbs = [
        'help', 'pay', 'join', 'choose', 'chose', 'decide', 'decided',
        'manage', 'managed', 'control', 'controlled', 'check', 'checked',
        'book', 'booked', 'order', 'ordered', 'reserve', 'reserved'
    ]
    if word_clean in professional_verbs:
        return 9

    if (word_clean.endswith('er') or word_clean.endswith('est') or
        word_clean.endswith('ier') or word_clean.endswith('iest')):
        return 8

    if (word_clean.endswith('ive') or word_clean.endswith('ous') or
          word_clean.endswith('ent') or word_clean.endswith('ant')):
        descriptive_adjs = [
            'significant', 'beneficial', 'essential', 'effective',
            'important', 'relevant', 'different', 'various'
        ]
        if word_clean in descriptive_adjs:
            return 8

    descriptive_adjs_v51 = [
        'serious', 'popular', 'possible', 'available', 'responsible',
        'necessary', 'expensive', 'cheap', 'free', 'full', 'empty',
        'short', 'long', 'high', 'low', 'hard', 'soft', 'heavy', 'light',
        'dark', 'bright', 'cold', 'warm', 'hot', 'cool', 'dry', 'wet'
    ]
    if word_clean in descriptive_adjs_v51:
        return 8

    if (word_clean.endswith('ment') or word_clean.endswith('ments') or
          word_clean.endswith('tion') or word_clean.endswith('tions') or
          word_clean.endswith('ness') or word_clean.endswith('nesses') or
          word_clean.endswith('ity') or word_clean.endswith('ities') or
          word_clean.endswith('ence') or word_clean.endswith('ences') or
          word_clean.endswith('ance') or word_clean.endswith('ances') or
          word_clean.endswith('dom') or word_clean.endswith('ship') or
          word_clean.endswith('ships') or word_clean.endswith('ism') or
          word_clean.endswith('ist') or word_clean.endswith('ists')):
        return 5

    common_nouns = [
        'room', 'rooms', 'hall', 'halls', 'hotel', 'hotels', 'club', 'clubs',
        'company', 'companies', 'conference', 'conferences',
        'manager', 'managers', 'secretary', 'secretaries', 'member', 'members',
        'audience', 'customer', 'customers', 'service', 'services',
        'product', 'products', 'facility', 'facilities', 'space', 'spaces',
        'place', 'places', 'area', 'areas', 'person', 'people'
    ]
    if word_clean in common_nouns:
        return 5

    return 6

def is_valid_single_word(word: str) -> bool:
    """检查是否为有效的单个词"""
    word_clean = word.strip('.,!?;:"\'')
    return ' ' not in word_clean

# ==================== GLM-4 挖空词识别 ====================
BLANKS_PROMPT = """你是一位英语教学专家，专注于设计**语言习得导向**的高质量词汇训练内容。

**核心目标**：通过挖空训练，帮助学习者内化【高价值表达】、【逻辑连接】和【具象动作】。

**权重系统**（按优先级排序）：
1. **【权重 10】程度、逻辑与频率副词** (40%)
2. **【权重 9】高级/具象动词** (30%)
3. **【权重 8】比较级/最高级与描述性形容词** (20%)
4. **【权重 7】固定搭配中的语义重心** (10%)

**严禁挖空的词类**：
1. **纯语气词/感叹词**：Yes, No, Okay, Well
2. **功能性缩写/代词**：You're, It's, That's
3. **低级/模糊词汇**：things, stuff, get, use
4. **事实词**：数字、日期、价格、地址
5. **专有名词**：人名、地名、机构名
6. **基础黑名单**：代词、虚词、介词、系动词

**全局去重规则**：
- **同一单词在整个素材中最多挖空1次**

**保底机制**：
- **每一句必须至少有一个候选词**

**输出格式**（JSON）：
{
  "candidates": [
    {"word": "候选词", "index": 位置, "reason": "权重X:理由"}
  ]
}

输入: {sentence}
输出:"""

def generate_blank_for_sentence(sentence_text: str, blanked_words: dict = None) -> Optional[Dict]:
    """为单个句子生成挖空（v6.2）"""
    if blanked_words is None:
        blanked_words = {}

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
                    {"role": "system", "content": BLANKS_PROMPT},
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

            try:
                data = json.loads(content)
            except:
                return fallback_blank_selection_v5(sentence_text, blanked_words)

            if 'candidates' not in data:
                return fallback_blank_selection_v5(sentence_text, blanked_words)

            candidates = data['candidates']

            if not candidates or len(candidates) == 0:
                return fallback_blank_selection_v5(sentence_text, blanked_words)

            best_candidate = None
            best_weight = -1

            for candidate in candidates:
                word = candidate.get('word', '')
                index = candidate.get('index', -1)

                if not is_valid_single_word(word):
                    continue

                words = sentence_text.split()
                if index < 0 or index >= len(words):
                    continue

                word_at_index = words[index].strip('.,!?;:"\'').lower()
                if word_at_index != word.lower():
                    actual_index = -1
                    for i, w in enumerate(words):
                        if w.strip('.,!?;:"\'').lower() == word.lower():
                            actual_index = i
                            break

                    if actual_index >= 0:
                        index = actual_index
                    else:
                        continue

                if should_skip_word(word, sentence_text, index):
                    continue

                word_lower = word.lower()
                if blanked_words.get(word_lower, 0) >= 1:
                    continue

                weight = calculate_word_weight(word, sentence_text, index)
                if weight > best_weight:
                    best_weight = weight
                    best_candidate = {
                        "word": word,
                        "index": index,
                        "pos": candidate.get('reason', '')[:30],
                        "is_core": True,
                        "weight": weight
                    }

            if best_candidate:
                return best_candidate

            return fallback_blank_selection_v5(sentence_text, blanked_words)

    except Exception as e:
        return fallback_blank_selection_v5(sentence_text, blanked_words)

def fallback_blank_selection_v5(sentence_text: str, blanked_words: dict) -> Optional[Dict]:
    """保底机制：使用权重系统选择挖空词（v6.2）"""
    words = sentence_text.split()

    candidates_with_weights = []

    for i, word in enumerate(words):
        word_clean = word.lower().strip('.,!?;:"\'')
        if blanked_words.get(word_clean, 0) >= 1:
            continue

        if should_skip_word(word, sentence_text, i):
            continue

        weight = calculate_word_weight(word, sentence_text, i)
        if weight > 0:
            word_clean_no_punct = word.strip('.,!?;:"\'')
            candidates_with_weights.append((weight, i, word_clean_no_punct))

    if candidates_with_weights:
        # 🔥 v6.2 新增：权重相同时，优先选择索引更大、更长的词
        candidates_with_weights.sort(key=lambda x: (-x[0], x[1], -len(x[2])))
        weight, index, word = candidates_with_weights[0]

        return {
            "word": word.strip('.,!?;:"\''),
            "index": index,
            "pos": f"权重{weight}",
            "is_core": False,
            "weight": weight
        }

    return None

def validate_index_match(transcript: List[dict], num_samples: int = 3) -> List[dict]:
    """验证索引匹配准确性（随机抽样）"""
    validations = []

    # 找到有 blanks 的句子
    sentences_with_blanks = [s for s in transcript if s.get('blanks') and len(s['blanks']) > 0]

    if not sentences_with_blanks:
        return validations

    # 随机抽样
    samples = random.sample(sentences_with_blanks, min(num_samples, len(sentences_with_blanks)))

    for sentence in samples:
        text = sentence.get('text', '')
        blanks = sentence.get('blanks', [])

        if not blanks:
            continue

        blank = blanks[0]
        word = blank.get('word', '')
        index = blank.get('index', -1)

        words = text.split()

        # 验证索引
        if 0 <= index < len(words):
            word_at_index = words[index].strip('.,!?;:"\'').lower()
            is_valid = word_at_index == word.lower()

            # 获取上下文
            context_start = max(0, index - 3)
            context_end = min(len(words), index + 4)
            context = ' '.join(words[context_start:context_end])

            validations.append({
                'word': word,
                'index': index,
                'word_at_index': word_at_index,
                'context': context,
                'valid': is_valid
            })

    return validations

def analyze_zero_blanks(text: str) -> str:
    """分析 0 挖空的原因"""
    words = text.split()

    # 统计各类词的数量
    blacklisted_count = 0
    fact_word_count = 0
    proper_noun_count = 0
    contraction_count = 0

    for i, word in enumerate(words):
        if is_blacklisted(word):
            blacklisted_count += 1
        elif is_contraction(word):
            contraction_count += 1
        elif is_fact_word(word):
            fact_word_count += 1
        elif is_proper_noun(word, text, i):
            proper_noun_count += 1

    total = len(words)
    skipped = blacklisted_count + fact_word_count + proper_noun_count + contraction_count

    if skipped == total:
        return "所有单词都在黑名单中（黑名单过严或纯事实词素材）"
    elif skipped > total * 0.8:
        return f"80%以上单词被跳过：黑名单({blacklisted_count}) + 事实词({fact_word_count}) + 专有名词({proper_noun_count}) + 缩写({contraction_count})"
    else:
        return "索引匹配失败或其他原因"

def process_material(slug: str, client, skip_if_completed: bool = True, validate_index: bool = True) -> dict:
    """处理单个素材的挖空

    Returns:
        处理结果字典
    """
    result = {
        'slug': slug,
        'status': 'Failed',
        'error': None,
        'stats': None,
        'old_blank_count': 0,
        'new_blank_count': 0,
        'category': 'Unknown',
        'title': 'Unknown'
    }

    # 检查是否已完成
    if skip_if_completed and progress_mgr.is_completed(slug):
        logger.info(f"  跳过（已完成）: {slug}", print_to_console=False)
        result['status'] = 'Success'
        result['skipped'] = True
        return result

    try:
        # 获取素材
        query_result = client.table('materials').select('*').eq('slug', slug).execute()

        if not query_result.data:
            logger.error(f"  素材不存在: {slug}")
            result['error'] = '素材不存在'
            progress_mgr.mark_failed(slug, '素材不存在')
            return result

        material = query_result.data[0]
        transcript = material.get('transcript')
        if isinstance(transcript, str):
            transcript = json.loads(transcript)

        result['title'] = material.get('title', 'Unknown')
        result['category'] = material.get('category', 'Unknown')

        # 统计原挖空数
        old_blank_count = 0
        for s in transcript:
            if s.get('blanks') and len(s.get('blanks', [])) > 0:
                old_blank_count += len(s['blanks'])
        result['old_blank_count'] = old_blank_count

        logger.info(f"  处理: {material['title']}")

        # 统计
        success_count = 0
        skip_count = 0
        weight_stats = {10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0}
        blanked_words = {}

        # 为每个句子生成挖空
        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            blank_data = generate_blank_for_sentence(sentence_text, blanked_words)

            if blank_data:
                sentence['blanks'] = [blank_data]

                word_lower = blank_data['word'].lower()
                blanked_words[word_lower] = blanked_words.get(word_lower, 0) + 1

                weight = blank_data.get('weight', 0)
                if weight in weight_stats:
                    weight_stats[weight] += 1

                success_count += 1
            else:
                sentence['blanks'] = []
                skip_count += 1

            if (i + 1) % 10 == 0:
                logger.info(f"    进度: {i+1}/{len(transcript)}")

            time.sleep(0.5)

        result['new_blank_count'] = success_count
        result['stats'] = {
            'total': len(transcript),
            'success': success_count,
            'skip': skip_count,
            'weights': weight_stats
        }

        logger.info(f"  ✓ 完成: 成功 {success_count}, 跳过 {skip_count}")

        # 保存到数据库
        client.table('materials').update({
            'transcript': transcript
        }).eq('slug', slug).execute()

        logger.success(f"  ✅ 已保存: {slug}")

        result['status'] = 'Success'

        # 0 挖空预警
        if success_count == 0:
            # 获取文本预览（前 200 字符）
            text_preview = ' '.join([s.get('text', '') for s in transcript[:3]])
            analysis = analyze_zero_blanks(text_preview)

            md_logger.log_zero_blank_warning(slug, material['title'], result['category'], text_preview, analysis)
            logger.warning(f"  ⚠️  0 挖空预警: {analysis}")

        # 索引校验（每 10 个素材做一次）
        if validate_index and success_count > 0:
            validations = validate_index_match(transcript, num_samples=3)
            if validations:
                md_logger.log_index_validation(slug, validations)

        progress_mgr.mark_completed(slug)

    except Exception as e:
        error_msg = str(e)
        logger.error(f"  ❌ 失败: {slug} - {error_msg}")
        result['error'] = error_msg
        progress_mgr.mark_failed(slug, error_msg)

    return result

def print_summary():
    """打印进度摘要"""
    summary = progress_mgr.get_summary()

    print("\n" + "="*70)
    print("  批量处理进度摘要")
    print("="*70)
    print(f"总数: {summary['total']}")
    print(f"已完成: {summary['completed']} ✅")
    print(f"失败: {summary['failed']} ❌")
    print(f"待处理: {summary['pending']} ⏳")
    print(f"开始时间: {summary['started_at']}")
    print("="*70)

    if summary['failed'] > 0:
        print("\n失败的素材：")
        for item in progress_mgr.data['failed']:
            print(f"  - {item['slug']}: {item.get('error', 'Unknown error')}")
        print()

def group_by_category(slugs: List[str], client) -> Dict[str, List[str]]:
    """按分类分组素材"""
    categories = {}

    for slug in slugs:
        try:
            result = client.table('materials').select('slug, category').eq('slug', slug).execute()
            if result.data:
                category = result.data[0].get('category', 'Unknown')
                if category not in categories:
                    categories[category] = []
                categories[category].append(slug)
        except:
            categories['Unknown'] = categories.get('Unknown', []) + [slug]

    return categories

def main():
    global logger, md_logger, progress_mgr

    parser = argparse.ArgumentParser(description='批量重新处理雅思素材挖空 v6.2（增强版日志）')
    parser.add_argument('--slug', help='处理单个素材')
    parser.add_argument('--batch', help='批量处理文件（每行一个 slug）')
    parser.add_argument('--resume', action='store_true', help='继续未完成的任务')
    parser.add_argument('--force', action='store_true', help='强制重新处理（忽略已完成标记）')

    args = parser.parse_args()

    # 初始化日志器
    md_logger = MarkdownLogger(MARKDOWN_LOG_FILE)
    logger.info(f"日志文件: {MARKDOWN_LOG_FILE}")
    logger.info(f"进度文件: {PROGRESS_FILE}")

    # 初始化进度管理器
    progress_mgr = ProgressManager(PROGRESS_FILE)

    # 创建 Supabase 客户端
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    slugs_to_process = []

    if args.slug:
        slugs_to_process = [args.slug]
        logger.info(f"模式: 单个素材处理")
        logger.info(f"素材: {args.slug}")

    elif args.batch:
        batch_file = Path(args.batch)
        if not batch_file.exists():
            logger.error(f"批量文件不存在: {batch_file}")
            sys.exit(1)

        with open(batch_file) as f:
            all_slugs = [line.strip() for line in f if line.strip()]

        if args.resume:
            completed = set(progress_mgr.data['completed'])
            slugs_to_process = [s for s in all_slugs if s not in completed]
            logger.info(f"模式: 继续未完成的任务")
            logger.info(f"总素材: {len(all_slugs)}, 已完成: {len(completed)}, 待处理: {len(slugs_to_process)}")
        else:
            slugs_to_process = all_slugs
            logger.info(f"模式: 批量处理")
            logger.info(f"素材数量: {len(slugs_to_process)}")

        progress_mgr.set_pending(all_slugs)

    elif args.resume:
        slugs_to_process = progress_mgr.data['pending'].copy()
        logger.info(f"模式: 继续未完成的任务")
        logger.info(f"待处理数量: {len(slugs_to_process)}")

        if not slugs_to_process:
            logger.info("没有待处理的任务")
            print_summary()
            return

    else:
        logger.error("请指定 --slug, --batch 或 --resume 参数")
        parser.print_help()
        sys.exit(1)

    # 按分类分组
    logger.info(f"\n按分类分组...")
    categories = group_by_category(slugs_to_process, client)

    for category, category_slugs in categories.items():
        md_logger.update_category_progress(category, len(category_slugs))

    print("="*70)
    print(f"  批量重新挖空 - v6.2 语言习得导向")
    print("="*70)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    print()

    # 按分类处理
    for category, category_slugs in categories.items():
        print(f"\n📂 处理分类: {category} ({len(category_slugs)} 个素材)")
        print("-"*70)

        for i, slug in enumerate(category_slugs, 1):
            logger.info(f"[{i}/{len(category_slugs)}] {slug}")

            result = process_material(slug, client, skip_if_completed=not args.force)

            # 记录到 Markdown 日志
            md_logger.log_batch_result(result)

            print("-"*70)

        # 标记分类完成
        md_logger.mark_category_complete(category)

    # 生成最终总结
    md_logger.generate_summary()

    print_summary()

if __name__ == '__main__':
    main()
