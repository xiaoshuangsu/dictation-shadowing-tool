#!/usr/bin/env python3
"""
口语类素材修复脚本（三级权重版）
遵循：语义对齐 > 上下文约束 > 禁止脑补
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
from typing import List, Dict
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

GLM_API_KEY = os.environ.get("GLM_API_KEY")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# ══════════════════════════════════════════════════════════════════════════════
# System Prompt V19.6（三级权重版）
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """你是一位专业的英汉翻译专家。严格遵守以下规则：

【三级权重原则】（必须按优先级遵守）：

1️⃣ 第一优先级：语义对齐 (Accuracy First)
⚠️ 严禁为了添加语气词而改变原句逻辑
- 原文是陈述句 → 翻译必须是陈述句（❌ 不能变成感叹句）
- 原文无感叹情绪 → 严禁添加感叹号和强烈情绪词
- 示例：I want to buy a fish. → "我想买条鱼。"（✅） / "我想买条鱼呀！"（❌ 过度）

2️⃣ 第二优先级：上下文约束 (Contextual Logic)
根据上下文判断"语气词"的必要性：

功能性对话（点餐、买卖、询问）：
- 语气词应极简，仅用于消除机械感
- 示例：Okay → "好的" / "行吧"（❌ "好的呀！"）

情绪性对话（朋友吐槽、惊讶、整蛊）：
- 语气词可以稍多，以匹配情绪
- 示例：You were joking? → "你逗我呢？" / "你耍我啊？"

故事/叙述类：
- 根据句子内容判断，不是所有句子都需要语气词
- 陈述事实：无需语气词
- 角色对话：可以添加轻微语气词
- 示例：The dog is brown. → "这只狗是棕色的。"（客观陈述，无需语气词）

3️⃣ 第三优先级：禁止脑补 (No Decoration)
- 严禁添加"就像、仿佛、轻声细语、真可爱"等形容词
- 语气词只能加在句末
- 每句不得超过一个语气词
- ❌ 负面案例：The dog is brown. → "这只小狗是棕色的哦，真可爱呀！"
- ✅ 正确案例：The dog is brown. → "这只狗是棕色的。"

【分类风格规则】：

📖 故事类（Kids Stories）：
- 叙述部分：客观陈述，无需语气词
- 角色对话：根据情绪添加轻微语气词
- 严禁：过度情绪化（"呀"、"哦"、"啦"连用）

🏠 日常生活类：
- 功能性对话：极简语气词（"好的"、"行吧"）
- 情绪性对话：可以添加语气词（"你逗我呢？"）
- 严禁：改变句子逻辑（陈述句→感叹句）

🔬 科学/IELTS 类：
- 术语严谨，无情绪词
- 无语气词

💼 职场正式类：
- 用词正式，无口语俚语
- 语气中性

【示例对照】（故事类）：
1. Said the giant,
   → 巨人说，（✅ 客观陈述）

2. With the golden eggs and the magic harp,
   → 带着金蛋和魔法竖琴，（✅ 客观陈述）

3. I stuck my hand into the cage,
   → 我把手伸进笼子里，（✅ 客观陈述）

4. That sounds nice.
   → 听起来不错，（✅ 可以有轻微语气）

【输出格式】：
返回 JSON：{"translations": ["翻译1", "翻译2", ...]}
"""


def translate_batch(texts: List[str], video_title: str, category: str, difficulty: str) -> List[str]:
    """批量翻译（三级权重版）"""
    
    numbered_list = "\n".join([f"{i+1}. [{text}]" for i, text in enumerate(texts)])
    
    url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    headers = {
        "Authorization": f"Bearer {GLM_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # 判断风格
    if 'IELTS' in category or category == 'Science and Facts':
        style = "科学科普（术语严谨，无情绪词，无语气词）"
    elif '故事' in category or 'Stories' in category or 'Kids' in category:
        style = "故事类（叙述客观，角色对话可加轻微语气词，严禁过度情绪化）"
    elif category == '日常生活':
        style = "日常生活（功能性对话极简语气词，情绪性对话可加语气词）"
    else:
        style = "职场正式（用词正式，无俚语，语气中性）"
    
    payload = {
        "model": "glm-4-flash",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"""请翻译以下 {len(texts)} 行字幕：

**视频标题**: {video_title}
**分类**: {category}
**难度**: {difficulty}
**风格**: {style}

字幕内容（带编号）：
{numbered_list}

⚠️ 三级权重强制要求：
1. 语义对齐：严禁为了语气词改变句子逻辑（陈述句不能变感叹句）
2. 上下文约束：功能性对话极简语气词，情绪性对话可加语气词
3. 禁止脑补：严禁添加形容词，语气词每句不超过一个

