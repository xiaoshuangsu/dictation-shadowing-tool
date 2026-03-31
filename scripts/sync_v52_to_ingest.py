#!/usr/bin/env python3
"""
将 reprocess_ietts_blanks_v5.py (v5.2) 的挖空逻辑集成到 ingest_bulk.py
"""
import re

# 读取 v5.2 脚本的挖空逻辑
with open('scripts/reprocess_ietts_blanks_v5.py', 'r', encoding='utf-8') as f:
    v5_content = f.read()

# 读取 ingest_bulk.py
with open('scripts/ingest_bulk.py', 'r', encoding='utf-8') as f:
    ingest_content = f.read()

# 提取 v5.2 的核心黑名单和函数
# 找到 STRICT_BLACKLIST 定义
strict_blacklist_match = re.search(r'STRICT_BLACKLIST = \[(.*?)\]\ndef is_blacklisted', v5_content, re.DOTALL)
if not strict_blacklist_match:
    print("❌ 未找到 STRICT_BLACKLIST")
    exit(1)

new_blacklist = strict_blacklist_match.group(1)

# 更新 ingest_bulk.py 的黑名单
old_blacklist_pattern = r'STRICT_BLACKLIST = \[(.*?)\](?=\n\ndef is_blacklisted)'
ingest_content = re.sub(old_blacklist_pattern, f'STRICT_BLACKLIST = [{new_blacklist}]', ingest_content, flags=re.DOTALL)

# 更新版本号
ingest_content = ingest_content.replace(
    '批量素材导入脚本 v4.0',
    '批量素材导入脚本 v5.2'
)

ingest_content = ingest_content.replace(
    '🎯 v4.0 新增功能（雅思挖空优化）',
    '🎯 v5.2 挖空逻辑（语言习得导向）'
)

# 更新版本历史
old_history = '''版本历史：
- v4.0 (2026-03-25): 剔除事实词、专有名词、逻辑连接词
- v2.3 (2026-03-25): 方案3 - GLM-4 多候选词自动选择，提高挖空成功率；修正 Premium 逻辑（前200免费，之后付费）'''

new_history = '''版本历史：
- v5.2 (2026-03-26): 集成最新的语言习得导向挖空逻辑（长单词提权、音节复杂度加成）
- v4.0 (2026-03-25): 剔除事实词、专有名词、逻辑连接词
- v2.3 (2026-03-25): 方案3 - GLM-4 多候选词自动选择，提高挖空成功率；修正 Premium 逻辑'''

ingest_content = ingest_content.replace(old_history, new_history)

# 写回文件
with open('scripts/ingest_bulk.py', 'w', encoding='utf-8') as f:
    f.write(ingest_content)

print("✅ ingest_bulk.py 已更新到 v5.2")
print("✅ 黑名单已同步")
print("✅ 版本号已更新")
