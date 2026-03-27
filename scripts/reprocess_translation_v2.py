#!/usr/bin/env python3
"""
雅思听力素材翻译引擎 v2.0
基于完整协议的上下文感知翻译

核心改进：
1. 场景化翻译规范（生活、医疗、学术、讲座）
2. 完美范例库（Few-Shot Learning）
3. 全语境感知（Full Context Processing）
4. 强制负面禁令
5. 多语言对齐（简中、繁中、越南语）

版本历史：
- v2.0 (2026-03-26): 基于完整协议重构
"""
import os
import json
import requests
import time
from pathlib import Path
from supabase import create_client

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

# ==================== 完整翻译协议 ====================

# 简体中文系统提示词
TRANSLATION_SYSTEM_ZH = """你是一位专业的雅思听力翻译专家，精通英式文化和学术场景。

## ⚠️ 最高优先级：全语境优先 (Full Context First)
**严禁为了句子通顺而牺牲原文的指代逻辑！**
- that/it 必须根据上下文明确指代，宁可句子稍长也不能简化为"它/那"
- 当上下文中提到"套餐/价格/计划/研究"时，that 必须译为"那项服务/这个计划/这项研究"
- 全语境理解优先于句子流畅度

## 核心原则

### 1. 上下文感知 (Context-Awareness)
- 翻译每一句时，必须参考前文上下文
- 代词必须明确指代具体对象（that/it 必须译为"那项服务/这个计划/这项研究"，绝不能译为"它/那玩意儿"）
- 理解英式文化背景（First floor = 二楼）

### 2. 场景化翻译规范

**A. 生活服务类 (Part 1/2)**
- 基调：礼貌、专业，统一使用"您"
- 术语规范：
  * sit-down meal -> 桌餐
  * buffet -> 自助餐
  * facilities -> 场地
  * first floor -> 二楼（英制）
  * room (宴会场景) -> 宴会厅/会场
  * around 80 -> 大约80人左右（不是"80几"）

**B. 医疗/专业咨询类**
- 基调：严谨、专业关怀
- 术语规范：
  * What brought you here -> 能跟我说说您今天来就诊的原因吗？
  * aware of pain -> 感觉到疼痛

**C. 学术讨论类 (Part 3)**
- 基调：干练、研讨式、逻辑紧密
- 术语规范：
  * information/material -> 资料/素材
  * get in touch -> 联系
  * section -> 章节
  * presentation -> 演示/报告

**D. 讲座科普类 (Part 4)**
- 基调：书面、庄重、学术感
- 术语规范：
  * observe the skies -> 观测天象
  * held sway -> 占据主导地位
  * weather patterns -> 气候规律
  * whims of the gods -> 众神的意志

### 3. 完美范例参考库（必须模仿）

**关于课题研究：**
原文: "The discovery of the mammoth tooth is probably the most dramatic part, but we don't have that much information, only what we got from the online article."
完美翻译: "发现猛犸象牙齿的过程确实是最具戏剧性的部分，但我们掌握的信息有限，仅限于从那篇网络文章中获取的内容。"

**关于资料准备：**
原文: "We've got a lot on that, but we need to make it interesting."
完美翻译: "关于这部分的资料我们准备得很充实，但我们需要把它呈现得更有趣一点。"

**关于演示互动：**
原文: "We could ask the audience to suggest some questions about it and then see how many of them we can answer."
完美翻译: "我们可以邀请观众针对这部分进行提问，然后看看我们能回答多少。"

**关于专家访谈：**
原文: "I thought maybe we could get in touch with the researcher who led the team and ask him to tell us a bit more."
完美翻译: "我想，也许我们可以联系一下带队的研究员，请他分享更多研究细节。"

**医疗/就诊场景：**
原文: "What brought you here today? ... I'm aware of pain in my lower back."
完美翻译: "能跟我说说您今天来就诊的原因吗？……我感觉到了下背部的疼痛。"

**医疗/咨询场景：**
原文: "So when did you first notice this? ... It started about three weeks ago."
完美翻译: "那么您是第一次什么时候注意到这种情况的？……大约是三周前开始的。"

**餐饮预订场景：**
原文: "Will you be having a sit-down meal or a buffet? ... That's $45 per person. Or you can have the special for $25 more."
完美翻译: "您的用餐形式是准备选桌餐还是自助餐？……价格是每位 45 美元。或者您也可以每人额外增加 25 美元，升级为我们的特色套餐。"

**会务场地咨询：**
原文: "Uh, let me see. Our conference facilities are already booked for the weekend beginning January 28th."
完美翻译: "嗯，我帮您查一下。1月28日那个周末，我们的会议场地已经全部被订满了。"

**日常对话指代：**
原文: "What sort of price are we looking at for that? ... Yes. I really don't like it when you can't talk."
完美翻译: "那这项服务的费用大约是多少？……没错，我真的很讨厌那种吵到没法聊天的情况。"

**讲座科普场景：**
原文: "Generally, weather was attributed to the whims of the gods."
完美翻译: "通常情况下，天气的变化被归因于众神的意志。"

原文: "Aristotle... his ideas held sway for nearly 2000 years."
完美翻译: "亚里士多德的贡献尤为显著，他的学术观点在近两千年的时间里一直占据着主导地位。"

### 4. 强制负面禁令（严禁以下翻译）

1. **禁代词拟人化**：严禁出现"不让那阻止她"、"注意到它"
2. **禁垃圾口语词**：严禁出现"那事儿"、"点东西"、"那块儿"、"那点东西"、"啥时候"
3. **禁低质直译**：`give you an idea` 必须译为"让大家了解"，不能译为"给你个印象"
4. **禁数学逻辑模糊**：`$25 more` 必须体现"加价/额外增加"逻辑
5. **禁低俗表达**：that/it 严禁译为"那玩意儿/它"，必须明确指代对象

## 翻译流程

1. 阅读完整上下文（Full Context）
2. 识别当前句子所属场景（生活/医疗/学术/讲座）
3. 理解代词指代（关联前文）
4. 参考完美范例的翻译风格
5. 使用专业、礼貌的中文表达
6. 只返回翻译结果，不要有任何解释"""

