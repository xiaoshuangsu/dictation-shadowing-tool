#!/usr/bin/env python3
"""
重新处理雅思素材挖空逻辑 v6.0
语言习得导向（Language Acquisition）的智能挖空

特点：
1. ✅ v4.0 优点：剔除事实词、专有名词、纯逻辑连接词
2. ✅ v5.0 新增：语言习得导向的权重系统
3. ✅ v5.0 新增黑名单：语气词、缩写代词、低级模糊词
4. ✅ v5.1 修复：扩展黑名单（问候语、常见形容词、常见动词）
5. ✅ v5.1 修复：扩展权重规则（更多动词、形容词模式）
6. ✅ v5.2 修复：禁止挖掘填充语（then, too, either, though, anyway, actually）
7. ✅ v5.2 新增：长单词提权协议（>7个字母的实义词优先）
8. ✅ v5.2 新增：音节复杂度加成（多音节、拼写复杂词汇最高权重）
9. ✅ v5.2 新增：月份提权（February, Wednesday 等拼写挑战词优先）
10. ✅ v5.2 新增：名词保底原则（优先选择核心名词如 date, room, time）
11. 🆕 v6.0 新增：情态助动词黑名单（can, could, would, should, may, might, must, shall）
12. 🆕 v6.0 新增：疑问代词黑名单（what）
13. 🆕 v6.0 新增：低级认知词/填充词黑名单（think, uh, hmm, um）
14. 🔥 v6.0 修复：解决 v4.0 事实词过滤与 v5.2 提权规则的冲突

版本历史：
- v6.0 (2026-03-26): 新增黑名单 + 修复逻辑冲突（月份/时间词汇提权生效）
- v5.2 (2026-03-26): 长单词提权、音节复杂度加成、月份提权、禁止填充语
- v5.1 (2026-03-26): 修复 W6 占比过高问题，扩展黑名单和权重规则
- v5.0 (2026-03-26): 语言习得导向重构，权重系统，固定搭配识别
- v4.1 (2026-03-25): 验证单个词，防止短语挖空
- v4.0 (2026-03-25): 剔除事实词、专有名词、逻辑连接词
- v2.3 (2026-03-25): 多候选词方案，提高挖空成功率
"""
import os
import json
import requests
import time
import re
from pathlib import Path
from supabase import create_client
from typing import Optional, List, Dict, Tuple

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

# ==================== 核心黑名单（v5.0 扩展） ====================
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

    # ===== 🔥 v6.0 新增：情态助动词 =====
    'can', 'could', 'would', 'should', 'may', 'might', 'must', 'shall',

    # ===== 🔥 v6.0 新增：疑问代词 =====
    'what',

    # ===== 🔥 v6.0 新增：低级认知词/填充词 =====
    'think', 'uh', 'hmm', 'um',

    # ===== 其他 =====
    'there', 'here', 'just', 'really', 'very'
]

def is_blacklisted(word: str) -> bool:
    """检查单词是否在黑名单中"""
    word_clean = word.lower().strip('.,!?;:"\'')
    return word_clean in STRICT_BLACKLIST

# ==================== 🔥 v5.0 新增：缩写代词检测 ====================

def is_contraction(word: str) -> bool:
    """检查是否为缩写代词（如 You're, It's, That's）

    Args:
        word: 待检查的词

    Returns:
        是否为缩写代词
    """
    word_clean = word.lower().strip('.,!?;:"\'')

    # 常见缩写代词模式
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

# ==================== v4.0 保留：事实词与专有名词检测 ====================

