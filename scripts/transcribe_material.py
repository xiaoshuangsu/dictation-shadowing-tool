#!/usr/bin/env python3
"""
使用 Whisper 转录单个素材

用法:
    python3 transcribe_material.py
"""

import os
import sys
import json
import time
import whisper
import requests
from pathlib import Path
from supabase import create_client, Client

# 添加 Homebrew bin 到 PATH（用于 ffmpeg）
sys.path.insert(0, '/opt/homebrew/bin')
os.environ['PATH'] = '/opt/homebrew/bin:' + os.environ.get('PATH', '')

# ============ 配置 ============
SUPABASE_URL = "https://cuxotlijjnxbsirpdkgr.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not SUPABASE_KEY:
    raise ValueError("请设置环境变量 SUPABASE_SERVICE_KEY")

# 要转录的素材
MATERIAL_TITLE = "A New Chapter"
STORAGE_BUCKET = "engnovate-audio"

# ============ 工具函数 ============

def is_capitalized(text: str) -> bool:
    """检查文本是否首字母大写"""
    text = text.strip()
    if not text:
        return False
    return text[0].isupper()

def split_words_to_sentences(words, title: str):
    """
    将词级时间戳转换为句子

    分句规则：
    1. 强制标点：[.?!] 必须断句
    2. 静音敏感度：停顿超过 1.5 秒才断句（针对连贯说话优化）
    3. 逗号处理：逗号后停顿超过 1.5 秒才断句
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
                if pause > 1.5:
                    should_end = True

        # 规则3: 静音检测 - 停顿超过 1.5 秒才断句（避免分割连贯说话）
        if i < len(words) - 1 and not should_end:
            next_word = words[i + 1]
            pause = next_word['start'] - word['end']
            if pause > 1.5:
                should_end = True

        if should_end and current_sentence_words:
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

def translate_sentence(text: str) -> str:
    """使用 MyMemory API 翻译句子"""
    try:
        url = f"https://api.mymemory.translated.net/get?q={text}&langpair=en|zh-CN"
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get('responseStatus') == 200:
            return data['responseData']['translatedText']
    except Exception as e:
        print(f"    ⚠️  翻译失败: {e}")

    return None

def main():
    """主函数"""
    print("=" * 70)
    print(f"🎯 Whisper 转录: {MATERIAL_TITLE}")
    print("=" * 70)

    # 初始化 Supabase
    print("🔗 连接 Supabase...")
    client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取素材信息
    print(f"📋 获取素材信息...")
    result = client.table('materials').select('*').eq('title', MATERIAL_TITLE).execute()

    if not result.data:
        print(f"❌ 错误: 未找到素材 '{MATERIAL_TITLE}'")
        return

    material = result.data[0]
    material_id = material['id']
    audio_path = material['audio_path']
    audio_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{audio_path}"

    print(f"  📌 素材 ID: {material_id}")
    print(f"  🔊 音频 URL: {audio_url}")
    print("=" * 70)

    try:
        # 步骤1: 下载音频
        print(f"📥 下载音频...")
        response = requests.get(audio_url)
        temp_audio_path = f"/tmp/whisper_{int(time.time())}.mp3"

        with open(temp_audio_path, 'wb') as f:
            f.write(response.content)

        print(f"  ✅ 音频已下载 ({len(response.content) / 1024 / 1024:.2f} MB)")

        # 步骤2: 加载 Whisper 模型
        print(f"🎯 加载 Whisper 模型 (base)...")
        model = whisper.load_model('base')

        # 步骤3: 转录
        print(f"🎤 正在转录...")
        result = model.transcribe(
            temp_audio_path,
            language='en',
            word_timestamps=True,
            fp16=False  # CPU 模式
        )

        # 提取所有词级时间戳
        all_words = []
        for segment in result['segments']:
            if 'words' in segment:
                all_words.extend(segment['words'])

        print(f"  ✅ 转录完成，共 {len(all_words)} 个词")

        # 步骤4: 分割成句子
        print(f"📝 分割句子...")
        sentences = split_words_to_sentences(all_words, MATERIAL_TITLE)
        print(f"  ✅ 生成 {len(sentences)} 句")

        # 步骤5: 翻译
        print(f"🌐 翻译中...")
        for i, sentence in enumerate(sentences):
            if sentence['text']:
                translation = translate_sentence(sentence['text'])
                if translation:
                    sentence['translation'] = translation
                    print(f"    [{i+1}/{len(sentences)}] {sentence['text'][:40]}... → {sentence['translation'][:20]}...")

                # 速率限制
                time.sleep(0.5)

        # 步骤6: 保存到数据库
        print(f"💾 保存到数据库...")
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

        client.table('materials').update({
            'transcript': transcript_data,
            'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S')
        }).eq('id', material_id).execute()

        print(f"  ✅ 保存成功!")

        # 清理临时文件
        os.remove(temp_audio_path)

        # 显示示例
        print("\n" + "=" * 70)
        print("📄 文稿预览 (前3句):")
        print("=" * 70)
        for i, s in enumerate(sentences[:3], 1):
            print(f"\n{i}. {s['text']}")
            print(f"   {s.get('translation', '')}")
            print(f"   ⏱️  {s['start']:.2f}s - {s['end']:.2f}s")

        print("\n" + "=" * 70)
        print("✅ 转录完成！")
        print("=" * 70)
        print(f"📌 素材 ID: {material_id}")
        print(f"📝 总句数: {len(sentences)}")
        print(f"🔗 在线练习: https://xiaoshuangsu.github.io/dictation-shadowing-tool/")
        print("=" * 70)

    except Exception as e:
        print(f"❌ 处理失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
