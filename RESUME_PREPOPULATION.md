# 词典预生成脚本恢复口令

**版本**: V27.1.1
**更新日期**: 2026-03-22
**用途**: 确保词典预生成脚本正确启动，避免字段名错误和重复进程

---

## 🎯 一句话恢复口令

> "请先阅读 `RESUME_PREPOPULATION.md`，然后执行：**先检查并清理旧进程，再启动最新脚本**。"

---

## 📊 当前状态（2026-03-22 17:29）✅ 已完成

### 数据库状态
- **数据库表**: `dictionary_cache`
- **字段名**: `definitions` ✅（不是 `definition_json`）
- **当前缓存数**: 7131 个
- **总单词数**: 7129 个（过滤后）
- **完成度**: 100% ✅
- **剩余**: 0 个

### 脚本状态
- **脚本位置**: `scripts/prepopulate_dictionary_cache.py`
- **版本**: V27.1.1（已优化）
- **特性**:
  - ✅ 完整日志系统
  - ✅ 逐词立即保存
  - ✅ 错误自动跳过
  - ✅ 5分钟进度汇报
  - ✅ 使用正确的字段名 `definitions`
  - ✅ **异常单词过滤**（新增）

### 🎉 完成历史

| 日期 | 事件 | 缓存数 | 进度 |
|------|------|--------|------|
| 2026-03-22 07:57 | 初始运行 | 5027 | 70.5% |
| 2026-03-22 17:21 | 发现隐藏进度 | 7131 | 99.9% |
| 2026-03-22 17:29 | 清理异常单词 + 优化过滤 | 7131/7129 | **100%** ✅ |

---

## 🛡️ 异常单词过滤规则（V27.1.1 新增）

### 过滤逻辑

脚本现在会自动过滤以下类型的异常单词：

1. **超长单词**（> 20 字符）
   - 例如：`greedinessgetsusnothing`, `moralbewareofflattersTheyoftenwantsomethingfromyou`
   - 原因：多个单词连在一起（素材数据质量问题）

2. **专有名词**（地名、人名、网站名）
   - 例如：`taipei`, `taiwanese`, `taiwan`, `fablecottage`
   - 原因：非通用英语词汇

3. **拼写错误**（素材质量问题）
   - 例如：`booly`, `groud`, `bussell`, `ratchesons`
   - 原因：素材 transcript 错误

4. **连续重复字符**
   - 例如：`aaaa`, `zzzzz`
   - 原因：非正常单词

5. **包含数字**
   - 例如：`abc123`, `test4`
   - 原因：非纯字母单词

6. **过短单词**（< 2 字符）
   - 原因：通常为无意义片段

### 已清理的异常单词（10 个）

| 单词 | 类型 | 来源素材 |
|------|------|---------|
| `greedinessgetsusnothing` | 超长 | The Goose That Laid Golden Eggs |
| `moralbewareofflatterstheyoftenwantsomethingfromyou` | 超长 | The Fox and the Crow |
| `fablecottage` | 网站名 | TheFableCottage.com 素材 |
| `booly` | 拼写错误 | What time is it? |
| `groud` | 拼写错误 | Little Red Riding Hood |
| `singsing` | 人名 | 未知素材 |
| `ratchesons` | 人名 | 未知素材 |
| `bussell` | 人名 | 未知素材 |
| `halleluia` | 宗教词汇 | 未知素材 |
| `system` | 系统词汇 | 技术类素材 |

### 修改过滤规则

如需调整过滤规则，编辑 `scripts/prepopulate_dictionary_cache.py` 中的 `is_valid_word()` 函数：

```python
def is_valid_word(word: str) -> bool:
    # 1. 调整长度限制
    if len(word) > 20:  # 可修改阈值
        return False

    # 2. 添加黑名单
    proper_nouns = {
        'your_word_here',  # 添加要过滤的单词
    }
    if word in proper_nouns:
        return False

    # ... 其他规则
```

---

## 🚀 正确启动步骤

### 步骤 1：检查并清理旧进程

```bash
# 检查是否有旧的脚本在运行
ps aux | grep "[p]ython3.*prepopulate_dictionary_cache"

# 如果有进程，先杀掉
pkill -f "prepopulate_dictionary_cache.py"

# 确认已清理
ps aux | grep "[p]ython3.*prepopulate_dictionary_cache" || echo "✅ 无旧进程"
```

### 步骤 2：确认数据库字段名

```bash
python3 -c "
from supabase import create_client
from pathlib import Path
import os

env_local = Path('.env.local')
with open(env_local) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

supabase = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

# 查询一个已缓存的单词来验证字段名
result = supabase.table('dictionary_cache').select('*').eq('word', 'hello').single().execute()
if result.data:
    if 'definitions' in result.data:
        print('✅ 数据库字段名正确: definitions')
    else:
        print('❌ 数据库字段名错误!')
        print(f'可用字段: {list(result.data.keys())}')
"
```