def is_fact_word(word: str) -> bool:
    """检查是否为事实词（纯数字、带数字的词、价格、地址相关）

    ⚠️ 重要变更（v6.0）：
    - 移除了月份、星期、基础时间词汇（date, time）的过滤
    - 这些词现在由 v5.2 的"月份提权"和"名词保底原则"处理
    - 保留纯数字、价格、地址等真正的事实词过滤

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
    # 注意：不含纯字母的月份/星期（如 February, Wednesday）
    if any(c.isdigit() for c in word_clean):
        return True

    # 3. 价格相关
    price_indicators = ['$', '£', '€', 'yen', 'yuan', 'dollar', 'pound', 'cent', 'euro']
    if any(indicator in word_clean for indicator in price_indicators):
        return True

    # 4. 地址相关（街道、建筑等）
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

    # 2. 🔥 v5.0 新增：缩写代词
    if is_contraction(word):
        return True

    # 3. 事实词
    if is_fact_word(word):
        return True

    # 4. 专有名词
    if is_proper_noun(word, sentence_text, index):
        return True

    return False

# ==================== 🔥 v5.0 新增：权重系统 ====================

def calculate_word_weight(word: str, sentence_text: str = '', index: int = -1) -> int:
    """计算单词的权重（0-10）

    权重说明：
    - 权重 10+：音节复杂度极高的词汇（available, refurbishment, September）
    - 权重 10：程度、逻辑与频率副词 + 长单词提权（>7个字母）
    - 权重 9：高级/具象动词
    - 权重 8：比较级/最高级与描述性形容词
    - 权重 7：固定搭配中的语义重心
    - 权重 6：月份提权（February, Wednesday 等拼写挑战词）
    - 权重 5：普通名词
    - 权重 0：应该跳过的词

    Args:
        word: 待评估的单词
        sentence_text: 完整句子（可选，用于固定搭配检测）
        index: 单词在句子中的位置（可选）

    Returns:
        权重值（0-12）
    """
    # 先检查是否应该跳过
    if should_skip_word(word, sentence_text, index):
        return 0

    word_clean = word.lower().strip('.,!?;:"\'')
    word_length = len(word_clean)

    # ===== 🔥 v5.2 新增：音节复杂度加成（最高优先级）=====
    # 拼写复杂、多音节词汇，直接赋予最高权重
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
        return 12  # 🔥 最高权重：音节复杂度极高

    # ===== 🔥 v5.2 新增：长单词提权协议 =====
    # 长度超过 7 个字母的实义词，优先级大幅提升
    if word_length >= 8 and word_length <= 10:
        # 检查是否为实义词（不是纯功能词）
        if (not word_clean.endswith('ly') and  # 副词单独处理
            word_clean not in ['something', 'anything', 'nothing', 'someone']):
            return 10  # 长单词提权
    elif word_length >= 11:
        return 11  # 超长单词，最高权重

    # ===== 🔥 v5.2 新增：月份提权 =====
    # 月份、星期等拼写挑战词，优先级提升
    month_days = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ]
    if word_clean in month_days:
        return 9  # 月份/星期提权

    # ===== 权重 10：程度、逻辑与频率副词 =====
    adverbs_weight_10 = [
        'massively', 'throughout', 'normally', 'extremely',
        'particularly', 'especially', 'significantly', 'considerably',
        'absolutely', 'completely', 'entirely', 'totally',
        'frequently', 'regularly', 'constantly', 'continuously',
        'relatively', 'comparatively', 'approximately',
        'ultimately', 'eventually', 'initially', 'originally',
        'effectively', 'efficiently', 'successfully'
    ]
    if word_clean.endswith('ly') or word_clean in adverbs_weight_10:
        # 进一步检查是否为高质量副词
        high_quality_adverbs = [
            'rarely', 'merely', 'barely', 'hardly', 'scarcely',
            'recently', 'currently', 'previously', 'formerly',
            'primarily', 'mainly', 'chiefly', 'largely'
        ]
        if word_clean in high_quality_adverbs:
            return 10
        # 其他 -ly 副词也给较高权重
        if word_clean.endswith('ly'):
            return 9

    # ===== 权重 9：高级/具象动词 =====
    # 检查动词形态
    if (word_clean.endswith('ing') or
        word_clean.endswith('ed') and not word_clean.endswith('ted') and not word_clean.endswith('ded')):
        # 排除基础动词
        basic_verbs = ['going', 'doing', 'getting', 'using', 'making', 'taking', 'seeing']
        if word_clean not in basic_verbs:
            return 9

    # 高级动词词根
    advanced_verbs = [
        'refurbishment', 'thriving', 'indicates', 'stolen', 'support',
        'offer', 'maintain', 'consume', 'cultivate', 'harvest',
        'demonstrate', 'illustrate', 'establish', 'implement',
        'organise', 'organise', 'organising', 'organised', 'organise',
        'expect', 'expecting', 'expected', 'call', 'calling', 'called'
    ]
    if any(root in word_clean for root in advanced_verbs):
        return 9

    # 🔥 v5.1 新增：更多动词模式
    # 常见职业动词（非基础动词）
    professional_verbs = [
        'help', 'pay', 'join', 'choose', 'chose', 'choose', 'decide', 'decided',
        'manage', 'managed', 'control', 'controlled', 'check', 'checked',
        'book', 'booked', 'order', 'ordered', 'reserve', 'reserved'
    ]
    if word_clean in professional_verbs:
        return 9

    # ===== 权重 8：比较级/最高级与描述性形容词 =====
    # 比较级/最高级
    if (word_clean.endswith('er') or word_clean.endswith('est') or
        word_clean.endswith('ier') or word_clean.endswith('iest')):
        comparative_superlatives = [
            'younger', 'older', 'better', 'worse', 'more', 'less',
            'bigger', 'smaller', 'faster', 'slower',
            'useful', 'useless', 'helpful', 'harmful'
        ]
        if word_clean in comparative_superlatives:
            return 8

    # 描述性形容词词尾
    if (word_clean.endswith('ive') or word_clean.endswith('ous') or
          word_clean.endswith('ent') or word_clean.endswith('ant')):
        descriptive_adjs = [
            'significant', 'beneficial', 'essential', 'effective',
            'important', 'relevant', 'different', 'various'
        ]
        if word_clean in descriptive_adjs:
            return 8

    # 🔥 v5.1 新增：更多描述性形容词
    descriptive_adjs_v51 = [
        'serious', 'popular', 'possible', 'available', 'responsible',
        'necessary', 'expensive', 'cheap', 'free', 'full', 'empty',
        'short', 'long', 'high', 'low', 'hard', 'soft', 'heavy', 'light',
        'dark', 'bright', 'cold', 'warm', 'hot', 'cool', 'dry', 'wet'
    ]
    if word_clean in descriptive_adjs_v51:
        return 8

    # ===== 权重 7：固定搭配中的语义重心 =====
    if sentence_text and index >= 0:
        collocation_weight = check_collocation_weight(word_clean, sentence_text, index)
        if collocation_weight > 0:
            return collocation_weight

    # ===== 权重 5：普通名词 =====
    # 名词词尾（包括复数形式）
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

    # 🔥 v5.1 新增：更多常见名词模式
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

    # 普通动词、形容词、名词默认权重
    return 6

# ==================== 🔥 v5.0 新增：固定搭配检测 ====================

COLLOCATIONS = [
    # 动词 + 形容词/副词/名词
    (r'\bgo\s+(wrong|bad|crazy|well|ahead|back|down|up|on|off)', 1),
    (r'\bfeel\s+(relaxed|happy|sad|angry|good|bad|better|worse)', 1),
    (r'\bdeal\s+with', 1),  # with 是语义重心
    (r'\bget\s+(ready|done|started|finished|lost|stolen|caught)', 1),
    (r'\bmake\s+(sure|clear|sense|progress|money|friends)', 1),
    (r'\btake\s+(place|part|care|time|advantage|action)', 1),
    (r'\bcome\s+(up|back|down|out|in|over|across)', 1),

    # 形容词 + 名词
    (r'\bmost\s+\w+\s+part', 1),  # part 是语义重心
    (r'\buseful\s+part', 1),

    # 副词 + 动词
    (r'\bjust\s+\w+\s+(said|told|asked|called)', 1),
]

def check_collocation_weight(word: str, sentence: str, index: int) -> int:
    """检查单词是否为固定搭配的语义重心

    Args:
        word: 待检查的单词
        sentence: 完整句子
        index: 单词在句子中的位置

    Returns:
        权重值（0 表示不是固定搭配重心）
    """
    words = sentence.split()

    # 检查是否在固定搭配中
    for pattern, weight_offset in COLLOCATIONS:
        matches = re.finditer(pattern, sentence.lower())
        for match in matches:
            # 找到匹配的词在句子中的位置
            match_text = match.group()
            match_words = match_text.split()

            # 检查当前词是否在匹配范围内
            for i, match_word in enumerate(match_words):
                # 找到当前词在原句中的实际位置
                actual_index = sentence.lower().find(match_word)
                if actual_index == -1:
                    continue

                # 计算这个词在原句中的词索引
                words_before = sentence[:actual_index].split()
                word_index = len(words_before)

                if word_index == index:
                    return 7  # 固定搭配的语义重心

    return 0

# ==================== 工具函数 ====================

def is_valid_single_word(word: str) -> bool:
    """检查是否为有效的单个词（不是短语）

    Args:
        word: 待检查的词

    Returns:
        是否为有效的单个词
    """
    word_clean = word.strip('.,!?;:"\'')
    return ' ' not in word_clean

def log(msg: str):
    """简化日志输出"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

