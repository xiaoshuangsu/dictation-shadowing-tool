# 自动翻译功能使用说明（智谱 GLM）

## 功能介绍

自动翻译脚本可以为数据库中所有素材添加中文翻译，无需手动逐句翻译。

**支持两种模式：**
1. `npm run translate-all` - 翻译所有未翻译的句子
2. `npm run translate-new` - 仅翻译完全没有翻译的素材（增量模式）

**使用智谱 GLM-4-Flash 模型：**
- 快速响应、高性价比
- 新用户每天 100 万 tokens 免费额度
- 足够翻译数万个句子

## 配置步骤

### 1. 获取智谱 API Key

1. 访问 https://open.bigmodel.cn/usercenter/apikeys
2. 注册/登录智谱 AI 账号（支持手机号注册）
3. 点击"创建新的 API Key"
4. 复制 API Key

**新用户福利：**
- 每天赠送 100 万 tokens（GLM-4-Flash）
- 每月赠送 200 万 tokens
- 翻译 1000 个句子 ≈ 5万 tokens
- 免费额度足够翻译 20,000+ 个句子

### 2. 配置环境变量

在项目根目录创建 `.env.local` 文件（不要提交到 Git）：

```bash
# 复制模板文件
cp .env.local.example .env.local

# 编辑文件，添加你的 API key
GLM_API_KEY=your-actual-glm-api-key-here
```

或者直接导出环境变量（临时使用）：

```bash
export GLM_API_KEY=your-actual-glm-api-key-here
npm run translate-all
```

## 使用方法

### 首次翻译（完整模式）

翻译所有素材中未翻译的句子：

```bash
npm run translate-all
```

**输出示例：**
```
🚀 开始自动翻译...

📥 正在从数据库获取素材...
✅ 找到 39 个素材

📊 需要翻译的素材: 39 个
   模式: 翻译所有未翻译的句子

📝 正在翻译: Niagara Falls (2)
   ID: aa8f3d7b-82f5-430a-bd80-d93559710210
   句子数: 50
   需要翻译: 50 个句子
   批次 1/5: 翻译 10 个句子...
   ✅ 批次 1/5 完成
   批次 2/5: 翻译 10 个句子...
   ✅ 批次 2/5 完成
   批次 3/5: 翻译 10 个句子...
   ✅ 批次 3/5 完成
   批次 4/5: 翻译 10 个句子...
   ✅ 批次 4/5 完成
   批次 5/5: 翻译 10 个句子...
   ✅ 批次 5/5 完成
   ✅ 已保存到数据库 (翻译了 50 个句子)

...

==================================================
📊 翻译完成统计:
   处理素材: 39
   成功: 39
   失败: 0
   总翻译句子: 1500
==================================================
```

### 增量翻译模式（推荐用于新素材）

仅翻译完全没有翻译的素材：

```bash
npm run translate-new
```

**适用场景：**
- 添加新素材后，只翻译新素材
- 跳过已有部分翻译的素材
- 更快的处理速度

## 工作流程

### 添加新素材的标准流程

1. **在 Supabase 中添加新素材**
   - 添加 title, audio_path, transcript 等字段
   - transcript 中无需添加 translation 字段

2. **运行翻译脚本**
   ```bash
   npm run translate-new
   ```

3. **验证翻译结果**
   - 访问素材库页面
   - 选择对应素材，进入练习页面
   - 测试翻译功能是否正常显示

## 注意事项

### API 速率限制

- 智谱 API 有速率限制
- 脚本已内置延迟机制，每次 API 调用间隔 1 秒
- 如果素材很多，可能需要几分钟完成

### 翻译质量

- 使用 GLM-4-Flash 模型
- 温度设置为 0.3（偏保守，更准确）
- 建议人工校对专业术语

### 成本说明

- **新用户**: 每天 100 万 tokens + 每月 200 万 tokens
- **续费**: GLM-4-Flash: ¥0.1 / 1K tokens
- **实际成本**: 翻译 1000 个句子 ≈ ¥5
- 可在 https://open.bigmodel.cn/usercenter/balance 查看余额

### 错误处理

如果翻译中断：
- 脚本会自动跳过已翻译的句子
- 可以重新运行，不会重复翻译
- 检查控制台错误信息进行调试

## 故障排查

### 错误：未找到 GLM_API_KEY

**原因：** 环境变量未设置

**解决：**
```bash
export GLM_API_KEY=your-key-here
npm run translate-all
```

### 错误：GLM API 请求失败: 401

**原因：** API key 无效或过期

**解决：**
- 检查 API key 是否正确
- 访问 https://open.bigmodel.cn/usercenter/apikeys 查看余额

### 错误：GLM API 请求失败: 429

**原因：** 超过 API 速率限制

**解决：**
- 检查免费额度是否用完
- 访问 https://open.bigmodel.cn/usercenter/balance 充值

### 错误：保存到数据库失败

**原因：** Supabase 权限问题

**解决：** 检查 API key 是否有 materials 表的更新权限

### 错误：余额不足

**原因：** API 余额不足

**解决：**
- 访问 https://open.bigmodel.cn/usercenter/balance
- 查看余额和使用量
- 充值后继续使用

## 高级配置

### 使用 GLM-4 标准版

编辑 `scripts/translate.js`，修改模型参数：

```javascript
model: 'glm-4',  // 更高质量但稍慢、稍贵
// 或
model: 'glm-4-flash',  // 默认，性价比最高
```

### 自定义批次大小

编辑 `scripts/translate.js`，修改 `batchSize`：

```javascript
const batchSize = 20  // 默认 10，可以增加以提高速度
```

## 技术细节

- **脚本语言**: Node.js
- **API**: 智谱 GLM-4 Chat Completions API
- **API 端点**: https://open.bigmodel.cn/api/paas/v4
- **批处理**: 每次最多翻译 10 个句子
- **错误重试**: 失败时会中断并显示错误
- **幂等性**: 可以安全地重复运行

## 相关链接

- 智谱 AI: https://open.bigmodel.cn/
- API 文档: https://open.bigmodel.cn/dev/api
- 控制台: https://open.bigmodel.cn/usercenter

## 更新日志

- 2025-02-19: 初始版本，使用智谱 GLM-4 API

