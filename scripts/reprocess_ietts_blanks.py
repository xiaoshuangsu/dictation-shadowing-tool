#!/usr/bin/env python3
"""
重新处理雅思素材挖空逻辑 v4.0
剔除高价值事实词、专有名词、纯逻辑连接词

特点：
1. 剔除高价值事实词（数字、日期、价格、地址）
2. 剔除专有名词（人名、地名、机构名、品牌名）
3. 剔除纯逻辑连接词（although, however, moreover, therefore 等）
4. 使用 should_skip_word() 综合判断函数
5. GLM Prompt 明确禁止挖空这些词类

版本历史：
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
    # 其他
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

def fallback_blank_selection(sentence_text: str, blanked_words: dict, digit_count: int = 0, digit_limit: int = 2) -> dict:
    """保底机制：使用本地算法选择挖空词（v4.1：绝不重复，除非没有其他选择）

    优先级：
    1. 非黑名单的动词、形容词、副词
    2. 避免重复词（已挖1次的词）
    3. 避免事实词、专有名词
    """
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
    cam_file = Path('/tmp/cam_first_5.txt')  # 🔧 测试模式：只处理前5个素材

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
