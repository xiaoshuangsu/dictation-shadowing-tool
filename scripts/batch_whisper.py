#!/usr/bin/env python3
"""
批量 Whisper 处理脚本
使用 openai-whisper 库处理所有素材
"""

import os
import json
import re
import time
import requests
import whisper
from pathlib import Path
from typing import List, Dict, Any
from supabase import create_client, Client

# ============ 配置 ============
SUPABASE_URL = "https://cuxotlijjnxbsirpdkgr.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# 常见冠词/介词/连词（专有名词的前缀词）
PREFIX_WORDS = {
    'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with',
    'by', 'about', 'as', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'over', 'and', 'but', 'or'
}

# ============ 工具函数 ============

def is_capitalized(text: str) -> bool:
    """检查文本是否首字母大写"""
    text = text.strip()
    if not text:
        return False
    return text[0].isupper()

def split_words_to_sentences(words: List[Dict], title: str) -> List[Dict]:
    """
    将词级时间戳转换为句子

    分句规则：
    1. 强制标点：[.?!] 必须断句
    2. 静音敏感度：停顿超过 0.8 秒才断句
    3. 逗号处理：逗号后停顿超过 0.8 秒才断句

    Args:
        words: Whisper 词级时间戳列表
        title: 素材标题（未使用，保留参数兼容性）

    Returns:
        句子列表，每个句子包含 id, text, start, end
    """
    if not words:
        return []

    sentences = []
    current_sentence_words = []
    sentence_start = words[0]['start']

    for i, word in enumerate(words):
        current_sentence_words.append(word)
        word_text = word['word'].strip()
        should_end = False

        # 规则1: 强制标点 - [.?!] 必须断句
        if word_text.endswith(('.', '?', '!')):
            should_end = True

        # 规则2: 逗号 + 长停顿才断句
        elif word_text.endswith(','):
            if i < len(words) - 1:
                next_word = words[i + 1]
                pause = next_word['start'] - word['end']
                # 只有停顿超过 0.8 秒才在逗号处断句
                if pause > 0.8:
                    should_end = True

        # 规则3: 静音检测 - 停顿超过 0.8 秒才断句
        if i < len(words) - 1 and not should_end:
            next_word = words[i + 1]
            pause = next_word['start'] - word['end']
            if pause > 0.8:
                should_end = True

        if should_end and current_sentence_words:
            # 构建句子
            text = ''.join([w['word'] for w in current_sentence_words]).strip()
            if text and len(text) > 2:
                sentences.append({
                    'id': len(sentences) + 1,
                    'text': text,
                    'start': sentence_start,
                    'end': word['end']
                })
                current_sentence_words = []
                if i < len(words) - 1:
                    sentence_start = words[i + 1]['start']

    # 处理最后一句
    if current_sentence_words:
        text = ''.join([w['word'] for w in current_sentence_words]).strip()
        if text and len(text) > 2:
            sentences.append({
                'id': len(sentences) + 1,
                'text': text,
                'start': sentence_start,
                'end': current_sentence_words[-1]['end']
            })

    return sentences

def process_audio(audio_url: str, title: str, model_name: str = 'base') -> List[Dict]:
    """
    处理单个音频文件

    Args:
        audio_url: 音频文件 URL
        title: 素材标题
        model_name: Whisper 模型名称

    Returns:
        句子列表
    """
    print(f"  📥 下载音频...")
    response = requests.get(audio_url)
    audio_path = f"/tmp/whisper_{int(time.time())}.mp3"

    with open(audio_path, 'wb') as f:
        f.write(response.content)

    print(f"  ✅ 音频已下载")

    # 加载 Whisper 模型
    print(f"  🎯 加载 Whisper 模型 ({model_name})...")
    model = whisper.load_model(model_name)

    # 转录
    print(f"  🎤 正在转录...")
    result = model.transcribe(
        audio_path,
        language='en',
        word_timestamps=True,
        fp16=False  # CPU 模式
    )

    # 提取所有词级时间戳
    all_words = []
    for segment in result['segments']:
        if 'words' in segment:
            all_words.extend(segment['words'])

    # 分割成句子
    print(f"  📝 分割句子...")
    sentences = split_words_to_sentences(all_words, title)

    # 清理临时文件
    os.remove(audio_path)

    print(f"  ✅ 生成 {len(sentences)} 句")

    return sentences

