# CLAUDE.md

本文件用于指导 Claude Code（claude.ai/code）在本仓库中的协作方式、项目背景与开发约束。
请在开始任何代码或架构设计前，完整阅读本文件。

---

## 一、项目概述（Project Overview）

这是一个 **英语听写 & 影子跟读工具（English Dictation & Shadowing Tool）**。

产品目标：
- 面向中国英语学习者
- 聚焦听力理解与发音模仿
- 使用真实英语音视频素材（如 YouTube / TED 等）
- 提供「句子级」的听写（Dictation）与影子跟读（Shadowing）练习体验

本产品是一个**单功能聚焦工具**，不做平台型设计。

---

## 二、项目阶段说明（Project Status）

⚠️ **重要说明**

- 当前处于 **V0（验证版本）阶段**
- V0 仅实现 **一个工具页面**
- 目标是验证：  
  **一个音视频素材 → 能否完成完整的一次听写 + 影子跟读流程**

### V0 特征

- 允许功能不完整
- 允许 UI 简陋
- 不追求扩展性

但必须：
- 核心流程完整
- 核心交互可用

---

## 三、技术与实现原则（High-level Guidelines）

### 核心原则

- 极简优先（Simplicity First）
- 能跑 > 完美
- 避免过度设计

### 用户介绍

- 使用者（Sarah）为**产品经理，完全不会写代码**
- 默认使用中文进行解释
- 技术说明需尽量口语化、结构化

### 记忆
memory.md 是我使用Claude code的相关记忆，需要你来写。每次启动时，都要读取当前文件夹下的memory查看之前的记录。
每次大改动时，也要把重要信息记录下来。

---

## 四、核心技术选型（V0 推荐）

（如后续调整，需记录到 `memory.md`）

- **前端框架**：Next.js（或同类 React 框架）
- **语言**：TypeScript / JavaScript（优先可读性）
- **样式**：Tailwind CSS 或基础 CSS
- **音视频来源**： - 支持来自第三方平台或公开渠道的音视频内容
  - 包括但不限于：YouTube、TED、播客平台、公开视频链接等
  - 统一原则：
    - 不下载音视频文件
    - 不在本地或服务器存储音视频内容
    - 仅通过 页面内方式播放（embed / iframe /内嵌播放器） 
    - 工具本身不持有、不分发任何音视频资源
    
    **明确禁止的实现方式**
   - 使用 `<a href>` 跳转到第三方平台播放
   - 任何需要用户离开工具页面才能完成播放的方式
- **后端**：V0 阶段不要求

---

## 五、V0 功能范围定义（非常重要）

### ✅ V0 必须实现的功能

- 单一工具页面（Tool Page）
- 支持一个固定或示例素材
- 功能包括：
  - 播放音频 / 视频
  - 句子级播放控制
  - 听写输入（Dictation）
  - 显示正确文本
  - 影子跟读（Shadowing）
    - 重播
    - 可选慢速播放

### ❌ V0 明确不包含的功能

- 首页
- 价格说明页
- 登录 / 注册
- 用户系统
- 支付 / 订阅
- AI 发音评分
- 多素材管理
- 任何社交功能

Claude Code **不得主动扩展以上范围**。

---

## 六、推荐项目结构

