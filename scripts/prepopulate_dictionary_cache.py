#!/usr/bin/env python3
"""
词典缓存预生成脚本

功能：
1. 从 materials 表提取所有单词
2. 批量调用 GLM API 获取释义
3. 存入 dictionary_cache 表

使用方法：
  python scripts/prepopulate_dictionary_cache.py

环境变量：
  GLM_API_KEY - 智谱 AI API 密钥
  SUPABASE_SERVICE_ROLE_KEY - Supabase Service Role Key
"""

import os
import sys
import json
import time
import re
import logging
from pathlib import Path
from typing import Set, List, Dict, Optional
from collections import Counter
from datetime import datetime
from supabase import create_client
import requests

# 配置日志
log_dir = Path(__file__).parent.parent / 'logs'
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f'prepopulate_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# GLM API 配置
GLM_API_KEY = os.environ.get("GLM_API_KEY")
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://cuxotlijjnxbsirpdkgr.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_SERVICE_KEY:
    print("❌ 错误: 未找到 SUPABASE_SERVICE_ROLE_KEY 环境变量")
    sys.exit(1)

if not GLM_API_KEY:
    print("❌ 错误: 未找到 GLM_API_KEY 环境变量")
    sys.exit(1)

# 创建 Supabase 客户端
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ══════════════════════════════════════════════════════════════════════════════
# 分词和单词提取
# ══════════════════════════════════════════════════════════════════════════════

def is_valid_word(word: str) -> bool:
    """验证单词是否有效（过滤异常单词）"""

    # 1. 过滤超长单词（超过 20 个字符，可能是多个单词连在一起）
    if len(word) > 20:
        return False

    # 2. 过滤过短单词（少于 2 个字符）
    if len(word) < 2:
        return False

    # 3. 过滤纯专有名词和异常单词（地点、人名、拼写错误等）
    proper_nouns = {
        'taipei', 'taiwanese', 'taiwan',  # 地名
        'halleluia',  # 宗教词汇
        'fablecottage', 'singsing', 'ratchesons', 'bussell',  # 网站名/人名
        'booly', 'groud',  # 素材拼写错误
        'system',  # 系统词汇
    }
    if word in proper_nouns:
        return False

    # 4. 检查是否包含至少一个元音字母（英语单词的基本特征）
    if not any(c in 'aeiouy' for c in word):
        return False

    # 5. 过滤连续重复字符超过 3 次的单词（如 'aaaa'）
    if re.search(r'(.)\1{3,}', word):
        return False

    # 6. 过滤包含数字的单词
    if any(c.isdigit() for c in word):
        return False

    return True

def extract_words_from_text(text: str) -> Set[str]:
    """从文本中提取有效的英语单词"""
    # 使用正则表达式提取单词
    words = re.findall(r'\b[a-zA-Z]{2,}\b', text.lower())

    # 过滤掉常见的非单词词汇
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
        'these', 'those', 'it', 'its', 'he', 'she', 'they', 'them', 'him',
        'her', 'his', 'their', 'our', 'your', 'my', 'me', 'us', 'you', 'we'
    }

    valid_words = set()
    for word in words:
        if word not in stop_words and is_valid_word(word):
            valid_words.add(word)

    return valid_words

def extract_words_from_transcripts() -> Dict[str, int]:
    """从所有素材的 transcript 中提取单词并统计频率"""
    print("📖 正在提取所有素材的单词...")

    # 获取所有素材
    response = supabase.table('materials').select('id, title, transcript').execute()

    if not response.data:
        print("❌ 未找到任何素材")
        return {}

    word_counter = Counter()

    for material in response.data:
        transcript = material.get('transcript')
        if not transcript:
            continue

        # 提取每个句子的文本
        for sentence in transcript:
            text = sentence.get('text', '')
            words = extract_words_from_text(text)
            word_counter.update(words)

    print(f"✅ 提取完成！共找到 {len(word_counter)} 个唯一单词")
    return dict(word_counter)

# ══════════════════════════════════════════════════════════════════════════════
# 音频获取
# ══════════════════════════════════════════════════════════════════════════════

