#!/usr/bin/env python3
"""
全面检查所有翻译质量，使用 GLM API 批量检查
"""
import requests
import json
import os
import time
from dotenv import load_dotenv

load_dotenv('/Users/a/dictation/.env.local')

# GLM API 配置
GLM_API_KEY = os.getenv('GLM_API_KEY', 'b21131aa31fe4fb2a38436c5aaf4430c.hiQFK9PflIMlaJEb')
GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

# 读取所有翻译
with open('/Users/a/dictation/scripts/all_translations.json', 'r', encoding='utf-8') as f:
    translations = json.load(f)

print(f"总共需要检查 {len(translations)} 条翻译\n")

# 按素材分组，减少 API 调用
by_material = {}
for item in translations:
    material = item['material_title']
    if material not in by_material:
        by_material[material] = []
    by_material[material].append(item)

print(f"共 {len(by_material)} 个素材\n")

# 重点检查的素材（地理、历史、文化类，容易出现翻译问题）
priority_materials = [
    'Canada: Provinces and Territories',
    'First Snowfall',
    'A Funny Thing Happened On The Way To School',
    'Corruption',
    'Ice Hockey',
    'Going Camping',
    'Hiroshima',
    'Jennifer the Firefighter',
    'Mark\'s Big Game',
    'New Year\'s Day',
    'Jessica\'s First Day of School',
    'Lou Gehrig\'s Farewell Speech',
    'Bill Clinton',
    'Handel\'s Messiah',
    'Valentine\'s Day Story',
    'The Story of the Three Little Pigs',
    'The Cunning Fox and the Clever Stork',
    'The Goose that Laid Golden Eggs',
    'The Lion and the Mouse',
]

# 只检查优先素材的所有翻译
issues_found = []

for material_name in priority_materials[:5]:  # 先检查前5个
    if material_name not in by_material:
        continue

    material_translations = by_material[material_name]
    print(f"\n=== 检查素材: {material_name} ({len(material_translations)} 条) ===")

    # 分批检查，每批 20 条
    batch_size = 20
    for i in range(0, len(material_translations), batch_size):
        batch = material_translations[i:i+batch_size]

        prompt = f"""请检查以下英文-中文翻译对，找出所有不自然、不准确或直译的翻译。

特别注意：
1. 地理方位词：north/south/east/west 应翻译为"北/南/东/西"
2. 方位介词：above/below 在地理上下文应翻译为"以北/以南"，而非"之上/之下"
3. 时间表达：ago, in, for, since 等要准确
4. 固定习语：不要直译，要用地道的中文表达
5. 口语化：保持口语化的自然风格

格式要求：只输出有问题翻译的序号和修改建议，格式如下：
序号. [问题类型]
   原文：...
   当前翻译：...
   建议修改：...

如果没有问题，请输出"全部正确"。

翻译列表：
"""
        for idx, item in enumerate(batch, 1):
            prompt += f"\n{idx}. {item['text']}\n   {item['translation']}\n"

        try:
            response = requests.post(
                GLM_API_URL,
                headers={
                    'Authorization': f'Bearer {GLM_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'glm-4-flash',
                    'messages': [
                        {'role': 'system', 'content': '你是一个专业的英汉翻译审校专家。'},
                        {'role': 'user', 'content': prompt}
                    ],
                    'temperature': 0.3,
                    'max_tokens': 2000
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                feedback = result['choices'][0]['message']['content']

                print(f"  批次 {i//batch_size + 1}: ", end='')
                if "全部正确" in feedback or "没有问题" in feedback:
                    print("✓ 全部正确")
                else:
                    print("发现")
                    print(feedback)

                issues_found.append({
                    'material': material_name,
                    'batch_start': i,
                    'batch_end': min(i+batch_size, len(material_translations)),
                    'feedback': feedback
                })

            else:
                print(f"  API 错误: {response.status_code}")

            time.sleep(0.5)  # 避免频率限制

        except Exception as e:
            print(f"  处理出错: {e}")

# 保存结果
with open('/Users/a/dictation/scripts/translation_check_results.json', 'w', encoding='utf-8') as f:
    json.dump(issues_found, f, ensure_ascii=False, indent=2)

print(f"\n检查完成！")
print(f"结果已保存到: /Users/a/dictation/scripts/translation_check_results.json")
