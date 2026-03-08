# 🔴 Worker 问题诊断和修复

## 当前问题
- Worker `https://media.shadowhub.app` 返回 "Not Found"
- 这说明 Worker 没有正确部署

## 快速验证 Worker 状态

在 B 账号 Cloudflare Dashboard 检查：
1. Workers & Pages
2. 找到 `media-shadowhub-app` 或类似名称的 Worker
3. 检查是否真的部署了
4. 检查是否有绑定的域名：`media.shadowhub.app`

## 如果 Worker 没有部署

### 步骤 1：创建 Worker

1. Cloudflare Dashboard > Workers & Pages
2. 点击 "Create application"
3. 选择 "Create Worker"
4. 命名为 `media-proxy`
5. 点击 "Deploy"

### 步骤 2：添加 Worker 代码

点击 "Quick edit" 或使用编辑器，粘贴 `worker-media-proxy.js` 的内容

### 步骤 3：绑定自定义域名

1. Workers & Pages > 你的 Worker
2. Settings > Triggers > Custom Domains
3. 添加域名：`media.shadowhub.app`
4. 等待 DNS 生效

### 步骤 4：（可选）绑定 R2 桶

如果需要直接访问 R2：
1. Worker Settings > R2
2. 绑定 R2 桶：变量名 `R2_BUCKET`
3. 选择 A 账号的 R2 桶

## 替代方案：使用 R2 公共域名 + CORS 配置

如果 Worker 太复杂，可以直接：
1. 在 R2 桶上配置 CORS（见 R2_CORS_INSTRUCTIONS.md）
2. 更新代码使用 R2 公共域名：`https://pub-7d4a9a2a7a544abab6159dcedc623ce2.r2.dev`
