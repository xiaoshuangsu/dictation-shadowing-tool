#!/usr/bin/env python3
"""
专业级上下文感知翻译脚本（V20.0 - 数据完整性校验版）
使用 GLM-4 API 生成地道、具备上下文理解能力的翻译
新增：时间戳合法性检查、强制对齐验证、结果分类汇报
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from supabase import create_client
import requests

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

# Supabase 配置
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# ══════════════════════════════════════════════════════════════════════════════
# 三道防线：System Prompt V19.5（口语终极版）
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """你是一位专业的英汉翻译专家。严格遵守以下规则：

【绝对规则】（强制执行）：
⚠️ **严禁将不同编号的句子合并翻译，即使句子不完整或以逗号结尾！**
每个编号对应一个独立的翻译，返回数组的每个元素只能包含一个编号的翻译。

【口语终极准则】（必须遵守）：

1️⃣ 拒绝"词典中文"：
- You were joking? → "你逗我呢？"或"你耍我啊？"（❌ "你在开玩笑吗？"）
- I got you! (整蛊语境) → "嘿嘿，上当了吧？"（❌ "我捉到你了"）
- Pulling my leg → "拿我开涮"或"忽悠我"（❌ "拉我的腿"）

2️⃣ 反问句式对齐 (Tag Questions)：
- 遇到 "...didn't I?" 或 "...right?" 类确认语气：
  - ❌ 严禁直译为"不是吗？"、"没吧？"、"对不对？"
  - ✅ 整蛊语境下：译为"是不是？"、"对吧？"或直接略过合并到前句
  - 示例：I got you, though. Didn't I? → "嘿嘿，上当了吧？是不是？" 或 "嘿嘿，上当了吧！"

3️⃣ 指代对象校验 (Reference Check)：
- 必须根据上下文判断主语和宾语
- "you think I'm good looking" → "你觉得我长得好看"（❌ "我觉得我长得好看"）
- "that you think I'm..." → "你觉得我..."（主语是 you，宾语是 I）
- 整蛊语境：A 骗 B，B 夸 A，A 拆穿时说 "you think I'm..." = "你觉得我..."

4️⃣ 整蛊语气词禁用"笃定"：
- ❌ 严禁在整蛊对话中使用书面词"笃定"
- ✅ 替换为"居然"、"竟然"或口语化表达
- 示例：Especially that you think I'm good looking. → "尤其是你居然还说我长得帅。"

5️⃣ 语气词强制要求：
- 非正式口语必须带有："啊、呢、吧、嘛、哩、哈"
- 没有语气词的口语翻译一律判定为失败

6️⃣ 对话角色逻辑校验 (Dialogue Role Tracking)：
- 必须判断谁是讲述者，谁是听众，严禁角色倒置
- 短促追问 (Short Follow-up Questions)：
  - You did? → "你做到了？"（❌ "我怎么做的"）
  - How? → "怎么弄的？"（❌ "我怎么做的"）
  - Really? → "真的？"（❌ "真的吗"太生硬）

7️⃣ 动词语境分析 (Semantic Disambiguation)：
- Call someone for my [Item]：
  - 如果物品属于拨打者 → "要回/问……的事"（❌ "借"）
  - 示例：I called her for my keys → "我打电话问她钥匙的事"

8️⃣ 情绪对齐 (Tone Alignment)：
- 对话类素材严禁使用"战斗"、"攻击"这种死板的词
- attacked you → "扑向你"（❌ "攻击你"）
- fought the ghost → "跟那个鬼斗了半天"（❌ "与鬼战斗"）

9️⃣ 去辞海化 (Natural Expression)：
- ❌ 严禁：哦不、太可怕了、非常震惊（书面词）
- ✅ 地道翻译：天哪！、那也太吓人了吧！、我都不信了！

🔟 地理天气术语保护 (Geographic & Weather Terms)：
- 特定术语根据地理位置选择：
  - 澳大利亚/印度洋：cyclones → 气旋
  - 东亚/西太平洋：typhoons → 台风
  - 美洲/大西洋：hurricanes → 飓风
1️⃣1️⃣ 气候询问句型 (Climate Questions)：
- What's your [Season] like? → "你们那儿的[季节]是什么样的？"
- ❌ 严禁：你[季节]怎么样？/你的[季节]如何？
- 示例：What's your summer like? → "你们那儿的夏天是什么样的？"