def fetch_word_audio_urls(word: str) -> Dict[str, str]:
    """从 dictionaryapi.dev 获取单词音频 URL"""
    audio_urls = {'us': None, 'uk': None}

    try:
        response = requests.get(
            f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}",
            timeout=10
        )

        if response.ok:
            data = response.json()
            phonetics = data[0].get('phonetics', []) if len(data) > 0 else []

            # 查找美音和英音
            for phonetic in phonetics:
                if phonetic.get('audio') and phonetic['audio'].endswith('.mp3'):
                    audio_url = phonetic['audio']
                    # 判断是美音还是英音
                    if not audio_urls['us'] and (phonetic.get('text', '').__contains__('US') or '-us' in audio_url):
                        audio_urls['us'] = audio_url
                    elif not audio_urls['uk'] and (phonetic.get('text', '').__contains__('UK') or '-uk' in audio_url):
                        audio_urls['uk'] = audio_url

            # 如果只找到一个，且没有明确标记，默认为美音
            if not audio_urls['us'] and not audio_urls['uk'] and phonetics:
                first_audio = next((p.get('audio') for p in phonetics if p.get('audio')), None)
                if first_audio:
                    audio_urls['us'] = first_audio
    except Exception as e:
        print(f"  ⚠️  获取音频失败: {e}")

    # 兜底：使用 Google TTS
    google_tts = lambda lang: f"https://translate.google.com/translate_tts?ie=UTF-8&q={word}&tl={lang}&client=tw-ob"

    if not audio_urls['us']:
        audio_urls['us'] = google_tts('en-us')
    if not audio_urls['uk']:
        audio_urls['uk'] = google_tts('en-GB')

    return audio_urls

# ══════════════════════════════════════════════════════════════════════════════
# GLM API 调用
# ══════════════════════════════════════════════════════════════════════════════

def fetch_word_definition_from_glm(word: str) -> Optional[Dict]:
    """调用 GLM API 获取单词释义"""
    try:
        response = requests.post(
            f"{GLM_BASE_URL}/chat/completions",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {GLM_API_KEY}'
            },
            json={
                'model': 'glm-4-flash',
                'messages': [
                    {
                        'role': 'system',
                        'content': """你是一个专业的英语词典助手。请为用户查询的单词提供准确、简洁的释义。

请严格按照以下 JSON 格式返回结果（不要有任何额外文字）：
{
  "word": "单词（小写）",
  "phonetic": "音标（如 /həˈləʊ/）",
  "zh-CN": "简体中文释义，最多3个常用释义，用分号分隔",
  "zh-Hant": "繁體中文释义，最多3个常用释义，用分号分隔",
  "vi": "越南语释义，最多3个常用释义，用分号分隔",
  "en": "英文释义，最多3个常用释义，用分号分隔",
  "example": "英文例句（选填，如果该单词常用的话）"
}

示例：
输入：hello
输出：
{
  "word": "hello",
  "phonetic": "/həˈləʊ/",
  "zh-CN": "你好；问候；喂",
  "zh-Hant": "你好；問候；喂",
  "vi": "xin chào; chào hỏi",
  "en": "a greeting; an expression of greeting",
  "example": "Hello, how are you?"
}"""
                    },
                    {
                        'role': 'user',
                        'content': word
                    }
                ],
                'temperature': 0.2,
                'max_tokens': 500,
                'top_p': 0.7
            },
            timeout=30
        )

        if response.status_code != 200:
            logger.warning(f"GLM API 错误 ({response.status_code}): {word}")
            return None

        data = response.json()
        content = data.get('choices', [{}])[0].get('message', {}).get('content')

        if not content:
            logger.warning(f"GLM API 返回空内容: {word}")
            return None

        # 解析 JSON
        try:
            result = json.loads(content)
            return result
        except json.JSONDecodeError:
            # 尝试提取 JSON 部分
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                try:
                    result = json.loads(json_match.group(0))
                    return result
                except json.JSONDecodeError:
                    pass

            logger.warning(f"无法解析 GLM 响应: {word}")
            return None

    except requests.Timeout:
        logger.error(f"GLM API 超时: {word}")
        return None
    except requests.RequestException as e:
        logger.error(f"GLM API 请求失败: {word} - {e}")
        return None
    except Exception as e:
        logger.error(f"调用 GLM API 异常: {word} - {e}")
        return None

