# Dictation & Shadowing Practice Tool
 
英语听写和影子跟读练习工具，帮助提高英语听力和口语水平。

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 打开浏览器访问
open http://localhost:3000
```

## 📁 项目结构

```
├── src/
│   ├── app/
│   │   ├── page.tsx              # 练习主页
│   │   ├── topics/               # 素材列表
│   │   ├── profile/              # 个人中心
│   │   └── tools/                # 独立工具
│   │       └── timestamp-marker/ # 时间戳标记工具 ⭐️
│   ├── components/               # React 组件
│   ├── lib/                      # 工具函数
│   └── contexts/                 # Context 提供者
├── docs/                         # 文档
│   └── TIMESTAMP_MARKER.md       # 工具使用文档 ⭐️
└── scripts/                      # 脚本工具
```

## 🛠️ 独立工具

### Timestamp Marker (时间戳标记工具)

**用途**: 手动调整素材的分句和时间戳

**访问地址**:
- 本地: http://localhost:3000/tools/timestamp-marker
- 生产: https://xiaoshuangsu.github.io/dictation-shadowing-tool/tools/timestamp-marker

**文档**: [docs/TIMESTAMP_MARKER.md](docs/TIMESTAMP_MARKER.md)

**特点**:
- ✅ 独立页面，支持音频播放和实时编辑
- ✅ 自动生成时间戳，支持手动微调
- ✅ 集成翻译 API
- ✅ 一键保存到数据库

---

## 📦 可用脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
```

## 🎯 主要功能

### 1. 素材练习
- **听写模式**: 完整听写和逐词听写
- **影子跟读**: 实时语音评估和反馈
- **多种难度**: A1-C2 六级分类

### 2. 内容分类
- 日常生活 (Daily Life)
- 历史演讲 (Historical Speeches)
- 文化历史 (Culture & History)
- 艺术文化 (Arts & Culture)
- YouTube Vlog
- 故事 (Stories)
- 人物访谈 (Interviews)
- BBC Learning English
- VOA Learning English

### 3. 语音识别
- 智能纠错：基于 Metaphone 算法的模糊匹配
- 口语优先：宽松的评估标准，鼓励开口
- 连读检测：自动识别连读组合
- 实时反馈：即时显示发音准确度

## 🗄️ 数据库

**后端**: Supabase
- PostgreSQL 数据库
- 文件存储 (Storage)
- 用户认证 (Auth)

## 📱 部署

项目部署在 GitHub Pages：
**https://xiaoshuangsu.github.io/dictation-shadowing-tool/**

## 📄 许可证

MIT License