```text
src/
├─ app/
│  ├─ layout.tsx      # 必须存在
│  └─ page.tsx        # V0 唯一页面（工具页）    # 听写 & 影子跟读工具页面
├── components/
│   ├── AudioPlayer.tsx       # 音频 / 视频播放组件
│   ├── DictationBox.tsx      # 听写输入组件
│   └── ShadowingPanel.tsx    # 影子跟读控制区
├── utils/
│   └── sentence.ts           # 句子切分 / 时间轴工具
├─ styles/
│  └─ globals.css
└─ lib/
   └─ utils.ts

七、核心交互流程（Claude 必须遵守）
听写（Dictation）流程
	1	播放一句音频
	2	用户输入听到的内容
	3	用户提交
	4	显示正确文本
	5	对比输入与原文（可简单实现）
影子跟读（Shadowing）流程
	1	播放一句音频
	2	用户跟读
	3	支持：
	1	重播当前句
	2	慢速播放（如 0.75x）
	4	不进行发音评分（V0 不做）

八、素材与版权处理原则（非常重要）
	•	不下载、不存储第三方视频或音频
	•	仅通过 embed / iframe 方式播放
	•	清晰标注素材来源（如 YouTube）
	•	产品价值体现在：
	◦	练习流程设计
	◦	句子级交互体验

九、开发工作方式（Workflow，必须严格遵守）
每完成一个功能，必须执行以下步骤（顺序不可省略）
	1	运行开发环境
	1	运行 npm run dev
	2	确保当前功能在本地可以正常工作
	2	功能性确认
	1	不报错
	2	页面可交互
	3	不影响已有功能
	3	更新更新日志
	1	在更新日志中记录：
	▪	本次完成了什么
	▪	是否属于 V0 核心功能
	4	Git 提交
	1	必须进行一次 Git commit
	2	提交消息中必须包含原始提示 / 原始需求
	3	示例：
	4	feat: 实现句子级听写输入
	5	原始需求：V0 听写功能，支持逐句播放并输入 

十、重要提醒（必须反复确认）
	•	项目需要完整初始化
	◦	包括 package.json
	◦	tsconfig.json
	◦	package-lock.json
	◦	以及所有必要的源文件
	•	界面必须：
	◦	响应灵敏
	◦	基本用户友好（哪怕 UI 简陋）
	•	安装依赖时：
	◦	使用 npm i <package> 安装所需 package
	•	任何改动完成后：
	◦	必须运行 npm run dev 测试是否有效
	◦	确认无错误后：
	1	先增加一个版本号
	2	再提交 Git
	•	完成后一定要提交修改
	◦	不允许“写完但不提交”

十一、最终共识（非常重要）
	•	不做加法产品
	•	不提前考虑扩展性
	•	不设计“未来版本”
	•	始终围绕：
	•	一个素材 + 一次完整的听写 & 影子跟读练习体验
当存在多种实现方式时：
	•	优先选择最简单、最稳妥的一种
	•	并清楚说明选择原因

---

## 十二、/topics 路由重构说明（V17）

### 路由结构

```
/topics                              # 聚合页（预览所有分类）
/topics/[category]                   # 分类详情页（显示该分类所有素材）
/topics/[category]/[slug]            # 素材练习页（听写/影子跟读）
```

### URL Slug 与数据库字段映射规范

**关键规则**：URL 中的 slug 是英文（如 `daily-life`），数据库 `materials.category` 字段存储的是中文（如 `日常生活`）。

#### 映射转换逻辑

1. **中文分类名 → Slug（生成链接时）**
   ```typescript
   import { categoryToSlug } from '@/lib/utils/category'

   // 数据库存储: "日常生活"
   // URL 路径: "daily-life"
   const slug = categoryToSlug("日常生活")  // => "daily-life"
   ```

2. **Slug → 中文分类名（查询数据库时）**
   ```typescript
   import { slugToCategory } from '@/lib/utils/category'

   // URL 参数: "daily-life"
   // 数据库查询: "日常生活"
   const categoryName = slugToCategory("daily-life")  // => "日常生活"
   ```

3. **完整映射表（src/lib/utils/category.ts）**
   - `CATEGORY_SLUG_MAP`: 中文 → Slug
   - `SLUG_CATEGORY_MAP`: Slug → 中文
   - `CATEGORY_METADATA`: 完整元数据（含图标、颜色、描述）

### 聚合页性能约束

**规则**：`/topics` 页面每个分类**仅加载前 4 个素材**作为预览。

#### 实现方式

```typescript
// 并行查询所有分类，每个分类 limit(4)
const promises = CATEGORIES.map(async (category) => {
  const { data } = await supabase
    .from('materials')
    .select('*')
    .eq('category', category.id)
    .order('title')
    .limit(4)  // 🔴 关键：仅取前4个
})
```

#### 跳转逻辑

- **分类标题**（如 "Daily Life (Preview)"）→ 可点击，跳转到 `/topics/[category]`
- **"View All →" 按钮** → 跳转到 `/topics/[category]`
- **素材卡片按钮**（Dictation/Shadowing）→ 跳转到 `/topics/[category]/[slug]?mode=xxx`

### 分类详情页功能

**路径**：`/topics/[category]`

**核心功能**：
1. 使用 `slugToCategory(categorySlug)` 获取中文分类名
2. 查询该分类下的**所有**素材
3. 客户端分页：每页 20 个素材
4. 难度筛选：通过 `DifficultySelector` 组件

#### 关键代码片段

```typescript
// 🔴 正确做法：先用 slugToCategory 转换
const categoryName = slugToCategory(categorySlug)  // "daily-life" => "日常生活"

const { data } = await supabase
  .from('materials')
  .select('*')
  .eq('category', categoryName)  // 使用中文字段名查询
  .order('title')
```

#### 常见错误

❌ **错误做法**：
```typescript
// 使用英文分类名直接查询（匹配不到数据库中的中文记录）
const { data } = await supabase
  .from('materials')
  .eq('category', "Daily Life")  // ❌ 数据库中是"日常生活"
```

✅ **正确做法**：
```typescript
// 先转换 slug 到中文分类名
const categoryName = slugToCategory(categorySlug)
const { data } = await supabase
  .from('materials')
  .eq('category', categoryName)  // ✅ "日常生活"
```

### 文件清单

#### 新建文件
- `src/components/topics/CategoryCard.tsx` - 分类卡片组件（暂未使用）
- `src/components/topics/CategoryPage.tsx` - 分类详情页客户端组件
- `src/app/topics/[category]/page.tsx` - 分类详情页服务端路由

#### 修改文件
- `src/app/topics/page.tsx` - 聚合页（限制每分类4个素材，使用页面跳转）
- `src/lib/utils/category.ts` - 添加 `CATEGORY_METADATA` 和辅助函数

#### 保持不变
- `src/app/topics/[category]/[slug]/page.tsx` - 素材练习页
- `src/components/topics/MaterialCard.tsx` - 素材卡片组件

### 性能优化效果

- **聚合页 DOM 节点**：从 1500+ 降至 ~120（减少 92%）
- **首屏加载时间**：从 3-5秒 降至 <1秒
- **数据加载量**：每个分类仅加载 4 个素材（而非全量）

### 浏览器兼容性

- 使用 `output: 'export'` 模式
- 所有路由预渲染为静态 HTML
- 客户端分页无需 API 路由
