#!/usr/bin/env python3
"""
修复单个句子的翻译
"""
import os
import requests
import json
from pathlib import Path
from supabase import create_client

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

MATERIAL_ID = "d96f97f5-cc6c-4c96-b768-6525572d9af2"
SENTENCE_INDEX = 4  # 第 5 句（索引从 0 开始）

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 获取素材数据
result = supabase.table('materials').select('transcript').eq('id', MATERIAL_ID).execute()
transcript = result.data[0]['transcript']

target_sentence = transcript[SENTENCE_INDEX]
original_text = target_sentence.get('text', '')

print(f'目标句子（第 {SENTENCE_INDEX + 1} 句）：')
print(f'  原文：{original_text}')
print()

# 使用 GLM 重新翻译这一句
url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
headers = {
    "Authorization": f"Bearer {GLM_API_KEY}",
    "Content-Type": "application/json"
}

user_prompt = f"""请翻译以下句子（这是励志故事中的一个句子）：

原文：{original_text}

⚠️ 关键要求：
- uneasy 必须翻译为"不安"或"焦虑"
- **严禁**使用"心神不宁"（这是 restless 的专用翻译）
- thoughts 翻译为"想法"或"念头"
- 保持文学化表达

请只返回翻译结果："""

payload = {
    "model": "glm-4-flash",
    "messages": [
        {"role": "user", "content": user_prompt}
    ],
    "temperature": 0.2,
    "max_tokens": 200
}

try:
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    result = response.json()

    if 'choices' in result and len(result['choices']) > 0:
        new_translation = result['choices'][0]['message']['content'].strip()

        print(f'新翻译：{new_translation}')
        print()

        # 检查是否包含"心神不宁"
        if '心神不宁' in new_translation:
            print('❌ 仍然包含"心神不宁"，需要手动修复')
        else:
            print('✅ 翻译符合要求')

            # 更新数据库
            transcript[SENTENCE_INDEX]['translation'] = {"zh": new_translation}

            supabase.table('materials').update({
                'transcript': transcript
            }).eq('id', MATERIAL_ID).execute()

            print(f'✅ 已更新到数据库')
    else:
        print('❌ API 调用失败')

except Exception as e:
    print(f'❌ 翻译失败: {e}')
