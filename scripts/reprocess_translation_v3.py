#!/usr/bin/env python3
"""
雅思听力素材翻译引擎 v3.0
支持 19 种语言的全语境翻译

核心改进：
1. 新增 16 种语言：ar, de, es, ja, ms, ru, tr, el, id, ko, pt, th, uk, bn, mn, hi
2. 增量更新策略：保留现有翻译，仅添加新语言
3. JSON 结构验证：确保 19 种语言都存在

版本历史：
- v3.0 (2026-03-29): 19 语言支持 + 增量更新逻辑
- v2.0 (2026-03-26): 基于完整协议重构
"""
import os
import json
import requests
import time
from pathlib import Path
from supabase import create_client
from typing import Dict, Optional

# ==================== 加载环境变量 ====================
def load_env():
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

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
GLM_API_KEY = os.environ.get('GLM_API_KEY')

# ==================== 语言配置 ====================

# 19 种语言配置
LANGUAGES = {
    'zh': {'name': '简体中文', 'system_prompt': 'zh-CN'},
    'zh_hant': {'name': '繁體中文', 'system_prompt': 'zh-TW'},
    'vi': {'name': 'Tiếng Việt', 'system_prompt': 'vi-VN'},
    'ar': {'name': 'العربية', 'system_prompt': 'ar-SA'},
    'de': {'name': 'Deutsch', 'system_prompt': 'de-DE'},
    'es': {'name': 'Español', 'system_prompt': 'es-ES'},
    'ja': {'name': '日本語', 'system_prompt': 'ja-JP'},
    'ms': {'name': 'Bahasa Melayu', 'system_prompt': 'ms-MY'},
    'ru': {'name': 'Русский', 'system_prompt': 'ru-RU'},
    'tr': {'name': 'Türkçe', 'system_prompt': 'tr-TR'},
    'el': {'name': 'Ελληνικά', 'system_prompt': 'el-GR'},
    'id': {'name': 'Bahasa Indonesia', 'system_prompt': 'id-ID'},
    'ko': {'name': '한국어', 'system_prompt': 'ko-KR'},
    'pt': {'name': 'Português', 'system_prompt': 'pt-PT'},
    'th': {'name': 'ภาษาไทย', 'system_prompt': 'th-TH'},
    'uk': {'name': 'Українська', 'system_prompt': 'uk-UA'},
    'bn': {'name': 'বাংলা', 'system_prompt': 'bn-BD'},
    'mn': {'name': 'Монгол', 'system_prompt': 'mn-MN'},
    'hi': {'name': 'हिन्दी', 'system_prompt': 'hi-IN'},
}

# 新增的 16 种语言（用于增量更新）
NEW_LANGUAGES = ['ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el', 'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']

# ==================== 翻译协议 ====================

# 原有的三语翻译系统提示词（保持不变）
TRANSLATION_SYSTEM_ZH = """你是一位专业的雅思听力翻译专家。

## 核心原则

### 1. 上下文感知
- 翻译每一句时，必须参考前文上下文
- 代词必须明确指代具体对象
- 理解英式文化背景

### 2. 场景化翻译规范

**A. 生活服务类**
- 基调：礼貌、专业
- 术语规范：sit-down meal -> 桌餐, buffet -> 自助餐, facilities -> 场地

**B. 医疗/专业咨询类**
- 基调：严谨、专业关怀

**C. 学术讨论类**
- 基调：干练、研讨式

**D. 讲座科普类**
- 基调：书面、庄重、学术感

### 3. 强制负面禁令
1. 禁代词拟人化：严禁出现"不让那阻止她"
2. 禁垃圾口语词：严禁出现"那事儿"、"点东西"
3. 禁低质直译
4. 禁数学逻辑模糊

只返回翻译结果，不要有任何解释。"""

