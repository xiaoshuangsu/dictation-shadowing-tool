#!/usr/bin/env python3
"""
专业级上下文感知翻译脚本
使用 GLM-4 API 生成地道、具备上下文理解能力的翻译
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import List, Dict, Optional
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
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# 专业 System Prompt
SYSTEM_PROMPT = """你是一位拥有 20 年经验的英汉同声传译专家。你的目标是为英语学习者提供极其地道、符合中文表达习惯的翻译。

核心原则：
1. 严禁直译：必须结合上下文判断词义
2. 语境感知：理解句子在完整段落中的作用
3. 地道表达：使用中文母语者的表达习惯

翻译案例：

案例 1 - 语境理解：
❌ 错误：'last light' -> "最后一盏灯"
✅ 正确：'last light' (日落语境) -> "落日余晖"

案例 2 - 地理位置（重要）：
❌ 错误：'above the USA' -> "美国上方" 或 "美国之上"
✅ 正确：'above the USA' -> "美国以北"

案例 3 - 文学意境：
❌ 错误：'touched the ground' -> "触碰地面"
✅ 正确：'touched the ground' -> "洒满大地"

案例 4 - 习语表达：
❌ 错误：'it's raining cats and dogs' -> "下猫下狗"
✅ 正确：'it's raining cats and dogs' -> "倾盆大雨"

🌍 地理常识补丁：
遇到国家、城市、地区间的相对位置描述时：
- above, north of → 以北
- below, south of → 以南
- next to, adjacent to → 相邻
- between → 之间

⚠️ 禁止使用的表达：
- 禁止："...之上"（方位词）
- 禁止："...下方"（方位词）
- 应使用指南针方位：以北、以南、以东、以西

输出要求：
- 严格返回 JSON 数组格式：["翻译1", "翻译2", "翻译3", ...]
- 每个翻译对应输入的英文句子
- 保持句子简洁，符合口语习惯
- 不要添加任何解释或额外文字"""


def has_geographic_issue(translation: str) -> bool:
    """检测翻译是否有地理问题"""
    problematic_patterns = [
        "之上", "下方", "之上方", "下方在"
    ]

    # 检查是否包含国家名和方位词的组合
    has_country = any(country in translation for country in [
        "美国", "加拿大", "中国", "日本", "英国", "法国", "德国", "俄罗斯", "澳洲"
    ])

    has_problem = any(pattern in translation for pattern in problematic_patterns)

    return has_country and has_problem


def fix_geographic_translation(original_en: str, bad_translation: str, video_title: str) -> Optional[str]:
    """修复地理问题翻译（单句重试）"""
    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

    headers = {
        "Authorization": f"Bearer {GLM_API_KEY}",
        "Content-Type": "application/json"
    }

    context_prefix = f"【当前视频标题：{video_title}】" if video_title else ""

    retry_prompt = f"""{context_prefix}
当前翻译存在地理方位表达问题，请重新翻译：

英文原文：{original_en}
当前翻译：{bad_translation}

⚠️ 问题提示：
1. 中文地理语境下，"在...之上"表达不自然
2. 应使用指南针方位：以北、以南、以东、以西

请按指南针方位重新翻译，只返回翻译结果（纯文本，不要JSON格式）："""

    payload = {
        "model": "glm-4-flash",
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": retry_prompt
            }
        ],
        "temperature": 0.3,
        "max_tokens": 500
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        corrected = result['choices'][0]['message']['content'].strip()
        print(f"       🔄 修正: {bad_translation} → {corrected}")
        return corrected

    except Exception as e:
        print(f"       ❌ 修正失败: {e}")
        return None


def translate_batch_with_glm(sentences: List[str], target_lang: str = "zh", video_title: str = "") -> Optional[List[str]]:
    """
    批量翻译句子（上下文感知 + 地理问题检测）

    Args:
        sentences: 待翻译的句子列表（5-10句）
        target_lang: 目标语言代码（默认 zh）
        video_title: 视频标题（用于提供上下文）

    Returns:
        翻译结果列表，失败返回 None
    """
    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

    headers = {
        "Authorization": f"Bearer {GLM_API_KEY}",
        "Content-Type": "application/json"
    }

    # 构建上下文：将句子组合成段落
    context = "\n".join([f"{i+1}. {s}" for i, s in enumerate(sentences)])

    # 注入视频标题上下文
    context_prefix = ""
    if video_title:
        context_prefix = f"【当前视频标题：{video_title}】\n请在此语境下进行地道翻译。\n\n"

    user_prompt = f"""{context_prefix}请将以下英文句子翻译成{get_language_name(target_lang)}，结合上下文提供地道翻译：

{context}

