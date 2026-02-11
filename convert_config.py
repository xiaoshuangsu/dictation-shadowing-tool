#!/usr/bin/env python3
"""
将 draft_config.json 转换为 sampleSentences 格式
"""

import json
from pathlib import Path

# 读取 draft_config.json
with open('draft_config.json', 'r') as f:
    config = json.load(f)

print("// 复制以下代码到 src/app/page.tsx 的 sampleSentences 数组：\n")
print("const sampleSentences = [")
for seg in config['segments']:
    print(f"  {{ id: {seg['id']}, text: \"[Text {seg['id']} - {seg['start']}s-{seg['end']}s]\", startTime: {seg['start']}, endTime: {seg['end']} }},")
print("]")

print("\n" + "="*60)
print("📝 接下来需要做的事情：")
print("="*60)
print("1. 上面的代码使用了占位符文本")
print("2. 你需要替换为真实的英语句子文本")
print("3. 运行以下命令生成带真实文本的版本：")
print("")
print("   python3 generate_with_text.py")
print("")
print("4. 或者直接在 src/app/page.tsx 中手动更新")

# 同时生成一个完整的 JavaScript 文件供参考
js_code = f"""
// Auto-generated from draft_config.json
// First Snowfall - 听写练习时间戳

const sampleSentences = [
{chr(10)}""".join([
    f"""  {{ id: {seg['id']}, text: "[需要填写文本 {seg['id']}]", startTime: {seg['start']}, endTime: {seg['end']} }},"""
    for seg in config['segments']
]) + """
];
"""

with open('sampleSentences_draft.js', 'w') as f:
    f.write(js_code)

print("✅ 同时生成了 sampleSentences_draft.js 供参考")
