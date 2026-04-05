#!/usr/bin/env python3
import os
import requests

# 加载环境变量
env_path = Path('.env.local')
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

GLM_API_KEY = os.environ.get("GLM_API_KEY")

# 测试文本（前 3 句的内容）
test_text = "at the colony two weeks have passed the chicks are testing their independence and spending time away from their mothers all that is except one as the last to hatch he's way behind in development"

# 改进的 prompt
prompt = f"""Please add punctuation to the following text. Follow these rules:
1. Add commas where there are natural pauses in speech
2. Add periods at the end of complete sentences
3. Capitalize the first letter of each sentence
4. IMPORTANT: Do NOT merge separate sentences. If there's a clear topic change or new subject, start a new sentence.

Text: {test_text}

Return only the text with punctuation added, nothing else."""

print("🧪 测试改进的 LLM prompt")
print(f"原文: {test_text}")
print(f"\nPrompt:\n{prompt}\n")

response = requests.post(
    "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GLM_API_KEY}"
    },
    json={
        "model": "glm-4-flash",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 500
    },
    timeout=30
)

if response.status_code == 200:
    result = response.json()
    restored_text = result["choices"][0]["message"]["content"].strip()
    print(f"恢复结果: {restored_text}")
else:
    print(f"请求失败: {response.status_code}")
