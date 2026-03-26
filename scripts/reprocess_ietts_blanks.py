#!/usr/bin/env python3
"""
重新处理雅思素材挖空逻辑 v5.3
剔除高价值事实词、专有名词、纯逻辑连接词
新增情态助动词、疑问代词、低级认知词黑名单
实现语言习得导向的本地评分算法

特点：
1. 剔除高价值事实词（数字、日期、价格、地址）
2. 剔除专有名词（人名、地名、机构名、品牌名）
3. 剔除纯逻辑连接词（although, however, moreover, therefore 等）
4. 使用 should_skip_word() 综合判断函数
5. GLM Prompt 明确禁止挖空这些词类
6. v5.0-v5.3 新增：纯语气词、问候语、常见形容词/动词、填充语、情态助动词等
7. 🔥 v5.3 新增：语言习得导向评分算法（长单词提权、音节复杂度加成）

语言习得导向评分算法（v5.3）：
- 词长权重（0-30分）：10+字母30分，8-9字母25分，6-7字母15分
- 音节复杂度（0-30分）：4+音节30分，3音节20分，2音节10分
- 词性权重（0-20分）：形容词/副词20分，动词15分，名词10分
- 稀有度加成（0-10分）：长单词且非常用词加分
- 特殊词汇（0-10分）：月份、星期、学科术语加分

版本历史：
- v5.3 (2026-03-26): 新增情态助动词、疑问代词、低级认知词/填充词 + 语言习得导向评分算法
- v5.2 (2026-03-25): 新增填充语/虚词（then, too, either, though, anyway, actually）
- v5.1 (2026-03-25): 新增问候语、常见形容词、常见动词
- v5.0 (2026-03-25): 新增纯语气词/感叹词、低级/模糊词汇
- v4.0 (2026-03-25): 剔除事实词、专有名词、逻辑连接词
- v2.3 (2026-03-25): 多候选词方案，提高挖空成功率
"""
import os
import json
import requests
import time
from pathlib import Path
from supabase import create_client

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

