#!/usr/bin/env python3
"""
修复专有名词挖空问题

功能：
1. 扫描所有素材的 blanks 字段
2. 识别专有名词（NNP, NNPS）
3. 重新选择合适的词进行挖空
4. 更新数据库

作者: Claude
日期: 2026-03-19
"""

import os
import sys
import json
import argparse
from typing import List, Dict, Any, Set, Tuple
from datetime import datetime

from dotenv import load_dotenv
from supabase import create_client

# ============ 配置 ============
load_dotenv('.env.local')
load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', 'https://cuxotlijjnxbsirpdkgr.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

# 常见英美人名列表（约 200 个）
COMMON_NAMES = {
    # 男性名字
    'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles',
    'christopher', 'daniel', 'matthew', 'anthony', 'donald', 'mark', 'paul', 'steven', 'andrew', 'kenneth',
    'joshua', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan',
    'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
    'benjamin', 'samuel', 'frank', 'gregory', 'raymond', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',

    # 女性名字
    'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'elizabeth', 'susan', 'jessica', 'sarah', 'karen',
    'nancy', 'lisa', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle',
    'dorothy', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia',
    'kathleen', 'amy', 'shirley', 'angela', 'helen', 'anna', 'brenda', 'pamela', 'emma', 'nicole',
    'hannah', 'samantha', 'katherine', 'christine', 'debra', 'rachel', 'catherine', 'carolyn', 'janet', 'ruth',

    # 常见名字变体
    'kate', 'katie', 'lizzy', 'liz', 'beth', 'becky', 'sue', 'maggie', 'meg', 'annie',
    'abby', 'cathy', 'chrissy', 'debbie', 'gina', 'jenny', 'kathy', 'missy', 'molly', 'patty',
    'bob', 'bill', 'jim', 'joe', 'tom', 'tim', 'tony', 'mike', 'rick', 'steve',
    'dan', 'dave', 'greg', 'jeff', 'johnny', 'kenny', 'pete', 'phil', 'ron', 'rob'
}

# 停用词列表
STOP_WORDS = {
    'a', 'an', 'the', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
    'this', 'that', 'these', 'those', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'as', 'and', 'but', 'or', 'so', 'because', 'is', 'am', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'yes', 'no', 'not',
    'oh', 'hey', 'well', 'now', 'then', 'here', 'there', 'what', 'when', 'where',
    'who', 'why', 'how', 'very', 'really', 'quite', 'rather', 'too', 'also', 'just'
}

# ============ NLTK 初始化 ============
def setup_nltk():
    """初始化 NLTK"""
    try:
        import nltk
        print("📦 NLTK 已安装")

        # 下载必要的数据包
        required_packages = ['punkt', 'averaged_perceptron_tagger', 'punkt_tab',
                           'averaged_perceptron_tagger_eng', 'punkt_eng']
        for package in required_packages:
            try:
                nltk.data.find(f'tokenizers/{package}')
            except LookupError:
                try:
                    nltk.data.find(f'taggers/{package}')
                except LookupError:
                    try:
                        nltk.download(package, quiet=True)
                    except:
                        pass

        return True
    except ImportError:
        print("❌ NLTK 未安装")
        return False

# ============ 专有名词识别 ============
def is_proper_noun(word: str, pos: str, word_index: int, sentence_length: int) -> bool:
    """判断是否为专有名词

    Args:
        word: 单词
        pos: 词性标注
        word_index: 单词在句子中的位置
        sentence_length: 句子总词数

    Returns:
        是否为专有名词
    """
    # 1. 词性标注判断
    if pos in ['NNP', 'NNPS']:
        return True

    # 2. 常用人名判断
    if word.lower() in COMMON_NAMES:
        return True

    # 3. 首字母大写且不在句首
    if word_index > 0 and word[0].isupper() and word.isalpha():
        return True

    return False

