# 雅思素材挖空逻辑问题与解决方案

## 📋 问题总结

### 原有问题

1. **过度挖空数字和日期**：GLM-4 优先挖空时间词（如 "mid-1500s", "15th March"）
2. **挖空无意义介词**：挖空了 "that", "about", "in" 等虚词
3. **前端随机算法问题**：当 `blanks` 为空时，前端使用随机算法挖空，导致挖空黑名单词（如 "my"）

### 影响范围

- **Cam 13**：16 个素材（Test 1-4）
- **Cam 14**：1 个素材（Test 4 Part 4）
- **其他雅思素材**：所有使用 IELTS Listening 分类的素材

---

## 🔧 解决方案

### 1. 更新挖空协议（雅思专家级）

**文件**：`scripts/ingest_bulk.py`

**新协议特点**：
- **黄金比例策略**（30/50/20）：
  - 30% 高价值事实词（数字、日期、价格、地址、专有名词）
  - 50% 核心考点实词（学术名词、功能性动词、描述性形容词）
  - 20% 逻辑连接词（信号词、转折词、强调词）
- **意义大于频率**：避免无意义挖空
- **密度控制**：短句不超过 2 个挖空

### 2. 核心黑名单（严禁挖空）

**文件**：`scripts/ingest_bulk.py`

```python
STRICT_BLACKLIST = [
    # 代词/引导词
    'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
    'that', 'which', 'who', 'this', 'these', 'those',
    'my', 'your', 'his', 'hers', 'its', 'our', 'their', 'ours', 'theirs',
    'whom', 'whose',
    # 虚词/连词
    'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'if',
    # 简单介词
    'in', 'on', 'at', 'to', 'of', 'for', 'with', 'by', 'from', 'about',
    # 基础系动词/助动词
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'have', 'has', 'had',
    # 其他
    'there', 'here'
]
```

**黑名单过滤函数**：
```python
def is_blacklisted(word: str) -> bool:
    """检查单词是否在黑名单中"""
    return word.lower().strip('.,!?;:"\'') in STRICT_BLACKLIST
```

### 3. 修复前端随机算法

**文件**：`src/components/WordMode.tsx`

**问题代码**（已移除）：
```typescript
// ❌ 旧逻辑：当 blanks 为空时，使用随机算法
const seed = sentence.id || 1
const randomIndex = seed % sentenceWords.length
// 结果：第1句（id=1）随机到索引1，挖空了 "my"
```

**修复后逻辑**：
```typescript
// ✅ 新逻辑：当 blanks 为空时，不挖空
if (!sentence.blanks || sentence.blanks.length === 0) {
  return {
    hiddenWordIndex: -1,  // -1 表示不挖空
    hiddenWord: "",
    visibleWordsBefore: sentenceWords,  // 显示所有单词
    visibleWordsAfter: []
  }
}
```

---

## 📊 效果对比

| 对比项 | 旧逻辑 | 新逻辑 |
|--------|--------|--------|
| **第1句挖空** | [my] ❌ | [importance] ✅ |
| **黑名单词** | 有（my, that, is） | 无 ✅ |
| **数字过度挖空** | 是 | 否 ✅ |
| **介词挖空** | 有 | 无 ✅ |
| **挖空质量** | 低 | 高 ✅ |

---

## 🚀 实施步骤

### 步骤1：更新脚本版本

```bash
# 当前版本：v2.2
# 位置：scripts/ingest_bulk.py
# 更新内容：
# - 雅思专家级挖空协议
# - 核心黑名单过滤
# - 三语翻译支持
```

### 步骤2：修复前端组件

```bash
# 文件：src/components/WordMode.tsx
# 提交：26cbbe2
# 状态：已部署到 Vercel
```

### 步骤3：批量重新处理素材

**测试素材**：
- `cam-13-academic-listening-test-4-part-4` ✅ 已验证

**待处理素材**：
- Cam 13：Test 1-4（16 个）
- Cam 14：Test 1-4（16 个）
- 其他：按需处理

---

## 📝 验证命令

### 检查脚本版本

```bash
head -5 scripts/ingest_bulk.py | grep "批量素材导入脚本"
```

### 验证黑名单

```python
import os, json
from pathlib import Path
from supabase import create_client

env = dict(line.strip().split('=', 1) for line in open('.env.local') if '=' in line and not line.startswith('#'))
os.environ.update(env)
s = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

r = s.table('materials').select('transcript').eq('slug', 'cam-13-academic-listening-test-4-part-4').execute()
t = json.loads(r.data[0]['transcript'])

# 检查前5句
for i in range(5):
    blanks = t[i].get('blanks', [])
    if blanks:
        word = blanks[0].get('word', '')
        print(f"{i+1}. [{word}] - {t[i]['text'][:50]}...")
    else:
        print(f"{i+1}. (无挖空) - {t[i]['text'][:50]}...")
```

---

## 🔍 恢复口令

```
项目：ShadowHub 雅思素材挖空优化
版本：ingest_bulk.py v2.2

问题：过度挖空数字、日期、介词；前端随机算法挖空黑名单词

解决方案：
1. 雅思专家级挖空协议（30/50/20 黄金比例）
2. 核心黑名单过滤（50+ 虚词）
3. 修复前端随机算法（不挖空而不是随机）

文件位置：
- 脚本：scripts/ingest_bulk.py
- 前端：src/components/WordMode.tsx
- 文档：/Users/a/dictation/docs/ielts_blanks_logic_fix.md

验证：https://shadowhub.app/topics/ielts-listening/cam-13-academic-listening-test-4-part-4/
```

---

## 📌 相关文件

- **脚本**：`scripts/ingest_bulk.py`（v2.2）
- **前端组件**：`src/components/WordMode.tsx`
- **本文档**：`/Users/a/dictation/docs/ielts_blanks_logic_fix.md`

---

## ✅ 状态

| 项目 | 状态 |
|------|------|
| **脚本更新** | ✅ v2.2 |
| **前端修复** | ✅ 已部署 |
| **测试素材** | ✅ 已验证（Cam 13 Test 4 Part 4）|
| **批量处理** | ⏸️ 待用户确认后执行 |

---

**版本**：v2.2
**更新日期**：2026-03-25
**状态**：生产就绪
