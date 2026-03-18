#!/usr/bin/env python3
"""
批量翻译失败素材（V21 版本 - 静默模式）
"""
import os
import subprocess
import sys
from pathlib import Path
from supabase import create_client

# 静默模式：重定向输出
class QuietOutput:
    def __init__(self, original_stdout):
        self.original_stdout = original_stdout
        self.buffer = []

    def write(self, text):
        self.buffer.append(text)

    def flush(self):
        pass

    def get_output(self):
        return ''.join(self.buffer)

# 加载 .env.local
env_local_path = Path(__file__).parent.parent / '.env.local'
if env_local_path.exists():
    with open(env_local_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# 失败素材 ID 列表（排除 Empty Your Mind）
FAILED_IDS = [
    "11445b3c-4ab4-4fc3-960b-0b5723a5846e",  # 1. The Lion And The Mouse
    "1a0b9159-ce41-4f70-8b63-88b1962ad455",  # 2. What lack of sleep does to the teenage brain
    "2d15774e-6ff4-4ea5-997e-8df859362c9a",  # 3. The Bear and the Bee
    "6fde26b2-05a6-49de-b248-7de1ef12662d",  # 5. Cam 12 Academic Listening Test 2 Part 1
    "78298216-175b-4cce-b4bb-006fbf6d5a89",  # 6. Do you really need to take 10,000 steps a day?
    "7bdd0141-1977-4297-9876-0b931abd199b",  # 7. Jessica's First Day of School
    "97f7c201-5199-4790-8ff4-2585d46f16f1",  # 9. What happens to your brain without any social contact?
    "b1c76b2b-9107-4903-87df-1f2a39ba4a4c",  # 11. The Frightened Lion
    "b28ace45-ce39-48c1-9f79-7c191e5fd56e",  # 12. Cam 11 Academic Listening Test 3 Part 3
    "b3381d2e-7553-466c-bc4f-8a9f2b5a3411",  # 13. Cam 11 Academic Listening Test 1 Part 2
    "80017f38-99ba-4d3c-8ee6-9a217cdf83e0",  # 14. The Goose That Laid Golden Eggs
    "c306df0c-3360-4aa6-a3b1-df60091127c2",  # 15. Cam 10 Academic Listening Test 4 Part 1
    "6c05b63f-a287-4c4a-9108-e1ed130e2fbc",  # 16. The Goose That Laid The Golden Egg
    "e0a7933f-28ed-4622-ab0d-c7ec0fcb87ff",  # 18. The Cunning Fox And The Clever Stork
]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("="*100)
print("🌍 批量翻译失败素材 - V21 字幕级对齐版（静默模式）")
print("="*100)
print(f"\n📊 待翻译素材数: {len(FAILED_IDS)}")
print(f"⚙️  静默模式已开启，每完成 1 个素材自动提交")

# 统计结果
stats = {
    'success': [],
    'failed': [],
    'timestamp_error': []
}

for idx, material_id in enumerate(FAILED_IDS, 1):
    # 获取素材信息
    result = supabase.table('materials').select('id, title, category, difficulty, transcript, slug').eq('id', material_id).execute()

    if not result.data:
        print(f"\n⚠️  [{idx}/{len(FAILED_IDS)}] 未找到素材: {material_id}")
        continue

    material = result.data[0]
    title = material['title']
    slug = material.get('slug', 'N/A')
    category = material['category']
    difficulty = material['difficulty']
    transcript = material.get('transcript', [])

    # 每 1 个素材打印进度
    print(f"[Progress] {idx}/{len(FAILED_IDS)} - {slug[:50]}")

    # 静默调用 V21 脚本翻译
    quiet = QuietOutput(sys.stdout)
    old_stdout = sys.stdout
    sys.stdout = quiet

    try:
        script_path = Path(__file__).parent / 'retranslate_with_glm_v21.py'
        result = subprocess.run(
            ['python3', str(script_path)],
            env={**os.environ, 'MODE': 'single', 'SINGLE_ID': material_id},
            capture_output=True,
            text=True,
            timeout=300  # 5 分钟超时
        )

        output = result.stdout + result.stderr
        sys.stdout = old_stdout

        # 检查是否成功
        if '✅ 完成' in output and 'alignment_failed' not in output:
            stats['success'].append(title)

            # 每完成一个素材就 commit
            try:
                subprocess.run(
                    ['git', 'add', '.'],
                    capture_output=True,
                    timeout=30,
                    cwd='/Users/a/dictation'
                )
                commit_msg = f"feat: 翻译失败素材 [{idx}/{len(FAILED_IDS)}] {title[:50]}"
                subprocess.run(
                    ['git', 'commit', '-m', commit_msg],
                    capture_output=True,
                    timeout=30,
                    cwd='/Users/a/dictation'
                )
            except:
                pass  # Git 失败不影响翻译继续

        elif 'timestamp' in output or 'bad_timestamp' in output:
            stats['timestamp_error'].append(title)
        else:
            stats['failed'].append(title)

    except subprocess.TimeoutExpired:
        sys.stdout = old_stdout
        stats['failed'].append(title)
    except Exception as e:
        sys.stdout = old_stdout
        stats['failed'].append(title)

# 输出最终报表
print(f"\n{'='*100}")
print(f"✅ 批量翻译完成")
print(f"{'='*100}")

print(f"\n📊 最终报表：")
print(f"\n   成功重刷数：{len(stats['success'])}")
print(f"   跳过数 (时间戳损坏)：{len(stats['timestamp_error'])}")
print(f"   失败数 (对齐校验未通过)：{len(stats['failed'])}")

if stats['success']:
    print(f"\n✅ 成功列表：")
    for i, title in enumerate(stats['success'], 1):
        print(f"   {i}. {title[:70]}")

if stats['failed']:
    print(f"\n❌ 失败列表：")
    for i, title in enumerate(stats['failed'], 1):
        print(f"   {i}. {title[:70]}")

print(f"\n{'='*100}")
