#!/usr/bin/env python3
"""
重新转录 "Empty Your Mind" 音频，修复时间戳问题

使用方法：
1. source scripts/.venv/bin/activate
2. python scripts/retranscribe_empty_your_mind.py
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from supabase import Client

# 尝试导入 whisper
try:
    import whisper
except ImportError:
    print("❌ 错误：whisper 未安装")
    print("   请先安装: pip install openai-whisper")
    sys.exit(1)

# 创建 Supabase 客户端
SUPABASE_URL = "https://cuxotlijjnxbsirpdkgr.supabase.co"

# 从 .env.local 读取密钥
env_file = Path(__file__).parent.parent / '.env.local'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                SUPABASE_KEY = line.split('=', 1)[1].strip()
                break
else:
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_KEY:
    print("❌ 错误：请设置环境变量 SUPABASE_SERVICE_KEY")
    sys.exit(1)

supabase = Client(SUPABASE_URL, SUPABASE_KEY)

# ============ 配置 ============
AUDIO_URL = "https://media.shadowhub.app/audio/empty-your-mind.mp3"
AUDIO_FILENAME = "/tmp/empty-your-mind.mp3"
TRANSCRIPT_OUTPUT = "/tmp/empty-your-mind_transcript.json"
MODEL_SIZE = "small"  # 使用 small 模型以获得词级时间戳

print("=" * 60)
print("🎯 重新转录 'Empty Your Mind' 音频")
print("   目标：修复不准确的时间戳")
print("=" * 60)

# ============ 步骤 1: 下载音频 ============
print(f"\n⬇️  步骤 1: 下载音频文件...")
print(f"   URL: {AUDIO_URL}")

try:
    response = requests.get(AUDIO_URL, timeout=30)
    response.raise_for_status()

    with open(AUDIO_FILENAME, 'wb') as f:
        f.write(response.content)

    file_size_mb = len(response.content) / 1024 / 1024
    print(f"✅ 音频已下载: {AUDIO_FILENAME} ({file_size_mb:.1f} MB)")
except Exception as e:
    print(f"❌ 下载失败: {e}")
    sys.exit(1)

# ============ 步骤 2: Whisper 转录 ============
print(f"\n🎙️  步骤 2: 使用 Whisper 转录...")
print(f"   模型: {MODEL_SIZE}")
print(f"   这可能需要几分钟，请耐心等待...")

start_time = time.time()

try:
    # 加载 Whisper 模型
    print(f"   加载 Whisper 模型...")
    model = whisper.load_model(MODEL_SIZE)

    # 转录音频
    print(f"   开始转录音频...")
    result = model.transcribe(
        AUDIO_FILENAME,
        word_timestamps=True,            # 启用词级时间戳
        language="en",                    # 指定语言为英语
        fp16=False,                       # 使用 FP32 精度（兼容性更好）
        # VAD 优化参数 - 调低静音判定灵敏度，保留词尾摩擦音
        no_speech_threshold=0.05,         # 大幅降低静音阈值，保留微弱摩擦音如 /s/
        logprob_threshold=-2.0,           # 降低概率阈值，接受更多边缘音频
        compression_ratio_threshold=3.0,  # 提高压缩比容忍度
        condition_on_previous_text=False,  # 减少对前文依赖，更准确检测每个词
    )

    elapsed = time.time() - start_time
    print(f"✅ 转录完成！耗时: {elapsed:.1f} 秒")

except Exception as e:
    print(f"❌ 转录失败: {e}")
    # 清理临时文件
    if os.path.exists(AUDIO_FILENAME):
        os.remove(AUDIO_FILENAME)
    sys.exit(1)

# ============ 步骤 3: 物理断句处理 ============
print(f"\n📋 步骤 3: 物理断句（毫秒级对齐）...")

# 从 segments 中提取所有词级时间戳
words = []
for segment in result.get('segments', []):
    if 'words' in segment:
        words.extend(segment['words'])

print(f"   共识别出 {len(words)} 个词")

# ============ 物理断句函数 ============
def split_words_to_sentences(words, title: str):
    """
    将词级时间戳转换为句子

    动态冲突检测逻辑（解决吞音 + 避免重叠）：
    1. 标点强制切分：遇到 ?.! 就断句（不管停顿多长）
    2. 逗号+停顿切分：逗号 , + 停顿 > 0.8s → 断句
    3. 长停顿切分：任何停顿 > 0.8s → 断句

    关键修复：动态后扩 + 静音裁剪 + 首部锁定
    - 动态后扩：延长 min(300ms, 间隙/2)，绝不占用下一句
    - 静音裁剪：使用 Whisper 已识别的停顿作为切割点
    - 首部锁定：起始时间最多向前 30ms，避免听到上一句尾音
    """
    if not words:
        return []

    sentences = []
    current_sentence_words = []
    sentence_start = words[0]['start']

    PAUSE_THRESHOLD = 0.8    # 停顿阈值（秒）
    TAIL_BUFFER = 0.3        # 默认尾部缓冲 300ms
    START_BUFFER = 0.03      # 起始时间最多向前 30ms

    for i, word in enumerate(words):
        current_sentence_words.append(word)
        word_text = word['word'].strip()
        should_end = False
        sentence_end_time = word['end']  # 默认使用词的结束时间

        # 只有在不是最后一个词时才检查停顿
        if i < len(words) - 1:
            next_word = words[i + 1]
            pause = next_word['start'] - word['end']

            # 规则1: 遇到 ?.! 强制断句（不管停顿多长）
            if word_text.endswith(('.', '?', '!')):
                should_end = True
                # 动态后扩：计算与下一句的间隙
                gap_to_next = next_word['start'] - word['end']
                # 实际延长量 = min(300ms, 间隙/2)
                # 这样既能保住尾音，又不会占用下一句的时间
                if gap_to_next > 0:
                    dynamic_extension = min(TAIL_BUFFER, gap_to_next / 2)
                    sentence_end_time = word['end'] + dynamic_extension
                else:
                    # 如果间隙为负（重叠），使用词的结束时间
                    sentence_end_time = word['end']

            # 规则2: 逗号 + 停顿 > 0.8s → 断句
            elif word_text.endswith(',') and pause > PAUSE_THRESHOLD:
                should_end = True
                # 对于逗号断句，也应用动态后扩
                gap_to_next = next_word['start'] - word['end']
                if gap_to_next > 0:
                    dynamic_extension = min(TAIL_BUFFER, gap_to_next / 2)
                    sentence_end_time = word['end'] + dynamic_extension
                else:
                    sentence_end_time = word['end']

            # 规则3: 任何停顿 > 0.8s → 断句（即使没有标点）
            elif pause > PAUSE_THRESHOLD:
                should_end = True
                # 对于长停顿，在停顿的中间位置结束（静音裁剪）
                # 这样既不会太早切断尾音，也不会占用下一句
                sentence_end_time = word['end'] + pause * 0.5

        if should_end and current_sentence_words:
            text = ''.join([w['word'] for w in current_sentence_words]).strip()
            if text and len(text) > 2:
                # 首部锁定：起始时间最多向前 30ms
                actual_start = max(0, sentence_start - START_BUFFER)

                sentences.append({
                    'id': len(sentences) + 1,
                    'text': text,
                    'start': actual_start,
                    'end': sentence_end_time
                })
                current_sentence_words = []
                if i < len(words) - 1:
                    # 下一句的起始时间锁定在原始识别点（不再前移 100ms）
                    sentence_start = words[i + 1]['start']

    # 处理最后一句
    if current_sentence_words:
        text = ''.join([w['word'] for w in current_sentence_words]).strip()
        if text and len(text) > 2:
            actual_start = max(0, sentence_start - START_BUFFER)
            # 最后一句向后延长 300ms（没有下一句冲突）
            sentences.append({
                'id': len(sentences) + 1,
                'text': text,
                'start': actual_start,
                'end': current_sentence_words[-1]['end'] + TAIL_BUFFER
            })

    return sentences

# 应用物理断句
if words:
    print(f"   使用词级时间戳进行物理断句...")
    sentences = split_words_to_sentences(words, "Empty Your Mind")
    print(f"   已生成 {len(sentences)} 个句子")

    # 调试：检查第20句的原始文本
    for i, s in enumerate(sentences):
        if 'hills' in s['text'].lower():
            print(f"\n   调试：找到包含 'hills' 的句子（第{i+1}句）:")
            print(f"   文本: {repr(s['text'])}")
            break

    # 转换字段名（start/end → startTime/endTime）
    transcript = []
    for s in sentences:
        transcript.append({
            'id': s['id'],
            'text': s['text'],
            'startTime': s['start'],
            'endTime': s['end']
        })
else:
    print(f"   ⚠️ 没有词级时间戳，使用 segments 时间戳...")
    segments = result.get('segments', [])

    if segments:
        print(f"   使用 segments 时间戳，共 {len(segments)} 个片段")

        # 从 segments 构造词级时间戳（用于断句）
        words_for_split = []
        for seg in segments:
            words_for_split.append({
                'word': seg['text'],
                'start': seg['start'],
                'end': seg['end']
            })

        sentences = split_words_to_sentences(words_for_split, "Empty Your Mind")
        print(f"   已生成 {len(sentences)} 个句子")

        # 转换字段名（start/end → startTime/endTime）
        transcript = []
        for s in sentences:
            transcript.append({
                'id': s['id'],
                'text': s['text'],
                'startTime': s['start'],
                'endTime': s['end']
            })
    else:
        print(f"   ❌ 错误：既没有 words 也没有 segments")
        sys.exit(1)

# 保存转录结果到文件
with open(TRANSCRIPT_OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(transcript, f, ensure_ascii=False, indent=2)

print(f"✅ 转录结果已保存: {TRANSCRIPT_OUTPUT}")

# 显示前 3 个句子
print(f"\n📝 前 3 个句子的时间戳:")
for i, sentence in enumerate(transcript[:3]):
    print(f"   {i+1}. [{sentence['startTime']} - {sentence['endTime']}] {sentence['text'][:50]}...")

# ============ 步骤 4: 更新数据库 ============
print(f"\n💾 步骤 4: 更新数据库...")

try:
    # 获取素材
    materials = supabase.table('materials').select('*').ilike('title', '%empty your mind%').execute().data

    if not materials or len(materials) == 0:
        print(f"❌ 错误：找不到 'Empty Your Mind' 素材")
        sys.exit(1)

    material = materials[0]
    print(f"   找到素材: {material['title']}")
    print(f"   ID: {material['id']}")

    # 更新 transcript
    result = supabase.table('materials').update({
        'transcript': transcript
    }).eq('id', material['id']).execute()

    if hasattr(result, 'error') and result.error:
        print(f"❌ 数据库更新失败: {result.error}")
        sys.exit(1)

    print(f"✅ 数据库更新成功！")
    print(f"   已更新 {len(transcript)} 个句子")

except Exception as e:
    print(f"❌ 数据库更新失败: {e}")
    sys.exit(1)

# ============ 步骤 5: 清理临时文件 ============
print(f"\n🧹 步骤 5: 清理临时文件...")

try:
    os.remove(AUDIO_FILENAME)
    print(f"   ✅ 已删除: {AUDIO_FILENAME}")
except:
    pass

try:
    os.remove(TRANSCRIPT_OUTPUT)
    print(f"   ✅ 已删除: {TRANSCRIPT_OUTPUT}")
except:
    pass

# ============ 完成 ============
print(f"\n" + "=" * 60)
print(f"🎉 完成！'Empty Your Mind' 的转录已重新生成")
print(f"=" * 60)
print(f"\n💡 提示：")
print(f"   1. 刷新浏览器页面")
print(f"   2. 测试音频播放是否完整")
print(f"   3. 如果正常，可以移除 AudioPlayer 中的特殊缓冲时间")
print(f"\n")
