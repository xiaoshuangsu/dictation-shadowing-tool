# 词典预生成脚本指南

**版本**：V3.0
**更新日期**：2026-04-06
**适用场景**：Oxford 3000 词汇预生成、19 国语言翻译、Edge TTS 音频生成

---

## 📋 脚本概览

| 脚本名称 | 版本 | 路径 | 功能描述 |
|---------|------|------|----------|
| **词典预生成** | V3.0 | `scripts/prepopulate_dictionary_cache_v3.py` | Oxford 3000 + 19国翻译 + Edge TTS + R2 存储 |
| **IELTS 词汇预生成** | V3.0 | `scripts/prepopulate_ielts_v3.py` | IELTS 词汇预生成 |

---

## 🚀 快速开始

### 测试模式（推荐先运行）

```bash
# 测试 3 个单词
python3 scripts/prepopulate_dictionary_cache_v3.py --test --oxford --limit 3

# 测试 20 个单词
python3 scripts/prepopulate_dictionary_cache_v3.py --test --oxford --limit 20
```

### 完整运行

```bash
# Oxford 3000 全量预生成
python3 scripts/prepopulate_dictionary_cache_v3.py --oxford

# IELTS 词汇预生成
python3 scripts/prepopulate_ielts_v3.py
```

**预期性能**：
- 每个单词约 15-20 秒（翻译 2 次 + 音频生成 + R2 上传）
- 20 个单词约 6-8 分钟

---

## 🏗️ V3.0 模块化架构

```
【模块 A】基础框架与配置
├─ dotenv 环境变量加载
├─ Supabase 客户端初始化
├─ R2 S3 客户端配置
└─ 19 国语言定义

【模块 B】OxfordScraper 抓取模块
├─ 从 engnovate.com 抓取 Oxford 3000
├─ 支持空行容错
└─ 已修复 Accept-Encoding 问题

【模块 C】TranslationEngine 翻译引擎
├─ 19 国语言批量翻译
├─ 指数退避重试（2s → 4s → 8s）
└─ 语种分组（Group 1: 11种 + Group 2: 8种）

【模块 D】Edge TTS 音频生成
├─ 异步音频生成
└─ 支持多语言发音

【模块 E】R2 上传
├─ S3 兼容接口上传
└─ 音频文件存储

【模块 F】数据保存
├─ JSONB translations 字段
├─ audio_r2_url 字段
└─ 向后兼容 definitions 字段
```

---

## 🌍 翻译语言列表（19 种）

**原有 (3种)**：zh, zh_hant, vi

**Group A (8种)**：ar, de, es, ja, ms, ru, tr, el

**Group B (8种)**：id, ko, pt, th, uk, bn, mn, hi

---

## 🔧 TranslationEngine 核心特性

### 批量翻译策略

```
Group 1: 原有 (3种) + Group A (8种) = 11 种
   ↓
冷却 1 秒（缓解 Rate Limit）
   ↓
Group 2: Group B (8种) = 8 种
```

### 指数退避重试机制

- **重试次数**：MAX_RETRIES = 3
- **退避时间**：2s → 4s → 8s（BACKOFF_MULTIPLIER = 2.0）
- **重试条件**：
  - API 请求失败
  - 翻译结果包含中文污染
  - 翻译结果包含指令关键词

### 成本优化

- **紧凑 Prompt**：语言缩写（简中, 繁中, 越南, 阿拉伯...）
- **批量翻译**：一次性请求所有语言
- **冷却机制**：分组间冷却 1 秒

---

## 📊 数据结构

### Dictionary Cache 记录格式

```json
{
  "word": "act",
  "phonetic": "/ækt/",
  "translations": {
    "en": "to do something for a particular purpose...",
    "zh": "执行",
    "zh_hant": "執行",
    "vi": "thực hiện",
    "ar": "فعل",
    "de": "tun",
    "es": "actuar",
    "ja": "行動する",
    "ms": "bertindak",
    "ru": "действовать",
    "tr": "hareket etmek",
    "el": "δράω",
    "id": "bertindak",
    "ko": "행동하다",
    "pt": "agir",
    "th": "กระทำ",
    "uk": "діяти",
    "bn": "কাজ করা",
    "mn": "үйлдэл хийх",
    "hi": "कार्य करना"
  },
  "example": "We need to act quickly.",
  "audio_r2_url": "https://media.shadowhub.app/audio/dictionary/act.mp3",
  "dataSource": "v3"
}
```

---

## ✅ 验证数据完整性

### 检查 translations 字段

```python
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# 查询单词
response = supabase.table('dictionary_cache').select('*').eq('word', 'act').execute()
translations = response.data[0]['translations']

# 检查语言数量
print(f"翻译语言数量: {len(translations)} 种")

# 检查 19 种语言是否都存在
expected = ['en', 'zh', 'zh_hant', 'vi', 'ar', 'de', 'es', 'ja', 'ms', 'ru', 'tr', 'el', 'id', 'ko', 'pt', 'th', 'uk', 'bn', 'mn', 'hi']
missing = [lang for lang in expected if lang not in translations]

if missing:
    print(f"❌ 缺失语言: {missing}")
else:
    print("✅ 所有 19 种语言翻译完整！")
```

### 检查音频 URL

```python
# 查询没有音频的单词
response = supabase.table('dictionary_cache').select('word').is_('audio_r2_url', 'null').execute()

print(f"缺少音频的单词数量: {len(response.data)}")
for item in response.data[:10]:
    print(f"  - {item['word']}")
```

---

## 🔍 数据库迁移状态

- ✅ **已完成**（7142 条记录）
- ✅ **translations 字段**（JSONB）
- ✅ **audio_r2_url 字段**
- ✅ **向后兼容 definitions 字段**

---

## ⚠️ 常见问题

### 1. 翻译失败

**问题**：部分翻译标记为 `[TODO_RETRY]`

**解决方案**：
- 运行重试脚本：
  ```bash
  python3 scripts/retry_failed_translations.py
  ```

### 2. 音频生成失败

**问题**：Edge TTS 无法生成音频

**解决方案**：
- 检查网络连接
- 检查 Edge TTS 服务是否可用
- 查看日志文件：`scripts/logs_archive/`

### 3. R2 上传失败

**问题**：音频文件无法上传到 R2

**解决方案**：
- 检查 R2 凭证配置
- 检查 bucket 权限
- 查看日志文件

---

## 📖 相关文档

- **词典缓存架构**：`docs/dictionary_cache_guide.md`
- **翻译修复脚本**：`scripts/retry_failed_translations.py`
- **主指南**：`claude-code-guide.md`

---

## 🔄 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| V3.0 | 2026-04-01 | 模块化架构，19 国语言，R2 音频存储 |
| V2.0 | 2026-03-26 | 支持 19 种语言翻译 |
| V1.0 | 2026-03-22 | 初始版本 |
