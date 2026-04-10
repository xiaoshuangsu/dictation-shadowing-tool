# 词典缓存增量补齐方案 - 部署指南

## 📋 概述

本指南用于部署词典缓存增量补齐功能，为 `dictionary_cache` 表的 1000 个单词补齐完整的 20 国语言翻译（含法语）。

## ✅ 实施状态

**已完成**：
- ✅ 添加增量补齐模式（`--patch-mode`）
- ✅ 实现断点续传功能（`--checkpoint-file`）
- ✅ 实现智能分批翻译（`--batch-size`）
- ✅ 实现静默模式（`--silent`）
- ✅ 实现进度报告（`--report-interval`）
- ✅ 添加法语语言定义（已包含在 GROUP_A）
- ✅ 测试验证通过（3 个单词测试成功）

## 🔧 技术实现

### 1. 核心功能模块

#### CheckpointManager（断点续传管理器）
- 保存处理进度到 JSON 文件
- 支持中断后恢复
- 跟踪成功/失败/跳过的单词

#### SmartTranslationEngine（智能翻译引擎）
- 只翻译缺失的语言（增量模式）
- 智能分批（默认每批 10 种语言）
- 带重试机制的 API 调用
- 自动降级策略

#### ProgressReporter（进度报告器）
- 实时进度追踪
- 定期汇总报告（默认每 50 个单词）
- 预计剩余时间
- 最终统计报告

#### SilentModeLogger（静默模式日志）
- 减少日志输出
- 只显示关键信息和汇总报告

### 2. 语言配置

当前支持 20 种语言（不含英语）：

```python
EXISTING_LANGUAGES = ['zh', 'zh_hant', 'vi']  # 3 种（已存在）
GROUP_A = ['ar', 'de', 'es', 'fr', 'ja', 'ms', 'ru', 'tr', 'el']  # 9 种（含法语）
GROUP_B = ['id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']  # 8 种

ALL_20_LANGUAGES = EXISTING_LANGUAGES + GROUP_A + GROUP_B  # 共 20 种
```

## 📊 当前数据状态

根据测试结果：
- **总单词数**：1000 个
- **翻译不全**：998 个（缺少 17-19 种语言）
- **翻译完整但缺法语**：2 个
- **总计需要补齐**：1000 个单词

## 🚀 部署步骤

### Phase 1：备份数据（可选但推荐）

```bash
# 使用备份脚本
python3 scripts/backup_dictionary_cache.py backup dictionary_cache
```

### Phase 2：小规模测试

**测试目标**：验证补齐逻辑、断点续传、日志输出

```bash
# 测试 10 个单词（非静默模式）
python3 scripts/prepopulate_dictionary_cache_v3.py \
    --test \
    --patch-mode \
    --batch-size 10 \
    --limit 10

# 测试 10 个单词（静默模式）
python3 scripts/prepopulate_dictionary_cache_v3.py \
    --test \
    --patch-mode \
    --silent \
    --batch-size 10 \
    --limit 10 \
    --report-interval 5
```

**验证点**：
- ✅ 检查 10 个单词是否都包含 fr, ja, zh_hant, zh
- ✅ 验证 checkpoint 文件是否生成
- ✅ 验证日志输出是否合理
- ✅ 中断后重启是否能从断点恢复

### Phase 3：中规模测试（可选）

**测试目标**：验证断点续传功能、长时间运行稳定性

```bash
# 测试 100 个单词（静默模式）
python3 scripts/prepopulate_dictionary_cache_v3.py \
    --test \
    --patch-mode \
    --silent \
    --batch-size 10 \
    --limit 100 \
    --report-interval 25 \
    --checkpoint-file scripts/patch_checkpoint_test.json
```

**断点续传测试**：
1. 运行上述命令
2. 等待 30-40 个单词后按 Ctrl+C 中断
3. 重新运行相同命令
4. 验证是否从断点继续（查看日志中的 "从第 X 个单词恢复"）

### Phase 4：生产部署

#### 方案 A：前台运行（适合监控）

```bash
# 全量运行（推荐）
python3 scripts/prepopulate_dictionary_cache_v3.py \
    --patch-mode \
    --silent \
    --batch-size 10 \
    --checkpoint-file scripts/patch_checkpoint.json \
    --report-interval 50
```

#### 方案 B：后台运行（推荐）

```bash
# 使用 nohup 后台运行
nohup python3 scripts/prepopulate_dictionary_cache_v3.py \
    --patch-mode \
    --silent \
    --batch-size 10 \
    --checkpoint-file scripts/patch_checkpoint.json \
    --report-interval 50 \
    >> scripts/dictionary_patch_final.log 2>&1 &

# 记录进程 ID
echo $! > scripts/patch_process.pid
```

### Phase 5：监控进度

```bash
# 实时查看日志
tail -f scripts/dictionary_patch_final.log

# 查看进度报告
grep "📊 进度:" scripts/dictionary_patch_final.log

# 查看检查点状态
cat scripts/patch_checkpoint.json | python3 -m json.tool

# 检查进程是否运行
ps aux | grep "prepopulate_dictionary_cache_v3.py"

# 如果有 PID 文件
kill -0 $(cat scripts/patch_process.pid) && echo "Running" || echo "Not running"
```

### Phase 6：验证结果

**完成后验证**：