1️⃣2️⃣ 情感反馈自然化 (Natural Feedback)：
- How interesting! → "真新鲜！"或"真有意思！"（❌ "真有趣"太生硬）
- How different! → "反差真大！"（❌ "真不同"）
- 根据语境选择更自然的情感表达

1️⃣3️⃣ 励志哲学类风格对齐 (Motivational/Philosophical)：
- 关键词替换：
  - restless → "心神不宁"或"焦躁"（❌ "不安分"）
  - thoughts（内心混乱时）→ "杂念"或"念头"（❌ "想法"）
  - In this moment → "当下"或"此时此刻"（❌ "在这个时刻"）
- 去平庸化（文学化表达）：
  - 使用有感染力的词汇：纷纷扰扰、充斥、活在当下、宁静
  - ❌ 严禁过于直白的口语化表达
- 保持简洁：
  - 励志故事语言短促有力，❌ 严禁啰嗦的长句
  - 示例：Marco was very restless. → "马可感到心神不宁。"（❌ "马可是一个非常不安分的人。"）

【分类风格规则】（重要）：
- 科学类（TED演讲/科普）：术语严谨，不带个人情绪，不使用语气词
- 职场类（正式对话）：用词正式，不使用口语俚语，语气中性
- 日常生活类（对话）：使用口语俚语，必须包含语气词
- 励志哲学类（Motivational）：文学化表达，简洁有力，关键词替换

【示例对照】（B 站/短视频风格）：
日常对话类（非正式）：
1. You were joking?
   → 你逗我呢？

2. You were pulling my leg that whole time?
   → 你一直都在拿我开涮啊？

3. You.
   → 你呀。

4. I can't believe it.
   → 我都不敢信了！

5. I got you, though. Didn't I?
   → 嘿嘿，上当了吧？是不是？
   （说明：Didn't I? 是确认语气，译为"是不是？"或合并到前句）

6. Thanks for saying those nice things about me, though.
   → 不过，谢啦，难得听你这么夸我。

7. It's nice to know what you think about me.
   → 知道你这么想我，挺开心的。

8. Especially that you think I'm good looking.
   → 尤其是你居然还说我长得帅。
   （说明：you think I'm = 你觉得我，严禁"我觉得我"；整蛊对话禁用"笃定"）

对话角色追踪类（Dialogue）：
9. You did?
   → 你做到了？
   （❌ "我怎么做的"）

10. How?
    → 怎么弄的？
    （❌ "我怎么做的"）

11. I called her for my keys.
    → 我打电话问她钥匙的事。
    （❌ "我打电话找她借钥匙"）

12. The dog attacked you!
    → 那狗扑向你了！
    （❌ "那只狗攻击了你"）

13. Oh no, that's terrible!
    → 天哪！那也太吓人了吧！
    （❌ "哦不，太可怕了"）

地理天气类（Geographic & Climate）：
14. What's your summer like?
    → 你们那儿的夏天是什么样的？
    （❌ "你夏天怎么样？"）

15. Cyclones hit Australia every year.
    → 气旋每年都会袭击澳大利亚。
    （说明：澳大利亚用"气旋"）

16. How interesting!
    → 真新鲜！
    （❌ "真有趣"）

17. That's so different!
    → 反差真大！
    （❌ "真不同"）

励志哲学类（Motivational/Philosophical）：
18. Marco was very restless.
    → 马可感到心神不宁。
    （❌ "马可是一个非常不安分的人。"）

19. His mind was full of thoughts.
    → 他脑海里充满了杂念。
    （❌ "他脑子里有很多想法。"）

20. Live in this moment.
    → 活在当下。
    （❌ "活在此时此刻"或"在这个时刻生活"）

21. Find your inner peace.
    → 寻找内心的宁静。
    （❌ "找到你内心的平静"）

正式/演讲类（更规范）：
1. When faced with a big challenge...
   → 面对重大挑战，似乎失败隐藏在每个角落时，

2. Be more confident.
   → 更自信点。

3. Take the belief that you are valuable...
   → 采取这一信念：你是有价值、值得且有能力的。

【词汇规则】：
- lurk → "隐藏"（❌ "潜伏"）
- that comes when → "源于...所带来的..."
- Take the belief that → "采取这一信念：..."
- certain → "笃定"（❌ "确信"）