def translate_sentence(text: str) -> str:
    """
    使用 MyMemory API 翻译句子
    """
    try:
        url = f"https://api.mymemory.translated.net/get?q={text}&langpair=en|zh-CN"
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get('responseStatus') == 200:
            return data['responseData']['translatedText']
    except Exception as e:
        print(f"    ⚠️ 翻译失败: {e}")

    return None

def improve_translation(text: str) -> str:
    """
    改进翻译质量（应用后处理规则）
    """
    # 移除句末的"。"
    text = re.sub(r'。$', '', text)

    # 其他改进规则...
    return text

def process_material(supabase: Client, material: Dict) -> bool:
    """
    处理单个素材

    Args:
        supabase: Supabase 客户端
        material: 素材信息

    Returns:
        是否成功
    """
    title = material['title']
    audio_url = material['audio_url']
    model = material.get('model', 'base')

    print(f"\n{'='*70}")
    print(f"🎯 处理: {title}")
    print(f"{'='*70}")

    try:
        # 步骤1: 转录
        sentences = process_audio(audio_url, title, model)

        # 步骤2: 翻译
        print(f"  🌐 翻译中...")
        for i, sentence in enumerate(sentences):
            if sentence['text']:
                translation = translate_sentence(sentence['text'])
                if translation:
                    # 应用后处理
                    sentence['translation'] = improve_translation(translation)
                    print(f"    [{i+1}/{len(sentences)}] {sentence['text'][:30]}... → {sentence['translation'][:20]}...")

                # 速率限制
                time.sleep(0.5)

        # 步骤3: 保存到数据库
        print(f"  💾 保存到数据库...")
        transcript_data = [
            {
                'id': s['id'],
                'text': s['text'],
                'startTime': f"{s['start']:.2f}",
                'endTime': f"{s['end']:.2f}",
                'translation': s.get('translation')
            }
            for s in sentences
        ]

        supabase.table('materials').update({
            'transcript': transcript_data,
            'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S')
        }).eq('title', title).execute()

        print(f"  ✅ 保存成功!")
        return True

    except Exception as e:
        print(f"  ❌ 处理失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """主函数"""
    # 检查环境变量
    if not SUPABASE_KEY:
        print("❌ 错误: 请设置 SUPABASE_SERVICE_KEY 环境变量")
        print("   export SUPABASE_SERVICE_KEY=your_key_here")
        return

    # 初始化 Supabase
    print("🔗 连接 Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 读取待处理素材列表
    config_path = Path(__file__).parent / 'materials-to-process.json'
    if not config_path.exists():
        print(f"❌ 错误: 配置文件不存在: {config_path}")
        return

    with open(config_path, 'r') as f:
        config = json.load(f)

    materials = config.get('materials', [])
    settings = config.get('settings', {})

    print(f"\n{'='*70}")
    print(f"🚀 批量 Whisper 处理 (Python 版本)")
    print(f"{'='*70}")
    print(f"📋 待处理素材: {len(materials)} 个")
    print(f"🎯 模型: {settings.get('model', 'base')}")
    print(f"🌐 自动翻译: {settings.get('auto_translate', True)}")
    print(f"{'='*70}\n")

    # 批量处理
    success_count = 0
    fail_count = 0
    start_time = time.time()

    for i, material in enumerate(materials, 1):
        print(f"\n[{i}/{len(materials)}] 处理中...")

        if process_material(supabase, material):
            success_count += 1
        else:
            fail_count += 1

        # 短暂延迟
        time.sleep(2)

    # 统计
    duration = (time.time() - start_time) / 60

    print(f"\n{'='*70}")
    print(f"📊 处理完成统计")
    print(f"{'='*70}")
    print(f"✅ 成功: {success_count}")
    print(f"❌ 失败: {fail_count}")
    print(f"⏱️  总耗时: {duration:.1f} 分钟")
    print(f"{'='*70}\n")

if __name__ == '__main__':
    main()