def save_word_to_cache(word_data: Dict, audio_urls: Dict[str, str] = None) -> bool:
    """将单词释义保存到缓存表（每个词立即保存，防止数据丢失）"""
    try:
        word = word_data.get('word', '').lower().strip()

        definitions = {
            'zh-CN': word_data.get('zh-CN', ''),
            'zh-Hant': word_data.get('zh-Hant', ''),
            'vi': word_data.get('vi', ''),
            'en': word_data.get('en', '')
        }

        # 准备数据
        cache_data = {
            'word': word,
            'phonetic': word_data.get('phonetic', ''),
            'definitions': definitions,  # 使用实际数据库字段名
            'example': word_data.get('example')
        }

        # 添加音频 URL（如果有）
        if audio_urls:
            cache_data['audio_url_us'] = audio_urls.get('us')
            cache_data['audio_url_uk'] = audio_urls.get('uk')

        supabase.table('dictionary_cache').upsert(
            cache_data,
            on_conflict='word'
        ).execute()

        return True

    except Exception as e:
        logger.error(f"保存到缓存失败: {word_data.get('word', 'unknown')} - {e}")
        return False

# ══════════════════════════════════════════════════════════════════════════════
# 主函数
# ══════════════════════════════════════════════════════════════════════════════

def main():
    # 检查命令行参数
    auto_confirm = '--yes' in sys.argv or '-y' in sys.argv
    print("=" * 70)
    print("词典缓存预生成脚本")
    print("=" * 70)
    print()

    # 1. 提取所有单词
    word_freq = extract_words_from_transcripts()

    if not word_freq:
        print("❌ 未找到任何单词，退出")
        return

    # 按频率排序
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)

    print(f"\n📊 单词频率统计（Top 20）：")
    for word, freq in sorted_words[:20]:
        print(f"  {word:20s} : {freq:3d} 次")

    # 2. 检查已缓存的单词（分批获取，突破 1000 条限制）
    print(f"\n🔍 检查已缓存的单词...")
    cached_count_result = supabase.table('dictionary_cache').select('word', count='exact').execute()
    total_cached = cached_count_result.count
    print(f"✅ 已缓存 {total_cached} 个单词")

    # 获取所有已缓存单词的集合（分批获取）
    cached_words = set()
    batch_size = 1000
    start = 0
    while start < total_cached:
        batch = supabase.table('dictionary_cache').select('word').range(start, start + batch_size - 1).execute()
        cached_words.update({row['word'] for row in batch.data})
        start += batch_size
        if len(batch.data) < batch_size:
            break

    # 3. 确定需要预生成的单词
    words_to_cache = [word for word, freq in sorted_words if word not in cached_words]

    print(f"\n📝 需要预生成 {len(words_to_cache)} 个单词")

    if len(words_to_cache) == 0:
        print("\n✅ 所有单词已缓存，无需预生成")
        return

    # 询问是否继续
    print(f"\n⚠️  预计需要调用 GLM API {len(words_to_cache)} 次")
    print(f"⚠️  预计耗时：{len(words_to_cache) * 2 / 60:.1f} 分钟")

    if auto_confirm:
        print("\n✅ 自动确认模式，开始执行...")
    else:
        confirm = input("\n是否继续？(y/N): ")
        if confirm.lower() != 'y':
            print("❌ 已取消")
            return

    # 4. 批量调用 API 并缓存
    logger.info(f"🚀 开始预生成 {len(words_to_cache)} 个单词...")
    logger.info(f"📝 日志文件: {log_file}")
    logger.info("=" * 70)

    success_count = 0
    failed_count = 0
    total_words = len(words_to_cache)
    start_time = time.time()
    last_progress_time = start_time
    failed_words = []

    try:
        for i, word in enumerate(words_to_cache, 1):
            try:
                # 调用 GLM API
                word_data = fetch_word_definition_from_glm(word)

                if not word_data:
                    logger.warning(f"[{i}/{total_words}] {word} - API 返回空")
                    failed_count += 1
                    failed_words.append(word)
                    time.sleep(1)  # API 失败后等待
                    continue

                # 获取音频 URL
                try:
                    audio_urls = fetch_word_audio_urls(word_data['word'])
                except Exception as e:
                    logger.warning(f"[{i}/{total_words}] {word} - 音频获取失败: {e}")
                    audio_urls = None

                # 保存到缓存（每个词立即保存）
                if save_word_to_cache(word_data, audio_urls):
                    logger.info(f"[{i}/{total_words}] {word} - ✅ 成功")
                    success_count += 1
                else:
                    logger.warning(f"[{i}/{total_words}] {word} - ⚠️ 保存失败")
                    failed_count += 1
                    failed_words.append(word)

                # API 限流：每 5 个单词后等待 2 秒
                if i % 5 == 0:
                    logger.info(f"⏸️  已处理 {i}/{total_words}，等待 2 秒...")
                    time.sleep(2)

                # 每 5 分钟汇报进度
                current_time = time.time()
                if current_time - last_progress_time >= 300:  # 300 秒 = 5 分钟
                    elapsed = current_time - start_time
                    progress_pct = (i / total_words) * 100
                    speed = i / (elapsed / 60)  # 每分钟处理数
                    remaining_min = (total_words - i) / speed if speed > 0 else 0

                    logger.info("=" * 70)
                    logger.info(f"⏱️  进度报告（运行 {int(elapsed/60)} 分钟）")
                    logger.info(f"  - 已处理: {i}/{total_words} ({progress_pct:.1f}%)")
                    logger.info(f"  - 成功: {success_count} | 失败: {failed_count}")
                    logger.info(f"  - 速度: {speed:.1f} 词/分钟")
                    logger.info(f"  - 预计剩余: {int(remaining_min)} 分钟")
                    logger.info("=" * 70)
                    last_progress_time = current_time
                else:
                    time.sleep(0.5)  # 每个单词之间等待 0.5 秒

            except KeyboardInterrupt:
                logger.info("\n⚠️  用户中断，正在保存进度...")
                break
            except Exception as e:
                logger.error(f"[{i}/{total_words}] {word} - 处理异常: {e}")
                failed_count += 1
                failed_words.append(word)
                continue  # 继续处理下一个词，不中断整个脚本

    except Exception as e:
        logger.critical(f"脚本严重错误: {e}")
        raise

    # 5. 总结
    logger.info("=" * 70)
    logger.info("📊 预生成完成！")
    logger.info("=" * 70)
    logger.info(f"✅ 成功: {success_count} 个")
    logger.info(f"❌ 失败: {failed_count} 个")
    logger.info(f"📈 成功率: {success_count / total_words * 100:.1f}%")

    if failed_words:
        logger.info(f"\n⚠️  失败单词列表 ({len(failed_words)} 个):")
        logger.info(f"   {', '.join(failed_words[:20])}")
        if len(failed_words) > 20:
            logger.info(f"   ... 还有 {len(failed_words) - 20} 个")
        logger.info(f"\n💾 失败单词已保存到日志: {log_file}")

    # 6. 查询缓存统计
    stats_response = supabase.table('dictionary_cache').select('hit_count').execute()
    total_cached = len(stats_response.data)
    total_hits = sum(row.get('hit_count', 0) for row in stats_response.data)

    logger.info(f"\n📚 缓存统计:")
    logger.info(f"  - 总单词数: {total_cached}")
    logger.info(f"  - 总命中次数: {total_hits}")
    if total_cached > 0:
        logger.info(f"  - 平均命中: {total_hits / total_cached:.1f} 次/词")
    logger.info("=" * 70)

if __name__ == '__main__':
    main()
