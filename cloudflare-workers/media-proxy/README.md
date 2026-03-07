# Cloudflare Worker 部署指南

## 📋 部署步骤

### 步骤 1: 登录账号 A (Suxiaoshuang2020@gmail.com)

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 确保使用账号 A 登录

---

### 步骤 2: 创建 Worker

1. **进入 Workers & Pages**
   - 左侧菜单 → **Workers & Pages**

2. **创建新 Worker**
   - 点击 **"Create application"**
   - 选择 **"Create Worker"**
   - 点击 **"Deploy"**

3. **编辑 Worker 代码**
   - 点击 **"Edit code"**
   - 删除默认代码
   - 复制 `worker.js` 的全部内容粘贴进去
   - 点击右上角 **"Save and deploy"**

4. **记录 Worker 名称**
   - 例如：`media-proxy-worker`
   - 记下完整地址：`https://media-proxy-worker.your-subdomain.workers.dev`

---

### 步骤 3: 添加自定义域名（重要！）

**⚠️ 这是关键步骤，让 Worker 可以响应 media.shadowhub.app**

1. **在 Worker 设置中**
   - 进入你的 Worker → **Settings** → **Triggers**
   - 找到 **"Custom Domains"** 部分
   - 点击 **"Add Custom Domain"**

2. **输入域名**
   - 域名：`media.shadowhub.app`
   - 点击 **"Add Custom Domain"**

3. **系统会自动检测 DNS**
   - Cloudflare 会检查 DNS 记录是否正确
   - 如果提示需要添加 DNS 记录，继续下一步

---

### 步骤 4: 验证 DNS 配置

**当前状态**：
- 账号 B 已添加 DNS 记录：`media.shadowhub.app` → 100::（橙色云朵）

**验证方法**：
1. 在命令行运行：
```bash
dig media.shadowhub.app
```

2. 应该看到类似输出：
```
media.shadowhub.app.  IN  A  172.66.0.2
media.shadowhub.app.  IN  A  172.66.0.3
```

---

### 步骤 5: 测试代理

1. **测试 HTML 文件访问**
```bash
curl -I https://media.shadowhub.app/audio/test.mp3
```

2. **应该看到响应头包含**：
```
access-control-allow-origin: *
cache-control: public, max-age=2592000
```

3. **在浏览器中测试**
   - 访问：`https://media.shadowhub.app/audio/任何音频文件.mp3`
   - 应该能直接加载音频

---

## 🔧 故障排查

### 问题 1: Worker 返回 1014 错误

**原因**：跨账户 R2 绑定限制

**解决**：
- 确保在 **账号 A** 下创建 Worker
- 确保自定义域名添加在 **账号 A 的 Worker** 中
- 不需要在账号 B 的 Cloudflare 设置任何内容

---

### 问题 2: DNS 解析失败

**解决**：
1. 检查 DNS 记录是否正确
2. 确保 DNS 已传播（可能需要 5-10 分钟）
3. 使用 Cloudflare DNS 查询工具验证

---

### 问题 3: CORS 错误

**解决**：
1. 检查 Worker 脚本中的 CORS 配置
2. 确保 `Access-Control-Allow-Origin: *` 存在
3. 清除浏览器缓存重试

---

## 📝 部署检查清单

- [ ] 步骤 1: 使用账号 A 登录 Cloudflare
- [ ] 步骤 2: 创建 Worker 并粘贴代码
- [ ] 步骤 3: 在 Worker 中添加自定义域名 `media.shadowhub.app`
- [ ] 步骤 4: 验证 DNS 解析正确
- [ ] 步骤 5: 测试代理功能正常
- [ ] 步骤 6: 在手机浏览器测试媒体加载

---

## 🚀 下一步

部署完成后，告诉我，我会：
1. 验证 Worker 是否正常工作
2. 更新数据库中的媒体链接
3. 更新前端配置
