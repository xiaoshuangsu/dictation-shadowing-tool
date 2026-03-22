# 词典缓存优化架构指南

## 📊 架构概览

```
用户点击单词
    ↓
查询 dictionary_cache 表
    ↓
┌───────────┬──────────┐
│  命中缓存  │ 未命中缓存  │
└───────────┴──────────┘
       ↓           ↓
  直接返回    调用 GLM API
       ↓           ↓
       └────→─ 存入缓存
```

---

## 🗄️ 数据库表结构

### `dictionary_cache` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `word` | TEXT (PK) | 单词（小写，主键） |
| `phonetic` | TEXT | 音标（如 `/həˈləʊ/`） |
| `definitions` | JSONB | 多语言释义 `{"zh-CN": "...", "zh-Hant": "...", "vi": "...", "en": "..."}` |
| `example` | TEXT | 英文例句 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |
| `hit_count` | INTEGER | 缓存命中次数 |

---

## 🔧 API 逻辑

### `/api/word-definition` 工作流程：

1. **查询缓存**
   ```sql
   SELECT * FROM dictionary_cache WHERE word = 'hello'
   ```

2. **命中缓存** → 返回结果 + `hit_count++`

3. **未命中** → 调用 GLM API → 存入缓存 → 返回结果

---

## 📦 部署步骤

### 第一步：创建数据库表

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 执行 `supabase/migrations/create_dictionary_cache_table.sql`

### 第二步：预生成词汇缓存（可选）

运行预生成脚本，提前缓存所有素材中的单词：

```bash
# 确保 .env.local 中已设置 GLM_API_KEY
python scripts/prepopulate_dictionary_cache.py
```

**脚本功能**：
- 从所有素材中提取单词
- 按频率排序
- 批量调用 GLM API 获取释义
- 存入 `dictionary_cache` 表

### 第三步：启动应用

```bash
npm run dev
# 或
npm run build && npm start
```

---

## 📊 成本优化效果

### 优化前（无缓存）：
- 每次点词都调用 GLM API
- 100 个用户 × 每人查 10 词 = 1000 次 API 调用

### 优化后（有缓存）：
- 首次查询调用 API，后续直接读缓存
- 假设缓存命中率 80%：
  - API 调用：1000 × 20% = 200 次
  - **节省 80% 成本**

---

## 🌍 多语言静态化

### 已支持的语言：

当前素材的 `translation` 字段已经是 JSONB 格式：
```json
{
  "zh": "中文翻译",
  "vi": "越南语翻译"
}
```

### 预生成脚本位置：

- **越南语**：`scripts/translate_to_vietnamese.py`
- **繁体中文**：`scripts/convert_to_traditional_zh.py`
- **多语言更新**：`scripts/retranslate_with_glm_v21.py`

### 验证方法：

```sql
-- 查询素材的多语言翻译
SELECT
  title,
  translation->>'zh' as zh_translation,
  translation->>'vi' as vi_translation
FROM materials
WHERE translation IS NOT NULL
LIMIT 5;
```

---

## 📈 监控与统计

### 查询缓存统计：

```sql
SELECT * FROM dictionary_stats;
```

输出示例：
```
total_words | hit_words | total_hits | avg_hits | last_updated
    1500        |   1200    |   25000    |   20.8  | 2026-03-21
```

### 查询热门词汇：

```sql
SELECT word, hit_count, definitions->>'zh-CN' as definition
FROM dictionary_cache
ORDER BY hit_count DESC
LIMIT 20;
```

---

## 🧪 测试方法

### 1. 测试缓存命中：

```bash
# 首次查询（未命中，调用 API）
curl -X POST http://localhost:3000/api/word-definition \
  -H "Content-Type: application/json" \
  -d '{"word": "hello"}'

# 再次查询（命中缓存，不调用 API）
curl -X POST http://localhost:3000/api/word-definition \
  -H "Content-Type: application/json" \
  -d '{"word": "hello"}'
```

### 2. 测试前端功能：

1. 访问练习页面
2. 点击 Transcript 中的单词
3. 查看控制台日志：
   - `[API] ✓ Cache hit for: hello` （缓存命中）
   - `[API] ✗ Cache miss for: world - calling GLM API...` （未命中）

---

## ⚠️ 注意事项

### 1. API 配额管理

即使有缓存，首次查询仍需调用 API。建议：

- **预生成常用词汇**：运行预生成脚本
- **监控 API 使用量**：定期查看 GLM 控制台
- **设置预算告警**：避免超额费用

### 2. 缓存失效策略

当前方案：**永久缓存**

未来可优化：
- 添加 `updated_at` 字段定期刷新
- 支持手动刷新单个单词
- 定期清理低频词汇

### 3. 多语言翻译

确保所有素材的翻译字段都已预生成：

```sql
-- 检查缺少翻译的素材
SELECT title, category
FROM materials
WHERE translation IS NULL
  OR translation = '{}'::jsonb
  OR NOT (translation ? 'zh');
```

---

## 🔄 后续优化建议

1. **热门词汇预加载**
   - 启动时自动加载 Top 100 常用词到 Redis

2. **批量查询优化**
   - 支持一次查询多个单词（减少请求次数）

3. **离线模式支持**
   - PWA 缓存常用词汇到本地存储

4. **智能推荐**
   - 根据用户查询历史推荐生词

---

**版本**：V1.0
**更新日期**：2026-03-21
**状态**：生产就绪