# ==================== GLM-4 挖空词识别（v5.0 更新） ====================
BLANKS_PROMPT = """你是一位英语教学专家，专注于设计**语言习得导向**的高质量词汇训练内容。

**核心目标**：通过挖空训练，帮助学习者内化【高价值表达】、【逻辑连接】和【具象动作】，而非拼写无意义的虚词。

**权重系统**（按优先级排序）：
1. **【权重 10】程度、逻辑与频率副词** (40%)：
   - 示例：massively, throughout, normally, extremely, particularly, rarely, merely
   - 理由：体现语言精度和语感

2. **【权重 9】高级/具象动词** (30%)：
   - 示例：refurbishment, thriving, indicates, stolen, support, maintain, cultivate
   - 理由：具象动作和职业词汇，具有拼写价值

3. **【权重 8】比较级/最高级与描述性形容词** (20%)：
   - 示例：younger, useful, significant, beneficial, essential, effective
   - 理由：强化比较级表达和属性描述的语感

4. **【权重 7】固定搭配中的语义重心** (10%)：
   - 示例：go [wrong], deal [with], feel [relax], most [useful] [part]
   - 理由：固定搭配的语义重心，避开系动词和介词

**严禁挖空的词类**（v5.0 扩展）：
1. **纯语气词/感叹词**：Yes, No, Okay, Well, So, Very, Quite
2. **功能性缩写/代词**：You're, It's, That's, I'm, They've, Don't, Won't
3. **低级/模糊词汇**：things, stuff, get, use, know
4. **事实词**：数字、日期、价格、地址（1998, January, $15, Street）
5. **专有名词**：人名（Louise Taylor）、地名（Atlit-Yam）、机构名
6. **基础黑名单**：代词、虚词、介词、系动词、逻辑连接词

**全局去重规则**：
- **同一单词在整个素材中最多挖空1次**
- 确保词汇多样性最大化

**保底机制**：
- **每一句必须至少有一个候选词**
- 如果句子中只有简单词，选择最核心的动词、形容词或副词
- 避免返回空的 candidates 数组

**输出格式**（JSON，不要有任何其他文字）：
{
  "candidates": [
    {"word": "第一候选词", "index": 位置1, "reason": "权重X:理由"},
    {"word": "第二候选词", "index": 位置2, "reason": "权重X:理由"},
    {"word": "第三候选词", "index": 位置3, "reason": "权重X:理由"}
  ]
}

**重要限制**：
- **每个候选词必须是单个词**，不能是短语（如 "set up" 是短语，不能使用）
- 短语动词（如 set up, look for）请选择其中的核心词（如 set, look）

**案例示范**（Few-shot Samples）：
输入: If anything goes wrong...
输出: {"candidates": [{"word": "wrong", "index": 3, "reason": "权重7:固定搭配go wrong的语义重心"}]}

输入: ...closed for refurbishment.
输出: {"candidates": [{"word": "refurbishment", "index": 3, "reason": "权重9:高级职业名词，具象动作"}]}

输入: ...one person younger than me.
输出: {"candidates": [{"word": "younger", "index": 2, "reason": "权重8:比较级，强化语感"}]}

输入: ...had some things stolen...
输出: {"candidates": [{"word": "stolen", "index": 4, "reason": "权重9:核心事件动作，具象动词"}]}

输入: That's the most useful part.
输出: {"candidates": [{"word": "useful", "index": 3, "reason": "权重8:属性形容词，避开缩写代词"}]}

输入: Very nice.
输出: {"candidates": [{"word": "nice", "index": 1, "reason": "权重8:实义形容词，避开语气词"}]}

输入: Louise Taylor.
输出: {"candidates": [{"word": "part", "index": 0, "reason": "权重5:保底机制，纯人名句"}]}

输入: {sentence}
输出:"""


