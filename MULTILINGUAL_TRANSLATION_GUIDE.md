# 多语言翻译功能升级总结

## 已完成的工作

### 1. 数据库迁移 ✅
**文件**: `supabase/migrations/add_multilingual_translation.sql`

- 将 `translation` 字段从 `TEXT` 升级为 `JSONB`
- 旧数据自动迁移：`"原来的文本"` → `{"zh": "原来的文本"}`
- 创建 GIN 索以支持高效的 JSONB 查询

### 2. TypeScript 类型定义 ✅
**文件**: `src/types/index.ts`

定义了：
- `Translation` 接口：支持多语言的键值对格式（如 `{"zh": "中文", "en": "English"}`）
- `Sentence` 接口：`translation` 字段改为 `Translation` 类型
- 辅助函数：`getTranslation()` 和 `hasTranslation()`

### 3. 前端组件更新 ✅
已更新 6 个组件文件，全部向后兼容旧数据：

| 文件 | 状态 |
|------|------|
| `src/components/DictationBox.tsx` | ✅ |
| `src/components/ShadowingPanel.tsx` | ✅ |
| `src/components/WordMode.tsx` | ✅ |
| `src/app/topics/[category]/[slug]/PracticePage.tsx` | ✅ |
| `src/app/practice/page.tsx` | ✅ |
| `src/app/tools/timestamp-marker/page.tsx` | ✅ |

**向后兼容逻辑**：
```typescript
// 支持旧的 string 格式和新的 Translation JSONB 格式
{typeof sentence.translation === 'string'
  ? sentence.translation
  : (sentence.translation?.['zh'] || '')}
```

---

## 下一步操作

### 第 1 步：应用数据库迁移

在 Supabase Dashboard 中运行迁移脚本：

```bash
# 方法 1：使用 Supabase CLI（推荐）
npx supabase db push

# 方法 2：在 Supabase Dashboard 中手动执行
# 1. 登录 Supabase Dashboard
# 2. 选择项目
# 3. SQL Editor -> New Query
# 4. 复制 add_multilingual_translation.sql 内容
# 5. 点击 Run
```

### 第 2 步：验证数据迁移

登录 Supabase Dashboard，查看 `materials` 表的 `translation` 字段：

**验证清单**：
- [ ] 字段类型已改为 `JSONB`
- [ ] 旧数据已转换为 `{"zh": "原来的文本"}` 格式
- [ ] 新增数据的 `translation` 字段默认为 `{}`

**验证 SQL 查询**：
```sql
-- 查看数据示例
SELECT title, translation FROM public.materials LIMIT 5;

-- 统计有翻译的记录数
SELECT COUNT(*) FROM public.materials WHERE translation ? 'zh';
```

---

## 使用示例

### 添加多语言翻译

**Python 脚本示例**：
```python
import supabase

# 更新为多语言翻译
supabase.table('materials').update({
    'translation': {
        'zh': '天空是蓝色的',
        'en': 'The sky is blue',
        'es': 'El cielo es azul',
        'fr': 'Le ciel est bleu'
    }
}).eq('id', material_id).execute()
```

### 前端使用

**TypeScript**：
```typescript
import { getTranslation } from '@/types'

// 获取中文翻译（默认）
const zhTranslation = getTranslation(sentence.translation)

// 获取英文翻译
const enTranslation = getTranslation(sentence.translation, 'en')

// 检查是否有某种语言的翻译
import { hasTranslation } from '@/types'
const hasEnglish = hasTranslation(sentence.translation, 'en')
```

---

## 支持的语言代码（ISO 639-1）

| 代码 | 语言 |
|------|------|
| `zh` | 中文（简体）|
| `en` | 英语 |
| `es` | 西班牙语 |
| `fr` | 法语 |
| `de` | 德语 |
| `ja` | 日语 |
| `ko` | 韩语 |
| `ru` | 俄语 |
| `ar` | 阿拉伯语 |
| `pt` | 葡萄牙语 |

---

## 常见问题

### Q1: 迁移会影响现有数据吗？
**A**: 不会。旧数据会自动转换为 `{"zh": "原来的文本"}` 格式，前端代码完全向后兼容。

### Q2: 如何添加新的语言翻译？
**A**: 直接在 `translation` JSONB 对象中添加新的键值对即可：
```python
'translation': {
    'zh': '中文',
    'en': 'English',
    'ja': '日本語'  # 新增日语
}
```

### Q3: 前端如何处理缺失的翻译？
**A**: 使用 `getTranslation()` 函数，如果翻译不存在会返回 `undefined`：
```typescript
const translation = getTranslation(sentence.translation, 'ja') || '暂无翻译'
```

---

## 构建验证

构建测试已通过：
```
✓ Compiled successfully
✓ Generating static pages (231/231)
```

所有组件的类型定义正确，向后兼容逻辑正常工作。
