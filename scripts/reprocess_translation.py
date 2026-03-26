#!/usr/bin/env python3
"""
重新翻译素材脚本 v1.0
使用上下文感知的翻译 Prompt，提升翻译质量

核心改进：
1. 上下文感知：发送整段对话作为上下文
2. 专业同传身份：礼貌、职场、专业
3. 代词指代明确：关联前文
4. 错误案例库：禁止低俗翻译

版本历史：
- v1.0 (2026-03-26): 上下文感知翻译
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

# ==================== 翻译 Prompt ====================

# 系统提示词
TRANSLATION_SYSTEM_PROMPT = """你是一位专业的英语同传翻译，服务于高端商务场景。

**核心原则**：
1. **上下文感知**：每一句翻译都必须关联前文，代词必须明确指代具体事物
2. **专业语气**：使用"您"而非"你"，语气礼貌、职场、专业
3. **准确传意**：准确理解英制文化背景（如 First floor = 二楼）
4. **避免口语化**：不使用俚语、低俗词汇

**错误案例库（严禁以下翻译）**：

❌ 餐饮场景错误：
- sit-down meal → 禁止译为"坐着来"或"套餐"，必须译为"桌餐/位餐"
- buffet → 必须译为"自助餐"
- two-course meal → 必须译为"双道菜套餐"

❌ 价格与代词错误：
- What sort of price... for that? → 禁止译为"那玩意儿多少钱？"，必须译为"那项费用/这种套餐的价格大约是多少？"
- that → 必须根据上下文明确指代（如：套餐、价格、计划），禁止译为"那玩意儿"

❌ 地点与数量错误：
- First floor (英制) → 必须译为"二楼"
- Room (宴会场景) → 必须译为"宴会厅/会场"，禁止译为"房间/租个房"
- Around 80 → 禁止译为"80几"，必须译为"大约 80 人左右"

❌ 口语习惯错误：
- I really don't like it when you can't talk → 禁止译为"你讲不话的时候"，必须译为"吵到没法聊天/无法正常交谈的情况"

**翻译流程**：
1. 先阅读上下文（前 5-10 句）
2. 理解当前句中的代词指代
3. 使用专业、礼貌的中文表达
4. 只返回翻译结果，不要有任何解释"""

# 繁体翻译系统提示词
TRANSLATION_SYSTEM_PROMPT_ZH_HANT = """你是一位專業的英語同傳翻譯，服務於高端商務場景。

**核心原則**：
1. **上下文感知**：每一句翻譯都必須關聯前文，代詞必須明確指代具體事物
2. **專業語氣**：使用「您」而非「你」，語氣禮貌、職場、專業
3. **準確傳意**：準確理解英制文化背景（如 First floor = 二樓）
4. **避免口語化**：不使用俚語、低俗詞彙

**錯誤案例庫（嚴禁以下翻譯）**：

❌ 餐飲場景錯誤：
- sit-down meal → 禁止譯為「坐著來」或「套餐」，必須譯為「桌餐/位餐」
- buffet → 必須譯為「自助餐」
- two-course meal → 必須譯為「雙道菜套餐」

❌ 價格與代詞錯誤：
- What sort of price... for that? → 禁止譯為「那玩意多少錢？」，必須譯為「那項費用/這種套餐的價格大約是多少？」
- that → 必須根據上下文明確指代（如：套餐、價格、計劃），禁止譯為「那玩意」

❌ 地點與數量錯誤：
- First floor (英制) → 必須譯為「二樓」
- Room (宴會場景) → 必須譯為「宴會廳/會場」，禁止譯為「房間/租個房」
- Around 80 → 禁止譯為「80幾」，必須譯為「大約 80 人左右」

❌ 口語習慣錯誤：
- I really don't like it when you can't talk → 禁止譯為「你講不話的時候」，必須譯為「吵到沒法聊天/無法正常交談的狀況」

**翻譯流程**：
1. 先閱讀上下文（前 5-10 句）
2. 理解當前句中的代詞指代
3. 使用專業、禮貌的中文表達
4. 只返回翻譯結果，不要有任何解釋"""

# 越南语翻译系统提示词
TRANSLATION_SYSTEM_PROMPT_VI = """Bạn là một phiên dịch viên tiếng Anh chuyên nghiệp, phục vụ trong các tình huống kinh doanh cao cấp.

