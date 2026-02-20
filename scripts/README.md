# 自动翻译功能快速开始

## 一句话说明

运行 `npm run translate-new` 即可自动翻译数据库中所有新增素材。

## 快速配置（3 步）

### 1️⃣ 获取智谱 API Key
1. 访问 https://open.bigmodel.cn/usercenter/apikeys
2. 注册/登录智谱 AI 账号（支持手机号注册）
3. 创建 API Key

**新用户福利：**
- 每天赠送 100 万 tokens（GLM-4-Flash）
- 足够翻译数万个句子

### 2️⃣ 设置环境变量
```bash
# 方式 A：临时设置（推荐测试用）
export GLM_API_KEY=your-key-here
npm run translate-new

# 方式 B：永久设置（推荐生产用）
# 复制模板文件
cp .env.local.example .env.local
# 编辑 .env.local，添加你的 API key
# 然后运行
npm run translate-new
```

### 3️⃣ 运行翻译
```bash
npm run translate-new    # 仅翻译新素材（推荐）
npm run translate-all    # 翻译所有未翻译的句子
```

## 成本参考

- **GLM-4-Flash**: 新用户每天 100 万 tokens 免费额度
- 翻译 1000 个句子 ≈ 5万 tokens
- 免费额度足够翻译 20,000+ 个句子

## 完整文档

详细说明请查看：[docs/TRANSLATE_GUIDE.md](./TRANSLATE_GUIDE.md)