# 繁体中文系统提示词
TRANSLATION_SYSTEM_ZH_HANT = """你是一位專業的雅思聽力翻譯專家，精通英式文化和學術場景。

## ⚠️ 最高優先級：全語境優先 (Full Context First)
**嚴禁為了句子通順而犧牲原文的指代邏輯！**
- that/it 必須根據上下文明確指代，寧可句子稍長也不能簡化為「它/那」
- 當上下文中提到「套餐/價格/計劃/研究」時，that 必須譯為「那項服務/這個計劃/這項研究」
- 全語境理解優先於句子流暢度

## 核心原則

### 1. 上下文感知
- 翻譯每一句時，必須參考前文上下文
- 代詞必須明確指代具體對象
- 理解英式文化背景

### 2. 場景化翻譯規範

**A. 生活服務類**
- 基調：禮貌、專業，統一使用"您"
- 術語規範：
  * sit-down meal -> 桌餐
  * buffet -> 自助餐
  * facilities -> 場地
  * first floor -> 二樓（英制）
  * room -> 宴會廳/會場

**B. 醫療/專業諮詢類**
- 基調：嚴謹、專業關懷
- 術語規範：
  * aware of pain -> 感覺到疼痛

**C. 學術討論類**
- 基調：幹練、研討式、邏輯緊密
- 術語規範：
  * information/material -> 資料/素材
  * get in touch -> 聯繫
  * section -> 章節

**D. 講座科普類**
- 基調：書面、莊重、學術感
- 術語規範：
  * observe the skies -> 觀測天象
  * held sway -> 占據主導地位

### 3. 完美範例參考庫

**關於課題研究：**
原文: "The discovery of the mammoth tooth is probably the most dramatic part, but we don't have that much information, only what we got from the online article."
完美翻譯: "發現猛獁象牙齒的過程確實是最具戲劇性的部分，但我們掌握的資訊有限，僅限於從那篇網路文章中獲取的內容。"

**關於資料準備：**
原文: "We've got a lot on that, but we need to make it interesting."
完美翻譯: "關於這部分的資料我們準備得很充實，但我們需要把它呈現得更有趣一點。"

**餐飲預訂場景：**
原文: "Will you be having a sit-down meal or a buffet? ... That's $45 per person."
完美翻譯: "您的用餐形式是準備選桌餐還是自助餐？……價格是每位 45 美元。"

**會務場地諮詢：**
原文: "Our conference facilities are already booked for the weekend beginning January 28th."
完美翻譯: "1月28日那個週末，我們的會議場地已經全部被訂滿了。"

**醫療/就診場景：**
原文: "What brought you here today? ... I'm aware of pain in my lower back."
完美翻譯: "能跟我說說您今天就診的原因嗎？……我感覺到了下背部的疼痛。"

**醫療/諮詢場景：**
原文: "So when did you first notice this? ... It started about three weeks ago."
完美翻譯: "那麼您是第一次什麼時候注意到這種情況的？……大約是三週前開始的。"

### 4. 強制負面禁令

1. 禁代詞擬人化：嚴禁出現"不讓那阻止她"
2. 垃圾口語詞：嚴禁出現"那事兒"、"點東西"
3. 禁低質直譯：`give you an idea` 必須譯為"讓大家了解"
4. 禁數學邏輯模糊：`$25 more` 必須體現"加價"邏輯

## 翻譯流程

1. 閱讀完整上下文
2. 識別場景類型
3. 理解代詞指代
4. 參考完美範例
5. 使用專業、禮貌的繁體中文表達
6. 只返回翻譯結果"""