返回格式：["翻译1", "翻译2", ...]"""

    payload = {
        "model": "glm-4-flash",
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        "temperature": 0.3,
        "max_tokens": 2000
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()

        content = result['choices'][0]['message']['content'].strip()

        # 解析 JSON 数组
        translations = json.loads(content)

        if len(translations) != len(sentences):
            print(f"    ⚠️  翻译数量不匹配: 期望 {len(sentences)}, 得到 {len(translations)}")
            return None

        # 检测并修复地理问题
        for i, (original, translation) in enumerate(zip(sentences, translations)):
            if has_geographic_issue(translation):
                print(f"    🔍 检测到地理问题（句子 {i+1}）: {translation[:50]}...")
                corrected = fix_geographic_translation(original, translation, video_title)
                if corrected:
                    translations[i] = corrected

        return translations

    except json.JSONDecodeError as e:
        print(f"    ❌ JSON 解析失败: {e}")
        print(f"    原始响应: {content}")
        return None
    except Exception as e:
        print(f"    ❌ GLM API 调用失败: {e}")
        return None


def get_language_name(lang_code: str) -> str:
    """获取语言名称"""
    language_map = {
        "zh": "中文",
        "en": "英文",
        "es": "西班牙语",
        "fr": "法文",
        "de": "德文",
        "ja": "日文",
        "ko": "韩文"
    }
    return language_map.get(lang_code, lang_code)


def retranslate_material(
    material_title: str,
    target_lang: str = "zh",
    batch_size: int = 8,
    dry_run: bool = False
) -> bool:
    """
    重新翻译素材（上下文感知）

    Args:
        material_title: 素材标题
        target_lang: 目标语言代码
        batch_size: 每批翻译的句子数（建议 5-10）
        dry_run: 干运行模式

    Returns:
        是否成功
    """
    print("=" * 80)
    print(f"  🎬 处理素材: {material_title}")
    print(f"  🌍 目标语言: {get_language_name(target_lang)} ({target_lang})")
    print(f"  📦 批次大小: {batch_size} 句/批")
    print("=" * 80)

    # 连接 Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 获取素材信息
    result = supabase.table('materials').select('*').eq('title', material_title).execute()

    if not result.data:
        print(f"  ❌ 未找到素材: {material_title}")
        return False

    material = result.data[0]
    material_id = material['id']
    transcript = material.get('transcript', [])

    if not transcript:
        print(f"  ❌ 素材没有 transcript")
        return False

    total = len(transcript)
    print(f"\n  📊 总句子数: {total}")

    # 检查当前翻译状态
    needs_translation = []
    already_translated = []

    for i, sentence in enumerate(transcript):
        translation = sentence.get('translation')
        text = sentence.get('text', '').strip()

        # 检查是否需要翻译
        needs_it = False

        if not translation:
            needs_it = True
        elif isinstance(translation, str):
            # 旧格式：字符串，需要升级为 JSONB
            needs_it = True
        elif isinstance(translation, dict):
            # 新格式：JSONB，检查目标语言是否为空
            value = translation.get(target_lang, '')
            if not value or value.strip() == '':
                needs_it = True
            else:
                already_translated.append(i)
        else:
            needs_it = True

        if needs_it:
            needs_translation.append((i, text))

    print(f"  ✅ 已翻译: {len(already_translated)} 句")
    print(f"  🔄 需要翻译: {len(needs_translation)} 句")

    if not needs_translation:
        print(f"\n  ✅ 所有句子都有翻译")
        return True

    # 显示预览
    print(f"\n  📝 待翻译句子预览（前5句）:")
    for i, (idx, text) in enumerate(needs_translation[:5]):
        print(f"     [{idx+1}] {text[:80]}")
    if len(needs_translation) > 5:
        print(f"     ... 还有 {len(needs_translation) - 5} 句")

    if dry_run:
        print(f"\n  ⚠️  干运行模式，不会实际更新数据库")
        return True

    # 确认是否继续
    print(f"\n  ⚠️  将使用 GLM-4 API 重新生成 {get_language_name(target_lang)}翻译")
    confirm = input(f"\n  是否继续？(yes/no): ")

    if confirm.lower() not in ['yes', 'y']:
        print(f"  ⏭️  已取消")
        return False

    # 批量翻译
    print(f"\n  🚀 开始翻译...\n")

    success_count = 0
    failed_indices = []

    # 将需要翻译的句子分组
    for batch_start in range(0, len(needs_translation), batch_size):
        batch_end = min(batch_start + batch_size, len(needs_translation))
        batch = needs_translation[batch_start:batch_end]

        batch_num = batch_start // batch_size + 1
        total_batches = (len(needs_translation) + batch_size - 1) // batch_size

        print(f"  📦 批次 {batch_num}/{total_batches} (句子 {batch[0][0]+1} - {batch[-1][0]+1})")

        # 提取句子文本
        texts = [text for _, text in batch]

        # 调用 GLM API 翻译（传入视频标题作为上下文）
        translations = translate_batch_with_glm(texts, target_lang, material_title)

        if translations:
            # 更新 transcript
            for (idx, _), translation in zip(batch, translations):
                # 确保 translation 是 JSONB 格式
                current_translation = transcript[idx].get('translation')

                if isinstance(current_translation, dict):
                    # 已是 JSONB 格式，只更新目标语言
                    current_translation[target_lang] = translation
                else:
                    # 旧格式或为空，创建新的 JSONB 对象
                    transcript[idx]['translation'] = {target_lang: translation}

                success_count += 1

            print(f"     ✅ 批次完成 ({len(translations)}/{len(texts)} 成功)")
        else:
            print(f"     ❌ 批次失败")
            failed_indices.extend([idx for idx, _ in batch])

        # 避免请求过快
        if batch_end < len(needs_translation):
            time.sleep(1)

    # 更新 Supabase
    print(f"\n  💾 更新 Supabase...")
    try:
        supabase.table('materials').update({
            'transcript': transcript
        }).eq('id', material_id).execute()

        print(f"  ✅ 数据库已更新")

        if failed_indices:
            print(f"\n  ⚠️  {len(failed_indices)} 个句子翻译失败:")
            for idx in failed_indices[:5]:
                print(f"     [{idx+1}] {transcript[idx].get('text', '')[:60]}")
            if len(failed_indices) > 5:
                print(f"     ... 还有 {len(failed_indices) - 5} 个")

        print(f"\n  📊 最终统计:")
        print(f"     ✅ 成功: {success_count}/{len(needs_translation)}")
        print(f"     ❌ 失败: {len(failed_indices)}")

        return len(failed_indices) == 0

    except Exception as e:
        print(f"  ❌ 更新数据库失败: {e}")
        return False


def find_material_by_title(partial_title: str) -> Optional[str]:
    """根据部分标题查找素材"""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    result = supabase.table('materials').select('id', 'title').execute()

    matches = []
    for material in result.data:
        title = material.get('title', '')
        if partial_title.lower() in title.lower():
            matches.append((material['id'], title))

    if not matches:
        return None

    if len(matches) == 1:
        return matches[0][1]

    print(f"\n  找到 {len(matches)} 个匹配的素材:")
    for i, (id, title) in enumerate(matches):
        print(f"    {i+1}. {title}")

    choice = input(f"\n  请选择 (1-{len(matches)}): ")
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(matches):
            return matches[idx][1]
    except:
        pass

    return None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("=" * 80)
        print("  专业级上下文感知翻译脚本")
        print("=" * 80)
        print("\n用法:")
        print("\n  1. 翻译指定素材:")
        print("     python retranslate_with_glm.py '素材标题'")
        print("\n  2. 模糊匹配素材:")
        print("     python retranslate_with_glm.py '关键词' --fuzzy")
        print("\n  3. 干运行（不实际更新）:")
        print("     python retranslate_with_glm.py '素材标题' --dry-run")
        print("\n  4. 指定目标语言:")
        print("     python retranslate_with_glm.py '素材标题' --lang ja")
        print("\n  5. 调整批次大小:")
        print("     python retranslate_with_glm.py '素材标题' --batch-size 10")
        print("\n示例:")
        print("     python retranslate_with_glm.py 'canada' --fuzzy")
        print("     python retranslate_with_glm.py 'empty your mind' --fuzzy --dry-run")
        print("\n支持的语言代码:")
        print("     zh - 中文")
        print("     en - 英文")
        print("     ja - 日文")
        print("     ko - 韩文")
        print("     es - 西班牙语")
        print("     fr - 法文")
        print("     de - 德文")
        sys.exit(1)

    # 解析参数
    material_input = sys.argv[1]
    fuzzy_match = "--fuzzy" in sys.argv
    dry_run = "--dry-run" in sys.argv
    target_lang = "zh"

    if "--lang" in sys.argv:
        lang_idx = sys.argv.index("--lang")
        if lang_idx + 1 < len(sys.argv):
            target_lang = sys.argv[lang_idx + 1]

    batch_size = 8
    if "--batch-size" in sys.argv:
        size_idx = sys.argv.index("--batch-size")
        if size_idx + 1 < len(sys.argv):
            batch_size = int(sys.argv[size_idx + 1])

    # 查找素材
    if fuzzy_match:
        material_title = find_material_by_title(material_input)
        if not material_title:
            print(f"  ❌ 未找到匹配 '{material_input}' 的素材")
            sys.exit(1)
    else:
        material_title = material_input

    # 执行翻译
    success = retranslate_material(
        material_title=material_title,
        target_lang=target_lang,
        batch_size=batch_size,
        dry_run=dry_run
    )

    sys.exit(0 if success else 1)