# ============ 重新选择挖空词 ============
def reselect_blank(
    words_with_pos: List[Tuple[str, str]],
    exclude_index: int
) -> Dict[str, Any]:
    """重新选择挖空词（排除专有名词）

    Args:
        words_with_pos: (word, pos_tag) 列表
        exclude_index: 要排除的词索引

    Returns:
        新的挖空词信息，如果没有合适的则返回 None
    """
    candidates = []

    for i, (word, pos) in enumerate(words_with_pos):
        # 跳过被排除的词
        if i == exclude_index:
            continue

        # 规范化单词
        word_clean = word.lower().replace('.', '').replace(',', '').replace('!', '').replace('?', '')

        # 跳过停用词
        if word_clean in STOP_WORDS:
            continue

        # 跳过非字母词
        if not word_clean.isalpha() or len(word_clean) < 2:
            continue

        # 跳过专有名词
        if is_proper_noun(word, pos, i, len(words_with_pos)):
            continue

        # 获取词性
        pos_category = pos[:2]

        # 只考虑动词、普通名词、形容词
        if pos_category not in ['VB', 'NN', 'JJ', 'VBP', 'VBZ', 'VBD', 'VBG', 'VBN', 'NNS']:
            continue

        # 排除专有名词变体
        if pos_category == 'NNS' and word[0].isupper():
            continue

        # 计算得分
        score = 0

        # 词性优先级：动词 > 名词 > 形容词
        if pos_category in ['VB', 'VBP', 'VBZ', 'VBD', 'VBG', 'VBN']:
            score += 30
        elif pos_category in ['NN', 'NNS']:
            score += 20
        elif pos_category in ['JJ', 'JJR', 'JJS']:
            score += 10

        # 单词长度适中
        if 3 <= len(word_clean) <= 10:
            score += 5

        # 添加随机性
        import random
        score += random.uniform(0, 5)

        candidates.append({
            'word': word,
            'index': i,
            'pos': pos,
            'score': score
        })

    # 返回得分最高的
    if candidates:
        candidates.sort(key=lambda x: x['score'], reverse=True)
        best = candidates[0]
        return {
            'word': best['word'],
            'index': best['index'],
            'pos': best['pos'],
            'is_core': False  # 保守设置
        }

    return None

# ============ 数据库操作 ============
def get_all_materials(client):
    """获取所有素材"""
    print("📥 获取所有素材...")
    result = client.table('materials').select('id, title, slug, transcript').execute()

    if not result.data:
        print("❌ 没有找到素材")
        return []

    print(f"✅ 找到 {len(result.data)} 个素材")
    return result.data

def update_material_blanks(client, material_id: str, transcript: List[Dict]) -> bool:
    """更新素材的 transcript blanks 字段"""
    try:
        client.table('materials').update({
            'transcript': transcript
        }).eq('id', material_id).execute()
        return True
    except Exception as e:
        print(f"   ❌ 更新失败: {e}")
        return False

# ============ 主处理逻辑 ============
def process_material_transcript(material: Dict) -> Tuple[List[Dict], Dict]:
    """处理单个素材的 transcript

    返回: (updated_transcript, statistics)
    """
    import nltk

    transcript = material.get('transcript', [])

    if not transcript or not isinstance(transcript, list):
        return transcript, {'processed': 0, 'fixed': 0, 'removed': 0, 'skipped': 0}

    stats = {'processed': 0, 'fixed': 0, 'removed': 0, 'skipped': 0}
    updated_transcript = []
    fix_examples = []

    for sentence in transcript:
        sentence_text = sentence.get('text', '')
        blanks = sentence.get('blanks', [])

        if not sentence_text or not blanks:
            updated_transcript.append(sentence)
            stats['skipped'] += 1
            continue

        stats['processed'] += 1

        # 重新分析句子
        words_with_pos = nltk.pos_tag(nltk.word_tokenize(sentence_text))

        # 检查当前挖空是否为专有名词
        blank = blanks[0]
        blank_word = blank.get('word', '')
        blank_index = blank.get('index', 0)

        # 找到对应的词性
        blank_pos = None
        for i, (word, pos) in enumerate(words_with_pos):
            if i == blank_index:
                blank_pos = pos
                break

        # 判断是否为专有名词
        if blank_pos and is_proper_noun(blank_word, blank_pos, blank_index, len(words_with_pos)):
            # 需要修复
            new_blank = reselect_blank(words_with_pos, blank_index)

            if new_blank:
                # 找到合适的替代词
                sentence['blanks'] = [new_blank]
                stats['fixed'] += 1

                # 记录前 5 个修复示例
                if len(fix_examples) < 5:
                    fix_examples.append({
                        'text': sentence_text,
                        'old_blank': blank_word,
                        'new_blank': new_blank['word'],
                        'reason': f"专有名词 ({blank_pos})"
                    })
            else:
                # 没有找到合适的替代词，移除挖空
                sentence['blanks'] = []
                stats['removed'] += 1

                # 记录前 5 个移除示例
                if len(fix_examples) < 5:
                    fix_examples.append({
                        'text': sentence_text,
                        'old_blank': blank_word,
                        'new_blank': None,
                        'reason': f"专有名词 ({blank_pos})，无其他可用词"
                    })
        else:
            stats['skipped'] += 1

        updated_transcript.append(sentence)

    return updated_transcript, stats, fix_examples

