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
BLANKS_PROMPT = """你是一位雅思考试教研专家。你的任务是识别听力文本中最具"考点价值"的单词，用于听写练习。

黄金比例策略 (优先级梯度)：
1. 高价值事实词 (30%)：数字、日期、价格、地址、专有名词（人名、地名、机构名）。
2. 核心考点实词 (50%)：学术名词、功能性动词、描述性形容词（这些通常是雅思填空题的答案词）。
3. 逻辑连接词 (20%)：信号词、转折词或强调词。

核心黑名单 (严禁挖空)：
- 代词/引导词：he, she, it, they, we, you, I, me, him, her, us, them, that, which, who, this, these, those, my, your, his, her, its, our, their, hers, ours, theirs, whom, whose
- 虚词/连词：a, an, the, and, or, but, so, because, if
- 简单介词：in, on, at, to, of, for, with, by, from, about
- 基础系动词：is, am, are, was, were, be, been, do, does, did, have, has, had

逻辑约束：
- 意义大于频率：不要因为某个词在句子里就随机挖空。如果一句话里没有"高价值"词汇，允许不挖空（保持原样）。
- 信息权重：挖掉该句中承载"信息量"最大的单词。
- 密度控制：在短句中严禁挖空超过 2 个单词。

输出格式（必须是有效的 JSON，不要有任何其他文字）：
{
  "candidates": [
    {"word": "第一候选词", "index": 位置1, "reason": "理由"},
    {"word": "第二候选词", "index": 位置2, "reason": "理由"},
    {"word": "第三候选词", "index": 位置3, "reason": "理由"}
  ]
}

要求：
1. 提供 2-3 个候选词
2. 按优先级排序（最重要的词放在前面）
3. 所有候选词都必须在黑名单之外
4. 如果没有合适的词，返回空的 candidates 数组
"""

def generate_blank_for_sentence(sentence_text: str, blanked_words: dict = None) -> dict:
    """为单个句子生成挖空（使用多候选词方案 + 全局去重）

    Args:
        sentence_text: 句子文本
        blanked_words: 已挖空单词的计数器 {word: count}
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
                return None

            # 检查是否有 candidates 字段
            if 'candidates' not in data:
                return None

            candidates = data['candidates']

            if not candidates or len(candidates) == 0:
                return None

            # 🔥 遍历候选词，选择第一个符合条件的词
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

            # 所有候选词都不符合条件（黑名单或已挖2次）
            return None

    except Exception as e:
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

        # 为每个句子生成挖空
        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            # 移除测试限制，处理所有句子

            blank_data = generate_blank_for_sentence(sentence_text, blanked_words)

            if blank_data:
                sentence['blanks'] = [blank_data]
                # 🔥 更新全局计数
                word_lower = blank_data['word'].lower()
                blanked_words[word_lower] = blanked_words.get(word_lower, 0) + 1
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