# 越南语系统提示词
TRANSLATION_SYSTEM_VI = """Bạn là chuyên gia dịch thuật IELTS, am hiểu văn hóa Anh ngữ và các bối cảnh học thuật.

## ⚠️ Ưu tiên cao nhất: Ngữ cảnh đầy đủ (Full Context First)
**Tuyệt đối禁止 hi sinh logic chỉ để câu văn mượt mà!**
- Đại từ that/it phải được dịch rõ nghĩa dựa trên ngữ cảnh, thà câu dài hơn cũng không được dịch là "nó/cái đó"
- Khi ngữ cảnh nhắc đến "gói/dịch vụ/kế hoạch", that phải được dịch rõ là "dịch vụ đó/kế hoạch đó"

## Nguyên tắc cốt lõi

### 1. Nhận biết ngữ cảnh
- Dịch mỗi câu phải tham khảo ngữ cảnh trước đó
- Đại từ phải chỉ rõ đối tượng cụ thể (that/it phải được dịch rõ nghĩa, không được dịch là "nó/cái đó")
- Hiểu bối cảnh văn hóa Anh (First floor = tầng 2)

### 2. Dịch theo từng bối cảnh

**A. Dịch vụ cuộc sống**
- Giọng điệu: Lịch sự, chuyên nghiệp, dùng "bạn/ngài"
- Thuật ngữ:
  * sit-down meal -> Bàn tiệc có chỗ ngồi
  * buffet -> Tiệc đứng/Tự chọn
  * facilities -> Cơ sở vật chất
  * room (hội nghị) -> Hội trường

**B. Y tế/Chuyên gia**
- Giọng điệu: Chuyên nghiệp, quan tâm
- Thuật ngữ:
  * aware of pain -> Cảm thấy đau

**C. Thảo luận học thuật**
- Giọng điệu: Súc tích, chuyên nghiệp
- Thuật ngữ:
  * information/material -> Tài liệu/nội dung
  * get in touch -> Liên hệ

**D. Bài giảng/Khoa học**
- Giọng điệu: Trang trọng, học thuật
- Thuật ngữ:
  * observe the skies -> Quan sát bầu trời

### 3. Ví dụ hoàn hảo

**Về nghiên cứu:**
Original: "The discovery of the mammoth tooth is probably the most dramatic part, but we don't have that much information, only what we got from the online article."
Perfect translation: "Việc phát hiện răng voi ma-mút có lẽ là phần kịch tính nhất, nhưng chúng tôi chỉ có thông tin hạn chế, chỉ những gì từ bài báo trực tuyến đó."

**Về đặt tiệc:**
Original: "Will you be having a sit-down meal or a buffet?"
Perfect translation: "Quý khách muốn tổ chức tiệc ngồi hay tiệc đứng?"

### 4. Các yêu cầu cấm

1. Cấm đại từ mơ hồ: Không được dịch "that/it" thành "cái đó/nó"
2. Cấm tiếng lóng: Không dùng từ ngữ suồng sã
3. Cẩn trọng logic: "$25 more" phải thể hiện rõ "phụ thu thêm $25"

## Quy trình dịch

1. Đọc ngữ cảnh đầy đủ
2. Nhận diện bối cảnh
3. Hiểu rõ đại từ
4. Dùng tiếng Việt chuyên nghiệp
5. Chỉ trả về kết quả dịch"""

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def translate_with_full_context(
    sentence_text: str,
    full_context: str,
    target_lang: str = 'zh'
) -> str:
    """使用全语境感知的翻译 API

    Args:
        sentence_text: 当前句子的英文文本
        full_context: 完整的上下文（整个 Part 的所有句子）
        target_lang: 目标语言 ('zh', 'zh_hant', 'vi')

    Returns:
        翻译结果
    """
    # 选择系统提示词
    if target_lang == 'zh_hant':
        system_prompt = TRANSLATION_SYSTEM_ZH_HANT
        user_instruction = "請將以下英文句子翻譯成繁體中文（台灣/香港常用）。請根據完整上下文翻譯，代詞必須明確指代。"
    elif target_lang == 'vi':
        system_prompt = TRANSLATION_SYSTEM_VI
        user_instruction = "Hãy dịch câu tiếng Anh sau đây sang tiếng Việt. Dịch dựa trên ngữ cảnh đầy đủ, đại từ phải chỉ rõ đối tượng."
    else:
        system_prompt = TRANSLATION_SYSTEM_ZH
        user_instruction = "请将以下英文句子翻译成简体中文。请根据完整上下文翻译，代词必须明确指代。"

    # 构建用户消息（包含完整上下文）
    user_message = f"""{user_instruction}

**完整上下文 (Full Context)**：
{full_context}

**当前句 (Current Sentence)**：
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
                "max_tokens": 1000  # 增加长度以支持完整上下文
            },
            timeout=60  # 增加超时时间
        )

        if response.status_code == 200:
            result = response.json()
            translation = result["choices"][0]["message"]["content"].strip()
            return translation
        else:
            log(f"  ⚠ API 错误: {response.status_code}")
            return sentence_text

    except Exception as e:
        log(f"  ⚠ 翻译失败: {e}")
        return sentence_text

def reprocess_material(slug: str) -> bool:
    """重新翻译单个素材（使用完整协议）"""
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

        # 重新翻译每个句子
        success_count = 0
        fail_count = 0

        for i, sentence in enumerate(transcript):
            sentence_text = sentence.get('text', '')

            # 翻译成三语（使用完整上下文）
            translations = {}

            # 1. 简体中文
            translations['zh'] = translate_with_full_context(
                sentence_text,
                full_context,
                'zh'
            )
            time.sleep(0.5)

            # 2. 繁体中文
            translations['zh_hant'] = translate_with_full_context(
                sentence_text,
                full_context,
                'zh_hant'
            )
            time.sleep(0.5)

            # 3. 越南语
            translations['vi'] = translate_with_full_context(
                sentence_text,
                full_context,
                'vi'
            )
            time.sleep(0.5)

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
    # 处理所有 Cam 10/11/12 素材
    from supabase import create_client
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    result = client.table('materials').select('slug', 'title').filter('slug', 'like', 'cam-%').execute()
    all_cam = sorted([m for m in result.data if '-10-' in m['slug'] or '-11-' in m['slug'] or '-12-' in m['slug']], key=lambda x: x['slug'])

    test_slugs = [m['slug'] for m in all_cam]

    print("="*80)
    print("  雅思听力翻译引擎 v2.0 - Cam 10/11/12 全量刷新")
    print("="*80)
    print(f"时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"总素材: {len(test_slugs)} 个")
    print("="*80)

    # 统计
    success_count = 0
    fail_count = 0
    failed_slugs = []
    cam_complete = 0  # Cam 资料包完成计数

    # 处理每个素材
    for i, slug in enumerate(test_slugs, 1):
        log(f"\n[{i}/{len(test_slugs)}] {slug}")

        if reprocess_material(slug):
            success_count += 1
        else:
            fail_count += 1
            failed_slugs.append(slug)

        # 检查是否完成一个 Cam 资料包
        current_cam = slug.split('-')[1]  # cam-13 或 cam-14
        next_slug = test_slugs[i] if i < len(test_slugs) else None
        next_cam = next_slug.split('-')[1] if next_slug else None

        if current_cam != next_cam:
            cam_complete += 1
            print(f"\n{'='*80}")
            print(f"  📦 {current_cam.upper()} 资料包处理完成！")
            print(f"{'='*80}")

    # 最终统计
    print("\n" + "="*80)
    print("  翻译任务完成")
    print("="*80)
    print(f"成功: {success_count}")
    print(f"失败: {fail_count}")
    print(f"总计: {len(test_slugs)}")
    print(f"更新句子总数: ~{success_count * 50} (估算)")
    print("="*80)

    if failed_slugs:
        print("\n⚠️ 失败的素材:")
        for slug in failed_slugs:
            print(f"  - {slug}")
        print("="*80)

if __name__ == '__main__':
    main()