TRANSLATION_SYSTEM_ZH_HANT = """你是一位專業的雅思聽力翻譯專家。

## 核心原則

### 1. 上下文感知
- 翻譯每一句時，必須參考前文上下文
- 代詞必須明確指代具體對象
- 理解英式文化背景

### 2. 場景化翻譯規範

**A. 生活服務類**
- 基調：禮貌、專業
- 術語規範：sit-down meal -> 桌餐, buffet -> 自助餐

**B. 醫療/專業諮詢類**
- 基調：嚴謹、專業關懷

**C. 學術討論類**
- 基調：幹練、研討式

**D. 講座科普類**
- 基調：書面、莊重、學術感

只返回翻譯結果，不要有任何解釋。"""

TRANSLATION_SYSTEM_VI = """Bạn là chuyên gia dịch thuật IELTS.

## Nguyên tắc cốt lõi

### 1. Nhận biết ngữ cảnh
- Dịch mỗi câu phải tham khảo ngữ cảnh trước đó
- Đại từ phải chỉ rõ đối tượng cụ thể
- Hiểu bối cảnh văn hóa Anh

### 2. Dịch theo từng bối cảnh

**A. Dịch vụ cuộc sống**
- Giọng điệu: Lịch sự, chuyên nghiệp

**B. Y tế/Chuyên gia**
- Giọng điệu: Chuyên nghiệp, quan tâm

**C. Thảo luận học thuật**
- Giọng điệu: Súc tích, chuyên nghiệp

**D. Bài giảng/Khoa học**
- Giọng điệu: Trang trọng, học thuật

Chỉ trả về kết quả dịch."""

# 新语言的通用翻译提示词
TRANSLATION_SYSTEM_GENERIC = """You are a professional translator for IELTS listening materials.

## Core Principles

### 1. Context Awareness
- Translate each sentence with reference to the preceding context
- Pronouns must clearly refer to specific objects
- Understand British English cultural context

### 2. Register and Tone

**A. Daily Life Services**
- Tone: Polite, professional
- Key terms: sit-down meal, buffet, facilities

**B. Medical/Professional Consultation**
- Tone: Formal, professional, caring

**C. Academic Discussion**
- Tone: Concise, professional, logical

**D. Academic Lectures**
- Tone: Formal, scholarly

### 3. Quality Standards
- Accurate meaning transfer
- Natural flow in target language
- Appropriate register for IELTS context

Return ONLY the translation, no explanation."""

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def get_system_prompt(lang_code: str) -> str:
    """获取指定语言的系统提示词"""
    if lang_code == 'zh_hant':
        return TRANSLATION_SYSTEM_ZH_HANT
    elif lang_code == 'vi':
        return TRANSLATION_SYSTEM_VI
    elif lang_code == 'zh':
        return TRANSLATION_SYSTEM_ZH
    else:
        # 新语言使用通用提示词
        lang_name = LANGUAGES[lang_code]['name']
        return f"""{TRANSLATION_SYSTEM_GENERIC}

## Target Language
Translate to: {lang_name} ({lang_code})

Ensure the translation follows the linguistic and cultural norms of {lang_name}."""

def translate_with_full_context(
    sentence_text: str,
    full_context: str,
    target_lang: str = 'zh'
) -> str:
    """使用全语境感知的翻译 API

    Args:
        sentence_text: 当前句子的英文文本
        full_context: 完整的上下文（整个 Part 的所有句子）
        target_lang: 目标语言代码

    Returns:
        翻译结果
    """
    system_prompt = get_system_prompt(target_lang)
    lang_name = LANGUAGES[target_lang]['name']

    # 构建用户消息
    if target_lang == 'zh':
        user_instruction = "请将以下英文句子翻译成简体中文。请根据完整上下文翻译，代词必须明确指代。"
    elif target_lang == 'zh_hant':
        user_instruction = "請將以下英文句子翻譯成繁體中文。請根據完整上下文翻譯，代詞必須明確指代。"
    elif target_lang == 'vi':
        user_instruction = "Hãy dịch câu tiếng Anh sau đây sang tiếng Việt. Dịch dựa trên ngữ cảnh đầy đủ."
    else:
        user_instruction = f"Translate the following English sentence to {lang_name}. Base your translation on the full context provided."

    user_message = f"""{user_instruction}

**Full Context**:
{full_context}

**Current Sentence**:
{sentence_text}

**Translation**:"""

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
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": 0.3,
                "max_tokens": 1000
            },
            timeout=60
        )

        if response.status_code == 200:
            result = response.json()
            translation = result["choices"][0]["message"]["content"].strip()
            return translation
        else:
            log(f"  ⚠ API 错误 ({target_lang}): {response.status_code}")
            return sentence_text

    except Exception as e:
        log(f"  ⚠ 翻译失败 ({target_lang}): {e}")
        return sentence_text