def generate_blank_for_sentence(sentence_text: str, blanked_words: dict = None) -> Optional[Dict]:
    """为单个句子生成挖空（v5.0：语言习得导向）

    Args:
        sentence_text: 句子文本
        blanked_words: 已挖空单词的计数器 {word: count}

    Returns:
        挖空数据字典或 None
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
                return fallback_blank_selection_v5(sentence_text, blanked_words)

            # 检查是否有 candidates 字段
            if 'candidates' not in data:
                return fallback_blank_selection_v5(sentence_text, blanked_words)

            candidates = data['candidates']

            if not candidates or len(candidates) == 0:
                return fallback_blank_selection_v5(sentence_text, blanked_words)

            # 🔥 v5.0: 使用权重系统过滤候选词
            best_candidate = None
            best_weight = -1

            for candidate in candidates:
                word = candidate.get('word', '')
                index = candidate.get('index', -1)

                # 验证是否为单个词
                if not is_valid_single_word(word):
                    continue

                # 验证 index 范围
                words = sentence_text.split()
                if index < 0 or index >= len(words):
                    continue

                # 使用 should_skip_word 综合判断
                if should_skip_word(word, sentence_text, index):
                    continue

                # 🔴 全局去重：同一单词最多挖空1次（绝不重复）
                word_lower = word.lower()
                if blanked_words.get(word_lower, 0) >= 1:
                    continue

                # 🔥 v5.0: 计算权重，选择权重最高的候选词
                weight = calculate_word_weight(word, sentence_text, index)
                if weight > best_weight:
                    best_weight = weight
                    best_candidate = {
                        "word": word,
                        "index": index,
                        "pos": candidate.get('reason', '')[:30],
                        "is_core": True,
                        "weight": weight  # 🔥 v5.0 新增：记录权重
                    }

            if best_candidate:
                return best_candidate

            # 保底机制：所有候选词都不符合条件
            return fallback_blank_selection_v5(sentence_text, blanked_words)

    except Exception as e:
        # 保底机制：发生错误，使用本地算法
        return fallback_blank_selection_v5(sentence_text, blanked_words)


def fallback_blank_selection_v5(sentence_text: str, blanked_words: dict) -> Optional[Dict]:
    """保底机制：使用权重系统选择挖空词（v5.0）

    优先级：
    1. 权重 10：程度、逻辑与频率副词
    2. 权重 9：高级/具象动词
    3. 权重 8：比较级/最高级与描述性形容词
    4. 权重 7：固定搭配中的语义重心
    5. 权重 5：普通名词
    6. 权重 6：其他实词

    Args:
        sentence_text: 句子文本
        blanked_words: 已挖空单词的计数器

    Returns:
        挖空数据字典或 None
    """
    words = sentence_text.split()

    # 计算所有词的权重
    candidates_with_weights = []

    for i, word in enumerate(words):
        # 跳过已挖1次的词（绝不重复）
        word_clean = word.lower().strip('.,!?;:"\'')
        if blanked_words.get(word_clean, 0) >= 1:
            continue

        # 使用 should_skip_word 判断
        if should_skip_word(word, sentence_text, i):
            continue

        # 计算权重
        weight = calculate_word_weight(word, sentence_text, i)
        if weight > 0:
            candidates_with_weights.append((weight, i, word))

    # 按权重排序，选择权重最高的词
    if candidates_with_weights:
        candidates_with_weights.sort(key=lambda x: x[0], reverse=True)
        weight, index, word = candidates_with_weights[0]

        return {
            "word": word.strip('.,!?;:"\''),
            "index": index,
            "pos": f"权重{weight}",
            "is_core": False,
            "weight": weight
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
        weight_stats = {10: 0, 9: 0, 8: 0, 7: 0, 6: 0, 5: 0}  # 🔥 v5.0 新增：权重统计
        blanked_words = {}  # 🔥 全局去重：记录已挖空的单词（绝不重复）

        # 为每个句子生成挖空
        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            blank_data = generate_blank_for_sentence(sentence_text, blanked_words)

            if blank_data:
                sentence['blanks'] = [blank_data]

                # 🔥 更新全局计数
                word_lower = blank_data['word'].lower()
                blanked_words[word_lower] = blanked_words.get(word_lower, 0) + 1

                # 🔥 v5.0: 统计权重分布
                weight = blank_data.get('weight', 0)
                if weight in weight_stats:
                    weight_stats[weight] += 1

                success_count += 1
            else:
                sentence['blanks'] = []
                skip_count += 1

            if (i + 1) % 5 == 0:
                log(f"    进度: {i+1}/{len(transcript)}")

            time.sleep(0.5)

        log(f"  ✓ 完成: 成功 {success_count}, 跳过 {skip_count}")
        # 🔥 v5.0 新增：输出权重分布
        log(f"  权重分布: W10={weight_stats[10]}, W9={weight_stats[9]}, W8={weight_stats[8]}, W7={weight_stats[7]}, W6={weight_stats[6]}, W5={weight_stats[5]}")

        # 保存到数据库
        client.table('materials').update({
            'transcript': transcript
        }).eq('slug', slug).execute()

        log(f"  ✅ 已保存")
        return True

    except Exception as e:
        log(f"  ❌ 失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    # 读取素材列表
    cam_file = Path('/tmp/test_single_v60.txt')  # 🔥 v6.0: 测试单个素材

    if not cam_file.exists():
        log(f"错误: 素材列表不存在: {cam_file}")
        log("请先创建素材列表文件")
        return

    with open(cam_file) as f:
        slugs = [line.strip() for line in f if line.strip()]

    if not slugs:
        log("错误: 素材列表为空")
        return

    print("="*70)
    print("  批量重新挖空 - Cam 13/14 素材（v5.0 语言习得导向）")
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