返回 JSON：{{"translations": ["翻译1", "翻译2", ...]}}"""}
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
            
            if len(translations) == len(texts):
                return translations
            else:
                print(f"      ⚠️  返回行数不匹配：{len(translations)}/{len(texts)}")
                while len(translations) < len(texts):
                    translations.append("")
                return translations[:len(texts)]
        else:
            print(f"      ⚠️  API 返回格式异常")
            return ["" for _ in texts]
            
    except Exception as e:
        print(f"      ❌ 翻译失败: {str(e)[:50]}")
        return ["" for _ in texts]


def process_material(material_id: str, video_title: str, category: str, difficulty: str, transcript: List[Dict], supabase_client) -> bool:
    """处理单个素材的翻译"""
    
    print(f"\n{'─'*80}")
    print(f"🎬 {video_title}")
    print(f"📝 {len(transcript)} 句 | 📂 {category} | 🎯 {difficulty}")
    print(f"{'─'*80}")
    
    # 提取所有句子文本（只处理有 text 字段的句子）
    valid_sentences = [(i, sent.get('text', '').strip()) for i, sent in enumerate(transcript) if sent.get('text', '').strip()]
    
    if not valid_sentences:
        print(f"❌ 无有效句子")
        return False
    
    # 提取文本列表用于翻译
    texts = [text for _, text in valid_sentences]
    
    # 分批翻译（每批 8 句）
    batch_size = 8
    all_translations = []
    
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(texts) + batch_size - 1) // batch_size
        
        print(f"   📦 批次 {batch_num}/{total_batches} ({len(batch_texts)} 句)...", end="", flush=True)
        
        # 翻译当前批次
        translations = translate_batch(batch_texts, video_title, category, difficulty)
        all_translations.extend(translations)
        
        print(f" ✓")
        time.sleep(0.3)  # 避免 API 频率限制
    
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
        
        print(f"✅ 完成")
        return True
        
    except Exception as e:
        print(f"❌ 数据库更新失败: {str(e)[:100]}")
        return False


def main():
    """主函数"""
    
    # 需要修复的素材列表
    materials_to_fix = [
        "Jack and the beanstalk - Kids Stories - LearnEnglish Kids British Council",
        "The Pet Store",
        "B3L3 Dialogue",
        "Personal Computers",
        "Describing your Hometown _ Adjectives, Prepositions of Place",
        "Eating Out"
    ]
    
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    print("="*100)
    print("🔧 口语类素材修复脚本（三级权重版）")
    print("="*100)
    print(f"\n📋 待修复素材: {len(materials_to_fix)} 个")
    
    success_count = 0
    
    for idx, title in enumerate(materials_to_fix, 1):
        result = supabase.table('materials').select('*').eq('title', title).execute()
        
        if not result.data:
            print(f"\n⚠️  未找到素材: {title[:60]}")
            continue
        
        material = result.data[0]
        
        print(f"\n{'='*100}")
        print(f"[{idx}/{len(materials_to_fix)}] {title}")
        print(f"{'='*100}")
        
        # 重点展示 Jack and the beanstalk
        if 'Jack and the beanstalk' in title:
            print(f"\n🎯 重点素材：故事类翻译示例")
            print(f"   预期效果：叙述客观，角色对话有轻微语气词")
            print(f"{'-'*80}")
        
        if process_material(
            material['id'],
            material['title'],
            material['category'],
            material['difficulty'],
            material.get('transcript', []),
            supabase
        ):
            success_count += 1
            
            # Git commit
            try:
                commit_msg = f"fix: 修复口语素材 [{idx}/{len(materials_to_fix)}] {title[:50]}"
                subprocess.run(['git', 'add', '.'], capture_output=True, timeout=30)
                subprocess.run(['git', 'commit', '-m', commit_msg], capture_output=True, timeout=30)
                print(f"   📦 Git commit: {commit_msg[:60]}...")
            except Exception as e:
                print(f"   ⚠️  Git commit 失败: {str(e)[:50]}")
            
            # 质量检查
            print(f"\n📊 质量验证：")
            result = supabase.table('materials').select('*').eq('title', title).execute()
            m = result.data[0]
            transcript = m.get('transcript', [])
            
            # 随机抽 3 句检查
            import random
            valid_sentences = [s for s in transcript if s.get('text') and s.get('translation')]
            if valid_sentences:
                samples = random.sample(valid_sentences, min(3, len(valid_sentences)))
                
                for i, sent in enumerate(samples, 1):
                    text = sent['text']
                    trans = sent.get('translation', {})
                    zh = trans.get('zh', '') if isinstance(trans, dict) else trans
                    
                    print(f"\n   采样 {i}:")
                    print(f"   EN: {text[:100]}")
                    print(f"   ZH: {zh}")
                    
                    # 检查是否过度情绪化
                    if '！！' in zh or '呀！' in zh or '哦！' in zh:
                        print(f"   ⚠️  过度情绪化")
                    elif text.endswith('?') and ('？' not in zh and '吗' not in zh and '呢' not in zh):
                        print(f"   ⚠️  疑问句缺少语气词")
                    elif text.endswith('.') and ('。' not in zh):
                        print(f"   ⚠️  陈述句未正确结束")
        else:
            print(f"\n⚠️  素材翻译失败")
    
    print(f"\n{'='*100}")
    print(f"✅ 修复完成")
    print(f"{'='*100}")
    print(f"\n📊 统计:")
    print(f"   成功: {success_count} / {len(materials_to_fix)}")
    
    # 推送到远程仓库
    try:
        print(f"\n📡 推送到 GitHub...")
        subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, timeout=60)
        print(f"✅ 推送完成")
    except Exception as e:
        print(f"⚠️  推送失败: {str(e)[:50]}")


if __name__ == "__main__":
    main()