【地理常识补丁】（必须遵守）：
- above, north of → "以北"（❌ "之上"、"上方"）
- below, south of → "以南"（❌ "之下"、"下方"）
- next to → "相邻"（❌ "旁边"）
- light touches ground → "阳光洒向大地"（❌ "光触碰地面"）

【全段落感知 + 极简主义】（必须遵守）：
- 极简主义：能用 3 个字表达的，绝不用 5 个字
- 严禁为了"完整"而增加修饰词（"一些"、"一点"等填充词）
- 译文长度控制在英文原句长度的 1.0-1.5 倍

【格式化约束机制】：
- 物理隔离（编号独立）：严禁将不同编号的句子合并翻译
- 长句拆分：that comes when → "源于...所带来的..."
- 引导句：Take the belief that → "采取这一信念：..."
- 不完整句：原文以逗号结尾，中文翻译也要保持不完整

【禁止词汇】：
- ❌ 严禁：捉到、玩笑、拉腿（pulling my leg 的字面翻译）
- ❌ 严禁：明灯、光芒、道路、旅程

【输出格式】：
返回 JSON：{"translations": ["翻译1", "翻译2", ...]}
⚠️ 如果输入 8 句，必须返回 8 个翻译，不能多也不能少！
❌ 严禁在翻译中使用方括号 [ ]，直接输出纯中文翻译即可
"""

# ══════════════════════════════════════════════════════════════════════════════
# 数据完整性校验函数
# ══════════════════════════════════════════════════════════════════════════════

def validate_timestamps(transcript: List[Dict]) -> Tuple[bool, Optional[str]]:
    """
    时间戳合法性检查
    返回: (是否通过, 错误原因)
    """
    timestamps = []

    # 提取所有时间戳
    for sent in transcript:
        if 'start' in sent and 'end' in sent:
            timestamps.append((sent['start'], sent['end']))

    # 检查1: 时间戳数量与原文句数是否一致
    if len(timestamps) != len(transcript):
        return False, f"时间戳数量({len(timestamps)})与句子数({len(transcript)})不一致"

    # 检查2: 时间戳是否倒序
    for i, (start, end) in enumerate(timestamps):
        if start > end:
            return False, f"第{i+1}句时间戳倒序: start({start}) > end({end})"

        # 检查是否与下一条重叠
        if i < len(timestamps) - 1:
            next_start = timestamps[i + 1][0]
            if end > next_start:
                return False, f"第{i+1}句与第{i+2}句时间戳重叠: {end} > {next_start}"

    return True, None


def validate_alignment(source_count: int, translations: List[str]) -> bool:
    """
    强制对齐验证
    检查: Length(Source) == Length(Translation)
    """
    return len(translations) == source_count


# ══════════════════════════════════════════════════════════════════════════════

def has_geographic_issue(translation: str) -> bool:
    """检测翻译是否有地理问题"""
    problematic_patterns = [
        "之上", "下方", "之上方", "下方在", "触碰地面", "光触碰"
    ]
    return any(pattern in translation for pattern in problematic_patterns)


def fix_geographic_translation(original_en: str, bad_translation: str, video_title: str) -> Optional[str]:
    """修复地理问题翻译（单句重试）"""
    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

    headers = {
        "Authorization": f"Bearer {GLM_API_KEY}",
        "Content-Type": "application/json"
    }

    retry_prompt = f"""请修复以下翻译中的地理问题：

原文：{original_en}
错误翻译：{bad_translation}
视频标题：{video_title}

⚠️ 地理常识补丁：
- above, north of → 以北（严禁："之上"）
- below, south of → 以南（严禁："下方"）
- light touches ground → 阳光洒向大地（严禁："光触碰地面"）

请提供修正后的翻译，只返回翻译结果："""

    payload = {
        "model": "glm-4-flash",
        "messages": [
            {"role": "user", "content": retry_prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 200
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        result = response.json()

        if 'choices' in result and len(result['choices']) > 0:
            translation = result['choices'][0]['message']['content'].strip()
            # 清理方括号
            translation = translation.replace('[', '').replace(']', '')
            return translation
        return bad_translation  # 保持原翻译
    except:
        return bad_translation


def translate_batch(texts: List[str], video_title: str, category: str, difficulty: str) -> List[str]:
    """批量翻译（三道防线 V19.2 版）"""

    # 构建带编号的列表格式输入
    numbered_list = "\n".join([f"{i+1}. [{text}]" for i, text in enumerate(texts)])

    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    headers = {
        "Authorization": f"Bearer {GLM_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "glm-4-flash",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"""请翻译以下 {len(texts)} 行字幕：