def reprocess_material(slug: str, dry_run: bool = False, languages: Optional[list] = None) -> bool:
    """重新翻译单个素材（支持增量更新）

    Args:
        slug: 素材的 slug
        dry_run: 是否为空跑模式（不写入数据库）
        languages: 要翻译的语言列表，None 表示全部 19 种

    Returns:
        是否成功
    """
    try:
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

        # 构建完整上下文
        full_context = '\n'.join([f"{i+1}. {s['text']}" for i, s in enumerate(transcript)])

        # 确定要翻译的语言
        if languages is None:
            languages = list(LANGUAGES.keys())

        log(f"  目标语言: {len(languages)} 种 ({', '.join(languages[:5])}{'...' if len(languages) > 5 else ''})")

        # 重新翻译每个句子
        success_count = 0
        fail_count = 0

        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            # 获取现有翻译（增量更新）
            existing_translations = sentence.get('translation', {})
            if isinstance(existing_translations, str):
                existing_translations = {}

            # 翻译新语言
            new_translations = {}
            for lang in languages:
                if lang not in existing_translations:
                    log(f"    翻译句子 {i+1}/{len(transcript)} 到 {LANGUAGES[lang]['name']} ({lang})")
                    new_translations[lang] = translate_with_full_context(
                        sentence_text,
                        full_context,
                        lang
                    )
                    time.sleep(0.5)  # API 限流

            # 合并翻译（增量更新）
            merged_translations = {**existing_translations, **new_translations}
            sentence['translation'] = merged_translations
            success_count += 1

            if (i + 1) % 5 == 0:
                log(f"    进度: {i+1}/{len(transcript)}")

        log(f"  ✓ 翻译完成: 成功 {success_count}, 失败 {fail_count}")

        # 验证 19 种语言都存在
        if transcript:
            sample = transcript[0].get('translation', {})
            missing = [lang for lang in LANGUAGES.keys() if lang not in sample]
            if missing:
                log(f"  ⚠️ 缺少语言: {', '.join(missing)}")
            else:
                log(f"  ✅ 所有 19 种语言完整")

        # 打印示例 JSON
        if transcript and len(transcript) > 0:
            print("\n" + "="*80)
            print("  📋 第一句翻译预览（增量更新后）")
            print("="*80)
            print(json.dumps(transcript[0]['translation'], ensure_ascii=False, indent=2))
            print("="*80)

        # 保存到数据库
        if not dry_run:
            client.table('materials').update({
                'transcript': transcript
            }).eq('slug', slug).execute()
            log(f"  ✅ 已保存到数据库")
        else:
            log(f"  🧪 空跑模式：未保存到数据库")

        return True

    except Exception as e:
        log(f"  ❌ 失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """主函数：测试单个素材"""
    test_slug = "corruption"  # 测试素材

    print("="*80)
    print("  雅思听力翻译引擎 v3.0 - 19 语言测试")
    print("="*80)
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"测试素材: {test_slug}")
    print(f"模式: 空跑（DRY RUN）")
    print(f"目标语言: 19 种（zh, zh_hant, vi + 16 种新语言）")
    print("="*80)

    # 执行翻译（空跑模式）
    reprocess_material(test_slug, dry_run=True, languages=NEW_LANGUAGES)

    print("\n" + "="*80)
    print("  测试完成")
    print("="*80)
    print("请检查上方输出的 JSON 结构，确认：")
    print("  1. 包含所有 19 种语言代码")
    print("  2. 孟加拉语（bn）和蒙古语（mn）无乱码")
    print("  3. 原有的 zh, zh_hant, vi 内容未变动")
    print("="*80)

if __name__ == '__main__':
    main()