# ==================== 核心黑名单 ====================
STRICT_BLACKLIST = [
    # ===== 代词/引导词 =====
    'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
    'that', 'which', 'who', 'this', 'these', 'those', 'what',
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

    # ===== 🔥 v5.0 新增：纯语气词/感叹词 =====
    'yes', 'no', 'okay', 'well', 'quite',

    # ===== 🔥 v5.0 新增：低级/模糊词汇 =====
    'things', 'stuff', 'know',

    # ===== 🔥 v5.1 新增：问候语 =====
    'hello', 'hi', 'hey', 'goodbye', 'bye', 'thanks', 'please',

    # ===== 🔥 v5.1 新增：常见形容词（低价值）=====
    'good', 'bad', 'big', 'small', 'right', 'wrong', 'sure', 'clear',
    'nice', 'fine', 'okay', 'alright', 'great', 'little',

    # ===== 🔥 v5.1 新增：常见动词（低价值）=====
    'say', 'says', 'said', 'tell', 'told', 'ask', 'get', 'make', 'go', 'come', 'take',
    'let', 'put', 'call', 'keep', 'give', 'find', 'show', 'hold',

    # ===== 🔥 v5.2 新增：填充语/虚词（句末或句中）=====
    'then', 'too', 'either', 'though', 'anyway', 'actually',

    # ===== 🔥 v5.3 新增：情态助动词 =====
    'can', 'could', 'would', 'should', 'may', 'might', 'must', 'shall',

    # ===== 🔥 v5.3 新增：疑问代词 =====
    'what',

    # ===== 🔥 v5.3 新增：低级认知词/填充词 =====
    'think', 'uh', 'hmm', 'um',

    # ===== 其他 =====
    'there', 'here', 'just', 'really', 'very'
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
        'nike', 'toyota', 'honda', 'bmw', 'mercedes', 'sony', 'samsung'
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

def log(msg: str):
    """简化日志输出"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

# ==================== GLM-4 挖空词识别 ====================
BLANKS_PROMPT = """你是一位英语教学专家，专注于设计高质量的词汇训练内容。

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
输出:"""


def generate_blank_for_sentence(sentence_text: str, blanked_words: dict = None, digit_count: int = 0, digit_limit: int = 2) -> dict:
    """为单个句子生成挖空（v4.0：剔除事实词、专有名词、逻辑连接词）

    Args:
        sentence_text: 句子文本
        blanked_words: 已挖空单词的计数器 {word: count}
        digit_count: 当前已挖空的数字数量（已弃用，保留兼容性）
        digit_limit: 数字挖空限制（已弃用，保留兼容性）
    """
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

            # 解析 JSON
            try:
                data = json.loads(content)
            except:
                # 🔥 保底机制：如果 GLM 返回失败，使用本地算法
                return fallback_blank_selection(sentence_text, blanked_words)

            # 检查是否有 candidates 字段
            if 'candidates' not in data:
                # 🔥 保底机制：使用本地算法
                return fallback_blank_selection(sentence_text, blanked_words)

            candidates = data['candidates']

            if not candidates or len(candidates) == 0:
                # 🔥 保底机制：使用本地算法
                return fallback_blank_selection(sentence_text, blanked_words)

            # 🔥 v4: 遍历候选词，应用所有过滤规则（包括事实词和专有名词）
            for candidate in candidates:
                word = candidate.get('word', '')
                index = candidate.get('index', -1)

                # 🔴 v4.1: 验证是否为单个词（不能是短语）
                if not is_valid_single_word(word):
                    continue

                # 验证
                words = sentence_text.split()
                if index < 0 or index >= len(words):
                    continue

                # 🔴 v4: 使用 should_skip_word 综合判断
                if should_skip_word(word, sentence_text, index):
                    continue

                # 🔴 全局去重：同一单词最多挖空1次（绝不重复）
                word_lower = word.lower()
                if blanked_words.get(word_lower, 0) >= 1:
                    continue

                # 找到了有效的候选词
                return {
                    "word": word,
                    "index": index,
                    "pos": candidate.get('reason', '')[:30],
                    "is_core": True
                }

            # 🔥 保底机制：所有候选词都不符合条件，使用本地算法
            return fallback_blank_selection(sentence_text, blanked_words, digit_count, digit_limit)

    except Exception as e:
        # 🔥 保底机制：发生错误，使用本地算法
        return fallback_blank_selection(sentence_text, blanked_words, digit_count, digit_limit)

def count_syllables(word: str) -> int:
    """估算单词的音节数量

    Args:
        word: 单词

    Returns:
        音节数量
    """
    word_clean = word.lower().strip('.,!?;:"\'')

    # 特殊规则
    if word_clean.endswith('e'):
        word_clean = word_clean[:-1]  # 词尾 e 不发音

    # 计算元音数量
    vowels = 'aeiouy'
    syllable_count = 0
    prev_was_vowel = False

    for char in word_clean:
        is_vowel = char in vowels
        if is_vowel and not prev_was_vowel:
            syllable_count += 1
        prev_was_vowel = is_vowel

    # 至少1个音节
    return max(1, syllable_count)

def is_comparative_superlative(word: str) -> bool:
    """检测是否为比较级或最高级形容词

    Args:
        word: 单词

    Returns:
        是否为比较级/最高级
    """
    word_clean = word.lower().strip('.,!?;:"\'')

    # 比较级后缀
    comparative_suffixes = ['er', 'ier', 'more', 'less']
    # 最高级后缀
    superlative_suffixes = ['est', 'iest', 'most', 'least']

    for suffix in comparative_suffixes:
        if word_clean.endswith(suffix):
            return True

    for suffix in superlative_suffixes:
        if word_clean.endswith(suffix):
            return True

    return False

def is_degree_adverb(word: str) -> bool:
    """检测是否为程度/逻辑副词（权重10的词汇）

    Args:
        word: 单词

    Returns:
        是否为程度副词
    """
    word_clean = word.lower().strip('.,!?;:"\'')

    # 常见程度副词（高价值）
    degree_adverbs = {
        'massively', 'extremely', 'incredibly', 'absolutely', 'completely',
        'totally', 'utterly', 'quite', 'rather', 'somewhat', 'fairly',
        'throughout', 'normally', 'typically', 'generally', 'usually',
        'frequently', 'occasionally', 'rarely', 'scarcely', 'barely',
        'hardly', 'merely', 'simply', 'purely', 'clearly', 'obviously',
        'certainly', 'definitely', 'probably', 'possibly', 'hopefully',
        'fortunately', 'unfortunately', 'surprisingly', 'amazingly'
    }

    return word_clean in degree_adverbs

def is_collocation_core(word: str, index: int, words: list) -> bool:
    """检测是否为固定搭配的语义核心词（权重7）

    Args:
        word: 单词
        index: 单词在句子中的位置
        words: 句子所有单词列表

    Returns:
        是否为固定搭配核心词
    """
    word_clean = word.lower().strip('.,!?;:"\'')

    # 常见固定搭配词库（动词+名词/形容词）
    collocations = {
        # 动词 + 名词/形容词
        'go': ['wrong', 'ahead', 'on', 'back', 'through', 'down', 'up'],
        'get': ['ready', 'lost', 'better', 'worse', 'started', 'married', 'familiar'],
        'make': ['sure', 'clear', 'sense', 'progress', 'mistake', 'decision', 'difference'],
        'take': ['place', 'care', 'part', 'action', 'advantage', 'responsibility'],
        'give': ['up', 'in', 'way', 'birth', 'advice', 'example', 'chance'],
        'have': ['fun', 'trouble', 'doubt', 'chance', 'opportunity', 'effect', 'impact'],
        'do': ['business', 'homework', 'exercise', 'damage', 'harm', 'good', 'best'],
        'keep': ['silent', 'calm', 'safe', 'warm', 'cool', 'clean', 'touch'],
        'feel': ['free', 'better', 'worse', 'comfortable', 'relaxed', 'happy', 'sad'],
        'deal': ['with', 'in', 'on', 'off'],
        'look': ['forward', 'back', 'after', 'for', 'at', 'into', 'upon'],
        'put': ['on', 'off', 'away', 'aside', 'together', 'forward', 'back'],
        'set': ['up', 'down', 'off', 'out', 'aside', 'apart', 'forth'],
        'break': ['down', 'up', 'out', 'off', 'through', 'into'],
        'bring': ['up', 'down', 'out', 'forward', 'back', 'about'],
        'come': ['up', 'down', 'out', 'in', 'back', 'across', 'along', 'through'],
        'hold': ['on', 'up', 'back', 'down', 'off', 'out'],
        'turn': ['on', 'off', 'up', 'down', 'out', 'over', 'around', 'into'],
        'run': ['out', 'away', 'into', 'through', 'over', 'across'],
        'fall': ['down', 'off', 'out', 'back', 'apart', 'into', 'through'],
        'carry': ['on', 'out', 'away', 'back', 'forward', 'through'],
        'call': ['off', 'on', 'up', 'down', 'out', 'back'],
        'catch': ['up', 'on', 'out', 'fire'],
        'pay': ['attention', 'respect', 'tribute', 'visit', 'homage'],
        'take': ['place', 'part', 'care', 'note', 'action', 'measure', 'step'],
        'make': ['progress', 'sense', 'difference', 'decision', 'choice', 'mistake', 'effort', 'attempt'],
        'keep': ['touch', 'contact', 'silence', 'quiet', 'calm', 'control'],
        'lose': ['control', 'touch', 'interest', 'faith', 'hope', 'patience', 'sight'],
        'gain': ['access', 'experience', 'knowledge', 'insight', 'understanding', 'momentum'],
        'draw': ['attention', 'conclusion', 'inference', 'distinction'],
        'pay': ['attention'],
    }

    # 检查当前词是否在某个搭配中
    if word_clean in collocations:
        # 检查前后词是否能形成搭配
        partners = collocations[word_clean]

        # 检查前一个词
        if index > 0:
            prev_word = words[index - 1].lower().strip('.,!?;:"\''')
            if prev_word in partners:
                return True  # 找到搭配，当前词是核心词

        # 检查后一个词
        if index < len(words) - 1:
            next_word = words[index + 1].lower().strip('.,!?;:"\'')

            if next_word in partners:
                return True  # 找到搭配，当前词是核心词

    return False

def calculate_word_score(word: str, index: int = 0, sentence_text: str = "") -> float:
    """计算单词的学习价值分数（语言习得导向）

    评分维度（总分 120）：
    1. 词长权重（0-30分）：长单词提权
    2. 音节复杂度（0-30分）：音节越多分数越高
    3. 词性权重（0-20分）：形容词/副词 > 动词 > 名词
    4. 稀有度加成（0-10分）：非常用词额外加分
    5. 特殊词汇（0-10分）：月份、星期、学科术语
    6. 比较级/最高级加成（0-10分）：-er, -est 等后缀
    7. 程度副词加成（0-10分）：extremely, massively 等
    8. 固定搭配核心词（0-10分）：go wrong, deal with 等

    Args:
        word: 待评分的单词
        index: 单词在句子中的位置
        sentence_text: 完整句子

    Returns:
        学习价值分数 (0-120)
    """
    word_clean = word.lower().strip('.,!?;:"\'')
    score = 0.0
    words = sentence_text.split()

    # ===== 维度1：词长权重（0-30分）=====
    word_length = len(word_clean)
    if word_length >= 10:
        score += 30
    elif word_length >= 8:
        score += 25
    elif word_length >= 6:
        score += 15
    elif word_length >= 4:
        score += 5
    # 1-3字母：0分

    # ===== 维度2：音节复杂度（0-30分）=====
    syllables = count_syllables(word_clean)
    if syllables >= 4:
        score += 30
    elif syllables == 3:
        score += 20
    elif syllables == 2:
        score += 10
    # 1音节：0分

    # ===== 维度3：词性权重（0-20分）=====
    # 通过后缀判断词性
    if word_clean.endswith('ly'):
        # 副词
        score += 20
    elif word_clean.endswith('ive') or word_clean.endswith('ous') or word_clean.endswith('ent') or \
         word_clean.endswith('able') or word_clean.endswith('ible') or word_clean.endswith('ful'):
        # 形容词
        score += 20
    elif word_clean.endswith('ing') or word_clean.endswith('ed'):
        # 动词分词
        score += 15
    elif word_clean.endswith('ment') or word_clean.endswith('tion') or word_clean.endswith('ness') or \
         word_clean.endswith('ity') or word_clean.endswith('ance') or word_clean.endswith('ence'):
        # 名词后缀
        score += 10
    else:
        # 默认基础分
        score += 5

    # ===== 维度4：稀有度加成（0-10分）=====
    # 长单词且不在常见词列表中
    common_words = {'get', 'make', 'go', 'come', 'take', 'see', 'know', 'think', 'look', 'want',
                    'give', 'find', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave', 'call'}
    if word_length >= 7 and word_clean not in common_words:
        score += 10
    elif word_length >= 5 and word_clean not in common_words:
        score += 5

    # ===== 维度5：特殊词汇（0-10分）=====
    # 月份、星期
    months = {'january', 'february', 'march', 'april', 'may', 'june',
              'july', 'august', 'september', 'october', 'november', 'december'}
    weekdays = {'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'}

    if word_clean in months or word_clean in weekdays:
        score += 10

    # 学科术语（示例列表）
    academic_terms = {'economy', 'biology', 'chemistry', 'physics', 'history', 'geography',
                      'mathematics', 'science', 'technology', 'engineering', 'literature'}
    if word_clean in academic_terms:
        score += 10

    # ===== 维度6：比较级/最高级加成（0-10分）=====
    if is_comparative_superlative(word):
        score += 10

    # ===== 维度7：程度副词加成（0-10分）=====
    if is_degree_adverb(word):
        score += 10

    # ===== 维度8：固定搭配核心词（0-10分）=====
    if is_collocation_core(word, index, words):
        score += 10

    return score

def fallback_blank_selection(sentence_text: str, blanked_words: dict, digit_count: int = 0, digit_limit: int = 2) -> dict:
    """保底机制：使用语言习得导向算法选择挖空词（v5.3）

    评分策略：
    1. 计算每个词的学习价值分数（词长、音节、词性、稀有度）
    2. 过滤黑名单词、重复词、事实词、专有名词
    3. 选择分数最高的词

    Args:
        sentence_text: 句子文本
        blanked_words: 已挖空单词的计数器
        digit_count: 当前已挖空的数字数量（已弃用，保留兼容性）
        digit_limit: 数字挖空限制（已弃用，保留兼容性）

    Returns:
        挖空数据或None
    """
    words = sentence_text.split()
    scored_words = []

    for i, word in enumerate(words):
        word_clean = word.lower().strip('.,!?;:"\'')

        # 跳过空字符串
        if not word_clean:
            continue

        # 🔴 使用 should_skip_word 综合判断（黑名单、事实词、专有名词等）
        if should_skip_word(word, sentence_text, i):
            continue

        # 跳过已挖1次的词（绝不重复）
        if blanked_words.get(word_clean, 0) >= 1:
            continue

        # 计算学习价值分数
        score = calculate_word_score(word, i, sentence_text)

        scored_words.append({
            'index': i,
            'word': word.strip('.,!?;:"\''),
            'score': score
        })

    # 按分数降序排序
    scored_words.sort(key=lambda x: x['score'], reverse=True)

    # 返回分数最高的词
    if scored_words:
        best = scored_words[0]
        # 推断词性（用于显示）
        word_clean = best['word'].lower()
        if word_clean.endswith('ing'):
            pos = 'VBG'
        elif word_clean.endswith('ed'):
            pos = 'VBD'
        elif word_clean.endswith('ly'):
            pos = 'RB'
        elif word_clean.endswith('ment') or word_clean.endswith('tion'):
            pos = 'NN'
        elif word_clean.endswith('ive') or word_clean.endswith('ous'):
            pos = 'JJ'
        else:
            pos = 'NN'

        return {
            "word": best['word'],
            "index": best['index'],
            "pos": pos,
            "is_core": False,
            "score": best['score']  # 调试用
        }

    # 如果没有合适的词，返回 None（允许不挖空）
    return None

def process_material(slug: str) -> bool:
    """处理单个素材的挖空"""
    try:
        # 获取素材
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        result = client.table('materials').select('*').eq('slug', slug).execute()

        if not result.data:
            log(f"  ❌ 素材不存在: {slug}")
            return False

        material = result.data[0]
        transcript = material.get('transcript')
        if isinstance(transcript, str):
            transcript = json.loads(transcript)

        log(f"  处理: {material['title']}")
        log(f"  句子数: {len(transcript)}")

        # 统计
        success_count = 0
        skip_count = 0
        blanked_words = {}  # 🔥 全局去重：记录已挖空的单词（绝不重复）
        digit_count = 0     # 🔥 事实词计数器：仅用于统计

        # 为每个句子生成挖空
        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            blank_data = generate_blank_for_sentence(sentence_text, blanked_words, digit_count, digit_limit=2)

            if blank_data:
                sentence['blanks'] = [blank_data]
                # 🔥 更新全局计数
                word_lower = blank_data['word'].lower()
                blanked_words[word_lower] = blanked_words.get(word_lower, 0) + 1

                # 🔥 更新事实词计数（用于统计）
                if is_fact_word(blank_data['word']):
                    digit_count += 1

                success_count += 1
            else:
                sentence['blanks'] = []
                skip_count += 1

            if (i + 1) % 5 == 0:
                log(f"    进度: {i+1}/{len(transcript)}")

            time.sleep(0.5)

        log(f"  ✓ 完成: 成功 {success_count}, 跳过 {skip_count}")

        # 保存到数据库
        client.table('materials').update({
            'transcript': transcript
        }).eq('slug', slug).execute()

        log(f"  ✅ 已保存")
        return True

    except Exception as e:
        log(f"  ❌ 失败: {e}")
        return False

def main():
    # 读取素材列表
    cam_file = Path('/tmp/cam13_14_all.txt')  # Cam 13/14 所有素材

    if not cam_file.exists():
        log(f"错误: 素材列表不存在: {cam_file}")
        log("请先运行查询脚本生成素材列表")
        return

    with open(cam_file) as f:
        slugs = [line.strip() for line in f if line.strip()]

    if not slugs:
        log("错误: 素材列表为空")
        return

    print("="*70)
    print("  批量重新挖空 - Cam 13/14 素材")
    print("="*70)
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"总数: {len(slugs)} 个素材")
    print("="*70)

    # 统计
    success_count = 0
    fail_count = 0

    # 处理每个素材
    for i, slug in enumerate(slugs, 1):
        log(f"\n[{i}/{len(slugs)}] {slug}")

        if process_material(slug):
            success_count += 1
        else:
            fail_count += 1

    # 最终统计
    print("\n" + "="*70)
    print("  批量处理完成")
    print("="*70)
    print(f"成功: {success_count}")
    print(f"失败: {fail_count}")
    print(f"总计: {len(slugs)}")
    print("="*70)

if __name__ == '__main__':
    main()
