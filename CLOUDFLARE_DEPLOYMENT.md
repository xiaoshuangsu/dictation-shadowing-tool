# Cloudflare Pages 部署指南

本项目已从 GitHub Pages 迁移到 Cloudflare Pages，提供更好的中国访问速度。

## 部署步骤

### 第一步：推送代码到 GitHub

确保所有代码已推送到 GitHub 仓库：

```bash
git add .
git commit -m "Add account system and profile features"
git push origin main
```

### 第二步：连接 Cloudflare Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧菜单"Workers & Pages"
3. 点击"创建应用程序" -> "Pages" -> "连接到 Git"
4. 选择 GitHub 仓库
5. 点击"开始设置"

### 第三步：配置构建设置

在 Cloudflare Pages 构建设置页面：

| 设置项 | 值 |
|--------|-----|
| 项目名称 | dictation-tool（或自定义） |
| 生产分支 | main |
| 构建命令 | `npm run build` |
| 构建输出目录 | `out` |
| 根目录 | `/`（留空） |
| Node.js 版本 | 20 |

### 第四步：添加环境变量

在"环境变量"部分，点击"添加变量"，添加以下三个变量：

```
NEXT_PUBLIC_LEANCLOUD_APP_ID=你的App ID
NEXT_PUBLIC_LEANCLOUD_APP_KEY=你的App Key
NEXT_PUBLIC_LEANCLOUD_SERVER_URL=https://xxx.leancloud.cn
```

**重要**：
- 这些变量与 `.env.local` 中的相同
- 在生产环境中，Cloudflare Pages 会自动使用这些值
- 不要在代码中硬编码这些值

### 第五步：部署

1. 点击"保存并部署"
2. 等待构建完成（约 2-3 分钟）
3. 构建成功后，Cloudflare 会提供：
   - `*.pages.dev` 域名（如：dictation-tool.pages.dev）
   - 自动 HTTPS
   - 全球 CDN

### 第六步：配置自定义域名（可选）

1. 在 Cloudflare Pages 项目中，点击"自定义域"
2. 添加你的域名（如：dictation.yourdomain.com）
3. Cloudflare 会自动配置 DNS 和 SSL

## 验证部署

### 1. 访问网站

打开浏览器访问你的 Cloudflare Pages URL

### 2. 测试完整流程

- [ ] 注册新用户
- [ ] 登录
- [ ] 完成一个练习
- [ ] 查看 Profile 页面
- [ ] 检查 LeanCloud 控制台是否有数据

### 3. 测试中国访问速度

- 从中国内地访问
- 目标延迟：< 500ms
- Cloudflare 在中国有多个节点，通常速度良好

### 4. 测试多设备

- [ ] 手机浏览器访问
- [ ] 不同浏览器（Chrome、Safari、Firefox）
- [ ] 登录状态持久化

## 环境变量管理

### 本地开发

使用 `.env.local` 文件（已在 .gitignore 中）：

```env
NEXT_PUBLIC_LEANCLOUD_APP_ID=xxx
NEXT_PUBLIC_LEANCLOUD_APP_KEY=xxx
NEXT_PUBLIC_LEANCLOUD_SERVER_URL=https://xxx.leancloud.cn
```

### Cloudflare Pages

在 Cloudflare Dashboard 中配置：

1. 进入项目 -> 设置 -> 环境变量
2. 添加生产环境变量
3. 也可添加预览环境变量（用于 pull request 预览）

### GitHub Actions（保留）

虽然主要使用 Cloudflare Pages，但 GitHub Actions 配置仍然保留，用于：
- 备份部署
- PR 预览

## 性能优化

### 自动优化

Cloudflare Pages 自动提供：
- 全球 CDN
- HTTP/2
- 自动压缩
- 缓存优化

### 手动优化建议

1. **图片优化**：本项目未使用图片，无需优化
2. **代码分割**：Next.js 自动完成
3. **静态资源**：自动上传到 Cloudflare CDN

## 监控和日志

### Cloudflare Analytics

1. 进入 Cloudflare Pages 项目
2. 点击"分析"查看：
   - 访问量
   - 地理分布
   - 性能指标

### 错误追踪

如需更详细的错误追踪，可集成：
- Sentry
- LogRocket
- Cloudflare Web Analytics

## 故障排除

### 构建失败

**问题**：构建时报错

**解决方案**：
1. 检查 Node.js 版本（应为 20）
2. 检查构建命令（应为 `npm run build`）
3. 检查输出目录（应为 `out`）
4. 查看构建日志中的错误信息

### 环境变量未生效

**问题**：LeanCloud 连接失败

**解决方案**：
1. 确认环境变量已正确添加
2. 确认变量名以 `NEXT_PUBLIC_` 开头
3. 重新部署项目
4. 检查 LeanCloud App ID 和 Key 是否正确

### 登录状态不持久

**问题**：刷新页面后登录丢失

**解决方案**：
1. 检查浏览器 localStorage 是否被禁用
2. 检查浏览器隐私设置
3. 尝试清除缓存后重新登录

### 中国访问慢

**问题**：从中国内地访问慢

**解决方案**：
1. Cloudflare 在中国的节点通常很快
2. 如果仍慢，可能是 LeanCloud API 的延迟
3. LeanCloud 在国内有节点，应该很快
4. 检查是否有其他网络问题

## 成本

### Cloudflare Pages

- **免费版**：无限请求、无限带宽
- **限制**：每月 500 次构建
- **本项目**：完全够用

### LeanCloud

- **免费版**：5000 用户、2GB 数据库
- **本项目**：个人使用完全够用

总成本：**完全免费** ✅

## 回滚到 GitHub Pages

如果需要回滚到 GitHub Pages：

1. 在 GitHub Repository -> Settings -> Pages
2. Source: 选择 GitHub Actions
3. Workflow 文件已保留：`.github/workflows/nextjs.yml`
4. 确保 GitHub Actions secrets 已配置

## 下一步优化

### V1.0（当前）

- [x] 用户注册/登录
- [x] 练习数据保存
- [x] Profile 页面
- [x] 基础统计

### V1.1（未来）

- [ ] 数据导出功能
- [ ] 7 天正确率趋势图
- [ ] 成就系统
- [ ] 社交分享

### V2.0（未来）

- [ ] 多音频课程支持
- [ ] 间隔重复系统（SRS）
- [ ] 自定义练习计划
- [ ] 移动端优化

## 支持

如有问题，请：
1. 查看 [LeanCloud 文档](https://leancloud.cn/docs/)
2. 查看 [Cloudflare Pages 文档](https://developers.cloudflare.com/pages)
3. 提交 GitHub Issue