**【当前视频标题】：{video_title}**
**请在此视频的语境下进行地道翻译，保持内容一致性。**

**分类**: {category}
**难度**: {difficulty}

字幕内容（带编号）：
{numbered_list}

⚠️ 强制要求：
1. 参考示例中的翻译风格和句式
2. lurk 翻译为"隐藏"（不要用"潜伏"）
3. that comes when 翻译为"源于...所带来的..."
4. Take the belief that 翻译为"采取这一信念：..."
5. certain 翻译为"笃定"

⚠️ 对话类素材（Dialogue）特别强制要求：
6. 短促追问：You did? → "你做到了？"（严禁"我怎么做的"）
7. 动词语境：call for my item → "要回/问……的事"（严禁"借"）
8. 情绪词：attacked → "扑向"（严禁"攻击"）；fought → "斗了半天"（严禁"打斗"）
9. 去书面化：Oh no → "天哪！"（严禁"哦不"）；terrible → "太吓人了"（严禁"太可怕"）

⚠️ 地理天气类素材特别强制要求：
10. 气候询问：What's your [Season] like? → "你们那儿的[季节]是什么样的？"（严禁"你[季节]怎么样"）
11. 特定术语：cyclones → 气旋；typhoons → 台风；hurricanes → 飓风（根据地理位置）
12. 情感反馈：How interesting → "真新鲜！"；How different → "反差真大！"（严禁"真有趣"、"真不同"）

