# 翻译 UI 重构文档

> 更新日期：2026-03-20
> 版本：v22.0.0

## 📋 修改概览

本次重构优化了练习页面的翻译交互体验，将原本分散的翻译控制合并为一个统一的设置面板，并实现了中栏与右侧 Transcript 的联动。

### 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/components/TranslationLanguageSelector.tsx` | 核心组件重构，合并语言选择器与 Translate 按钮 |
| `src/components/DictationBox.tsx` | 添加语言前缀显示，更新翻译逻辑 |
| `src/components/WordMode.tsx` | 添加语言前缀显示，更新翻译逻辑 |
| `src/app/topics/[category]/[slug]/PracticePage.tsx` | 恢复右侧 Show 按钮，实现联动 |

---

## 🎯 核心功能

### 1. 组合翻译面板

**设计理念**：参考主流翻译插件（如 Google Translate、DeepL）的 UI 交互

**UI 结构**：
```
┌─────────────────────────┐
│  🌐 (语言图标按钮)       │  ← 点击打开面板
└─────────────────────────┘
         ↓ 点击后
┌─────────────────────────┐
│  语言选择框 ▾            │
├─────────────────────────┤
│   [Translate]           │  ← 蓝色按钮
└─────────────────────────┘
```

**视觉细节**：
- 触发按钮：仅显示语言图标（`w-3.5 h-3.5`），无文字
- 面板尺寸：`w-56` (224px)，紧凑设计
- 面板样式：白色背景、灰色边框、圆角阴影

---

## 🔄 核心交互逻辑

### 二阶段操作流程

```
用户操作流程：
1. 点击语言图标 → 打开设置面板
2. 选择语言（中文/越南语/隐藏）
   └─ 此时界面不变化，仅记录选择
3. 点击 Translate 按钮
   └─ 应用更改，更新翻译内容
   └─ 保存到 localStorage
   └─ 面板自动关闭
```

### 状态管理

**localStorage 存储**：
- `translation-language-preference`: 存储选择的语言（`'zh'` | `'vi'` | `'hide'`）
- `translation-show-preference`: 存储显示状态（`'true'` | `'false'`）

**状态初始化**：
```typescript
const translationLanguage = getStoredLanguage()  // 默认 'zh'
const showTranslation = getStoredShowTranslation()  // 默认 false
```

---

## 🔗 联动逻辑

### 中栏（练习区域）

**组件**：`DictationBox` / `WordMode`

**交互**：
1. 点击语言图标 → 打开面板
2. 选择语言 + 点击 Translate
3. 显示翻译，格式：`中文 (简体): [翻译文本]`

**代码示例**：
```typescript
// 翻译文本格式
<p className="text-sm text-gray-600 italic">
  <span className="font-medium text-gray-700">{languageLabel}:</span> {currentTranslation}
</p>
```

### 右侧（Transcript）

**组件**：PracticePage 右栏

**交互**：
1. 在中栏选择翻译语言并点击 Translate
2. 点击右侧 Show 按钮
3. 同时显示原文稿和对应语言的翻译

**关键代码**：
```typescript
// Show/Hide 按钮
<button onClick={() => setShowTranscript(!showTranscript)}>
  {showTranscript ? 'Hide' : 'Show'}
</button>

// 翻译显示（联动中栏语言选择）
{showTranscript && sentence.translation && (
  <p className="text-sm text-gray-700 italic mt-1">
    {typeof sentence.translation === 'string'
      ? sentence.translation
      : (sentence.translation?.[translationLanguage] || '')}
  </p>
)}
```

---

## 📊 数据流

```
TranslationLanguageSelector (组件)
    ↓ onLanguageChange(language, show)
PracticePage (状态管理)
    ├── translationLanguage → DictationBox / WordMode
    └── translationLanguage → Transcript 右侧
    ↓
读取数据库 translation 字段 (JSONB 格式)
    ├── translation.zh: "中文翻译"
    └── translation.vi: "Vietnamese translation"
    ↓
显示翻译文本
```

---

## 🗄️ 数据库字段

**翻译数据结构**（JSONB 格式）：
```json
{
  "translation": {
    "zh": "这是中文翻译",
    "vi": "This is Vietnamese translation"
  }
}
```

**向后兼容**：
- 支持旧的 `string` 格式：`translation: "中文翻译"`
- 支持新的 `JSONB` 格式：`translation: { "zh": "...", "vi": "..." }`

---

## 🎨 样式规范

### 语言图标按钮
```css
inline-flex items-center justify-center p-1.5
bg-white hover:bg-gray-50
border border-gray-300 rounded-lg shadow-sm
icon: w-3.5 h-3.5
```

### 悬浮面板
```css
absolute right-0 mt-2 w-56
bg-white rounded-lg shadow-xl
border border-gray-200 p-4 z-50
```

### Translate 按钮
```css
w-full py-2.5
bg-blue-500 hover:bg-blue-600
text-white text-sm font-medium rounded-lg
```

### 翻译文本显示
```css
text-sm text-gray-600 italic
语言标签：font-medium text-gray-700
```

---

## ✅ 验收清单

- [x] 语言图标仅显示图标，无文字
- [x] 点击图标打开设置面板
- [x] 面板包含语言选择框和 Translate 按钮
- [x] 选择语言后不立即生效
- [x] 点击 Translate 后应用更改
- [x] 面板点击外部自动关闭
- [x] 翻译前缀显示（如"中文 (简体):"）
- [x] localStorage 持久化
- [x] 中栏与右侧 Transcript 联动
- [x] 支持 translation_zh 和 translation_vi 字段

---

## 🔧 开发者备注

**关键类型定义**：
```typescript
export type TranslationLanguage = 'zh' | 'vi' | 'hide'

interface TranslationLanguageSelectorProps {
  onLanguageChange?: (language: TranslationLanguage, showTranslation: boolean) => void
}
```

**工具函数**：
```typescript
// 获取存储的语言偏好
getStoredLanguage(): TranslationLanguage

// 获取存储的显示状态
getStoredShowTranslation(): boolean

// 保存语言偏好
setStoredLanguage(language: TranslationLanguage, show: boolean): void
```

---

## 📸 用户操作示例

**场景 1：显示中文翻译**
1. 点击中栏右上角语言图标
2. 选择"中文 (简体)"
3. 点击 Translate 按钮
4. 中栏显示：`中文 (简体): 这是翻译文本`
5. 点击右侧 Show 按钮
6. 右侧显示原文稿 + 中文翻译

**场景 2：切换到越南语**
1. 点击语言图标
2. 选择"Tiếng Việt"
3. 点击 Translate 按钮
4. 中栏显示：`Tiếng Việt: Vietnamese translation`
5. 右侧翻译自动更新为越南语

**场景 3：隐藏翻译**
1. 点击语言图标
2. 选择"隐藏 (Hide)"
3. 点击 Translate 按钮
4. 中栏翻译隐藏
5. 右侧仅显示原文稿（不显示翻译）

---

## 🚀 未来优化方向

- [ ] 支持更多语言（如日语、韩语）
- [ ] 翻译语音朗读功能
- [ ] 收藏常用句翻译
- [ ] 翻译历史记录