# ============ 主函数 ============
def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='修复专有名词挖空问题')
    parser.add_argument('--batch-size', type=int, default=10, help='每批处理的素材数量')
    parser.add_argument('--silent', action='store_true', help='静默模式')
    args = parser.parse_args()

    silent = args.silent

    if not silent:
        print("="*70)
        print("🔧 修复专有名词挖空问题")
        print("="*70)

    # 检查环境变量
    if not SUPABASE_KEY:
        print("❌ 错误: 未找到 SUPABASE_KEY")
        sys.exit(1)

    # 初始化 NLTK
    if not setup_nltk():
        sys.exit(1)

    # 连接 Supabase
    if not silent:
        print("🔗 连接 Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取所有素材
    materials = get_all_materials(client)
    if not materials:
        sys.exit(1)

    # 处理每个素材
    if not silent:
        print("\n🔧 开始处理...")
        print("="*70)

    total_stats = {'processed': 0, 'fixed': 0, 'removed': 0, 'skipped': 0}
    all_fix_examples = []

    batch_size = args.batch_size
    total_batches = (len(materials) + batch_size - 1) // batch_size

    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(materials))
        batch = materials[start_idx:end_idx]

        if not silent:
            print(f"\n📦 Batch {batch_num + 1}/{total_batches} (素材 {start_idx + 1}-{end_idx})")

        batch_fixed = 0

        for i, material in enumerate(batch, start_idx):
            material_id = material.get('id')
            title = material.get('title', 'Unknown')

            # 处理 transcript
            updated_transcript, stats, fix_examples = process_material_transcript(material)

            total_stats['processed'] += stats['processed']
            total_stats['fixed'] += stats['fixed']
            total_stats['removed'] += stats['removed']
            total_stats['skipped'] += stats['skipped']

            all_fix_examples.extend(fix_examples)

            # 更新数据库
            if stats['fixed'] > 0 or stats['removed'] > 0:
                success = update_material_blanks(client, material_id, updated_transcript)
                if success:
                    batch_fixed += 1

        if not silent and batch_fixed > 0:
            print(f"  ✅ Batch {batch_num + 1} 完成 - 修复了 {batch_fixed}/{len(batch)} 个素材")

    # 总结
    if not silent:
        print("\n" + "="*70)
        print("✅ 处理完成！")
        print("="*70)
        print(f"\n统计:")
        print(f"  总素材数: {len(materials)}")
        print(f"  处理句子数: {total_stats['processed']}")
        print(f"  修复句子数: {total_stats['fixed']}")
        print(f"  移除挖空数: {total_stats['removed']}")
        print(f"  跳过句子数: {total_stats['skipped']}")

    # 显示修复示例
    if all_fix_examples:
        print("\n" + "="*70)
        print("📝 修复示例（前 5 个）")
        print("="*70)

        for i, example in enumerate(all_fix_examples[:5], 1):
            print(f"\n【{i}】{example['text']}")
            print(f"  原挖空: {example['old_blank']}")
            if example['new_blank']:
                print(f"  新挖空: {example['new_blank']}")
            else:
                print(f"  新挖空: (已移除)")
            print(f"  原因: {example['reason']}")

    # 保存修复报告
    report = {
        'completed_at': datetime.now().isoformat(),
        'stats': total_stats,
        'examples': all_fix_examples[:10]  # 保存前 10 个示例
    }

    report_file = os.path.join(os.path.dirname(__file__), 'fix_proper_nouns_report.json')
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    if not silent:
        print(f"\n📄 报告已保存到 {report_file}")
        print("\n" + "="*70)
        print("🎉 全部完成！")
        print("="*70)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ 用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