```bash
# 1. 检查完成状态
tail -50 scripts/dictionary_patch_final.log

# 2. 验证翻译完整性
python3 -c "
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

env_path = Path('.env.local')
load_dotenv(env_path)

supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# 查询所有单词的翻译数量
response = supabase.table('dictionary_cache').select('word', 'translations').not_.is_('translations', 'null').execute()

all_words = response.data
complete_count = 0
incomplete_words = []

for word_entry in all_words:
    word = word_entry['word']
    translations = word_entry.get('translations')

    if isinstance(translations, str):
        translations = json.loads(translations)

    if translations and len(translations) >= 20:  # 至少 20 种语言
        complete_count += 1
    else:
        incomplete_words.append(word)

print(f'✅ 翻译完整: {complete_count}/{len(all_words)}')
if incomplete_words:
    print(f'⚠️  仍然不全: {len(incomplete_words)} 个')
    print(f'前 10 个: {incomplete_words[:10]}')
else:
    print(f'✅ 所有单词翻译完整！')
"
```

## 📈 预期结果

### 补齐前
- 998 个单词：3-4 种语言（zh, zh_hant, vi，可能还有其他）
- 2 个单词：19 种语言（缺法语）

### 补齐后
- **所有 1000 个单词**：完整的 21 种语言（en + 20 种目标语言）
- JSON 格式统一
- 前端自动获取最新翻译

### 性能指标

- **成功率**：> 95%（预期）
- **平均速度**：8-10 秒/单词（基于测试）
- **预计总耗时**：约 2-3 小时（1000 个单词）
- **API 调用次数**：约 1500-2000 次（智能分批减少）

## 🔧 参数说明

| 参数 | 说明 | 默认值 | 推荐值 |
|------|------|--------|--------|
| `--patch-mode` | 增量补齐模式 | - | 必须启用 |
| `--silent` | 静默模式（减少日志） | - | 生产环境推荐 |
| `--batch-size` | 每批翻译语言数 | 10 | 8-10 |
| `--checkpoint-file` | 断点文件路径 | `scripts/patch_checkpoint.json` | 默认即可 |
| `--report-interval` | 进度报告间隔 | 50 | 50-100 |
| `--test` | 测试模式 | - | 仅测试时使用 |
| `--limit` | 单词数量限制 | 3 | 测试时使用 |

## ⚠️ 注意事项

1. **API 限流**：脚本已内置延迟机制，但仍需注意 GLM API 的速率限制
2. **断点续传**：中断后重新运行相同命令即可自动恢复
3. **静默模式**：生产环境推荐使用，减少日志输出
4. **分批大小**：默认 10 种语言/批，可根据 API 性能调整（8-12）
5. **法语支持**：已添加到 GROUP_A，无需额外配置

## 🐛 故障排除

### 问题 1：API 调用失败

**现象**：日志显示 "批次 X 最终失败"

**解决**：
- 检查网络连接
- 检查 GLM_API_KEY 是否有效
- 减小 `--batch-size`（如改为 8）

### 问题 2：进程中断

**现象**：Ctrl+C 或系统中断

**解决**：
- 断点续传会自动保存进度
- 重新运行相同命令即可恢复
- 不要删除 `scripts/patch_checkpoint.json`

### 问题 3：翻译不完整

**现象**：验证时发现部分单词仍然不全

**解决**：
- 查看日志中的失败单词列表
- 重新运行脚本（只会处理缺失的单词）
- 检查 `patch_checkpoint.json` 中的 `failed_words`

### 问题 4：日志过多

**现象**：日志文件太大

**解决**：
- 使用 `--silent` 参数
- 增大 `--report-interval`（如改为 100）

## 📝 文件清单

### 新增/修改的文件

1. **`scripts/prepopulate_dictionary_cache_v3.py`**（已修改）
   - 添加增量补齐模式
   - 添加断点续传功能
   - 添加智能分批翻译
   - 添加静默模式
   - 添加进度报告

### 生成的文件

2. **`scripts/patch_checkpoint.json`**（运行时生成）
   - 断点续传数据
   - 处理进度记录
   - 失败单词列表

3. **`scripts/dictionary_patch_final.log`**（运行时生成）
   - 完整运行日志
   - 进度报告
   - 错误信息

4. **`scripts/patch_process.pid`**（可选）
   - 后台进程 PID
   - 用于进程管理

## ✅ 成功标准

- [ ] 所有 1000 个单词包含完整的 20+1 种语言
- [ ] 成功率 > 95%
- [ ] 无数据库错误
- [ ] 检查点文件正确记录
- [ ] 前端能正确获取翻译

## 🎯 后续步骤

1. **验证前端集成**：确认前端能正确获取多语言翻译
2. **性能监控**：观察 API 调用次数和响应时间
3. **数据清理**：验证无误后可删除测试检查点文件
4. **文档更新**：更新系统文档，记录新增的法语支持

## 📞 支持

如遇问题，请检查：
1. 日志文件：`scripts/dictionary_patch_final.log`
2. 检查点文件：`scripts/patch_checkpoint.json`
3. 环境变量：`.env.local` 文件
4. 网络连接：确保能访问 GLM API 和 Supabase

---

**状态**：✅ 实施完成，等待部署

**最后更新**：2026-04-10
**版本**：v1.0