**Nguyên tắc cốt lõi**:
1. **Nhận biết ngữ cảnh**: Mỗi câu dịch phải liên quan đến ngữ cảnh trước đó, đại từ phải chỉ rõ đối tượng cụ thể
2. **Giọng điệu chuyên nghiệp**: Sử dụng ngôn ngữ lịch sự, chuyên nghiệp
3. **Truyền đạt chính xác**: Hiểu rõ bối cảnh văn hóa
4. **Tránh ngôn ngữ suồng sã**: Không dùng từ lóng, từ ngữ thô tục

**Quy trình dịch**:
1. Đọc ngữ cảnh (5-10 câu trước đó)
2. Hiểu rõ đại từ trong câu hiện tại chỉ điều gì
3. Sử dụng tiếng Trung chuyên nghiệp, lịch sự
4. Chỉ trả về kết quả dịch, không có giải thích nào khác"""

def log(msg: str):
    """简化日志输出"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def translate_with_context(
    sentence_text: str,
    context_sentences: list,
    target_lang: str = 'zh'
) -> str:
    """使用上下文感知的翻译 API

    Args:
        sentence_text: 当前句子的英文文本
        context_sentences: 前文句子列表（用于上下文）
        target_lang: 目标语言 ('zh', 'zh_hant', 'vi')

    Returns:
        翻译结果
    """
    # 构建上下文（最多前 5 句）
    context_text = '\n'.join([f"{i+1}. {s['text']}" for i, s in enumerate(context_sentences[-5:])])

    # 选择系统提示词
    if target_lang == 'zh_hant':
        system_prompt = TRANSLATION_SYSTEM_PROMPT_ZH_HANT
        user_instruction = "請將以下英文句子翻譯成繁體中文（台灣/香港常用）。請根據上下文翻譯，代詞必須明確指代。"
    elif target_lang == 'vi':
        system_prompt = TRANSLATION_SYSTEM_PROMPT_VI
        user_instruction = "Hãy dịch câu tiếng Anh sau đây sang tiếng Việt. Dịch dựa trên ngữ cảnh, đại từ phải chỉ rõ đối tượng."
    else:
        system_prompt = TRANSLATION_SYSTEM_PROMPT
        user_instruction = "请将以下英文句子翻译成简体中文。请根据上下文翻译，代词必须明确指代。"

    # 构建用户消息
    user_message = f"""{user_instruction}

**上下文**（前文）：
{context_text if context_text else '(无前文)'}

**当前句**：
{sentence_text}

**翻译**："""

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
                "max_tokens": 500
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            translation = result["choices"][0]["message"]["content"].strip()
            return translation
        else:
            log(f"  ⚠ API 错误: {response.status_code}")
            return sentence_text  # 失败时返回原文

    except Exception as e:
        log(f"  ⚠ 翻译失败: {e}")
        return sentence_text  # 失败时返回原文

def reprocess_material(slug: str) -> bool:
    """重新翻译单个素材"""
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

        # 重新翻译每个句子
        success_count = 0
        fail_count = 0

        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            # 获取前文作为上下文
            context_sentences = transcript[:i]

            # 翻译成三语
            translations = {}

            # 1. 简体中文
            translations['zh'] = translate_with_context(
                sentence_text,
                context_sentences,
                'zh'
            )
            time.sleep(0.3)

            # 2. 繁体中文
            translations['zh_hant'] = translate_with_context(
                sentence_text,
                context_sentences,
                'zh_hant'
            )
            time.sleep(0.3)

            # 3. 越南语
            translations['vi'] = translate_with_context(
                sentence_text,
                context_sentences,
                'vi'
            )
            time.sleep(0.3)

            # 更新句子
            sentence['translation'] = translations
            success_count += 1

            if (i + 1) % 5 == 0:
                log(f"    进度: {i+1}/{len(transcript)}")

        log(f"  ✓ 完成: 成功 {success_count}, 失败 {fail_count}")

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
    # 指定要重新翻译的素材
    test_slugs = [
        'cam-14-academic-listening-test-3-part-1',
        'cam-14-academic-listening-test-4-part-1'
    ]

    print("="*70)
    print("  重新翻译素材（上下文感知）")
    print("="*70)
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"总数: {len(test_slugs)} 个素材")
    print("="*70)

    # 统计
    success_count = 0
    fail_count = 0

    # 处理每个素材
    for i, slug in enumerate(test_slugs, 1):
        log(f"\n[{i}/{len(test_slugs)}] {slug}")

        if reprocess_material(slug):
            success_count += 1
        else:
            fail_count += 1

    # 最终统计
    print("\n" + "="*70)
    print("  重新翻译完成")
    print("="*70)
    print(f"成功: {success_count}")
    print(f"失败: {fail_count}")
    print(f"总计: {len(test_slugs)}")
    print("="*70)

if __name__ == '__main__':
    main()