### 步骤 3：启动最新脚本

```bash
# 后台运行，使用 nohup
nohup python3 -u scripts/prepopulate_dictionary_cache.py --yes > /tmp/prepopulate.out 2>&1 &

# 获取进程 ID
echo $!

# 等待 5 秒后检查
sleep 5
ps aux | grep "[p]ython3.*prepopulate_dictionary_cache" && echo "✅ 脚本已启动"
```

### 步骤 4：监控进度

```bash
# 实时查看输出
tail -f /tmp/prepopulate.out

# 或查看详细日志
tail -f /Users/a/dictation/logs/prepopulate_*.log

# 查看数据库进度
python3 -c "
from supabase import create_client
from pathlib import Path
import os

env_local = Path('.env.local')
with open(env_local) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

supabase = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

result = supabase.table('dictionary_cache').select('word', count='exact').execute()
print(f'当前缓存: {result.count} 个')
"
```

---

## ⚠️ 常见问题与解决方案

### 问题 1：字段名错误

**症状**：
```
column dictionary_cache.definition_json does not exist
```

**原因**：数据库已迁移到新字段名 `definitions`

**解决**：
- ✅ 确保使用最新脚本（V27.1.0）
- ✅ 脚本第 263 行使用 `'definitions': definitions`

### 问题 2：多个重复进程

**症状**：
- 多个脚本同时运行
- 大量 `duplicate key` 错误
- CPU 使用率高

**解决**：
```bash
# 停止所有重复进程
pkill -f "prepopulate_dictionary_cache.py"

# 确认只剩一个
ps aux | grep "[p]ython3.*prepopulate" | wc -l
# 应该返回 0 或 1
```

### 问题 3：脚本保存失败

**症状**：
- 日志显示 "保存到缓存失败"
- 数据库缓存数不增加

**检查**：
```bash
# 1. 验证 Supabase 连接
python3 -c "
from supabase import create_client
from pathlib import Path
import os

env_local = Path('.env.local')
with open(env_local) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

supabase = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

# 测试写入
test_data = {
    'word': '__test__',
    'phonetic': '/test/',
    'definitions': {'zh-CN': '测试', 'en': 'test'}
}

try:
    supabase.table('dictionary_cache').insert(test_data).execute()
    print('✅ 数据库写入正常')
    # 清理测试数据
    supabase.table('dictionary_cache').delete().eq('word', '__test__').execute()
except Exception as e:
    print(f'❌ 数据库写入失败: {e}')
"
```

---

## 📋 验证清单

启动前检查：
- [ ] 已清理所有旧进程
- [ ] 数据库字段名确认为 `definitions`
- [ ] 脚本版本为 V27.1.0（第 263 行使用 `definitions`）
- [ ] 环境变量已配置（.env.local 中有 GLM_API_KEY 和 SUPABASE_SERVICE_ROLE_KEY）

启动后验证（5 分钟后）：
- [ ] 进程正在运行
- [ ] 日志文件正在写入
- [ ] 数据库缓存数在增加
- [ ] 无错误日志

---

## 🔧 快速命令参考

```bash
# 一键启动（推荐）
alias start-prepopulate='pkill -f "prepopulate_dictionary_cache.py"; sleep 2; nohup python3 -u scripts/prepopulate_dictionary_cache.py --yes > /tmp/prepopulate.out 2>&1 & sleep 5; tail -20 /tmp/prepopulate.out'

# 使用方法
start-prepopulate

# 查看进度
alias check-progress='python3 -c "from supabase import create_client; from pathlib import Path; import os; env_local = Path(\".env.local\"); [os.environ.update({k.strip(): v.strip()}) for line in open(env_local) if line.strip() and not line.startswith(\"#\") and \"=\" in line for k, v in [line.split(\"=\", 1)]]; supabase = create_client(os.environ[\"NEXT_PUBLIC_SUPABASE_URL\"], os.environ[\"SUPABASE_SERVICE_ROLE_KEY\"]); result = supabase.table(\"dictionary_cache\").select(\"word\", count=\"exact\").execute(); print(f\"当前缓存: {result.count} 个\")"'

# 使用方法
check-progress
```

---

**重要提醒**：
1. ✅ **永远先清理旧进程再启动**
2. ✅ **使用 nohup 后台运行**
3. ✅ **确认字段名是 `definitions`**
4. ✅ **检查日志确保正常工作**
5. ✅ **异常单词会被自动过滤**（V27.1.1）

---

**创建日期**: 2026-03-22
**适用版本**: V27.1.1
**脚本文件**: `scripts/prepopulate_dictionary_cache.py`
**状态**: ✅ **预生成已完成（100%）**
