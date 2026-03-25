#!/usr/bin/env python3
"""
重新处理雅思素材挖空逻辑 v2.3
使用多候选词方案：让 GLM-4 返回 2-3 个候选词，自动选择第一个非黑名单词

特点：
1. 多候选词策略（2-3 个）
2. 自动过滤黑名单词
3. 按优先级排序
4. 提高挖空成功率
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
    # 简单介词
    'in', 'on', 'at', 'to', 'of', 'for', 'with', 'by', 'from', 'about',
    # 基础系动词/助动词
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'have', 'has', 'had',
    # 其他
    'there', 'here'
]

def is_blacklisted(word: str) -> bool:
    """检查单词是否在黑名单中"""
    return word.lower().strip('.,!?;:"\'') in STRICT_BLACKLIST

def log(msg: str):
    """简化日志输出"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

# ==================== GLM-4 挖空词识别 ====================
BLANKS_PROMPT = """你是一位英语教学专家，专注于设计高质量的词汇训练内容。

**核心目标**：选择最能体现英语语感、词汇量和表达能力的单词进行挖空，而不仅仅是"答案词"。

**优先级策略**（按重要性排序）：
1. **体现语感的词汇** (40%)：如 cultivated, rarely, instead, significant, merely, particularly 等能展示语言精度的词
2. **核心词汇多样性** (30%)：功能性动词、描述性形容词、副词（如 maintain, consume, essential, primarily）
3. **学术名词** (20%)：专业术语、概念词（如 photosynthesis, economy, cultivation）
4. **逻辑信号词** (10%)：转折、强调、递进词（如 however, moreover, consequently）

**数字挖空限制**：
- 数字、日期、价格等事实词优先级**最低**
- 只有在句子中没有其他合适词汇时才挖数字
- 建议避免挖空数字，除非它们是核心概念

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

**示例**：
输入: Coffee bushes are cultivated in shaded areas.
输出: {"candidates": [{"word": "cultivated", "index": 3, "reason": "体现语感的动词"}, {"word": "shaded", "index": 6, "reason": "描述性形容词"}, {"word": "areas", "index": 7, "reason": "名词"}]}

输入: The product was launched in 1995.
输出: {"candidates": [{"word": "launched", "index": 4, "reason": "功能性动词"}, {"word": "product", "index": 2, "reason": "名词"}, {"word": "1995", "index": 6, "reason": "数字（最后选择）"}]}

输入: {sentence}
输出:"""

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

def generate_blank_for_sentence(sentence_text: str, blanked_words: dict = None, digit_count: int = 0, digit_limit: int = 2) -> dict:
    """为单个句子生成挖空（带保底机制和数字限制）

    Args:
        sentence_text: 句子文本
        blanked_words: 已挖空单词的计数器 {word: count}
        digit_count: 当前已挖空的数字数量
        digit_limit: 数字挖空限制（默认2个）
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

            # 🔥 遍历候选词，应用所有过滤规则
            for candidate in candidates:
                word = candidate.get('word', '')
                index = candidate.get('index', -1)

                # 验证
                words = sentence_text.split()
                if index < 0 or index >= len(words):
                    continue

                # 检查黑名单
                if is_blacklisted(word):
                    continue

                # 🔥 数字限制：检查是否为数字词
                if is_digit_word(word):
                    if digit_count >= digit_limit:
                        continue  # 数字已达到上限，跳过

                # 🔥 全局去重：同一单词最多挖空2次
                word_lower = word.lower()
                if blanked_words.get(word_lower, 0) >= 2:
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
    """保底机制：使用本地算法选择挖空词

    优先级：
    1. 非黑名单的动词、形容词、副词
    2. 避免重复词（已挖2次的词）
    3. 避免数字（如果已达上限）
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

        # 跳过黑名单
        if is_blacklisted(word):
            continue

        # 跳过已挖2次的词
        if blanked_words.get(word_clean, 0) >= 2:
            continue

        # 跳过数字（如果已达上限）
        if is_digit_word(word) and digit_count >= digit_limit:
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
        blanked_words = {}  # 🔥 全局去重：记录已挖空的单词及其次数
        digit_count = 0     # 🔥 数字计数器：限制数字挖空不超过2个

        # 为每个句子生成挖空
        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            blank_data = generate_blank_for_sentence(sentence_text, blanked_words, digit_count, digit_limit=2)

            if blank_data:
                sentence['blanks'] = [blank_data]
                # 🔥 更新全局计数
                word_lower = blank_data['word'].lower()
                blanked_words[word_lower] = blanked_words.get(word_lower, 0) + 1

                # 🔥 更新数字计数
                if is_digit_word(blank_data['word']):
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
    cam_file = Path('/tmp/cam_materials_reprocess.txt')

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
