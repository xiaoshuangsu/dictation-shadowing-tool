#!/usr/bin/env python3
"""
快速检查所有素材翻译 - 每个素材一次检查
"""
import requests
import json
import os
import time
from dotenv import load_dotenv

load_dotenv('/Users/a/dictation/.env.local')

GLM_API_KEY = os.getenv('GLM_API_KEY')
GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

# 读取所有翻译
with open('/Users/a/dictation/scripts/all_translations.json', 'r', encoding='utf-8') as f:
    translations = json.load(f)

# 按素材分组
by_material = {}
for item in translations:
    material = item['material_title']
    if material not in by_material:
        by_material[material] = []
    by_material[material].append(item)

# 已检查的素材
checked = ['Canada: Provinces and Territories', 'First Snowfall',
           'A Funny Thing Happened On The Way To School', 'Corruption', 'Ice Hockey']

unchecked = [m for m in by_material.keys() if m not in checked]

print(f"检查剩余 {len(unchecked)} 个素材\n")
print(f"总计: {len(by_material)} 个素材, {len(translations)} 条翻译\n")

issues = {}

for idx, material_name in enumerate(unchecked, 1):
    print(f"[{idx}/{len(unchecked)}] {material_name[:40]}")

    material_translations = by_material[material_name]

    # 每个素材只检查前 20 条（关键句子）
    sample = material_translations[:20]

    prompt = f"""快速检查以下翻译，只列出有明显问题的序号。

问题类型：
- above/below 地理方位错误
- 专业术语误译
- 明显的直译问题

素材：{material_name}

翻译列表：
"""
    for i, item in enumerate(sample, 1):
        prompt += f"{i}. {item['text']}\n   {item['translation']}\n\n"

    prompt += "\n如果全部正确，只输出'OK'。有问题请列出序号。"

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
                    {'role': 'system', 'content': '你是翻译审校专家。'},
                    {'role': 'user', 'content': prompt}
                ],
                'temperature': 0.2,
                'max_tokens': 1000
            },
            timeout=20
        )

        if response.status_code == 200:
            result = response.json()
            feedback = result['choices'][0]['message']['content'].strip()

            if feedback != 'OK' and '全部正确' not in feedback:
                print(f"  → 发现问题")
                issues[material_name] = feedback
            else:
                print(f"  → OK")
        else:
            print(f"  → API错误 {response.status_code}")

        time.sleep(0.2)

    except Exception as e:
        print(f"  → 出错: {str(e)[:30]}")

# 保存结果
with open('/Users/a/dictation/scripts/quick_check_issues.json', 'w', encoding='utf-8') as f:
    json.dump(issues, f, ensure_ascii=False, indent=2)

print(f"\n=== 完成 ===")
print(f"检查了 {len(unchecked)} 个素材")
print(f"发现问题的素材: {len(issues)} 个")
print(f"\n结果保存到: /Users/a/dictation/scripts/quick_check_issues.json")

if issues:
    print(f"\n有问题的素材:")
    for material, feedback in issues.items():
        print(f"  - {material}")