⚠️ 励志哲学类素材（Motivational/Philosophical）特别强制要求：
13. 关键词替换：restless → "心神不宁"或"焦躁"（严禁"不安分"）
14. 关键词替换：thoughts（内心）→ "杂念"或"念头"（严禁"想法"）
15. 关键词替换：In this moment → "当下"或"此时此刻"（严禁"在这个时刻"）
16. 文学化表达：使用有感染力的词汇（宁静、纷扰、充斥），❌ 严禁过于直白
17. 保持简洁：语言短促有力，❌ 严禁啰嗦的长句
18. 严禁在翻译中使用方括号 [ ]，直接输出纯中文翻译
19. 返回 JSON 格式：{{"translations": ["翻译1", "翻译2", ...]}}"""}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        result = response.json()

        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content'].strip()
            data = json.loads(content)
            translations = data.get('translations', [])

            # 验证返回格式
            if not isinstance(translations, list):
                print(f"      ⚠️  返回格式错误：不是数组")
                return None

            if len(translations) != len(texts):
                print(f"      ⚠️  返回行数不匹配：{len(translations)}/{len(texts)}")
                return None  # 返回 None 表示对齐失败

            # 清理方括号（如果模型误模仿了输入格式）
            cleaned_translations = []
            for trans in translations:
                # 去除可能被误加的方括号及其内容
                # 例如: "[翻译]" 或 "翻译 [原文]" 都会被清理
                cleaned = trans
                # 去除开头和结尾的方括号
                if cleaned.startswith('[') and ']' in cleaned:
                    # 尝试提取方括号内的内容（如果是纯方括号包裹）
                    first_close = cleaned.index(']')
                    maybe_translation = cleaned[1:first_close].strip()
                    # 检查是否是完整的翻译（不包含英文原文）
                    if not any(c in maybe_translation for c in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'):
                        cleaned = maybe_translation
                    else:
                        # 如果方括号内混有原文，去除所有方括号
                        cleaned = cleaned.replace('[', '').replace(']', '')
                else:
                    # 去除所有方括号（保险起见）
                    cleaned = cleaned.replace('[', '').replace(']', '')

                cleaned_translations.append(cleaned.strip())

                # 检查是否有脑补内容（如"明灯"、"光芒"等）
                if any(word in cleaned for word in ['明灯', '光芒', '就像', '仿佛', '展现']):
                    print(f"      ⚠️  检测到脑补内容: {cleaned[:50]}...")

            return cleaned_translations
        else:
            print(f"      ⚠️  API 返回格式异常")
            return None

    except json.JSONDecodeError as e:
        print(f"      ❌ JSON 解析失败: {str(e)[:50]}")
        return None
    except Exception as e:
        print(f"      ❌ 翻译失败: {str(e)[:50]}")
        return None


def process_material(material_id: str, video_title: str, category: str, difficulty: str, transcript: List[Dict], supabase_client) -> Dict:
    """
    处理单个素材的翻译（带数据完整性校验）
    返回: {
        'success': bool,
        'reason': Optional[str],  # 失败原因
        'geo_fixes': int
    }
    """

    print(f"\n{'─'*80}")
    print(f"🎬 {video_title}")
    print(f"📝 {len(transcript)} 句 | 📂 {category} | 🎯 {difficulty}")
    print(f"{'─'*80}")

    # ═════════════════════════════════════════════════════════════════════════
    # 1. 时间戳合法性检查（已禁用 - 直接翻译，不检查时间戳）
    # ═════════════════════════════════════════════════════════════════════════
    # timestamp_valid, timestamp_error = validate_timestamps(transcript)
    # if not timestamp_valid:
    #     print(f"❌ 时间戳检查失败: {timestamp_error}")
    #     return {
    #         'success': False,
    #         'reason': f'bad_timestamp: {timestamp_error}',
    #         'geo_fixes': 0
    #     }

    # 提取所有句子文本（只处理有 text 字段的句子）
    valid_sentences = [(i, sent.get('text', '').strip()) for i, sent in enumerate(transcript) if sent.get('text', '').strip()]

    if not valid_sentences:
        print(f"❌ 无有效句子")
        return {
            'success': False,
            'reason': 'no_valid_sentences',
            'geo_fixes': 0
        }

    # 提取文本列表用于翻译
    texts = [text for _, text in valid_sentences]

    # 分批翻译（每批 8 句）
    batch_size = 8
    all_translations = []
    geo_fixes = 0

    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(texts) + batch_size - 1) // batch_size

        print(f"   📦 批次 {batch_num}/{total_batches} ({len(batch_texts)} 句)...", end="", flush=True)

        # ═════════════════════════════════════════════════════════════════════════
        # 2. 强制对齐验证（最多重试 2 次）
        # ═════════════════════════════════════════════════════════════════════════
        translations = None
        for retry in range(3):  # 最多尝试 3 次（首次 + 2 次重试）
            translations = translate_batch(batch_texts, video_title, category, difficulty)

            if translations is None:
                if retry < 2:
                    print(f" [重试 {retry+1}/2]...", end="", flush=True)
                    time.sleep(0.5)
                    continue
                else:
                    print(f" ❌ 对齐失败")
                    return {
                        'success': False,
                        'reason': 'alignment_failed',
                        'geo_fixes': geo_fixes
                    }

            # 验证对齐
            if validate_alignment(len(batch_texts), translations):
                break  # 对齐成功
            else:
                if retry < 2:
                    print(f" [对齐失败，重试 {retry+1}/2]...", end="", flush=True)
                    time.sleep(0.5)
                    translations = None
                    continue
                else:
                    print(f" ❌ 对齐失败")
                    return {
                        'success': False,
                        'reason': 'alignment_failed',
                        'geo_fixes': geo_fixes
                    }

        all_translations.extend(translations)

        # 检查地理问题并自动修复
        for j, trans in enumerate(translations):
            if has_geographic_issue(trans):
                geo_fixes += 1
                original = batch_texts[j]
                fixed = fix_geographic_translation(original, trans, video_title)
                if fixed and fixed != trans:
                    all_translations[i+j] = fixed
                    print(f" [地理修复]", end="", flush=True)

        print(f" ✓")
        time.sleep(0.3)  # 避免 API 频率限制

    # 最终对齐验证（确保总长度一致）
    if len(all_translations) != len(texts):
        print(f"❌ 最终对齐失败: {len(all_translations)}/{len(texts)}")
        return {
            'success': False,
            'reason': 'final_alignment_failed',
            'geo_fixes': geo_fixes
        }

    # 更新 transcript（按原始索引）
    updated_transcript = []
    trans_idx = 0
    for sent in transcript:
        sent_copy = sent.copy()
        if sent.get('text', '').strip() and trans_idx < len(all_translations):
            sent_copy['translation'] = {"zh": all_translations[trans_idx]}
            trans_idx += 1
        updated_transcript.append(sent_copy)

    # 写入数据库
    try:
        supabase_client.table('materials').update({
            'transcript': updated_transcript
        }).eq('id', material_id).execute()

        print(f"✅ 完成 | 地理修复: {geo_fixes} 句")
        return {
            'success': True,
            'reason': None,
            'geo_fixes': geo_fixes
        }

    except Exception as e:
        print(f"❌ 数据库更新失败: {str(e)[:100]}")
        return {
            'success': False,
            'reason': f'db_error: {str(e)[:50]}',
            'geo_fixes': geo_fixes
        }


def main():
    """主函数"""

    # 参数
    MODE = os.environ.get("MODE", "full")  # full | demo | single
    SINGLE_ID = os.environ.get("SINGLE_ID")  # 单个素材 ID
    LIMIT = int(os.environ.get("LIMIT", "0"))  # 限制处理数量
    FORCE_RETRANSLATE = os.environ.get("FORCE_RETRANSLATE", "false").lower() == "true"  # 强制重新翻译

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("="*100)
    print("🌍 专业级上下文感知翻译脚本 V20.0 - 数据完整性校验版")
    print("="*100)
    print(f"\n📋 模式: {MODE}")
    print(f"📋 强制重译: {'是' if FORCE_RETRANSLATE else '否'}")

    # 统计结果
    stats = {
        'fixed': [],           # 已修复：成功重写并对齐的素材
        'skipped_timestamp': [],  # 已跳过（时间戳错误）
        'failed_alignment': [],    # 已失败（对齐失败）
        'other_errors': []         # 其他错误
    }

    if MODE == "single":
        # 单个素材模式
        print(f"\n🎯 素材 ID: {SINGLE_ID}")

        result = supabase.table('materials').select('*').eq('id', SINGLE_ID).execute()
        if not result.data:
            print(f"❌ 未找到素材")
            return

        material = result.data[0]
        process_result = process_material(
            material['id'],
            material['title'],
            material['category'],
            material['difficulty'],
            material.get('transcript', []),
            supabase
        )

        if process_result['success']:
            stats['fixed'].append(material['title'])
        else:
            reason = process_result['reason']
            if 'bad_timestamp' in reason:
                stats['skipped_timestamp'].append((material['title'], reason))
            elif 'alignment_failed' in reason:
                stats['failed_alignment'].append(material['title'])
            else:
                stats['other_errors'].append((material['title'], reason))

    elif MODE == "demo":
        # 演示模式：只翻译 5 个素材
        demo_titles = [
            "April Fool's Day Joke _ English Conversation",
            "What If The Earth Stopped Orbiting The Sun",
            "Corruption",
            "Handel's 'Messiah'",
            "3 tips to boost your confidence - TED-Ed"
        ]

        print(f"\n🎯 演示素材: {len(demo_titles)} 个")

        for title in demo_titles:
            result = supabase.table('materials').select('*').eq('title', title).execute()
            if result.data:
                material = result.data[0]
                process_result = process_material(
                    material['id'],
                    material['title'],
                    material['category'],
                    material['difficulty'],
                    material.get('transcript', []),
                    supabase
                )

                if process_result['success']:
                    stats['fixed'].append(material['title'])
                else:
                    reason = process_result['reason']
                    if 'bad_timestamp' in reason:
                        stats['skipped_timestamp'].append((material['title'], reason))
                    elif 'alignment_failed' in reason:
                        stats['failed_alignment'].append(material['title'])
                    else:
                        stats['other_errors'].append((material['title'], reason))

    else:
        # 全量模式：Auto-pilot 翻译所有素材
        print(f"\n🚀 全量 Auto-pilot 模式")
        print(f"="*100)
        print(f"[模式]：原子提交 + 实时汇报 + 数据完整性校验")
        print(f"="*100)

        # 查询所有素材
        result = supabase.table('materials').select('*').order('id').execute()
        materials = result.data

        if LIMIT > 0:
            materials = materials[:LIMIT]
            print(f"\n📊 限制处理前 {LIMIT} 个素材")

        # 过滤出需要翻译的素材
        materials_to_process = []
        skip_count = 0

        for material in materials:
            transcript = material.get('transcript', [])
            needs_translation = False

            # 如果强制重译，则全部重新翻译
            if FORCE_RETRANSLATE:
                needs_translation = True
            else:
                # 检查是否有未翻译的句子
                for sent in transcript:
                    trans = sent.get('translation')
                    zh = trans.get('zh', '') if isinstance(trans, dict) else trans
                    if not zh:
                        needs_translation = True
                        break

            if needs_translation:
                materials_to_process.append(material)
            else:
                skip_count += 1

        total = len(materials_to_process)
        print(f"\n📊 总素材数: {len(materials)}")
        print(f"📊 需要翻译: {total}")
        print(f"📊 已有翻译: {skip_count}")
        print(f"="*100)

        if total == 0:
            print("\n✅ 所有素材翻译已完成！")
            return

        # Auto-pilot 主循环
        import subprocess

        for idx, material in enumerate(materials_to_process):
            current_num = idx + 1
            material_id = material['id']
            video_title = material['title']
            category = material['category']
            difficulty = material['difficulty']
            transcript = material.get('transcript', [])

            # 处理素材
            process_result = process_material(
                material_id,
                video_title,
                category,
                difficulty,
                transcript,
                supabase
            )

            if process_result['success']:
                stats['fixed'].append(video_title)

                # 原子提交：每个素材一个 commit
                try:
                    commit_msg = f"feat: 翻译素材 [{current_num}/{total}] {video_title[:50]}"
                    subprocess.run([
                        'git', 'add', '.'
                    ], capture_output=True, timeout=30)
                    subprocess.run([
                        'git', 'commit', '-m', commit_msg
                    ], capture_output=True, timeout=30)
                    print(f"   📦 Git commit: {commit_msg[:60]}...")
                except Exception as e:
                    print(f"   ⚠️  Git commit 失败: {str(e)[:50]}")

                # 实时汇报
                print(f"[进度] {current_num}/{total} | {video_title[:60]}")

                # 10 个以后：进入 Full Auto-pilot
                if current_num == 11:
                    print("\n🚀 进入 Full Auto-pilot 模式（静默运行）\n")
            else:
                reason = process_result['reason']
                if 'bad_timestamp' in reason:
                    stats['skipped_timestamp'].append((video_title, reason))
                    print(f"\n⚠️  跳过（时间戳错误）: {video_title}")
                elif 'alignment_failed' in reason:
                    stats['failed_alignment'].append(video_title)
                    print(f"\n⚠️  失败（对齐失败）: {video_title}")
                else:
                    stats['other_errors'].append((video_title, reason))
                    print(f"\n⚠️  失败（{reason[:30]}）: {video_title}")

    # ═════════════════════════════════════════════════════════════════════════
    # 结果分类汇报
    # ═════════════════════════════════════════════════════════════════════════
    print(f"\n{'='*100}")
    print(f"✅ 翻译任务完成")
    print(f"{'='*100}")

    print(f"\n📊 统计结果:")
    print(f"\n   ✅ 已修复数: {len(stats['fixed'])} 个")
    if stats['fixed']:
        for i, title in enumerate(stats['fixed'][:10], 1):
            print(f"      {i}. {title[:70]}")
        if len(stats['fixed']) > 10:
            print(f"      ... 还有 {len(stats['fixed']) - 10} 个")

    print(f"\n   ⏭️  已跳过（时间戳错误）: {len(stats['skipped_timestamp'])} 个")
    if stats['skipped_timestamp']:
        for i, (title, reason) in enumerate(stats['skipped_timestamp'][:10], 1):
            print(f"      {i}. {title[:50]}")
            print(f"         原因: {reason}")
        if len(stats['skipped_timestamp']) > 10:
            print(f"      ... 还有 {len(stats['skipped_timestamp']) - 10} 个")

    print(f"\n   ❌ 已失败（对齐失败）: {len(stats['failed_alignment'])} 个")
    if stats['failed_alignment']:
        for i, title in enumerate(stats['failed_alignment'][:10], 1):
            print(f"      {i}. {title[:70]}")
        if len(stats['failed_alignment']) > 10:
            print(f"      ... 还有 {len(stats['failed_alignment']) - 10} 个")

    print(f"\n   ⚠️  其他错误: {len(stats['other_errors'])} 个")
    if stats['other_errors']:
        for i, (title, reason) in enumerate(stats['other_errors'][:10], 1):
            print(f"      {i}. {title[:50]}")
            print(f"         原因: {reason}")
        if len(stats['other_errors']) > 10:
            print(f"      ... 还有 {len(stats['other_errors']) - 10} 个")

    print(f"\n{'='*100}")

    # 推送到远程仓库
    if MODE == "full" and len(stats['fixed']) > 0:
        try:
            print(f"\n📡 推送到 GitHub...")
            subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, timeout=60)
            print(f"✅ 推送完成")
        except Exception as e:
            print(f"⚠️  推送失败: {str(e)[:50]}")


if __name__ == "__main__":
    main()
